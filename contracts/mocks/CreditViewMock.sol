// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract CreditViewMock {
    mapping(address => address) public padreOf;
    mapping(address => bool) public esMoroso;
    mapping(address => uint256) public nivelOf;
    mapping(address => bool) public adminOf;
    bool public paused;
    address public attester;
    address public owner;

    function redGenealogica(address usuario) external view returns (address padre, bool bonoActivacionCobrado) {
        return (padreOf[usuario], false);
    }

    function obtenerProgresoUsuario(address usuario)
        external
        view
        returns (uint256 nivelActual, uint256 solicitudesCompletadas, uint256 ultimoPrestamoTimestamp)
    {
        uint256 n = nivelOf[usuario];
        if (n == 0) n = 1;
        return (n, 0, 0);
    }

    function admins(address cuenta) external view returns (bool) {
        return adminOf[cuenta];
    }

    function setPadre(address usuario, address padre) external {
        padreOf[usuario] = padre;
    }

    function setMora(address usuario, bool mora) external {
        esMoroso[usuario] = mora;
    }

    function setPaused(bool value) external {
        paused = value;
    }

    function setAttester(address next) external {
        attester = next;
    }

    function setNivel(address usuario, uint256 nivel) external {
        nivelOf[usuario] = nivel;
    }

    function setAdmin(address cuenta, bool value) external {
        adminOf[cuenta] = value;
    }

    function setOwner(address next) external {
        owner = next;
    }
}
