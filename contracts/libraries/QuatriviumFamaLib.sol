// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @dev Nodo Unilevel. Vive aquí para que la fama de línea pueda
///      ejecutarse por delegatecall sin duplicar el layout.
struct Usuario {
    address padre;
    bool bonoActivacionCobrado;
}

/**
 * @title QuatriviumFamaLib
 * @notice Fama decreciente al registrar. Contrato hermano del núcleo:
 *         el bytecode no cuenta para el tope EIP-170 de QuatriviumCredit.
 */
library QuatriviumFamaLib {
    uint256 internal constant PUNTOS_POR_REFERIDO = 50;
    uint256 internal constant GEN1_BP = 1500;
    uint256 internal constant FUNDADOR_BP = 1500;
    uint256 internal constant GEN2_BP = 800;
    uint256 internal constant GEN3_BP = 600;
    uint256 internal constant GEN4_BP = 400;
    uint256 internal constant GEN5_BP = 200;
    uint8 internal constant MAX_LINEA = 40;

    event ReputationUpdated(address indexed usuario, uint256 nuevaReputacion);

    function acreditarFama(
        mapping(address => uint256) storage reputacion,
        mapping(address => bool) storage cuentaDestruida,
        mapping(address => Usuario) storage red,
        address nuevo,
        address padre,
        address founder
    ) external {
        if (founder != address(0) && founder != nuevo && !cuentaDestruida[founder]) {
            reputacion[founder] += _famaPts(FUNDADOR_BP);
            emit ReputationUpdated(founder, reputacion[founder]);
        }
        address cursor = padre;
        for (uint8 gen = 1; gen <= MAX_LINEA; ) {
            if (cursor == address(0) || cursor == nuevo) {
                break;
            }
            if (!cuentaDestruida[cursor]) {
                reputacion[cursor] += _famaPts(_bpGeneracion(gen));
                emit ReputationUpdated(cursor, reputacion[cursor]);
            }
            cursor = red[cursor].padre;
            unchecked {
                gen++;
            }
        }
    }

    function _famaPts(uint256 bp) private pure returns (uint256) {
        return (PUNTOS_POR_REFERIDO * bp) / GEN1_BP;
    }

    function _bpGeneracion(uint8 generacion) private pure returns (uint256) {
        if (generacion == 1) return GEN1_BP;
        if (generacion == 2) return GEN2_BP;
        if (generacion == 3) return GEN3_BP;
        if (generacion == 4) return GEN4_BP;
        if (generacion == 5) return GEN5_BP;
        if (generacion <= 12) return 80;
        return 40;
    }
}
