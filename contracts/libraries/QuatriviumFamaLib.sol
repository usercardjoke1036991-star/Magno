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
    uint256 internal constant CARRIL_REF_BP = 1000;
    uint256 internal constant CARRIL_CHICO_PISO = 50e18;
    uint256 internal constant UTIL_GRANDE_NUM = 7000;
    uint256 internal constant UTIL_GRANDE_DEN = 8000;

    /// @notice Chico si el préstamo no pasa de max(50 USDT, 0,5 % de caja general).
    function umbralCarrilChico(uint256 caja) public pure returns (uint256 u) {
        u = (caja * CARRIL_REF_BP) / 200000;
        if (u < CARRIL_CHICO_PISO) u = CARRIL_CHICO_PISO;
    }

    function esCarrilChico(uint256 caja, uint256 monto) public pure returns (bool) {
        return monto > 0 && monto <= umbralCarrilChico(caja);
    }

    function liqGeneral(uint256 totalLiq, uint256 reservado) public pure returns (uint256) {
        return totalLiq > reservado ? totalLiq - reservado : 0;
    }

    /// @notice Hitos cada 100 hasta 1000: ~mitad del interés de ese préstamo (no 30 000 fijos).
    function bonoDeHito(uint256 hito) external pure returns (uint256) {
        if (hito == 100) return 400e18;
        if (hito == 200) return 4000e18;
        if (hito == 300) return 7000e18;
        if (hito == 400) return 8500e18;
        if (hito == 500) return 9000e18;
        if (hito == 600) return 11500e18;
        if (hito == 700) return 13500e18;
        if (hito == 800) return 16000e18;
        if (hito == 900) return 18000e18;
        if (hito == 1000) return 20000e18;
        return 0;
    }

    /// @notice Los grandes paran al 70 % si el tope global es 80 % (misma proporción si el admin mueve el 80 %).
    function topeUtilGrande(uint256 utilMaxBps) public pure returns (uint256) {
        return (utilMaxBps * UTIL_GRANDE_NUM) / UTIL_GRANDE_DEN;
    }

    function usaSelloPrimera(
        uint256 reserved,
        uint256 expira,
        uint256 ts,
        uint256 monto,
        uint256 nivel,
        bool nuncaPidio
    ) public pure returns (bool) {
        return nuncaPidio && nivel == 1 && monto == BONO_ACTIVACION && reserved >= BONO_ACTIVACION && ts <= expira;
    }

    function requireAcceso(
        uint256 totalLiq,
        uint256 reservado,
        uint256 outstanding,
        uint256 monto,
        uint256 utilMaxBps,
        bool esChico
    ) internal pure {
        require(monto > 0);
        uint256 base = liqGeneral(totalLiq, reservado);
        require(base >= outstanding + monto, "insufficient liquidity");
        uint256 utilAfter = ((outstanding + monto) * 10000) / base;
        if (!esChico) {
            require(utilAfter <= topeUtilGrande(utilMaxBps), "insufficient liquidity");
        }
        require(utilAfter <= utilMaxBps, "utilization cap");
    }

    function liberarSelloSiExpiro(
        mapping(address => uint256) storage reservaPrimera,
        mapping(address => uint256) storage reservaPrimeraExpira,
        mapping(address => address) storage reservaPrimeraToken,
        mapping(address => uint256) storage totalReservadoPrimera,
        address tokenHint,
        address user
    ) external {
        uint256 r = reservaPrimera[user];
        if (r == 0 || block.timestamp <= reservaPrimeraExpira[user]) return;
        address tkn = reservaPrimeraToken[user];
        if (tkn == address(0)) tkn = tokenHint;
        reservaPrimera[user] = 0;
        reservaPrimeraExpira[user] = 0;
        reservaPrimeraToken[user] = address(0);
        uint256 tot = totalReservadoPrimera[tkn];
        totalReservadoPrimera[tkn] = tot > r ? tot - r : 0;
    }

    function pagarActivacion(
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
        if (hermano != address(0) && padreOk && padre != address(0) && padre != deudor) {
            (bool okA, bytes memory rawA) = hermano.staticcall(abi.encodeWithSignature("alta()"));
            if (okA && rawA.length >= 32) {
                address alta = abi.decode(rawA, (address));
                if (alta != address(0)) {
                    (bool ok, bytes memory data) = alta.call(
                        abi.encodeWithSignature("soltarPadrino(address,address)", deudor, padre)
                    );
                    if (ok && data.length >= 32) {
                        bono = abi.decode(data, (uint256));
                        if (bono > 0) return bono;
                    }
                    return 0;
                }
            }
        }
        return pagarBonoPool(
            totalLiquidity,
            reputacion,
            token,
            tokenAddr,
            padre,
            deudor,
            padreOk,
            caja,
            piso,
            hermano
        );
    }

    function sellarPrimera(
        mapping(address => uint256) storage reservaPrimera,
        mapping(address => uint256) storage reservaPrimeraExpira,
        mapping(address => address) storage reservaPrimeraToken,
        mapping(address => uint256) storage totalReservadoPrimera,
        uint256 yaPidioTimestamp,
        address token,
        address user,
        uint256 selloDuracion
    ) public {
        if (yaPidioTimestamp != 0) return;
        uint256 r = reservaPrimera[user];
        if (r != 0 && block.timestamp <= reservaPrimeraExpira[user]) return;
        if (r != 0) {
            address tknOld = reservaPrimeraToken[user];
            if (tknOld == address(0)) tknOld = token;
            uint256 totOld = totalReservadoPrimera[tknOld];
            totalReservadoPrimera[tknOld] = totOld > r ? totOld - r : 0;
            reservaPrimera[user] = 0;
            reservaPrimeraExpira[user] = 0;
            reservaPrimeraToken[user] = address(0);
        }
        reservaPrimera[user] = BONO_ACTIVACION;
        reservaPrimeraExpira[user] = block.timestamp + selloDuracion;
        reservaPrimeraToken[user] = token;
        totalReservadoPrimera[token] += BONO_ACTIVACION;
    }

    function consumirSello(
        mapping(address => uint256) storage reservaPrimera,
        mapping(address => uint256) storage reservaPrimeraExpira,
        mapping(address => address) storage reservaPrimeraToken,
        mapping(address => uint256) storage totalReservadoPrimera,
        address token,
        address user
    ) external {
        uint256 r = reservaPrimera[user];
        address tkn = reservaPrimeraToken[user];
        reservaPrimera[user] = 0;
        reservaPrimeraExpira[user] = 0;
        reservaPrimeraToken[user] = address(0);
        if (tkn == address(0)) tkn = token;
        uint256 tot = totalReservadoPrimera[tkn];
        totalReservadoPrimera[tkn] = tot > r ? tot - r : 0;
    }

    event ReputationUpdated(address indexed usuario, uint256 nuevaReputacion);
    event ComisionGeneracional(
        address indexed beneficiario,
        address indexed deudor,
        uint8 generacion,
        uint256 monto,
        address indexed token
    );

    /// @notice Donar y aportar: 100 fama por cada 1 USDT, desde el primero.
    function ptsDonacion(uint256, uint256 amount) external pure returns (uint256) {
        if (amount == 0) return 0;
        return (amount * 100) / 1e18;
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
    ) public returns (uint256 bono) {
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

    /// @notice Si Fama tiene Alta, el préstamo exige el pago de 4 USDT (registroHecho).
    function requireAltaPagada(address hermano, address user) external view {
        (bool okA, bytes memory rawA) = hermano.staticcall(abi.encodeWithSignature("alta()"));
        if (!(okA && rawA.length >= 32)) return;
        address alta = abi.decode(rawA, (address));
        if (alta == address(0)) return;
        (bool ok, bytes memory data) = alta.staticcall(
            abi.encodeWithSignature("registroHecho(address)", user)
        );
        require(ok && data.length >= 32 && abi.decode(data, (bool)));
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
