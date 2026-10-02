// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AggregatorV3Interface} from "../interfaces/AggregatorV3Interface.sol";
import {IQuatriviumFamaCaja} from "../interfaces/IQuatriviumFamaCaja.sol";

/**
 * @title QuatriviumFamaLib
 * @notice Ganchos y peg. El bytecode de la librería no cuenta para EIP-170 del núcleo.
 */
library QuatriviumFamaLib {
    using SafeERC20 for IERC20;

    uint256 internal constant BONO_ACTIVACION = 1e18;
    uint256 internal constant ORIGINACION_DIA_BP = 1000;
    /// @notice Suelo humano. El 0,5 % de umbral es ORIGINACION_DIA_BP / 20.
    uint256 internal constant ORIGINACION_DIA_PISO = 50e18;

    /// @notice Chico si el préstamo no pasa de max(50 USDT, 0,5 % de caja).
    function umbralCarrilChico(uint256 caja) public pure returns (uint256 u) {
        u = (caja * ORIGINACION_DIA_BP) / 200000;
        if (u < ORIGINACION_DIA_PISO) u = ORIGINACION_DIA_PISO;
    }

    function esCarrilChico(uint256 caja, uint256 monto) public pure returns (bool) {
        return monto > 0 && monto <= umbralCarrilChico(caja);
    }

    /// @notice Potómetro grande: 10 % de caja libre.
    function topeOriginacionDia(uint256 caja) public pure returns (uint256 room) {
        room = (caja * ORIGINACION_DIA_BP) / 10000;
        if (room > caja) room = caja;
    }

    /// @notice Potómetro chico: max(50 USDT, 10 % de caja), nunca más que la caja.
    function topeCarrilChico(uint256 caja) public pure returns (uint256 room) {
        room = (caja * ORIGINACION_DIA_BP) / 10000;
        if (room < ORIGINACION_DIA_PISO) room = ORIGINACION_DIA_PISO;
        if (room > caja) room = caja;
    }

    function consumirCupo(
        uint256 caja,
        uint256 yaChico,
        uint256 yaGrande,
        uint256 add
    ) external pure returns (uint256, uint256) {
        require(add > 0);
        if (add <= umbralCarrilChico(caja)) {
            require(yaChico + add <= topeCarrilChico(caja));
            return (yaChico + add, yaGrande);
        }
        require(yaGrande + add <= topeOriginacionDia(caja));
        return (yaChico, yaGrande + add);
    }

    event ReputationUpdated(address indexed usuario, uint256 nuevaReputacion);
    event ComisionGeneracional(
        address indexed beneficiario,
        address indexed deudor,
        uint8 generacion,
        uint256 monto,
        address indexed token
    );

    /// @notice Los primeros 2 USDT de donación son la puerta Real: no dan fama.
    function ptsDonacion(uint256 prev, uint256 amount) external pure returns (uint256) {
        uint256 gate = 2 * BONO_ACTIVACION;
        if (amount == 0) return 0;
        uint256 famable = prev >= gate ? amount : (prev + amount > gate ? prev + amount - gate : 0);
        return (famable * 100) / 1e18;
    }

    function tocar(address hermano, address who, uint256 pts) external {
        if (hermano == address(0) || who == address(0)) return;
        if (pts == 0) {
            IQuatriviumFamaCaja(hermano).wipe(who);
            return;
        }
        IQuatriviumFamaCaja(hermano).acreditar(who, pts);
    }

    function onCierre(address hermano, address deudor, address padre) external {
        if (hermano == address(0) || deudor == address(0) || padre == address(0) || padre == deudor) return;
        IQuatriviumFamaCaja(hermano).onCierrePrestamo(deudor, padre);
    }

    function sacarCaja(
        mapping(address => uint256) storage totalLiquidity,
        IERC20 token,
        address tokenAddr,
        address to,
        uint256 amount,
        uint256 caja,
        uint256 piso
    ) external {
        require(to != address(0) && to != address(this) && amount > 0);
        require(caja > piso && caja - piso >= amount);
        require(token.balanceOf(address(this)) >= amount);
        totalLiquidity[tokenAddr] -= amount;
        token.safeTransfer(to, amount);
    }

    function pagarBonoPool(
        mapping(address => uint256) storage totalLiquidity,
        mapping(address => uint256) storage reputacion,
        IERC20 token,
        address tokenAddr,
        address padre,
        address deudor,
        bool padreOk,
        uint256 caja,
        uint256 piso,
        address hermano
    ) external returns (uint256 bono) {
        if (!padreOk || padre == address(0) || padre == deudor) {
            return 0;
        }
        bono = BONO_ACTIVACION;
        if (caja <= piso || caja - piso < bono) return 0;
        totalLiquidity[tokenAddr] -= bono;
        token.safeTransfer(padre, bono);
        emit ComisionGeneracional(padre, deudor, 1, bono, tokenAddr);
        reputacion[padre] += 100;
        emit ReputationUpdated(padre, reputacion[padre]);
        if (hermano != address(0)) {
            IQuatriviumFamaCaja(hermano).acreditarFamaRed(deudor);
        }
    }

    function alimentarPool(
        mapping(address => uint256) storage totalLiquidity,
        IERC20 token,
        address tokenAddr,
        address from,
        uint256 amount
    ) external {
        require(from != address(0) && (amount == 5e17 || amount == 1e18));
        token.safeTransferFrom(from, address(this), amount);
        totalLiquidity[tokenAddr] += amount;
    }

    function recoverAttest(
        address user,
        bytes32 phoneHash,
        bytes32 deviceHash,
        uint256 deadline,
        uint256 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external view returns (address recovered) {
        if (v != 27 && v != 28) return address(0);
        if (uint256(s) > 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0) {
            return address(0);
        }
        bytes32 packed = keccak256(
            abi.encode(user, phoneHash, deviceHash, deadline, nonce, block.chainid, address(this))
        );
        recovered = ecrecover(
            keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", packed)),
            v,
            r,
            s
        );
    }

    function assertPeg(AggregatorV3Interface feed) external view {
        require(address(feed) != address(0));
        (
            uint80 roundId,
            int256 price,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        ) = feed.latestRoundData();
        require(price > 0);
        uint8 dec = feed.decimals();
        require(dec >= 2 && dec <= 18);
        int256 threshold = int256(uint256(98) * (10 ** uint256(dec - 2)));
        require(price >= threshold);
        require(updatedAt > 0 && block.timestamp - updatedAt <= 30 minutes);
        require(roundId > 0 && answeredInRound == roundId);
        require(startedAt > 0 && startedAt <= updatedAt);
    }
}
