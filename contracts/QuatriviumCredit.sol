// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AggregatorV3Interface} from "./interfaces/AggregatorV3Interface.sol";
import {LoanTierSeed} from "./libraries/LoanTierSeed.sol";
import {Usuario} from "./libraries/Usuario.sol";
import {QuatriviumFamaLib} from "./libraries/QuatriviumFamaLib.sol";

/**
 * @title Quatrivium Finance
 * @notice Microcredito sin colateral + red Unilevel de flujo estrictamente ascendente.
 *         El principal vuelve integro al pool. El interes se reparte (red + pool) con suma cero.
 *         Oraculo, pausa de emergencia y admin con timelock + confirmaciones.
 *
 * Escala: 1000 niveles, $1 a $1 000 000. 1-100 en LoanTierSeed; 101-1000 por formula en _tier.
 * Nivel 1 = 1e18 (1 USDT). El bono de 1 USDT al padrino sale del pool
 * (caja libre con piso) cuando el referido pide y paga su primer L1.
 * El fundador cobra un recorte fijo de cada interes. Si una llave se compromete,
 * las otras fundadoras pueden reasignar fundador y owner (timelock + confirmaciones).
 * Las comisiones de red recorren toda la linea hacia arriba (no se cortan a 5).
 * Fama de caja: donar/aportar (no la puerta), racha y red generacional desde gen 2.
 *
 * EIP-170: ESTE archivo no puede pasar de 24576 bytes (limite de Ethereum, no nuestro).
 * El protocolo no se recorta: cada pieza nueva vive en un hermano o libreria
 * (QuatriviumLeveling, QuatriviumFamaLib, etc.), cada uno con su propio tope.
 */
