// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {QuatriviumCredit} from "../contracts/QuatriviumCredit.sol";
import {QuatriviumFamaCaja} from "../contracts/QuatriviumFamaCaja.sol";
import {QuatriviumFamaLib} from "../contracts/libraries/QuatriviumFamaLib.sol";
import {QuatriviumReserva} from "../contracts/QuatriviumReserva.sol";
import {ERC20Mock} from "../contracts/mocks/ERC20Mock.sol";
import {MockV3Aggregator} from "../contracts/mocks/MockV3Aggregator.sol";
import {CreditViewMock} from "../contracts/mocks/CreditViewMock.sol";

contract QuatriviumAuditForgeTest is Test {
    uint256 internal constant EIP170 = 24576;
    ERC20Mock internal token;
    MockV3Aggregator internal feed;
    QuatriviumCredit internal credit;
    QuatriviumFamaCaja internal fama;
    address internal owner;
    uint256 internal ownerPk;
    address internal user;
    address internal liquidator;

    function setUp() public {
        vm.warp(1_704_000_000);
        ownerPk = 0xA11CE;
        owner = vm.addr(ownerPk);
        user = makeAddr("user");
        liquidator = makeAddr("liquidator");
        vm.deal(owner, 10 ether);

        token = new ERC20Mock();
        feed = new MockV3Aggregator(8, 100000000);
        address[] memory admins = new address[](1);
        admins[0] = owner;
        uint64 nonce = vm.getNonce(owner);
        address predictedCredit = vm.computeCreateAddress(owner, nonce + 1);
        vm.startPrank(owner);
        fama = new QuatriviumFamaCaja(address(token), predictedCredit);
        credit = new QuatriviumCredit(
            address(token),
            address(feed),
            payable(owner),
            500,
            admins,
            1,
            address(fama)
        );
        vm.stopPrank();
        require(address(credit) == predictedCredit, "credit pred");

        token.mint(owner, 10_000 ether);
        vm.startPrank(owner, owner);
        token.approve(address(credit), type(uint256).max);
        credit.depositarLiquidez(address(token), 500 ether);
        vm.stopPrank();
    }

    function test_runtime_fits_eip170() public view {
        assertLe(address(credit).code.length, EIP170);
    }

    function test_donate_exact_gate_gives_zero_fame() public {
        _onboard(user);
        _donate(user, 2 ether);
        assertEq(fama.famaCaja(user), 0);
        assertEq(credit.donado(user), 2 ether);
    }

    function test_donate_dust_then_gate_gives_zero_fame() public {
        _onboard(user);
        _donate(user, 1);
        _donate(user, 2 ether);
        assertEq(fama.famaCaja(user), 0);
        _donate(user, 3 ether);
        assertEq(fama.famaCaja(user), 300);
    }

    function test_donate_three_credits_only_excess() public {
        _onboard(user);
        _donate(user, 3 ether);
        assertEq(fama.famaCaja(user), 100);
    }

    function testFuzz_donate_never_fames_first_two_usdt(uint96 aRaw, uint96 bRaw) public {
        uint256 a = bound(aRaw, 1, 20 ether);
        uint256 b = bound(bRaw, 1, 20 ether);
        _onboard(user);
        _donate(user, a);
        _donate(user, b);
        uint256 expected = QuatriviumFamaLib.ptsDonacion(0, a) + QuatriviumFamaLib.ptsDonacion(a, b);
        assertEq(fama.famaCaja(user), expected);
    }

    function test_self_liquidate_reverts() public {
        _onboard(user);
        vm.prank(user, user);
        credit.solicitarPrestamo(address(token), 0);
        (, , uint256 vencimiento,,,) = credit.usuarios(user);
        vm.warp(vencimiento + 10);
        token.mint(user, 20 ether);
        vm.prank(user, user);
        vm.expectRevert();
        credit.liquidate(user, address(token));
        (, uint256 montoActivo,,,,) = credit.usuarios(user);
        assertGt(montoActivo, 0);
    }

    function test_third_party_liquidate_keeps_nav() public {
        _onboard(user);
        vm.prank(user, user);
        credit.solicitarPrestamo(address(token), 0);
        (, , uint256 vencimiento,,,) = credit.usuarios(user);
        vm.warp(vencimiento + 10);
        token.mint(liquidator, 50 ether);
        vm.prank(liquidator);
        token.approve(address(credit), type(uint256).max);
        vm.prank(liquidator, liquidator);
        credit.liquidate(user, address(token));
        _assertNav();
        (, uint256 montoActivo,,,,) = credit.usuarios(user);
        assertEq(montoActivo, 0);
    }

    function test_paused_still_allows_repay() public {
        _onboard(user);
        vm.prank(user, user);
        credit.solicitarPrestamo(address(token), 0);
        (,, uint256 total,) = credit.obtenerDeuda(user);
        vm.prank(owner);
        credit.pausarContrato();
        vm.prank(user, user);
        credit.pagarPrestamo(address(token), total);
        (, uint256 montoActivo,,,,) = credit.usuarios(user);
        assertEq(montoActivo, 0);
        _assertNav();
    }

    function test_stale_peg_blocks_borrow_and_donate() public {
        _onboard(user);
        feed.setRound(2, 100000000, block.timestamp - 4000, block.timestamp - 31 minutes, 2);
        vm.prank(user, user);
        vm.expectRevert();
        credit.solicitarPrestamo(address(token), 0);
        vm.prank(user, user);
        vm.expectRevert();
        credit.donar(address(token), 2 ether);
    }

    function test_depeg_blocks_deposit() public {
        feed.updateAnswer(97000000);
        vm.prank(owner, owner);
        vm.expectRevert();
        credit.depositarLiquidez(address(token), 1 ether);
    }

    function test_attest_replay_reverts() public {
        vm.prank(user, user);
        credit.registrarHumanoConPadre(address(0));
        (uint8 v, bytes32 r, bytes32 s, bytes32 phoneHash, bytes32 deviceHash, uint256 deadline) = _signAttest(user);
        vm.prank(user, user);
        credit.vincularIdentidad(phoneHash, deviceHash, deadline, v, r, s);
        vm.prank(user, user);
        vm.expectRevert();
        credit.vincularIdentidad(phoneHash, deviceHash, deadline, v, r, s);
    }

    function test_failed_admin_execute_can_retry() public {
        bytes memory data = abi.encodeWithSelector(QuatriviumCredit.retirarComisionesToken.selector, address(token));
        vm.prank(owner);
        uint256 id = credit.proposeAdminAction(data);
        vm.warp(block.timestamp + 72 hours + 1);
        vm.prank(owner);
        vm.expectRevert();
        credit.executeAdminAction(id);
        (,,,, bool executed,) = credit.proposals(id);
        assertFalse(executed);

        _onboard(user);
        vm.prank(user, user);
        credit.solicitarPrestamo(address(token), 0);
        (, , uint256 vencimiento,,,) = credit.usuarios(user);
        vm.warp(vencimiento + 10);
        token.mint(liquidator, 50 ether);
        vm.prank(liquidator);
        token.approve(address(credit), type(uint256).max);
        vm.prank(liquidator, liquidator);
        credit.liquidate(user, address(token));
        assertGt(credit.collectedFees(address(token)), 0);

        vm.prank(owner);
        credit.executeAdminAction(id);
        (,,,, bool done,) = credit.proposals(id);
        assertTrue(done);
        assertEq(credit.collectedFees(address(token)), 0);
        _assertNav();
    }

    function test_canje_respects_cash_floor() public {
        _onboard(user);
        _donate(user, 5 ether);
        assertEq(fama.famaCaja(user), 300);
        // Pool is 500; 20% floor = 100. Redeem 250 fame = 1 USDT, allowed.
        vm.prank(user, user);
        fama.canjearFama(250);
        assertEq(fama.famaCanjeada(user), 250);
        _assertNav();
    }

    function test_pagarCanje_only_fama_sibling() public {
        vm.prank(user, user);
        vm.expectRevert();
        credit.pagarCanje(address(token), user, 1 ether);
    }

    function test_no_destroy_selector() public {
        (bool ok,) = address(credit).call(abi.encodeWithSignature("destruirCuenta(address)", address(token)));
        assertFalse(ok);
    }

    function test_founder_cannot_self_donate() public {
        token.mint(owner, 5 ether);
        vm.prank(owner, owner);
        vm.expectRevert();
        credit.donar(address(token), 5 ether);
    }

    function test_contract_cannot_borrow() public {
        BorrowProxy proxy = new BorrowProxy(credit);
        vm.expectRevert();
        proxy.borrow();
    }

    function testFuzz_nav_after_repay(uint8 extraMint) public {
        _onboard(user);
        vm.prank(user, user);
        credit.solicitarPrestamo(address(token), 0);
        (,, uint256 total,) = credit.obtenerDeuda(user);
        token.mint(user, uint256(extraMint) * 1e15);
        vm.prank(user, user);
        credit.pagarPrestamo(address(token), total);
        _assertNav();
    }

    function test_boost_daily_cap_and_two_key_resume() public {
        CreditViewMock vista = new CreditViewMock();
        address founder = makeAddr("boost-founder");
        address attester = makeAddr("boost-attester");
        address locker = makeAddr("boost-locker");
        QuatriviumReserva reserva = new QuatriviumReserva(address(token), founder, address(vista), address(vista));
        vista.setAttester(attester);
        vista.setAdmin(founder, true);
        vista.setNivel(locker, 10);
        vista.setPayToken(address(token));
        token.mint(address(vista), 200 ether);
        token.mint(founder, 200 ether);
        token.mint(locker, 600 ether);
        vm.prank(founder, founder);
        token.approve(address(reserva), type(uint256).max);
        vm.prank(locker, locker);
        token.approve(address(reserva), type(uint256).max);
        vm.prank(founder, founder);
        reserva.aportarBote(20 ether);
        vm.prank(locker, locker);
        reserva.bloquear(500 ether);

        bytes32 salt = keccak256("cap");
        vm.prank(attester, attester);
        vm.expectRevert(QuatriviumReserva.TopeDiario.selector);
        reserva.pagarBoostComision(locker, 1_000_000 ether, salt);

        address g2 = makeAddr("g2");
        reserva.addGuardian(g2);
        vm.warp(block.timestamp + 72 hours + 1);
        reserva.applyGuardian();
        reserva.pausarBoost();
        reserva.reanudarBoost();
        assertTrue(reserva.boostPausado());
        vm.prank(g2);
        reserva.reanudarBoost();
        assertFalse(reserva.boostPausado());
    }

    function _onboard(address who) internal {
        vm.prank(who, who);
        credit.registrarHumanoConPadre(address(0));
        _attest(who);
        vm.prank(who, who);
        credit.declararKyc();
        token.mint(who, 80 ether);
        vm.prank(who);
        token.approve(address(credit), type(uint256).max);
    }

    function _donate(address who, uint256 amount) internal {
        token.mint(who, amount);
        vm.prank(who);
        token.approve(address(credit), type(uint256).max);
        vm.prank(who, who);
        credit.donar(address(token), amount);
    }

    function _attest(address who) internal {
        (uint8 v, bytes32 r, bytes32 s, bytes32 phoneHash, bytes32 deviceHash, uint256 deadline) = _signAttest(who);
        vm.prank(who, who);
        credit.vincularIdentidad(phoneHash, deviceHash, deadline, v, r, s);
    }

    function _signAttest(address who)
        internal
        view
        returns (uint8 v, bytes32 r, bytes32 s, bytes32 phoneHash, bytes32 deviceHash, uint256 deadline)
    {
        phoneHash = keccak256(abi.encodePacked(who, ":phone"));
        deviceHash = keccak256(abi.encodePacked(who, ":device"));
        deadline = block.timestamp + 3600;
        bytes32 packed = keccak256(
            abi.encode(who, phoneHash, deviceHash, deadline, credit.attestNonce(who), block.chainid, address(credit))
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", packed));
        (v, r, s) = vm.sign(ownerPk, digest);
    }

    function _assertNav() internal view {
        uint256 cash = token.balanceOf(address(credit));
        uint256 outstanding = credit.outstandingLoans(address(token));
        uint256 liquidity = credit.totalLiquidity(address(token));
        uint256 fees = credit.collectedFees(address(token));
        assertEq(cash + outstanding, liquidity + fees, "NAV broken");
    }
}

contract BorrowProxy {
    QuatriviumCredit internal immutable credit;

    constructor(QuatriviumCredit credit_) {
        credit = credit_;
    }

    function borrow() external {
        credit.solicitarPrestamo(address(0), 0);
    }
}

contract FamaLibPtsTest is Test {
    function testFuzz_ptsDonacion_never_credits_gate(uint256 prev, uint256 amount) public pure {
        prev = bound(prev, 0, 100 ether);
        amount = bound(amount, 0, 100 ether);
        uint256 pts = QuatriviumFamaLib.ptsDonacion(prev, amount);
        uint256 famable = prev >= 2 ether ? amount : (prev + amount > 2 ether ? prev + amount - 2 ether : 0);
        assertEq(pts, (famable * 100) / 1e18);
        if (prev + amount <= 2 ether) assertEq(pts, 0);
    }
}
