// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface ICreditAlta {
    function fundador() external view returns (address);
    function paused() external view returns (bool);
}

interface IReservaAlta {
    function onAlta(uint256 monto) external;
}

/// @title QuatriviumAlta
/// @notice 3 USDT del registro (fundador + Reserva + padrino). El 4º es pagarVerificacion(1) del usuario.
contract QuatriviumAlta is ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable token;
    ICreditAlta public immutable credit;
    address public immutable reserva;
    mapping(address => uint256) public padrinoApartado;

    error DestinoCero();
    error SoloEOA();
    error Pausado();
    error YaRegistro();

    event RegistroPagado(address indexed usuario);
    event PadrinoSoltado(address indexed referido, address indexed padre, uint256 monto);

    constructor(address token_, address credit_, address reserva_) {
        if (token_ == address(0) || credit_ == address(0) || reserva_ == address(0)) revert DestinoCero();
        token = IERC20(token_);
        credit = ICreditAlta(credit_);
        reserva = reserva_;
    }

    function pagarRegistro() external nonReentrant {
        if (tx.origin != msg.sender) revert SoloEOA();
        if (credit.paused()) revert Pausado();
        if (padrinoApartado[msg.sender] != 0) revert YaRegistro();
        address fundador = credit.fundador();
        if (fundador == address(0)) revert DestinoCero();
        token.safeTransferFrom(msg.sender, address(this), 3e18);
        token.safeTransfer(fundador, 1e18);
        token.safeTransfer(reserva, 1e18);
        IReservaAlta(reserva).onAlta(1e18);
        padrinoApartado[msg.sender] = 1e18;
        emit RegistroPagado(msg.sender);
    }

    function soltarPadrino(address deudor, address padre) external returns (uint256) {
        if (msg.sender != address(credit)) revert DestinoCero();
        uint256 monto = padrinoApartado[deudor];
        if (monto == 0 || padre == address(0) || padre == deudor) return 0;
        padrinoApartado[deudor] = 0;
        token.safeTransfer(padre, monto);
        emit PadrinoSoltado(deudor, padre, monto);
        return monto;
    }
}