contract QuatriviumCredit is ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    uint256 public constant TIMELOCK_DELAY = 72 hours;
    uint256 public constant COOLDOWN_PRESTAMO = 48 hours;
    uint256 internal constant GRACIA_MORA = 30 days;
    uint256 internal constant FAMA_POR_DIA_MORA = 10;
    uint256 public constant ORIGINATION_WINDOW = 1 days;
    uint256 public constant MAX_ADMINS = 3;
    uint256 internal constant MAX_NIVEL_TOTAL = 1000;

    /// @notice Bono Ãºnico al referidor directo cuando el referido paga su primer Nivel 1 (1 USDT del pool).
    uint256 public constant BONO_ACTIVACION = 1e18;
    uint8 internal constant MAX_LINEA = 40;
    uint256 internal constant REPUTACION_INICIAL = 100;
    uint256 public constant PUNTOS_POR_REFERIDO = 50;
    uint256 public constant UMBRAL_BONO_RED = 250;
    uint256 public constant BONO_RED_USDT = 5e17;
    uint256 internal constant BONO_RED_PISO_CAJA_BP = 2000;
    /// @notice Bono de hito = 20 USDT Ã— nivel (100 â†’ 2000, 1000 â†’ 20 000).
    /// @dev 15% fundador + 15/8/6/4/2% las primeras 5 generaciones. El resto va al pool;
    ///      generaciones 6+ toman de ese resto (0,8% y luego 0,4%) sin bajar del piso del pool.
    uint256 internal constant POOL_RECURRENTE_BP = 5000;
    uint256 internal constant POOL_FLOOR_BP = 4000;
    uint256 internal constant FUNDADOR_BP = 1500;
    uint256 internal constant GEN1_BP = 1500;
    uint256 internal constant GEN2_BP = 800;
    uint256 internal constant GEN3_BP = 600;
    uint256 internal constant GEN4_BP = 400;
    uint256 internal constant GEN5_BP = 200;

    mapping(address => IERC20) public stableTokens;
    mapping(address => bool) public supportedToken;
    mapping(address => AggregatorV3Interface) public priceFeeds;
    address payable public feeCollector;
    address payable public owner;
    address public fundador;
    uint256 public feeBasisPoints;

    mapping(address => bool) public admins;
    address[] public ownerList;
    uint256 public requiredConfirmations;
    mapping(bytes4 => bool) public allowedAdminSelector;

    struct AdminProposal {
        address proposer;
        uint256 eta;
        bytes data;
        uint256 confirms;
        bool executed;
        bool cancelled;
    }
    uint256 public proposalCount;
    mapping(uint256 => AdminProposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public confirmed;

    mapping(address => uint256) public totalLiquidity;
    mapping(address => uint256) public outstandingLoans;
    mapping(address => mapping(address => uint256)) public lpShares;
    mapping(address => uint256) public totalShares;
    mapping(address => uint256) public collectedFees;

    uint256 public originationsInWindow;
    uint256 public originationWindowStart;
    uint256 public maxOriginationsPerWindow = 50;
    uint256 public maxUtilizationBps = 8000;

    struct Level { uint256 montoPrestamo; uint256 plazo; uint256 tasaInteresBP; }
    mapping(uint256 => Level) private _niveles;

    struct PosicionCredito {
        uint256 nivelActual;
        uint256 montoActivo;
        uint256 vencimiento;
        bool enMora;
        address monedaActivo;
        uint256 tasaAplicadaBP;
    }
    mapping(address => PosicionCredito) public usuarios;

    /// @notice Nodo Unilevel. Registro orgÃ¡nico cuelga del `fundador`.
    mapping(address => Usuario) public redGenealogica;
    mapping(address => uint256) public prestamosCerrados;

    struct PlanPago {
        uint128 pagado;
        uint64 venceCuota;
        uint8 totales;
        uint8 pagadas;
        bool enPlazo;
    }
    mapping(address => PlanPago) public planPago;

    mapping(address => bool) public humanosVerificados;
    mapping(address => bool) public blacklist;
    mapping(address => bool) public esMoroso;
    mapping(address => uint256) internal moraDesde;
    mapping(address => uint256) internal moraDiasCobrados;
    mapping(address => uint256) public reputacion;
    mapping(address => uint256) public puntosRed;
    mapping(address => uint256) public bonosRedCobrados;
    mapping(address => uint256) public prestamosPagadosATiempo;
    mapping(address => uint256) public prestamosMorosos;
    mapping(address => uint256) public penalizacionesAcumuladas;

    struct ProgresoNivel {
        uint256 nivelActual;
        uint256 solicitudesCompletadas;
        uint256 ultimoPrestamoTimestamp;
    }
    mapping(address => ProgresoNivel) public progresoUsuarios;
    /// @notice Ãšltimo hito de 100 cobrado (0, 100, 200â€¦ 1000).
    mapping(address => uint256) public hitoCobrado;
    /// @notice USDT donado al fundador (no entra al pool).
    mapping(address => uint256) public donado;

    uint256 public tasaBaseBP;
    uint256 public puntoOptimoUtilBP;
    uint256 public pendiente1BP;
    uint256 public pendiente2BP;
    uint256 public puntosPorPagoATiempo;
    uint256 public penalizacionPorMora;
    uint256 public reputacionThresholdGovernance;
    mapping(address => bool) public kycDeclarado;
    bool public kycExigido = true;

    /// @notice Firmante del worker OTP. Un telÃ©fono y un dispositivo â†’ una sola wallet.
    address public attester;
    bool public identidadExigida = true;
    mapping(address => bytes32) public phoneHashOf;
    mapping(address => bytes32) public deviceHashOf;
    mapping(bytes32 => address) public walletOfPhone;
    mapping(bytes32 => address) public walletOfDevice;
    mapping(address => uint256) public attestNonce;
    mapping(address => bool) public cuentaDestruida;
    /// @notice Hermano de fama/canje. Se crea en el constructor (no cabe en este bytecode).
    address public immutable famaHermano;

    event HumanoVerificado(address indexed usuario);
    event AfiliadoRegistrado(address indexed usuario, address indexed padre);
    event BonoActivacionPagado(address indexed padre, address indexed referido, uint256 monto, address indexed token);
    event ComisionGeneracional(address indexed beneficiario, address indexed deudor, uint8 generacion, uint256 monto, address indexed token);
    event InteresRetenidoPool(address indexed token, uint256 monto);
    event InteresDistribuido(
        address indexed deudor,
        address indexed token,
        uint256 interes,
        uint256 comisionesRed,
        uint256 retenidoPool,
        bool bonoActivacion
    );
    event LiquidezAportada(address indexed proveedor, uint256 monto, address indexed token);
    event PrestamoEmitido(address indexed usuario, uint256 monto, uint256 vencimiento, address indexed token);
    event PrestamoPagado(address indexed usuario, uint256 montoPrincipal, uint256 fee, address indexed token);
    event LiquidationExecuted(address indexed liquidator, address indexed user, address indexed token, uint256 paidAmount, uint256 reward);
    event LoanLiquidated(address indexed deudor, address indexed liquidador, address indexed token, uint256 monto);
    event NivelActualizado(address indexed usuario, uint256 nuevoNivel);
    event MorosityUpdated(address indexed usuario, bool esMoroso);
    event ReputationUpdated(address indexed usuario, uint256 nuevaReputacion);
    event PuntosRed(address indexed usuario, uint256 puntos);
    event BonoRedPagado(address indexed usuario, uint256 umbral, uint256 monto, address indexed token);
    event BonoHitoPagado(address indexed usuario, uint256 hito, uint256 monto, address indexed token);
    event Donacion(address indexed usuario, uint256 monto, address indexed token);
    event AdminActionProposed(uint256 indexed id, address indexed proposer, bytes4 selector, uint256 eta);
    event AdminActionConfirmed(uint256 indexed id, address indexed admin, uint256 confirms);
    event AdminActionCancelled(uint256 indexed id, address indexed admin);
    event AdminActionExecuted(uint256 indexed id, bytes4 selector);
    event AdminAdded(address indexed admin);
    event AdminRemoved(address indexed admin);
    event OwnerTransferred(address indexed previousOwner, address indexed newOwner);
    event FundadorUpdated(address indexed previous, address indexed next);
    event SecurityParamsUpdated(uint256 maxOriginations, uint256 maxUtilizationBps);
    event FeeCollectorUpdated(address indexed newCollector);
    event KycDeclarado(address indexed usuario);
    event KycExigidoUpdated(bool exigido);
    event IdentidadVinculada(address indexed usuario, bytes32 phoneHash, bytes32 deviceHash);
    event IdentidadExigidaUpdated(bool exigido);
    event AttesterUpdated(address indexed attester);
    event CuentaDestruida(address indexed usuario, address indexed token, uint256 confiscado);

    modifier onlyAdmin() {
        require(admins[msg.sender], "only admin");
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "only owner");
        _;
    }

    modifier onlySelf() {
        require(msg.sender == address(this), "only timelock");
        _;
    }

    modifier onlySupportedToken(address token) {
        require(supportedToken[token], "unsupported token");
        _;
    }

    constructor(
        address _usdtAddress,
        address _usdtFeed,
        address payable _feeCollector,
        uint256 _feeBP,
        address[] memory _initialAdmins,
        uint256 _requiredConfirmations,
        address _famaHermano
    ) {
        require(_usdtAddress != address(0), "zero token");
        require(_usdtFeed != address(0), "feed required");
        require(_feeCollector != address(0), "zero fee collector");
        require(_feeBP <= 1000, "fee too high");
        require(_famaHermano != address(0) && _famaHermano != address(this), "fama");
        require(_initialAdmins.length >= 1 && _initialAdmins.length <= MAX_ADMINS, "bad admins");
        require(
            _requiredConfirmations >= 1 && _requiredConfirmations <= _initialAdmins.length,
            "bad confirms"
        );

        stableTokens[_usdtAddress] = IERC20(_usdtAddress);
        supportedToken[_usdtAddress] = true;
        priceFeeds[_usdtAddress] = AggregatorV3Interface(_usdtFeed);
        feeCollector = _feeCollector;
        feeBasisPoints = _feeBP;
        requiredConfirmations = _requiredConfirmations;

        owner = payable(_initialAdmins[0]);
        fundador = _initialAdmins[0];
        attester = _initialAdmins[0];
        humanosVerificados[fundador] = true;
        redGenealogica[fundador] = Usuario({ padre: address(0), bonoActivacionCobrado: true });
        progresoUsuarios[fundador].nivelActual = 1;
        reputacion[fundador] = REPUTACION_INICIAL;
        emit HumanoVerificado(fundador);
        emit AfiliadoRegistrado(fundador, address(0));

        for (uint256 i = 0; i < _initialAdmins.length; i++) {
            address admin = _initialAdmins[i];
            require(admin != address(0), "zero admin");
            require(!admins[admin], "dup admin");
            admins[admin] = true;
            ownerList.push(admin);
        }
        _syncQuorum();

        (uint16[100] memory usd, uint16[100] memory bps, uint8[100] memory dias) = LoanTierSeed.tables();
        for (uint256 i = 0; i < LoanTierSeed.MAX_NIVEL; i++) {
            _niveles[i + 1] = Level({
                montoPrestamo: uint256(usd[i]) * 1e18,
                plazo: uint256(dias[i]) * 1 days,
                tasaInteresBP: uint256(bps[i])
            });
        }
        _assertAntiSybilNivel1(_niveles[1].montoPrestamo, _niveles[1].tasaInteresBP);
        require(
            POOL_RECURRENTE_BP + FUNDADOR_BP + GEN1_BP + GEN2_BP + GEN3_BP + GEN4_BP + GEN5_BP == 10000,
            "bad recurrent split"
        );

        tasaBaseBP = 100;
        puntoOptimoUtilBP = 8000;
        pendiente1BP = 400;
        pendiente2BP = 2000;
        puntosPorPagoATiempo = 100;
        penalizacionPorMora = 200;
        reputacionThresholdGovernance = 1000;

        allowedAdminSelector[this.setFeeBP.selector] = true;
        allowedAdminSelector[this.setNivel.selector] = true;
        allowedAdminSelector[this.setTokenConfig.selector] = true;
        allowedAdminSelector[this.setInterestModelParams.selector] = true;
        allowedAdminSelector[this.setReputationParams.selector] = true;
        allowedAdminSelector[this.setMorosidad.selector] = true;
        allowedAdminSelector[this.banWallet.selector] = true;
        allowedAdminSelector[this.despausarContrato.selector] = true;
        allowedAdminSelector[this.setFeeCollector.selector] = true;
        allowedAdminSelector[this.addAdmin.selector] = true;
        allowedAdminSelector[this.removeAdmin.selector] = true;
        allowedAdminSelector[this.setOwner.selector] = true;
        allowedAdminSelector[this.setFundador.selector] = true;
        allowedAdminSelector[this.setRequiredConfirmations.selector] = true;
        allowedAdminSelector[this.setSecurityParams.selector] = true;
        allowedAdminSelector[this.setAttester.selector] = true;
        allowedAdminSelector[this.setKycExigido.selector] = true;
        allowedAdminSelector[this.setIdentidadExigida.selector] = true;
        allowedAdminSelector[this.retirarComisiones.selector] = true;
        allowedAdminSelector[this.retirarComisionesToken.selector] = true;
        famaHermano = _famaHermano;
    }

    function _syncQuorum() internal {
        if (ownerList.length >= 3) {
            requiredConfirmations = 2;
        }
    }

    function _requiredConfirms() internal view returns (uint256) {
        uint256 n = ownerList.length;
        if (n >= 3) return 2;
        uint256 req = requiredConfirmations;
        if (req > n) return n;
        if (req == 0) return 1;
        return req;
    }

    function proposeAdminAction(bytes calldata data) external onlyAdmin returns (uint256 id) {
        require(data.length >= 4, "bad data");
        bytes4 sel = bytes4(data);
        require(allowedAdminSelector[sel], "selector not allowed");
        id = ++proposalCount;
        proposals[id] = AdminProposal({
            proposer: msg.sender,
            eta: block.timestamp + TIMELOCK_DELAY,
            data: data,
            confirms: 1,
            executed: false,
            cancelled: false
        });
        confirmed[id][msg.sender] = true;
        emit AdminActionProposed(id, msg.sender, sel, proposals[id].eta);
    }

    function confirmAdminAction(uint256 id) external onlyAdmin {
        AdminProposal storage p = proposals[id];
        require(p.eta != 0 && !p.executed && !p.cancelled, "closed");
        require(!confirmed[id][msg.sender], "already confirmed");
        confirmed[id][msg.sender] = true;
        p.confirms += 1;
        emit AdminActionConfirmed(id, msg.sender, p.confirms);
    }

    function cancelAdminAction(uint256 id) external onlyAdmin {
        AdminProposal storage p = proposals[id];
        require(p.eta != 0 && !p.executed && !p.cancelled, "closed");
        require(msg.sender == p.proposer, "only proposer");
        p.cancelled = true;
        emit AdminActionCancelled(id, msg.sender);
    }

    function executeAdminAction(uint256 id) external nonReentrant onlyAdmin {
        AdminProposal storage p = proposals[id];
        require(p.eta != 0 && !p.executed && !p.cancelled, "closed");
        require(block.timestamp >= p.eta, "timelock");
        require(p.confirms >= _requiredConfirms(), "confirmations");
        bytes4 sel = bytes4(p.data);
        require(allowedAdminSelector[sel], "selector not allowed");
        p.executed = true;
        (bool ok, ) = address(this).call(p.data);
        require(ok);
        emit AdminActionExecuted(id, sel);
    }

    function pausarContrato() external onlyAdmin {
        _pause();
    }

    function despausarContrato() external onlySelf {
        _unpause();
    }

    function setFeeBP(uint256 _feeBP) external onlySelf {
        require(_feeBP <= 1000, "fee too high");
        feeBasisPoints = _feeBP;
    }

    function setNivel(uint256 id, uint256 montoPrestamo, uint256 plazo, uint256 tasaInteresBP) external onlySelf {
        require(id >= 1 && id <= LoanTierSeed.MAX_NIVEL, "invalid tier");
        require(montoPrestamo > 0 && montoPrestamo <= LoanTierSeed.MAX_MONTO, "invalid amount");
        require(plazo >= 1 days && plazo <= 365 days, "invalid term");
        require(tasaInteresBP <= 10000, "tier rate too high");
        if (id == 1) {
            _assertAntiSybilNivel1(montoPrestamo, tasaInteresBP);
        }
        _niveles[id] = Level({ montoPrestamo: montoPrestamo, plazo: plazo, tasaInteresBP: tasaInteresBP });
    }

    function _assertAntiSybilNivel1(uint256 montoPrestamo, uint256 tasaInteresBP) internal pure {
        uint256 interes = (montoPrestamo * tasaInteresBP) / 10000;
        uint256 extracto = (BONO_RED_USDT * PUNTOS_POR_REFERIDO) / UMBRAL_BONO_RED;
        require(interes > extracto, "L1 interest must exceed referral extract");
    }

    function setTokenConfig(address token, address feed, bool enabled) external onlySelf {
        require(token != address(0), "zero token");
        if (enabled) {
            require(feed != address(0), "feed required");
            supportedToken[token] = true;
            stableTokens[token] = IERC20(token);
            priceFeeds[token] = AggregatorV3Interface(feed);
        } else {
            require(outstandingLoans[token] == 0, "open loans");
            supportedToken[token] = false;
            delete stableTokens[token];
            delete priceFeeds[token];
        }
    }

    function setInterestModelParams(
        uint256 _tasaBaseBP,
        uint256 _puntoOptimoUtilBP,
        uint256 _pendiente1BP,
        uint256 _pendiente2BP
    ) external onlySelf {
        require(_puntoOptimoUtilBP > 0 && _puntoOptimoUtilBP < 10000, "invalid optimal");
        require(_tasaBaseBP <= 2000, "base too high");
        require(_pendiente1BP <= 5000, "slope1 too high");
        require(_pendiente2BP <= 10000, "slope2 too high");
        tasaBaseBP = _tasaBaseBP;
        puntoOptimoUtilBP = _puntoOptimoUtilBP;
        pendiente1BP = _pendiente1BP;
        pendiente2BP = _pendiente2BP;
    }

    function setReputationParams(uint256 _puntosPago, uint256 _penalizacion, uint256 _thresholdGov) external onlySelf {
        require(_puntosPago > 0 && _puntosPago <= 10000, "invalid points");
        require(_penalizacion > 0 && _penalizacion <= 5000, "invalid penalty");
        require(_thresholdGov > 0 && _thresholdGov <= 100000, "invalid threshold");
        puntosPorPagoATiempo = _puntosPago;
        penalizacionPorMora = _penalizacion;
        reputacionThresholdGovernance = _thresholdGov;
    }

    function setMorosidad(address usuario, bool moroso) external onlySelf {
        esMoroso[usuario] = moroso;
        usuarios[usuario].enMora = moroso;
        emit MorosityUpdated(usuario, moroso);
    }

    function banWallet(address _addr, bool _banned) external onlySelf {
        blacklist[_addr] = _banned;
    }

    function setFeeCollector(address newCollector) external onlySelf {
        require(newCollector != address(0), "zero address");
        feeCollector = payable(newCollector);
        emit FeeCollectorUpdated(newCollector);
    }

    function addAdmin(address newAdmin) external onlySelf {
        require(newAdmin != address(0), "zero admin");
        require(!admins[newAdmin], "already admin");
        require(ownerList.length < MAX_ADMINS, "max owners reached");
        admins[newAdmin] = true;
        ownerList.push(newAdmin);
        _syncQuorum();
        emit AdminAdded(newAdmin);
    }

    function removeAdmin(address admin) external onlySelf {
        require(admins[admin], "not admin");
        require(ownerList.length > _requiredConfirms(), "would break quorum");
        require(admin != owner, "cannot remove owner");
        admins[admin] = false;
        for (uint256 i = 0; i < ownerList.length; i++) {
            if (ownerList[i] == admin) {
                ownerList[i] = ownerList[ownerList.length - 1];
                ownerList.pop();
                break;
            }
        }
        emit AdminRemoved(admin);
    }

    function setOwner(address newOwner) external onlySelf {
        require(newOwner != address(0), "zero owner");
        require(admins[newOwner], "must be admin");
        address previous = owner;
        owner = payable(newOwner);
        emit OwnerTransferred(previous, newOwner);
    }

    function setFundador(address next) external onlySelf {
        require(next != address(0), "zero founder");
        require(admins[next], "must be admin");
        address previous = fundador;
        fundador = next;
        if (!humanosVerificados[next]) {
            humanosVerificados[next] = true;
            redGenealogica[next] = Usuario({ padre: address(0), bonoActivacionCobrado: true });
            if (progresoUsuarios[next].nivelActual == 0) {
                progresoUsuarios[next].nivelActual = 1;
            }
            if (reputacion[next] == 0) {
                reputacion[next] = REPUTACION_INICIAL;
            }
            emit HumanoVerificado(next);
            emit AfiliadoRegistrado(next, address(0));
        }
        emit FundadorUpdated(previous, next);
    }

    function setRequiredConfirmations(uint256 _required) external onlySelf {
        if (ownerList.length >= 3) {
            requiredConfirmations = 2;
            return;
        }
        require(_required >= 1 && _required <= ownerList.length, "bad confirms");
        requiredConfirmations = _required;
    }

    function setSecurityParams(
        uint256 _maxOriginationsPerWindow,
        uint256 _maxUtilizationBps
    ) external onlySelf {
        require(_maxOriginationsPerWindow >= 1 && _maxOriginationsPerWindow <= 10000, "bad cap");
        require(_maxUtilizationBps >= 1000 && _maxUtilizationBps <= 9500, "bad util");
        maxOriginationsPerWindow = _maxOriginationsPerWindow;
        maxUtilizationBps = _maxUtilizationBps;
        emit SecurityParamsUpdated(_maxOriginationsPerWindow, _maxUtilizationBps);
    }

    function retirarComisiones() external onlySelf {
        uint256 balance = address(this).balance;
        require(balance > 0, "no native balance");
        (bool ok, ) = feeCollector.call{value: balance}("");
        require(ok, "ETH transfer failed");
    }

    function retirarComisionesToken(address token) external onlySelf onlySupportedToken(token) {
        uint256 fees = collectedFees[token];
        require(fees > 0, "no token fees");
        collectedFees[token] = 0;
        stableTokens[token].safeTransfer(feeCollector, fees);
    }

    function registrarHumanoConPadre(address _padre) external whenNotPaused {
        require(msg.sender == tx.origin, "no contracts");
        require(!cuentaDestruida[msg.sender], "dead");
        require(!humanosVerificados[msg.sender], "already registered");
        require(!blacklist[msg.sender], "blacklisted");
        require(msg.sender != fundador, "already registered");

        address padre = _padre == address(0) ? fundador : _padre;
        require(padre != msg.sender, "self referral");
        require(humanosVerificados[padre], "padre not registered");
        require(!blacklist[padre], "padre blacklisted");
        require(padre != address(this), "invalid padre");

        if (progresoUsuarios[msg.sender].nivelActual == 0) {
            progresoUsuarios[msg.sender].nivelActual = 1;
        }
        if (reputacion[msg.sender] == 0) {
            reputacion[msg.sender] = REPUTACION_INICIAL;
        }

        redGenealogica[msg.sender] = Usuario({ padre: padre, bonoActivacionCobrado: false });
        humanosVerificados[msg.sender] = true;
        emit HumanoVerificado(msg.sender);
        emit AfiliadoRegistrado(msg.sender, padre);
    }

    function declararKyc() external whenNotPaused {
        require(humanosVerificados[msg.sender], "not verified");
        require(phoneHashOf[msg.sender] != bytes32(0), "identity required");
        kycDeclarado[msg.sender] = true;
        emit KycDeclarado(msg.sender);
    }

    function setKycExigido(bool exigido) external onlySelf {
        kycExigido = exigido;
        emit KycExigidoUpdated(exigido);
    }

    function setIdentidadExigida(bool exigido) external onlySelf {
        identidadExigida = exigido;
        emit IdentidadExigidaUpdated(exigido);
    }

    function setAttester(address next) external onlySelf {
        require(next != address(0) && next != owner, "bad attester");
        attester = next;
        emit AttesterUpdated(next);
    }

    function vincularIdentidad(
        bytes32 phoneHash,
        bytes32 deviceHash,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external whenNotPaused {
        require(tx.origin == msg.sender, "no contracts");
        require(humanosVerificados[msg.sender], "not verified");
        require(block.timestamp <= deadline, "expired");
        require(phoneHash != bytes32(0) && deviceHash != bytes32(0), "empty");

        uint256 nonce = attestNonce[msg.sender];
        address recovered = QuatriviumFamaLib.recoverAttest(
            msg.sender,
            phoneHash,
            deviceHash,
            deadline,
            nonce,
            v,
            r,
            s
        );
        require(recovered != address(0) && recovered == attester, "bad attest");
        attestNonce[msg.sender] = nonce + 1;

        address takenPhone = walletOfPhone[phoneHash];
        require(takenPhone == address(0) || takenPhone == msg.sender, "phone taken");
        address takenDevice = walletOfDevice[deviceHash];
        require(takenDevice == address(0) || takenDevice == msg.sender, "device taken");

        bytes32 oldPhone = phoneHashOf[msg.sender];
        bytes32 oldDevice = deviceHashOf[msg.sender];
        if (oldPhone != bytes32(0) && oldPhone != phoneHash) {
            delete walletOfPhone[oldPhone];
        }
        if (oldDevice != bytes32(0) && oldDevice != deviceHash) {
            delete walletOfDevice[oldDevice];
        }

        phoneHashOf[msg.sender] = phoneHash;
        deviceHashOf[msg.sender] = deviceHash;
        walletOfPhone[phoneHash] = msg.sender;
        walletOfDevice[deviceHash] = msg.sender;
        emit IdentidadVinculada(msg.sender, phoneHash, deviceHash);
    }

    function depositarLiquidez(address token, uint256 _monto) external nonReentrant whenNotPaused onlySupportedToken(token) {
        require(tx.origin == msg.sender, "no contracts");
        require(_monto > 0, "monto>0");
        _assertPeg(token);
        stableTokens[token].safeTransferFrom(msg.sender, address(this), _monto);

        uint256 shares;
        if (totalShares[token] == 0 || totalLiquidity[token] == 0) {
            shares = _monto;
        } else {
            shares = (_monto * totalShares[token]) / totalLiquidity[token];
        }
        if (shares > 0) {
            lpShares[msg.sender][token] += shares;
            totalShares[token] += shares;
        }
        totalLiquidity[token] += _monto;
        uint256 pts = (_monto * 100) / 1e18;
        reputacion[msg.sender] += pts;
        _tocarFama(msg.sender, pts);
        emit LiquidezAportada(msg.sender, _monto, token);
        emit ReputationUpdated(msg.sender, reputacion[msg.sender]);
    }

    function _assertPeg(address token) internal view {
        QuatriviumFamaLib.assertPeg(priceFeeds[token]);
    }

    function solicitarPrestamo(address token, uint256 nivel) external whenNotPaused nonReentrant onlySupportedToken(token) {
        require(tx.origin == msg.sender, "no contracts");
        require(humanosVerificados[msg.sender], "not verified");
        if (kycExigido) {
            require(kycDeclarado[msg.sender], "kyc required");
        }
        if (identidadExigida) {
            require(
                phoneHashOf[msg.sender] != bytes32(0) && deviceHashOf[msg.sender] != bytes32(0),
                "identity required"
            );
        }
        require(!blacklist[msg.sender], "blacklisted");
        require(!_inhabilitado(msg.sender), "usuario moroso");
        require(usuarios[msg.sender].montoActivo == 0, "loan already active");

        ProgresoNivel storage progreso = progresoUsuarios[msg.sender];
        if (progreso.nivelActual == 0) {
            progreso.nivelActual = 1;
        }
        uint256 desbloqueado = progreso.nivelActual;
        uint256 pedido = nivel == 0 ? desbloqueado : nivel;
        require(pedido >= 1 && pedido <= desbloqueado && pedido <= MAX_NIVEL_TOTAL, "nivel locked");
        require(
            block.timestamp >= progreso.ultimoPrestamoTimestamp + COOLDOWN_PRESTAMO,
            "cooldown 48h"
        );

        _assertPeg(token);
        if (block.timestamp > originationWindowStart + ORIGINATION_WINDOW) {
            originationWindowStart = block.timestamp;
            originationsInWindow = 0;
        }
        originationsInWindow += 1;
        require(originationsInWindow <= maxOriginationsPerWindow, "daily origination cap");

        Level memory L = _tier(pedido);
        require(L.montoPrestamo > 0, "tier not set");
        require(totalLiquidity[token] >= outstandingLoans[token] + L.montoPrestamo, "insufficient liquidity");
        uint256 utilAfter = ((outstandingLoans[token] + L.montoPrestamo) * 10000) / totalLiquidity[token];
        require(utilAfter <= maxUtilizationBps, "utilization cap");

        progreso.ultimoPrestamoTimestamp = block.timestamp;
        usuarios[msg.sender].nivelActual = pedido;
        usuarios[msg.sender].montoActivo = L.montoPrestamo;
        usuarios[msg.sender].vencimiento = block.timestamp + L.plazo;
        usuarios[msg.sender].enMora = false;
        usuarios[msg.sender].monedaActivo = token;
        uint256 tasaCurva = obtenerTasaInteresActual(token);
        uint256 tasaPiso = L.tasaInteresBP;
        usuarios[msg.sender].tasaAplicadaBP = tasaCurva > tasaPiso ? tasaCurva : tasaPiso;

        outstandingLoans[token] += L.montoPrestamo;
        uint256 m = L.montoPrestamo;
        uint8 n = m >= 100000e18 ? 12 : m >= 25000e18 ? 6 : m >= 60e18 ? 3 : m >= 50e18 ? 2 : 1;
        planPago[msg.sender] = PlanPago({
            pagado: 0,
            venceCuota: uint64(n <= 1 ? block.timestamp + L.plazo : block.timestamp + (L.plazo / n)),
            totales: n,
            pagadas: 0,
            enPlazo: true
        });
        stableTokens[token].safeTransfer(msg.sender, L.montoPrestamo);
        emit PrestamoEmitido(msg.sender, L.montoPrestamo, usuarios[msg.sender].vencimiento, token);
    }

    function _tier(uint256 id) internal view returns (Level memory L) {
        if (id <= LoanTierSeed.MAX_NIVEL) return _niveles[id];
        if (id > MAX_NIVEL_TOTAL) return L;
        uint256 t = id - LoanTierSeed.MAX_NIVEL;
        L.montoPrestamo = (10000 + 1100 * t) * 1e18;
        L.plazo = (90 + t / 10) * 1 days;
        L.tasaInteresBP = 800 - (t > 394 ? 394 : t);
    }

    function _montoCuota(
        uint256 totalDue,
        uint256 pagado,
        uint8 totales,
        uint8 pagadas
    ) internal pure returns (uint256) {
        if (totalDue <= pagado) return 0;
        uint256 restante = totalDue - pagado;
        uint8 left = totales > pagadas ? totales - pagadas : 1;
        if (left <= 1) return restante;
        return restante / left;
    }


    function _deudaActual(address usuario) internal view returns (uint256 principal, uint256 interes, uint256 total, address token) {
        principal = usuarios[usuario].montoActivo;
        token = usuarios[usuario].monedaActivo;
        uint256 tasaBP = usuarios[usuario].tasaAplicadaBP;
        if (tasaBP == 0 && principal > 0) {
            uint256 nivel = usuarios[usuario].nivelActual;
            if (nivel == 0) nivel = 1;
            tasaBP = _tier(nivel).tasaInteresBP;
        }
        interes = (principal * tasaBP) / 10000;
        total = principal + interes;
    }

    function obtenerDeuda(address usuario) external view returns (uint256 principal, uint256 interes, uint256 total, address token) {
        return _deudaActual(usuario);
    }

    function _reducirOutstanding(address token, uint256 amount) internal {
        if (outstandingLoans[token] <= amount) {
            outstandingLoans[token] = 0;
        } else {
            outstandingLoans[token] -= amount;
        }
    }

    function _subirNivelSiATiempo(address deudor, bool enPlazo) internal {
        if (
            !enPlazo
            || usuarios[deudor].vencimiento == 0
            || block.timestamp > usuarios[deudor].vencimiento
        ) {
            return;
        }
        reputacion[deudor] += puntosPorPagoATiempo;
        prestamosPagadosATiempo[deudor] += 1;
        emit ReputationUpdated(deudor, reputacion[deudor]);
        ProgresoNivel storage progresoPago = progresoUsuarios[deudor];
        uint256 unlocked = progresoPago.nivelActual == 0 ? 1 : progresoPago.nivelActual;
        if (usuarios[deudor].montoActivo != _tier(unlocked).montoPrestamo) {
            return;
        }
        progresoPago.solicitudesCompletadas++;
        if (unlocked >= MAX_NIVEL_TOTAL) {
            if (progresoPago.solicitudesCompletadas % 100 == 0 && hitoCobrado[deudor] >= MAX_NIVEL_TOTAL) {
                hitoCobrado[deudor] = MAX_NIVEL_TOTAL - 100;
            }
            return;
        }
        uint256 solicitudesRequeridas = unlocked <= 1 ? 3 : (unlocked < 10 ? 5 : 5 * (unlocked - 9));
        if (progresoPago.solicitudesCompletadas >= solicitudesRequeridas) {
            progresoPago.solicitudesCompletadas = 0;
            progresoPago.nivelActual++;
            emit NivelActualizado(deudor, progresoPago.nivelActual);
        }
    }

    function _limpiarPrestamo(address deudor) internal {
        usuarios[deudor].montoActivo = 0;
        usuarios[deudor].vencimiento = 0;
        usuarios[deudor].enMora = false;
        usuarios[deudor].monedaActivo = address(0);
        usuarios[deudor].tasaAplicadaBP = 0;
        delete planPago[deudor];
        delete moraDesde[deudor];
        prestamosCerrados[deudor] += 1;
        if (esMoroso[deudor]) {
            esMoroso[deudor] = false;
            emit MorosityUpdated(deudor, false);
        }
    }

    function _repartirPago(address deudor, address token, uint256 interesParte) internal returns (uint256 comisionesRed) {
        uint256 nivelPrestamo = usuarios[deudor].nivelActual;
        if (nivelPrestamo == 0) nivelPrestamo = 1;
        uint256 retenidoPool;
        bool usoBonoA;
        (comisionesRed, retenidoPool, usoBonoA) =
            _dispersarInteres(deudor, token, interesParte, nivelPrestamo, prestamosCerrados[deudor]);
        emit InteresDistribuido(deudor, token, interesParte, comisionesRed, retenidoPool, usoBonoA);
    }

    function pagarPrestamo(address token, uint256 monto) external nonReentrant onlySupportedToken(token) {
        require(tx.origin == msg.sender, "no contracts");
        require(monto > 0, "monto>0");
        require(usuarios[msg.sender].montoActivo > 0, "no active loan");
        require(usuarios[msg.sender].monedaActivo == token, "token mismatch");
        _pagarComo(msg.sender, token, monto);
    }

    function _pagarComo(address deudor, address token, uint256 monto) internal {
        _aplicarPenalizacionDiaria(deudor);
        (uint256 principalDue, uint256 interesDue, uint256 totalDue, ) = _deudaActual(deudor);
        PlanPago storage plan = planPago[deudor];
        require(totalDue > plan.pagado, "already paid");
        uint8 totales = plan.totales == 0 ? 1 : plan.totales;
        uint256 cuota = _montoCuota(totalDue, plan.pagado, totales, plan.pagadas);
        require(monto >= cuota, "insufficient amount");

        uint256 pagadoAntes = plan.pagado;
        uint256 restante = totalDue - pagadoAntes;
        uint256 pago = monto < restante ? monto : restante;
        if (_estaVencido(deudor)) {
            plan.enPlazo = false;
            _aplicarMoraSiVencido(deudor);
        }

        stableTokens[token].safeTransferFrom(deudor, address(this), pago);
        uint256 interesYa = (interesDue * pagadoAntes) / totalDue;
        uint256 interesParte = pago == restante
            ? interesDue - interesYa
            : (interesDue * pago) / totalDue;
        if (interesParte > pago) interesParte = pago;
        _reducirOutstanding(token, pago - interesParte);
        uint256 comisionesRed = _repartirPago(deudor, token, interesParte);

        plan.pagado = uint128(pagadoAntes + pago);
        if (uint256(plan.pagado) < totalDue) {
            plan.pagadas += 1;
            uint256 vence = usuarios[deudor].vencimiento;
            uint256 left = totales > plan.pagadas ? totales - plan.pagadas : 1;
            plan.venceCuota = uint64(vence > block.timestamp ? block.timestamp + ((vence - block.timestamp) / left) : vence);
            return;
        }

        uint256 prevOut = (principalDue * pagadoAntes) / totalDue;
        if (principalDue > prevOut + (pago - interesParte)) {
            _reducirOutstanding(token, principalDue - prevOut - (pago - interesParte));
        }
        bool enPlazo = plan.enPlazo;
        _subirNivelSiATiempo(deudor, enPlazo);
        _limpiarPrestamo(deudor);
        emit PrestamoPagado(deudor, principalDue, comisionesRed, token);
    }

    function _inhabilitado(address usuario) internal view returns (bool) {
        return esMoroso[usuario] || _estaVencido(usuario);
    }

    /// @notice Tras el mes de gracia las comisiones y bonos del usuario van al pool.
    function dispersionCongelada(address usuario) public view returns (bool) {
        if (usuario == fundador || !esMoroso[usuario]) return false;
        uint256 desde = moraDesde[usuario];
        return desde != 0 && block.timestamp > desde + GRACIA_MORA;
    }

    function _bpGeneracion(uint8 generacion) internal pure returns (uint256) {
        if (generacion == 1) return GEN1_BP;
        if (generacion == 2) return GEN2_BP;
        if (generacion == 3) return GEN3_BP;
        if (generacion == 4) return GEN4_BP;
        if (generacion == 5) return GEN5_BP;
        if (generacion <= 12) return 80;
        return 40;
    }

    function _dispersarInteres(
        address deudor,
        address token,
        uint256 interes,
        uint256 nivelPrestamo,
        uint256 pagosAntes
    ) internal returns (uint256 comisionesRed, uint256 retenidoPool, bool usoBonoA) {
        if (interes == 0) {
            return (0, 0, false);
        }

        bool habriaBonoA = pagosAntes == 0
            && nivelPrestamo == 1
            && !redGenealogica[deudor].bonoActivacionCobrado;

        uint256 remaining = interes;
        uint256 corteFundador = (interes * FUNDADOR_BP) / 10000;
        remaining -= _pagarCapped(token, fundador, corteFundador, remaining, deudor, 0);

        address padre = redGenealogica[deudor].padre;
        if (habriaBonoA) {
            uint256 pagadoBono = QuatriviumFamaLib.pagarBonoPool(
                totalLiquidity,
                cuentaDestruida,
                reputacion,
                stableTokens[token],
                token,
                padre,
                deudor,
                padre != address(0) && !dispersionCongelada(padre),
                _cajaLibre(token),
                (totalLiquidity[token] * BONO_RED_PISO_CAJA_BP) / 10000,
                famaHermano
            );
            if (pagadoBono > 0) {
                redGenealogica[deudor].bonoActivacionCobrado = true;
                usoBonoA = true;
                emit BonoActivacionPagado(padre, deudor, pagadoBono, token);
            }
        }

        uint256 floor = (interes * POOL_FLOOR_BP) / 10000;
        address cursor = padre;
        for (uint8 gen = 1; gen <= MAX_LINEA; gen++) {
            if (cursor == address(0) || cursor == deudor || remaining == 0) {
                break;
            }
            if (!(usoBonoA && gen == 1)) {
                uint256 share = (interes * _bpGeneracion(gen)) / 10000;
                if (gen >= 6) {
                    if (remaining <= floor) break;
                    uint256 room = remaining - floor;
                    if (share > room) share = room;
                }
                remaining -= _pagarCapped(token, cursor, share, remaining, deudor, gen);
            }
            cursor = redGenealogica[cursor].padre;
        }

        retenidoPool = remaining;
        comisionesRed = interes - retenidoPool;
        if (retenidoPool > 0) {
            totalLiquidity[token] += retenidoPool;
            emit InteresRetenidoPool(token, retenidoPool);
        }
        return (comisionesRed, retenidoPool, usoBonoA);
    }

    function _pagarCapped(
        address token,
        address to,
        uint256 amount,
        uint256 remaining,
        address deudor,
        uint8 generacion
    ) internal returns (uint256) {
        if (remaining == 0 || amount == 0) return 0;
        if (amount > remaining) amount = remaining;
        return _pagarComision(token, to, amount, deudor, generacion);
    }

    function _pagarComision(
        address token,
        address to,
        uint256 amount,
        address deudor,
        uint8 generacion
    ) internal returns (uint256) {
        if (amount == 0 || to == address(0) || to == deudor || cuentaDestruida[to]) {
            return 0;
        }
        if (generacion != 0 && dispersionCongelada(to)) {
            return 0;
        }
        stableTokens[token].safeTransfer(to, amount);
        emit ComisionGeneracional(to, deudor, generacion, amount, token);
        return amount;
    }

    function _cajaLibre(address token) internal view returns (uint256) {
        uint256 liq = totalLiquidity[token];
        uint256 out = outstandingLoans[token];
        return liq > out ? liq - out : 0;
    }

    function _tocarFama(address who, uint256 pts) internal {
        QuatriviumFamaLib.tocar(famaHermano, who, pts);
    }

    function _acreditarRed(address padre, address token) internal {
        if (padre == address(0) || cuentaDestruida[padre]) {
            return;
        }
        puntosRed[padre] += PUNTOS_POR_REFERIDO;
        emit PuntosRed(padre, puntosRed[padre]);
        _pagarBonosRed(padre, token);
    }

    function _pagarBonosRed(address usuario, address token) internal {
        if (dispersionCongelada(usuario) || blacklist[usuario]) return;
        uint256 earned = puntosRed[usuario] / UMBRAL_BONO_RED;
        uint256 already = bonosRedCobrados[usuario];
        if (earned <= already) return;
        uint256 n = earned - already;
        for (uint256 i = 0; i < n; i++) {
            uint256 caja = _cajaLibre(token);
            uint256 piso = (totalLiquidity[token] * BONO_RED_PISO_CAJA_BP) / 10000;
            if (caja <= piso || caja - piso < BONO_RED_USDT) break;
            totalLiquidity[token] -= BONO_RED_USDT;
            stableTokens[token].safeTransfer(usuario, BONO_RED_USDT);
            already += 1;
            emit BonoRedPagado(usuario, already * UMBRAL_BONO_RED, BONO_RED_USDT, token);
        }
        bonosRedCobrados[usuario] = already;
    }

    function obtenerRedReputacion(address usuario) external view returns (
        uint256 puntos,
        uint256 bonosCobrados,
        uint256 umbral,
        uint256 bono,
        uint256 puntosPorReferido
    ) {
        return (
            puntosRed[usuario],
            bonosRedCobrados[usuario],
            UMBRAL_BONO_RED,
            BONO_RED_USDT,
            PUNTOS_POR_REFERIDO
        );
    }

    function valorLp(address user, address token) public view returns (uint256) {
        if (totalShares[token] == 0) return 0;
        return (lpShares[user][token] * totalLiquidity[token]) / totalShares[token];
    }

    function _ajustarLiquidezPorInteres(address token, uint256 interes, uint256 fee) internal {
        if (interes >= fee) {
            totalLiquidity[token] += (interes - fee);
        } else {
            uint256 dip = fee - interes;
            require(totalLiquidity[token] >= dip, "fee exceeds pool");
            totalLiquidity[token] -= dip;
        }
    }

    /// @notice El pool es de prÃ©stamo, no un LP redimible. La UI y el contrato coinciden.
    function retirarLiquidez(address, uint256) external pure {
        revert("pool locked");
    }

    function _estaVencido(address usuario) internal view returns (bool) {
        if (usuarios[usuario].montoActivo == 0) return false;
        uint256 vence = usuarios[usuario].vencimiento;
        return vence > 0 && block.timestamp > vence;
    }

    function _aplicarPenalizacionDiaria(address usuario) internal {
        uint256 desde = moraDesde[usuario];
        if (!esMoroso[usuario] || desde < 1 || block.timestamp <= desde + GRACIA_MORA) return;
        uint256 dias = (block.timestamp - desde - GRACIA_MORA) / 1 days;
        uint256 ya = moraDiasCobrados[usuario];
        if (dias <= ya) return;
        uint256 nivel = progresoUsuarios[usuario].nivelActual;
        if (nivel < 1) nivel = 1;
        uint256 quita = (dias - ya) * FAMA_POR_DIA_MORA * nivel;
        reputacion[usuario] = reputacion[usuario] > quita ? reputacion[usuario] - quita : 0;
        moraDiasCobrados[usuario] = dias;
        penalizacionesAcumuladas[usuario] += quita;
        emit ReputationUpdated(usuario, reputacion[usuario]);
    }

    function _aplicarMoraSiVencido(address usuario) internal {
        if (!_estaVencido(usuario) || esMoroso[usuario]) return;
        esMoroso[usuario] = true;
        usuarios[usuario].enMora = true;
        moraDesde[usuario] = block.timestamp;
        moraDiasCobrados[usuario] = 0;
        prestamosMorosos[usuario] += 1;
        emit MorosityUpdated(usuario, true);
    }

    function marcarMorosoSiVencido(address usuario) external nonReentrant {
        require(usuarios[usuario].montoActivo > 0 && _estaVencido(usuario), "not due");
        _aplicarPenalizacionDiaria(usuario);
        address token = usuarios[usuario].monedaActivo;
        (, , uint256 totalDue, ) = _deudaActual(usuario);
        uint256 pagado = planPago[usuario].pagado;
        uint256 restante = totalDue - pagado;
        require(restante > 0, "already paid");
        uint8 tot = planPago[usuario].totales == 0 ? 1 : planPago[usuario].totales;
        uint256 amount = block.timestamp > usuarios[usuario].vencimiento
            ? restante
            : _montoCuota(totalDue, pagado, tot, planPago[usuario].pagadas);
        IERC20 erc = stableTokens[token];
        if (erc.balanceOf(usuario) >= amount && erc.allowance(usuario, address(this)) >= amount) {
            _pagarComo(usuario, token, amount);
        } else {
            _aplicarMoraSiVencido(usuario);
        }
    }

    function liquidate(address deudor, address tokenAddress) external nonReentrant onlySupportedToken(tokenAddress) {
        require(tx.origin == msg.sender, "no contracts");
        require(usuarios[deudor].montoActivo > 0, "no active loan");
        require(usuarios[deudor].monedaActivo == tokenAddress, "token mismatch");
        require(_estaVencido(deudor), "not defaulted");

        uint256 principal = usuarios[deudor].montoActivo;
        (, uint256 interest, uint256 totalDue, ) = _deudaActual(deudor);
        uint256 pagado = planPago[deudor].pagado;
        require(totalDue > pagado, "already paid");
        uint256 restante = totalDue - pagado;
        uint256 interestRestante = (interest * restante) / totalDue;
        uint256 principalRestante = principal - ((principal * pagado) / totalDue);

        stableTokens[tokenAddress].safeTransferFrom(msg.sender, address(this), restante);

        uint256 fee = (interest * restante * feeBasisPoints) / (totalDue * 10000);
        if (fee > interestRestante) fee = interestRestante;
        if (fee > 0) collectedFees[tokenAddress] += fee;

        uint256 reward = (principalRestante * 5) / 100;
        uint256 availableForReward = restante - fee;
        if (reward > availableForReward) reward = availableForReward;
        if (reward > 0) {
            stableTokens[tokenAddress].safeTransfer(msg.sender, reward);
        }

        _ajustarLiquidezPorInteres(tokenAddress, interestRestante, fee + reward);

        if (outstandingLoans[tokenAddress] <= principalRestante) {
            outstandingLoans[tokenAddress] = 0;
        } else {
            outstandingLoans[tokenAddress] -= principalRestante;
        }

        usuarios[deudor].montoActivo = 0;
        usuarios[deudor].vencimiento = 0;
        usuarios[deudor].enMora = false;
        usuarios[deudor].monedaActivo = address(0);
        usuarios[deudor].tasaAplicadaBP = 0;
        delete planPago[deudor];
        prestamosCerrados[deudor] += 1;

        if (esMoroso[deudor]) {
            esMoroso[deudor] = false;
            emit MorosityUpdated(deudor, false);
        } else {
            prestamosMorosos[deudor] += 1;
            penalizacionesAcumuladas[deudor] += penalizacionPorMora;
            if (reputacion[deudor] >= penalizacionPorMora) {
                reputacion[deudor] -= penalizacionPorMora;
            } else {
                reputacion[deudor] = 0;
            }
            emit ReputationUpdated(deudor, reputacion[deudor]);
        }

        emit LiquidationExecuted(msg.sender, deudor, tokenAddress, restante, reward);
        emit LoanLiquidated(deudor, msg.sender, tokenAddress, restante);
    }

    function calcularTasaUtilizacion(address tokenAddress) public view returns (uint256) {
        uint256 pool = totalLiquidity[tokenAddress];
        if (pool < 1) return 0;
        return (outstandingLoans[tokenAddress] * 10000) / pool;
    }

    function obtenerTasaInteresActual(address tokenAddress) public view returns (uint256) {
        uint256 utilBP = calcularTasaUtilizacion(tokenAddress);
        if (utilBP < 1) return tasaBaseBP;
        if (utilBP <= puntoOptimoUtilBP) {
            if (puntoOptimoUtilBP < 1) return tasaBaseBP;
            return tasaBaseBP + (pendiente1BP * utilBP) / puntoOptimoUtilBP;
        }
        uint256 extraBP = utilBP - puntoOptimoUtilBP;
        uint256 denom = 10000 - puntoOptimoUtilBP;
        if (denom < 1) return tasaBaseBP + pendiente1BP + pendiente2BP;
        return tasaBaseBP + pendiente1BP + (pendiente2BP * extraBP) / denom;
    }

    function obtenerHistorialUsuario(address usuario) external view returns (
        uint256 puntosReputacion,
        bool moroso,
        uint256 pagadosATiempo,
        uint256 morosos,
        uint256 totalPenalizaciones
    ) {
        return (
            reputacion[usuario],
            esMoroso[usuario],
            prestamosPagadosATiempo[usuario],
            prestamosMorosos[usuario],
            penalizacionesAcumuladas[usuario]
        );
    }

    function obtenerProgresoUsuario(address usuario) external view returns (
        uint256 nivelActual,
        uint256 solicitudesCompletadas,
        uint256 ultimoPrestamoTimestamp
    ) {
        ProgresoNivel storage progreso = progresoUsuarios[usuario];
        uint256 level = progreso.nivelActual == 0 ? 1 : progreso.nivelActual;
        return (level, progreso.solicitudesCompletadas, progreso.ultimoPrestamoTimestamp);
    }

    function destruirCuenta(address token) external nonReentrant onlySupportedToken(token) {
        require(tx.origin == msg.sender, "no contracts");
        require(msg.sender != fundador, "founder");
        require(humanosVerificados[msg.sender], "not verified");
        require(!cuentaDestruida[msg.sender], "dead");
        require(!esMoroso[msg.sender], "in mora");
        require(usuarios[msg.sender].montoActivo == 0, "active loan");

        uint256 shares = lpShares[msg.sender][token];
        if (shares > 0) {
            lpShares[msg.sender][token] = 0;
            totalShares[token] -= shares;
        }

        bytes32 ph = phoneHashOf[msg.sender];
        bytes32 dh = deviceHashOf[msg.sender];
        if (ph != bytes32(0)) {
            delete walletOfPhone[ph];
            delete phoneHashOf[msg.sender];
        }
        if (dh != bytes32(0)) {
            delete walletOfDevice[dh];
            delete deviceHashOf[msg.sender];
        }

        delete redGenealogica[msg.sender];
        delete progresoUsuarios[msg.sender];
        delete planPago[msg.sender];
        humanosVerificados[msg.sender] = false;
        kycDeclarado[msg.sender] = false;
        esMoroso[msg.sender] = false;
        reputacion[msg.sender] = 0;
        puntosRed[msg.sender] = 0;
        bonosRedCobrados[msg.sender] = 0;
        prestamosPagadosATiempo[msg.sender] = 0;
        prestamosMorosos[msg.sender] = 0;
        prestamosCerrados[msg.sender] = 0;
        penalizacionesAcumuladas[msg.sender] = 0;
        delete moraDesde[msg.sender];
        hitoCobrado[msg.sender] = 0;
        donado[msg.sender] = 0;
        cuentaDestruida[msg.sender] = true;
        _tocarFama(msg.sender, 0);
        emit CuentaDestruida(msg.sender, token, 0);
    }

    function cobrarBonoHito(address token) external whenNotPaused nonReentrant onlySupportedToken(token) {
        require(tx.origin == msg.sender, "no contracts");
        require(humanosVerificados[msg.sender] && !blacklist[msg.sender] && !dispersionCongelada(msg.sender));
        uint256 nivel = progresoUsuarios[msg.sender].nivelActual;
        if (nivel < 1) nivel = 1;
        uint256 next = hitoCobrado[msg.sender] + 100;
        require(next <= MAX_NIVEL_TOTAL && next <= nivel - (nivel % 100));
        uint256 bono = next >= 200 ? 30000e18 : next * 20e18;
        uint256 caja = _cajaLibre(token);
        uint256 piso = (totalLiquidity[token] * BONO_RED_PISO_CAJA_BP) / 10000;
        require(caja > piso && caja - piso >= bono);
        hitoCobrado[msg.sender] = next;
        totalLiquidity[token] -= bono;
        stableTokens[token].safeTransfer(msg.sender, bono);
        emit BonoHitoPagado(msg.sender, next, bono, token);
    }

    function donar(address token, uint256 amount) external nonReentrant whenNotPaused onlySupportedToken(token) {
        require(tx.origin == msg.sender, "no contracts");
        require(amount > 0 && fundador != address(0) && msg.sender != fundador);
        uint256 prev = donado[msg.sender];
        stableTokens[token].safeTransferFrom(msg.sender, fundador, amount);
        donado[msg.sender] += amount;
        bool puerta = prev == 0 && amount == 2 * BONO_ACTIVACION;
        if (!puerta) {
            uint256 pts = (amount * 100) / 1e18;
            reputacion[msg.sender] += pts;
            _tocarFama(msg.sender, pts);
        }
        emit Donacion(msg.sender, amount, token);
        emit ReputationUpdated(msg.sender, reputacion[msg.sender]);
    }

    /// @notice Correo/teléfono: 0.50 o 1 USDT al pool. Sin fama ni participaciones LP.
    function pagarVerificacion(address token, uint256 amount) external nonReentrant whenNotPaused onlySupportedToken(token) {
        require(tx.origin == msg.sender, "no contracts");
        _assertPeg(token);
        QuatriviumFamaLib.alimentarPool(totalLiquidity, stableTokens[token], token, msg.sender, amount);
    }

    function pagarCanje(address token, address to, uint256 amount) external nonReentrant onlySupportedToken(token) {
        require(msg.sender == famaHermano);
        QuatriviumFamaLib.sacarCaja(
            totalLiquidity,
            stableTokens[token],
            token,
            to,
            amount,
            _cajaLibre(token),
            (totalLiquidity[token] * BONO_RED_PISO_CAJA_BP) / 10000
        );
    }

    function niveles(uint256 id) external view returns (uint256, uint256, uint256) {
        Level memory L = _tier(id);
        return (L.montoPrestamo, L.plazo, L.tasaInteresBP);
    }
}
