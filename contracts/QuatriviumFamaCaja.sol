// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ICreditCaja {
    function pagarCanje(address token, address to, uint256 amount) external;
    function humanosVerificados(address) external view returns (bool);
    function blacklist(address) external view returns (bool);
    function dispersionCongelada(address usuario) external view returns (bool);
    function paused() external view returns (bool);
    function cuentaDestruida(address) external view returns (bool);
}

/**
 * @title QuatriviumFamaCaja
 * @notice Hermano del crédito: fama de caja y canje contra el pool.
 *         100 fama por USDT donado o aportado, 100 al padrino en el primer L1 pagado.
 *         Canje: 250 fama disponible = 1 USDT. El perfil de fama no baja.
 *         EIP-170: no vive en QuatriviumCredit.
 */
contract QuatriviumFamaCaja is ReentrancyGuard {
    uint256 public constant FAMA_POR_USDT = 100;
    uint256 public constant FAMA_POR_REFERIDO_L1 = 100;
    uint256 public constant FAMA_CANJE_POR_USDT = 250;

    address public immutable credit;
    address public immutable token;

    mapping(address => uint256) public famaCaja;
    mapping(address => uint256) public famaCanjeada;

    error SoloCredit();
    error SoloEOA();
    error DestinoCero();
    error NoHumano();
    error FamaInvalida();
    error SinFama();
    error CreditoPausado();

    event FamaAcreditada(address indexed usuario, uint256 pts);
    event FamaCanjeada(address indexed usuario, uint256 fama, uint256 monto, address indexed token);
    event FamaBorrada(address indexed usuario);

    constructor(address token_, address credit_) {
        if (token_ == address(0) || credit_ == address(0)) revert DestinoCero();
        token = token_;
        credit = credit_;
    }

    modifier onlyCredit() {
        if (msg.sender != credit) revert SoloCredit();
        _;
    }

    function famaDisponible(address usuario) public view returns (uint256) {
        uint256 ganada = famaCaja[usuario];
        uint256 cobrada = famaCanjeada[usuario];
        return ganada > cobrada ? ganada - cobrada : 0;
    }

    function acreditar(address who, uint256 pts) external onlyCredit {
        if (who == address(0) || pts == 0) return;
        famaCaja[who] += pts;
        emit FamaAcreditada(who, pts);
    }

    function wipe(address who) external onlyCredit {
        famaCaja[who] = 0;
        famaCanjeada[who] = 0;
        emit FamaBorrada(who);
    }

    function canjearFama(uint256 fama) external nonReentrant {
        if (tx.origin != msg.sender) revert SoloEOA();
        ICreditCaja nucleo = ICreditCaja(credit);
        if (nucleo.paused()) revert CreditoPausado();
        if (
            !nucleo.humanosVerificados(msg.sender)
                || nucleo.blacklist(msg.sender)
                || nucleo.dispersionCongelada(msg.sender)
                || nucleo.cuentaDestruida(msg.sender)
        ) revert NoHumano();
        if (fama < FAMA_CANJE_POR_USDT || fama % FAMA_CANJE_POR_USDT != 0) revert FamaInvalida();
        if (fama > famaDisponible(msg.sender)) revert SinFama();
        uint256 pago = (fama * 1e18) / FAMA_CANJE_POR_USDT;
        famaCanjeada[msg.sender] += fama;
        nucleo.pagarCanje(token, msg.sender, pago);
        emit FamaCanjeada(msg.sender, fama, pago, token);
    }
}
