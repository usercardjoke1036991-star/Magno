// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title QuatriviumLeveling
 * @notice Misma curva de solicitudes que el núcleo + bonos de hito cada 100 niveles.
 *         L1 → 3; L2–9 → 5; desde $100 (L10) → 5, 10, 15…; L1000 no sube.
 *         Bono = 20 USDT × nivel del hito (100 → 2000, 200 → 4000, 1000 → 20 000).
 */
contract QuatriviumLeveling {
    uint256 public constant BONO_POR_NIVEL = 20e18;
    uint256 public constant HITO_PASO = 100;
    uint256 public constant BONO_NIVEL_MAXIMO = 20000e18;
    uint256 public constant BONO_HITOS_TOTAL = 110000e18;
    uint256 public constant MAX_NIVEL = 1000;
    uint256 internal constant PISO_CAJA_BP = 2000;

    function requiredCount(uint256 nivel) public pure returns (uint256) {
        if (nivel < 1 || nivel >= MAX_NIVEL) return 0;
        if (nivel <= 1) return 3;
        if (nivel < 10) return 5;
        unchecked {
            return 5 * (nivel - 9);
        }
    }

    function hitoAlcanzado(uint256 nivel) public pure returns (uint256) {
        if (nivel < HITO_PASO) return 0;
        uint256 h = nivel - (nivel % HITO_PASO);
        return h > MAX_NIVEL ? MAX_NIVEL : h;
    }

    function siguienteHito(uint256 cobrado, uint256 nivel) public pure returns (uint256) {
        uint256 next = cobrado + HITO_PASO;
        uint256 reached = hitoAlcanzado(nivel);
        if (next < HITO_PASO || next > MAX_NIVEL || next > reached) return 0;
        return next;
    }

    function bonoDeHito(uint256 hito) public pure returns (uint256) {
        if (hito < HITO_PASO || hito > MAX_NIVEL || hito % HITO_PASO != 0) return 0;
        return hito * BONO_POR_NIVEL;
    }

    function canPayHito(uint256 cajaLibre, uint256 liquidezTotal, uint256 hito) public pure returns (bool) {
        uint256 bono = bonoDeHito(hito);
        if (bono == 0) return false;
        uint256 piso = (liquidezTotal * PISO_CAJA_BP) / 10000;
        return cajaLibre > piso && cajaLibre - piso >= bono;
    }

    function canPayMaxBonus(uint256 cajaLibre, uint256 liquidezTotal) public pure returns (bool) {
        return canPayHito(cajaLibre, liquidezTotal, MAX_NIVEL);
    }
}
