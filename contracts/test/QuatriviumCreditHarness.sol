// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {QuatriviumCredit} from "../QuatriviumCredit.sol";

/// @dev Solo tests: fuerza el nivel de progreso para probar bonos de hito.
contract QuatriviumCreditHarness is QuatriviumCredit {
    constructor(
        address usdt,
        address feed,
        address payable feeCollector_,
        uint256 feeBp,
        address[] memory admins_,
        uint256 confirms
    ) QuatriviumCredit(usdt, feed, feeCollector_, feeBp, admins_, confirms) {}

    function forceNivel(address usuario, uint256 nivel) external {
        progresoUsuarios[usuario].nivelActual = nivel;
    }
}
