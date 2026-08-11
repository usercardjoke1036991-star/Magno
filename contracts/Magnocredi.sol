// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

/**
 * @title Magnocredi - Autonomous Microcredit Protocol (modular core)
 * @notice Combines a liquidity vault, fee router, identity registry and a simple credit engine.
 * - Deposits are ERC20 stablecoins (configurable at deployment)
 * - Loans are issued algorithmically according to user tier
 * - Fees are routed to a configured fee wallet
 * - Includes a renounceOwnership path for total immutability
 *
 * THIS IS A BASE ARCHITECTURE / REFERENCE IMPLEMENTATION. Do not deploy to mainnet
 * without a security audit and completing the ZK verifier integration.
 */
contract Magnocredi is ReentrancyGuard, Pausable {
    mapping(address => IERC20) public stableTokens;
    mapping(address => bool) public supportedToken;
    address payable public feeCollector;
    address payable public owner;
    uint256 public feeBasisPoints; // e.g. 500 = 5.00%

    address public pendingFeeCollector;
    uint256 public pendingFeeCollectorTimestamp;
    uint256 public constant TIMELOCK_DELAY = 72 hours;

    mapping(address => bool) public admins;
    address[] public ownerList;

    mapping(address => uint256) public totalLiquidity;
    mapping(address => uint256) public outstandingLoans;

    // Chainlink price feeds per token
    mapping(address => AggregatorV3Interface) public priceFeeds;

    // Circuit breaker tracking: recent withdrawal volume per token and window
    mapping(address => uint256) public recentWithdrawalVolume;
    mapping(address => uint256) public recentWindowStart;
    uint256 public constant WITHDRAWAL_WINDOW = 1 hours;
    uint256 public constant WITHDRAWAL_THRESHOLD_BPS = 5000; // 50% = 5000 basis points

    struct Level { uint256 montoPrestamo; uint256 plazo; uint256 tasaInteresBP; }
    mapping(uint256 => Level) private _niveles;

    struct Usuario { uint256 nivelActual; uint256 montoActivo; uint256 vencimiento; bool enMora; address monedaActivo; uint256 tasaAplicadaBP; }
    mapping(address => Usuario) public usuarios;

    mapping(address => bool) public humanosVerificados;
    mapping(address => bool) public blacklist;
    // On-chain credit bureau: delinquency registry
    mapping(address => bool) public esMoroso;
    mapping(address => uint256) public reputacion; // optional reputation score (higher = better)
    mapping(address => uint256) public prestamosPagadosATiempo;
    mapping(address => uint256) public prestamosMorosos;
    mapping(address => uint256) public penalizacionesAcumuladas;

    struct ProgresoNivel {
        uint256 nivelActual;          // Del 1 al 10
        uint256 solicitudesCompletadas; // Conteo de solicitudes en el nivel actual
        uint256 ultimoPrestamoTimestamp; // Marca de tiempo para el cooldown de 48 horas
    }

    mapping(address => ProgresoNivel) public progresoUsuarios;
    uint256 public constant COOLDOWN_PRESTAMO = 48 hours;

    event NivelActualizado(address indexed usuario, uint256 nuevoNivel);
    event MorosityUpdated(address indexed usuario, bool esMoroso);
    event ReputationUpdated(address indexed usuario, uint256 nuevaReputacion);

    address public pendingOwnerToAdd;
    uint256 public pendingOwnerTimestamp;

    event HumanoVerificado(address indexed usuario);
    event LiquidezAportada(address indexed proveedor, uint256 monto, address indexed token);
    event PrestamoEmitido(address indexed usuario, uint256 monto, uint256 vencimiento, address indexed token);
    event PrestamoPagado(address indexed usuario, uint256 montoPrincipal, uint256 fee, address indexed token);
    event LiquidationExecuted(address indexed liquidator, address indexed user, address indexed token, uint256 paidAmount, uint256 reward);
    event LoanLiquidated(address indexed deudor, address indexed liquidador, address indexed token, uint256 monto);
    event CircuitBreakerActivated(address indexed token, uint256 attemptedWithdrawal, uint256 windowVolume);
    event FeeCollectorChangeQueued(address indexed proposedCollector, uint256 executeAfter);
    event FeeCollectorChangeExecuted(address indexed newCollector);
    event OwnerAdditionQueued(address indexed proposedOwner, uint256 executeAfter);
    event OwnerAdded(address indexed newOwner);

    constructor(address _usdtAddress, address payable _feeCollector, uint256 _feeBP) {
        require(_usdtAddress != address(0), "zero token");
        require(_feeCollector != address(0), "zero fee collector");
        stableTokens[_usdtAddress] = IERC20(_usdtAddress);
        supportedToken[_usdtAddress] = true;
        feeCollector = _feeCollector;
        owner = payable(msg.sender);
        feeBasisPoints = _feeBP;

        admins[msg.sender] = true;
        ownerList.push(msg.sender);

        _niveles[1] = Level({ montoPrestamo: 1 * 1e18, plazo: 7 days, tasaInteresBP: 500 });
        _niveles[2] = Level({ montoPrestamo: 2 * 1e18, plazo: 10 days, tasaInteresBP: 600 });
        _niveles[3] = Level({ montoPrestamo: 5 * 1e18, plazo: 15 days, tasaInteresBP: 800 });
        _niveles[4] = Level({ montoPrestamo: 10 * 1e18, plazo: 20 days, tasaInteresBP: 900 });
        _niveles[5] = Level({ montoPrestamo: 20 * 1e18, plazo: 25 days, tasaInteresBP: 1000 });
        _niveles[6] = Level({ montoPrestamo: 35 * 1e18, plazo: 30 days, tasaInteresBP: 1100 });
        _niveles[7] = Level({ montoPrestamo: 50 * 1e18, plazo: 35 days, tasaInteresBP: 1200 });
        _niveles[8] = Level({ montoPrestamo: 65 * 1e18, plazo: 40 days, tasaInteresBP: 1300 });
        _niveles[9] = Level({ montoPrestamo: 80 * 1e18, plazo: 45 days, tasaInteresBP: 1400 });
        _niveles[10] = Level({ montoPrestamo: 100 * 1e18, plazo: 50 days, tasaInteresBP: 1500 });

        // Interest model defaults (basis points)
        tasaBaseBP = 100; // 1.00% base
        puntoOptimoUtilBP = 8000; // 80% utilization
        pendiente1BP = 400; // slow slope (4.00% when at optimal)
        pendiente2BP = 2000; // aggressive slope beyond optimal (20.00%)

        // Reputation defaults
        puntosPorPagoATiempo = 100;
        penalizacionPorMora = 200;
        reputacionThresholdGovernance = 1000;
    }

    // --- Interest rate model state (basis points) ---
    uint256 public tasaBaseBP;
    uint256 public puntoOptimoUtilBP; // in BP (0-10000)
    uint256 public pendiente1BP;
    uint256 public pendiente2BP;

    function setInterestModelParams(uint256 _tasaBaseBP, uint256 _puntoOptimoUtilBP, uint256 _pendiente1BP, uint256 _pendiente2BP) external onlyAdmin {
        require(_puntoOptimoUtilBP > 0 && _puntoOptimoUtilBP < 10000, "invalid optimal");
        tasaBaseBP = _tasaBaseBP;
        puntoOptimoUtilBP = _puntoOptimoUtilBP;
        pendiente1BP = _pendiente1BP;
        pendiente2BP = _pendiente2BP;
    }

    // Calculate utilization in basis points (0 - 10000)
    uint256 public puntosPorPagoATiempo;
    uint256 public penalizacionPorMora;
    uint256 public reputacionThresholdGovernance;

    function setReputationParams(uint256 _puntosPago, uint256 _penalizacion, uint256 _thresholdGov) external onlyAdmin {
        puntosPorPagoATiempo = _puntosPago;
        penalizacionPorMora = _penalizacion;
        reputacionThresholdGovernance = _thresholdGov;
    }

    function obtenerMontoMaximoNivel(uint256 nivel) public pure returns (uint256) {
        if (nivel == 1) return 1;
        if (nivel == 2) return 2;
        if (nivel == 3) return 5;
        if (nivel == 4) return 10;
        if (nivel == 5) return 20;
        if (nivel == 6) return 35;
        if (nivel == 7) return 50;
        if (nivel == 8) return 65;
        if (nivel == 9) return 80;
        if (nivel >= 10) return 100;
        return 1;
    }

    function esElegibleParaGovernanza(address usuario) public view returns (bool) {
        return (!esMoroso[usuario] && reputacion[usuario] >= reputacionThresholdGovernance);
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

    function obtenerCooldownRestante(address usuario) external view returns (uint256 segundosRestantes) {
        ProgresoNivel storage progreso = progresoUsuarios[usuario];
        if (progreso.ultimoPrestamoTimestamp == 0) {
            return 0;
        }
        uint256 finalBloqueo = progreso.ultimoPrestamoTimestamp + COOLDOWN_PRESTAMO;
        if (block.timestamp >= finalBloqueo) {
            return 0;
        }
        return finalBloqueo - block.timestamp;
    }

    function calcularTasaUtilizacion(address tokenAddress) public view returns (uint256) {
        uint256 pool = totalLiquidity[tokenAddress];
        if (pool == 0) return 0;
        uint256 borrowed = outstandingLoans[tokenAddress];
        return (borrowed * 10000) / pool;
    }

    // Returns current interest rate in basis points according to utilization curve
    function obtenerTasaInteresActual(address tokenAddress) public view returns (uint256) {
        uint256 utilBP = calcularTasaUtilizacion(tokenAddress);
        if (utilBP == 0) {
            return tasaBaseBP;
        }

        // If utilization <= optimal: linear ramp from base to base+pendiente1
        if (utilBP <= puntoOptimoUtilBP) {
            // scale = utilBP / puntoOptimoUtilBP (both BP), compute pendiente1 contribution
            // contribution = pendiente1BP * utilBP / puntoOptimoUtilBP
            if (puntoOptimoUtilBP == 0) return tasaBaseBP;
            uint256 contrib = (pendiente1BP * utilBP) / puntoOptimoUtilBP;
            return tasaBaseBP + contrib;
        } else {
            // utilization beyond optimal: base + pendiente1 + pendiente2 * (util - opt)/(10000 - opt)
            uint256 extraBP = utilBP - puntoOptimoUtilBP;
            uint256 denom = 10000 - puntoOptimoUtilBP;
            if (denom == 0) return tasaBaseBP + pendiente1BP + pendiente2BP;
            uint256 contrib = (pendiente2BP * extraBP) / denom;
            return tasaBaseBP + pendiente1BP + contrib;
        }
    }

    modifier onlySupportedToken(address token) {
        require(supportedToken[token], "unsupported token");
        _;
    }

    modifier onlyAdmin() {
        require(admins[msg.sender], "only admin");
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "only owner");
        _;
    }

    function setStablecoin(address token, bool enabled) external onlyAdmin {
        require(token != address(0), "zero token");
        supportedToken[token] = enabled;
        if (enabled) {
            stableTokens[token] = IERC20(token);
        } else {
            delete stableTokens[token];
        }
    }

    function retirarComisiones() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "no native balance");
        owner.transfer(balance);
    }

    function retirarComisionesToken(address token) external onlyOwner onlySupportedToken(token) {
        uint256 tokenBalance = stableTokens[token].balanceOf(address(this));
        require(tokenBalance > 0, "no token balance");
        require(stableTokens[token].transfer(owner, tokenBalance), "transfer failed");
    }

    function setPriceFeed(address token, address feed) external onlyAdmin {
        require(token != address(0) && feed != address(0), "zero");
        priceFeeds[token] = AggregatorV3Interface(feed);
    }

    function isSupportedToken(address token) external view returns (bool) {
        return supportedToken[token];
    }

    // Owner may set tiers, fee collector and fee percent before renouncing
    function setNivel(uint256 id, uint256 montoPrestamo, uint256 plazo, uint256 tasaInteresBP) external onlyAdmin {
        _niveles[id] = Level({ montoPrestamo: montoPrestamo, plazo: plazo, tasaInteresBP: tasaInteresBP });
    }

    function queueChangeFeeCollector(address newCollector) external onlyAdmin {
        require(newCollector != address(0), "zero address");
        pendingFeeCollector = newCollector;
        pendingFeeCollectorTimestamp = block.timestamp + TIMELOCK_DELAY;
        emit FeeCollectorChangeQueued(newCollector, pendingFeeCollectorTimestamp);
    }

    function executeChangeFeeCollector() external onlyAdmin {
        require(pendingFeeCollector != address(0), "no pending collector");
        require(block.timestamp >= pendingFeeCollectorTimestamp, "timelock not expired");

        feeCollector = payable(pendingFeeCollector);
        emit FeeCollectorChangeExecuted(pendingFeeCollector);

        pendingFeeCollector = address(0);
        pendingFeeCollectorTimestamp = 0;
    }

    function setFeeBP(uint256 _feeBP) external onlyAdmin {
        feeBasisPoints = _feeBP;
    }

    function queueAddOwner(address newOwner) external onlyAdmin {
        require(newOwner != address(0), "zero owner");
        require(ownerList.length < 3, "max owners reached");
        require(!admins[newOwner], "already owner");

        pendingOwnerToAdd = newOwner;
        pendingOwnerTimestamp = block.timestamp + TIMELOCK_DELAY;
        emit OwnerAdditionQueued(newOwner, pendingOwnerTimestamp);
    }

    function executeAddOwner() external onlyAdmin {
        require(pendingOwnerToAdd != address(0), "no pending owner");
        require(block.timestamp >= pendingOwnerTimestamp, "timelock not expired");
        require(ownerList.length < 3, "max owners reached");

        admins[pendingOwnerToAdd] = true;
        ownerList.push(pendingOwnerToAdd);
        emit OwnerAdded(pendingOwnerToAdd);

        pendingOwnerToAdd = address(0);
        pendingOwnerTimestamp = 0;
    }

    // --- Identity & Anti-fraud ---
    function registrarHumanoZK(address _usuario) external {
        require(msg.sender == _usuario, "can only self-register");
        require(!blacklist[_usuario], "blacklisted");
        humanosVerificados[_usuario] = true;
        emit HumanoVerificado(_usuario);
    }

    function banWallet(address _addr, bool _banned) external onlyOwner {
        blacklist[_addr] = _banned;
    }

    // --- Liquidity pool ---
    function depositarLiquidez(address token, uint256 _monto) external nonReentrant onlySupportedToken(token) {
        require(_monto > 0, "monto>0");
        require(stableTokens[token].transferFrom(msg.sender, address(this), _monto), "transferFrom failed");
        totalLiquidity[token] += _monto;
        emit LiquidezAportada(msg.sender, _monto, token);
    }

    // --- Credit engine ---
    function solicitarPrestamo(address token) external whenNotPaused nonReentrant onlySupportedToken(token) {
        require(humanosVerificados[msg.sender], "not verified");
        require(!blacklist[msg.sender], "blacklisted");
        require(!esMoroso[msg.sender], "usuario moroso");
        require(usuarios[msg.sender].montoActivo == 0, "loan already active");

        ProgresoNivel storage progreso = progresoUsuarios[msg.sender];
        if (progreso.nivelActual == 0) {
            progreso.nivelActual = 1;
        }

        require(
            block.timestamp >= progreso.ultimoPrestamoTimestamp + COOLDOWN_PRESTAMO,
            "Debe esperar 48 horas desde su ultimo prestamo para solicitar uno nuevo."
        );

        // Peg protection: verify price feed if available
        if (address(priceFeeds[token]) != address(0)) {
            (, int256 price, , , ) = priceFeeds[token].latestRoundData();
            // Chainlink price usually has 8 decimals. Require price >= 0.98 USD
            int256 threshold = 98_000_000; // 0.98 * 1e8
            require(price >= threshold, "peg lost");
        }

        uint256 nivel = progreso.nivelActual;
        Level memory L = _niveles[nivel];
        require(L.montoPrestamo > 0, "tier not set");
        require(totalLiquidity[token] >= outstandingLoans[token] + L.montoPrestamo, "insufficient liquidity");

        progreso.ultimoPrestamoTimestamp = block.timestamp;
        progreso.solicitudesCompletadas++;

        uint256 solicitudesRequeridas = progreso.nivelActual == 1 ? 3 : 5;
        if (progreso.solicitudesCompletadas >= solicitudesRequeridas && progreso.nivelActual < 10) {
            progreso.nivelActual++;
            progreso.solicitudesCompletadas = 0;
            emit NivelActualizado(msg.sender, progreso.nivelActual);
        }

        usuarios[msg.sender].nivelActual = progreso.nivelActual;
        usuarios[msg.sender].montoActivo = L.montoPrestamo;
        usuarios[msg.sender].vencimiento = block.timestamp + L.plazo;
        usuarios[msg.sender].enMora = false;
        usuarios[msg.sender].monedaActivo = token;
        // Assign dynamic interest at time of loan
        uint256 tasaActualBP = obtenerTasaInteresActual(token);
        usuarios[msg.sender].tasaAplicadaBP = tasaActualBP;

        outstandingLoans[token] += L.montoPrestamo;
        require(stableTokens[token].transfer(msg.sender, L.montoPrestamo), "transfer failed");

        emit PrestamoEmitido(msg.sender, L.montoPrestamo, usuarios[msg.sender].vencimiento, token);
    }

    function pagarPrestamo(address token, uint256 _montoConInteres) external whenNotPaused nonReentrant onlySupportedToken(token) {
        require(_montoConInteres > 0, "monto>0");
        require(usuarios[msg.sender].montoActivo > 0, "no active loan");
        require(usuarios[msg.sender].monedaActivo == token, "token mismatch");
        require(stableTokens[token].transferFrom(msg.sender, address(this), _montoConInteres), "transferFrom failed");

        uint256 fee = (_montoConInteres * feeBasisPoints) / 10000;
        uint256 principal = _montoConInteres - fee;

        if (fee > 0) {
            require(stableTokens[token].transfer(feeCollector, fee), "fee transfer failed");
        }

        totalLiquidity[token] += principal;

        if (outstandingLoans[token] <= principal) {
            outstandingLoans[token] = 0;
        } else {
            outstandingLoans[token] -= principal;
        }

        // award reputation if paid on-time
        if (usuarios[msg.sender].vencimiento > 0 && block.timestamp <= usuarios[msg.sender].vencimiento) {
            reputacion[msg.sender] += puntosPorPagoATiempo;
            prestamosPagadosATiempo[msg.sender] += 1;
            emit ReputationUpdated(msg.sender, reputacion[msg.sender]);
        }

        usuarios[msg.sender].montoActivo = 0;
        usuarios[msg.sender].vencimiento = 0;
        usuarios[msg.sender].enMora = false;
        usuarios[msg.sender].monedaActivo = address(0);
        // Successful payment rehabilitates borrower
        if (esMoroso[msg.sender]) {
            esMoroso[msg.sender] = false;
            emit MorosityUpdated(msg.sender, false);
        }

        emit PrestamoPagado(msg.sender, principal, fee, token);
    }

    // --- Withdraw liquidity for providers (with circuit-breaker checks)
    function retirarLiquidez(address token, uint256 amount) external nonReentrant onlySupportedToken(token) whenNotPaused {
        require(amount > 0, "amount>0");
        require(totalLiquidity[token] >= amount, "insufficient pool");

        _checkAndTriggerCircuitBreaker(token, amount);

        totalLiquidity[token] -= amount;
        require(stableTokens[token].transfer(msg.sender, amount), "transfer failed");
    }

    function _checkAndTriggerCircuitBreaker(address token, uint256 amount) internal {
        uint256 start = recentWindowStart[token];
        if (block.timestamp > start + WITHDRAWAL_WINDOW) {
            // reset window
            recentWindowStart[token] = block.timestamp;
            recentWithdrawalVolume[token] = 0;
            start = recentWindowStart[token];
        }

        recentWithdrawalVolume[token] += amount;
        uint256 windowVolume = recentWithdrawalVolume[token];

        // If attempted to withdraw > 50% of totalLiquidity in window, activate circuit breaker
        uint256 pool = totalLiquidity[token];
        if (pool > 0) {
            // compare using basis points
            if (windowVolume * 10000 >= pool * WITHDRAWAL_THRESHOLD_BPS) {
                _pause();
                emit CircuitBreakerActivated(token, amount, windowVolume);
            }
        }
    }

    // Admin functions to resume operations
    function resume() external onlyAdmin {
        _unpause();
    }

    // Emergency controls
    function pausarContrato() external onlyAdmin {
        _pause();
    }

    function despausarContrato() external onlyAdmin {
        _unpause();
    }

    // Mark a user as moroso if their loan is past due. Callable by anyone to maintain bureau.
    function marcarMorosoSiVencido(address usuario) external {
        require(usuarios[usuario].montoActivo > 0, "no active loan");
        require(usuarios[usuario].vencimiento > 0 && block.timestamp > usuarios[usuario].vencimiento, "not expired");

        if (!esMoroso[usuario]) {
            esMoroso[usuario] = true;
            usuarios[usuario].enMora = true;
            prestamosMorosos[usuario] += 1;
            penalizacionesAcumuladas[usuario] += penalizacionPorMora;
            emit MorosityUpdated(usuario, true);
        }

        // apply reputation penalty for becoming moroso
        if (reputacion[usuario] >= penalizacionPorMora) {
            reputacion[usuario] -= penalizacionPorMora;
        } else {
            reputacion[usuario] = 0;
        }
        emit ReputationUpdated(usuario, reputacion[usuario]);
    }

    // Admin may manually set or clear morosity flags (eg. dispute resolution)
    function setMorosidad(address usuario, bool moroso) external onlyAdmin {
        esMoroso[usuario] = moroso;
        usuarios[usuario].enMora = moroso;
        emit MorosityUpdated(usuario, moroso);
    }

    // --- Liquidation: allow any third party to liquidate overdue loans
    function liquidate(address deudor, address tokenAddress) external nonReentrant onlySupportedToken(tokenAddress) whenNotPaused {
        require(usuarios[deudor].montoActivo > 0, "no active loan");
        require(usuarios[deudor].vencimiento > 0 && block.timestamp > usuarios[deudor].vencimiento, "not defaulted");

        uint256 principal = usuarios[deudor].montoActivo;
        // Use the interest rate applied at loan origination; fallback to tier rate if missing
        uint256 tasaBP = usuarios[deudor].tasaAplicadaBP;
        if (tasaBP == 0) {
            uint256 nivel = usuarios[deudor].nivelActual;
            if (nivel == 0) nivel = 1;
            tasaBP = _niveles[nivel].tasaInteresBP;
        }
        uint256 interest = (principal * tasaBP) / 10000;
        uint256 totalDue = principal + interest;

        // liquidator must transfer totalDue to contract
        require(stableTokens[tokenAddress].transferFrom(msg.sender, address(this), totalDue), "transferFrom failed");

        // protocol fee
        uint256 fee = (totalDue * feeBasisPoints) / 10000;
        if (fee > 0) {
            require(stableTokens[tokenAddress].transfer(feeCollector, fee), "fee transfer failed");
        }

        // reward to liquidator: 5% of principal (incentivo por limpieza)
        uint256 reward = (principal * 5) / 100;
        if (reward > 0) {
            require(stableTokens[tokenAddress].transfer(msg.sender, reward), "reward transfer failed");
        }

        uint256 remaining = totalDue;
        if (fee > 0) remaining -= fee;
        if (reward > 0) {
            // reward was transferred from contract balance, so deduct
            remaining = remaining >= reward ? remaining - reward : 0;
        }

        // credit remaining to pool liquidity and reduce outstanding loans
        totalLiquidity[tokenAddress] += remaining;
        if (outstandingLoans[tokenAddress] <= principal) {
            outstandingLoans[tokenAddress] = 0;
        } else {
            outstandingLoans[tokenAddress] -= principal;
        }

        // clear debtor's loan to prevent double-liquidation
        usuarios[deudor].montoActivo = 0;
        usuarios[deudor].vencimiento = 0;
        usuarios[deudor].enMora = false;
        usuarios[deudor].monedaActivo = address(0);

        // mark debtor as moroso in the on-chain bureau
        if (!esMoroso[deudor]) {
            esMoroso[deudor] = true;
            prestamosMorosos[deudor] += 1;
            penalizacionesAcumuladas[deudor] += penalizacionPorMora;
            emit MorosityUpdated(deudor, true);
        }

        // penalize reputation for default
        if (reputacion[deudor] >= penalizacionPorMora) {
            reputacion[deudor] -= penalizacionPorMora;
        } else {
            reputacion[deudor] = 0;
        }
        emit ReputationUpdated(deudor, reputacion[deudor]);

        emit LiquidationExecuted(msg.sender, deudor, tokenAddress, totalDue, reward);
        emit LoanLiquidated(deudor, msg.sender, tokenAddress, totalDue);
    }

    // --- Read helpers ---
    function obtenerLiquidezUsuario(address user) external view returns (uint256) {
        return usuarios[user].montoActivo;
    }

    // --- Prepare for immutability ---
    // Owner can renounce ownership to make contract immutable
    // (Ownable.renounceOwnership already available)

    // Compatibility convenience: expose niveles getter matching expected ABI
    function niveles(uint256 id) external view returns (uint256, uint256, uint256) {
        Level memory L = _niveles[id];
        return (L.montoPrestamo, L.plazo, L.tasaInteresBP);
    }
}
