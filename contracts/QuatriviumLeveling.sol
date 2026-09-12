// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {LoanTierSeed} from "./libraries/LoanTierSeed.sol";

/**
 * @title QuatriviumLeveling
 * @notice Contrato hermano: escalera de solicitudes y bono del nivel 100.
 *         El núcleo no importa este archivo (EIP-170). Se cableará en el próximo deploy.
 *
 * Reglas: 1–5 → 3; 6–9 → 5; desde 10 (100 USDT) → 5, 10, 15…; 100 → 455 y bono 2000 USDT.
 */
contract QuatriviumLeveling {
    uint256 public constant BONO_NIVEL_MAXIMO = 2000e18;
    uint256 internal constant PISO_CAJA_BP = 2000;

    function requiredCount(uint256 nivel) public pure returns (uint256) {
        if (nivel == 0 || nivel > LoanTierSeed.MAX_NIVEL) return 0;
        if (nivel <= 5) return 3;
        if (nivel < 10) return 5;
        unchecked {
            return 5 * (nivel - 9);
        }
    }

    function canPayMaxBonus(uint256 cajaLibre, uint256 liquidezTotal) public pure returns (bool) {
        uint256 piso = (liquidezTotal * PISO_CAJA_BP) / 10000;
        return cajaLibre > piso && cajaLibre - piso >= BONO_NIVEL_MAXIMO;
    }
}
