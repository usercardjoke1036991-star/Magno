// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IQuatriviumCreditView {
    function redGenealogica(address usuario) external view returns (address padre, bool bonoActivacionCobrado);
    function esMoroso(address usuario) external view returns (bool);
    function paused() external view returns (bool);
    function attester() external view returns (address);
    function obtenerProgresoUsuario(address usuario)
        external
        view
        returns (uint256 nivelActual, uint256 solicitudesCompletadas, uint256 ultimoPrestamoTimestamp);
    function admins(address) external view returns (bool);
}

/**
 * @title QuatriviumReserva
 * @notice Hermano del crédito: bloqueo de USDT 30 días con techo de 12% anual.
 *         El principal vuelve. El rendimiento sale de un bote aparte, no del pool de préstamos.
 *         EIP-170: no vive en QuatriviumCredit.
 */
contract QuatriviumReserva is ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    uint256 public constant LOCK = 30 days;
    uint256 public constant MAX_APY_BP = 1200;
    uint256 public constant YEAR = 365 days;
    uint256 public constant TRAMO_MEDIO = 50e18;
    uint256 public constant TRAMO_ALTO = 500e18;
    uint256 public constant NIVEL_MINIMO = 10;

    IERC20 public immutable token;
    address public owner;
    address public fundador;
    address public credit;
    uint256 public bote;

    struct Posicion {
        uint256 principal;
        uint256 desde;
        bool activa;
        bool enRed;
    }

    mapping(address => Posicion) public posiciones;
    mapping(address => uint256) public boostPagado;
    mapping(bytes32 => bool) public boostUsado;

    error SoloOwner();
    error NoAutorizado();
    error SoloEOA();
    error MontoCero();
    error PeriodoActivo();
    error NadaQueMover();
    error AunBloqueado();
    error EnMora();
    error CreditoPausado();
    error CreditNoPausado();
    error DestinoCero();
    error YaPagado();
    error NivelInsuficiente();
    error SoloAdmin();

    event Bloqueado(address indexed usuario, uint256 monto, uint256 desbloqueo);
    event Desbloqueado(address indexed usuario, uint256 principal, uint256 rendimiento, uint256 corteFundador);
    event Renovado(address indexed usuario, uint256 principal, uint256 rendimiento, uint256 corteFundador);
    event BoteAportado(address indexed de, uint256 monto);
    event BoostComision(address indexed beneficiario, uint256 montoBase, uint256 extra, uint256 corteFundador);
    event FundadorCambiado(address indexed next);
    event CreditCambiado(address indexed next);

    modifier onlyOwner() {
        if (msg.sender != owner) revert SoloOwner();
        _;
    }

    modifier onlyEOA() {
        if (tx.origin != msg.sender) revert SoloEOA();
        _;
    }

    constructor(address token_, address fundador_, address credit_) {
        if (token_ == address(0) || fundador_ == address(0) || credit_ == address(0)) revert DestinoCero();
        token = IERC20(token_);
        owner = msg.sender;
        fundador = fundador_;
        credit = credit_;
    }

    function tramo(uint256 principal) public pure returns (uint256) {
        if (principal >= TRAMO_ALTO) return 3;
        if (principal >= TRAMO_MEDIO) return 2;
        return 1;
    }

    function boostRedBp(uint256 t) public pure returns (uint256) {
        if (t == 3) return 2000;
        if (t == 2) return 1000;
        return 0;
    }

    function corteFundadorBp(uint256 t) public pure returns (uint256) {
        if (t == 3) return 1200;
        if (t == 2) return 800;
        return 500;
    }

    function techoRendimiento(uint256 principal, uint256 elapsed) public pure returns (uint256) {
        if (elapsed > LOCK) elapsed = LOCK;
        return (principal * MAX_APY_BP * elapsed) / (10000 * YEAR);
    }

    function desbloqueoDe(address usuario) public view returns (uint256) {
        Posicion memory p = posiciones[usuario];
        if (!p.activa) return 0;
        return p.desde + LOCK;
    }

    function bloquear(uint256 monto) external onlyEOA whenNotPaused nonReentrant {
        if (monto == 0) revert MontoCero();
        Posicion storage p = posiciones[msg.sender];
        if (p.activa) revert PeriodoActivo();
        _exigirNuevoPeriodo();

        bool enRed = false;
        if (credit != address(0)) {
            (address padre,) = IQuatriviumCreditView(credit).redGenealogica(msg.sender);
            enRed = padre != address(0);
        }

        token.safeTransferFrom(msg.sender, address(this), monto);
        posiciones[msg.sender] = Posicion(monto, block.timestamp, true, enRed);
        boostPagado[msg.sender] = 0;
        emit Bloqueado(msg.sender, monto, block.timestamp + LOCK);
    }

    function desbloquear() external onlyEOA nonReentrant {
        (uint256 principal, uint256 userPay, uint256 founderCut) = _cerrar(false);
        emit Desbloqueado(msg.sender, principal, userPay, founderCut);
    }

    function renovar() external onlyEOA whenNotPaused nonReentrant {
        _exigirNuevoPeriodo();
        (uint256 principal, uint256 userPay, uint256 founderCut) = _cerrar(true);
        emit Renovado(msg.sender, principal, userPay, founderCut);
    }

    function aportarBote(uint256 monto) external onlyEOA whenNotPaused nonReentrant {
        if (msg.sender != owner && !_esOwnerCredit() && !_esAdminCredit()) revert SoloAdmin();
        if (monto == 0) revert MontoCero();
        token.safeTransferFrom(msg.sender, address(this), monto);
        bote += monto;
        emit BoteAportado(msg.sender, monto);
    }

    /// @notice Extra sobre una comisión de red ya pagada por Credit. Sale del bote, no del pool.
    ///         Lo llama el attester (o el owner) con un id único por evento. El fundador cobra su tramo del extra.
    function pagarBoostComision(address beneficiario, uint256 montoBase, bytes32 id)
        external
        onlyEOA
        whenNotPaused
        nonReentrant
    {
        if (msg.sender != owner && !_esAttesterCredit()) revert NoAutorizado();
        if (id == bytes32(0) || boostUsado[id]) revert YaPagado();
        if (beneficiario == address(0) || montoBase == 0) revert MontoCero();

        (uint256 extra, uint256 founderCut) = extraComisionDe(beneficiario, montoBase);
        if (extra == 0) revert NadaQueMover();

        boostUsado[id] = true;
        boostPagado[beneficiario] += extra;
        bote -= extra;
        uint256 userPay = extra - founderCut;
        if (userPay > 0) token.safeTransfer(beneficiario, userPay);
        if (founderCut > 0) token.safeTransfer(fundador, founderCut);
        emit BoostComision(beneficiario, montoBase, extra, founderCut);
    }

    /// @dev Tope del extra = % del principal bloqueado (mismo boost del tramo). No drena el bote de un solo evento.
    function extraComisionDe(address beneficiario, uint256 montoBase) public view returns (uint256 extra, uint256 founderCut) {
        Posicion memory p = posiciones[beneficiario];
        if (!p.activa || montoBase == 0) return (0, 0);
        uint256 t = tramo(p.principal);
        extra = (montoBase * boostRedBp(t)) / 10000;
        uint256 tope = (p.principal * boostRedBp(t)) / 10000;
        uint256 ya = boostPagado[beneficiario];
        if (ya >= tope) return (0, 0);
        uint256 room = tope - ya;
        if (extra > room) extra = room;
        if (extra > bote) extra = bote;
        founderCut = (extra * corteFundadorBp(t)) / 10000;
    }

    function setFundador(address next) external onlyOwner {
        if (next == address(0)) revert DestinoCero();
        fundador = next;
        emit FundadorCambiado(next);
    }

    function setCredit(address next) external onlyOwner {
        if (next == address(0)) revert DestinoCero();
        credit = next;
        emit CreditCambiado(next);
    }

    function setOwner(address next) external onlyOwner {
        if (next == address(0)) revert DestinoCero();
        owner = next;
    }

    function pausar() external {
        if (msg.sender != owner && !_esOwnerCredit()) revert SoloOwner();
        _pause();
    }

    function despausar() external onlyOwner {
        _unpause();
    }

    /// @dev Cualquiera puede alinear la pausa de Reserva si Credit ya está pausado. No usa la llave de owner.
    function syncPauseFromCredit() external {
        if (credit == address(0)) revert DestinoCero();
        if (!IQuatriviumCreditView(credit).paused()) revert CreditNoPausado();
        if (!paused()) _pause();
    }

    function _esOwnerCredit() internal view returns (bool) {
        (bool ok, bytes memory data) = credit.staticcall(abi.encodeWithSignature("owner()"));
        if (!ok || data.length < 32) return false;
        return abi.decode(data, (address)) == msg.sender;
    }

    function _esAttesterCredit() internal view returns (bool) {
        (bool ok, bytes memory data) = credit.staticcall(abi.encodeWithSignature("attester()"));
        if (!ok || data.length < 32) return false;
        return abi.decode(data, (address)) == msg.sender;
    }

    function _esAdminCredit() internal view returns (bool) {
        (bool ok, bytes memory data) = credit.staticcall(abi.encodeWithSignature("admins(address)", msg.sender));
        if (!ok || data.length < 32) return false;
        return abi.decode(data, (bool));
    }

    /// @dev Bloquear/renovar respetan mora, pausa y nivel 10. Desbloquear no, para no atrapar el principal.
    function _exigirNuevoPeriodo() internal view {
        if (credit == address(0)) return;
        IQuatriviumCreditView vista = IQuatriviumCreditView(credit);
        if (vista.paused()) revert CreditoPausado();
        if (vista.esMoroso(msg.sender)) revert EnMora();
        (uint256 nivel,,) = vista.obtenerProgresoUsuario(msg.sender);
        if (nivel < NIVEL_MINIMO) revert NivelInsuficiente();
    }

    function _cerrar(bool renovarPos) internal returns (uint256 principal, uint256 userPay, uint256 founderCut) {
        Posicion storage p = posiciones[msg.sender];
        if (!p.activa) revert NadaQueMover();
        if (block.timestamp < p.desde + LOCK) revert AunBloqueado();

        principal = p.principal;
        (userPay, founderCut) = _pagarRendimiento(p);

        if (renovarPos) {
            p.desde = block.timestamp;
            boostPagado[msg.sender] = 0;
            if (credit != address(0)) {
                (address padre,) = IQuatriviumCreditView(credit).redGenealogica(msg.sender);
                p.enRed = padre != address(0);
            }
        } else {
            delete posiciones[msg.sender];
            delete boostPagado[msg.sender];
            token.safeTransfer(msg.sender, principal);
        }
        if (userPay > 0) token.safeTransfer(msg.sender, userPay);
        if (founderCut > 0) token.safeTransfer(fundador, founderCut);
    }

    function _pagarRendimiento(Posicion memory p) internal returns (uint256 userPay, uint256 founderCut) {
        uint256 elapsed = block.timestamp - p.desde;
        uint256 techo = techoRendimiento(p.principal, elapsed);
        uint256 t = tramo(p.principal);
        uint256 grosso = techo < bote ? techo : bote;
        founderCut = (grosso * corteFundadorBp(t)) / 10000;
        userPay = grosso - founderCut;
        if (p.enRed) {
            uint256 extra = (userPay * boostRedBp(t)) / 10000;
            uint256 leftover = bote - grosso;
            if (extra > leftover) extra = leftover;
            if (userPay + extra > techo) extra = techo - userPay;
            userPay += extra;
            grosso += extra;
        }
        bote -= grosso;
    }
}
