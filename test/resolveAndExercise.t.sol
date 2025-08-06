// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/OptionsBook.sol";
import "../contracts/CallOptionContract.sol";
import "../contracts/PutOptionContract.sol";
import "../contracts/SimuOracle.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract exerciseTest is Test {
    OptionsBook public optionsBook;
    CallOptionContract public callImpl;
    PutOptionContract public putImpl;
    SimuOracle public oracle;
    MockERC20 public twoTK;
    MockERC20 public mtk;

    address public short = address(0x1);
    address public long = address(0x2);

    function setUp() public {
        vm.startPrank(address(this));

        // Deploy mock tokens
        twoTK = new MockERC20("TwoToken", "2TK");
        mtk = new MockERC20("MoneyToken", "MTK");

        // Mint to test accounts
        twoTK.mint(short, 1_000e18);
        mtk.mint(short, 1_000e18);
        mtk.mint(long, 1_000e18);

        // Deploy Oracle
        oracle = new SimuOracle();

        // PRICE SETUP (makes PUT profitable):
        // 2TK = 1
        // MTK = 1
        // strikePrice = 2 → put is profitable if 2TK < 2 MTK
        oracle.setPrice(address(twoTK), "2TK", 1);
        oracle.setPrice(address(mtk), "MTK", 1);

        // Deploy option templates
        callImpl = new CallOptionContract();
        putImpl = new PutOptionContract();

        // Deploy OptionsBook (adding dummy addresses for quadratic and logarithmic implementations)
        optionsBook = new OptionsBook(
            address(callImpl), 
            address(putImpl), 
            address(0), // quadraticCallImpl - dummy for tests
            address(0), // quadraticPutImpl - dummy for tests
            address(0), // logarithmicCallImpl - dummy for tests
            address(0)  // logarithmicPutImpl - dummy for tests
        );

        vm.stopPrank();
    }

    function testProfitablePutResolvesAndExercises() public {
        vm.startPrank(short);

        // Approve & create PUT option (short deposits MTK)
        uint256 strikeDeposit = (100e18 * 2e18) / 1e18; // = 200 MTK
        mtk.approve(address(optionsBook), strikeDeposit);
        address putAddr = optionsBook.createAndFundPutOption(
            address(twoTK),
            address(mtk),
            "2TK",
            "MTK",
            2e18,     // strike price: 2 MTK per 1 2TK
            100e18,   // option size: 100 2TK
            10e18,    // premium
            address(oracle),
            "Linear"  // payoffType
        );

        vm.stopPrank();

        vm.startPrank(long);

        // Approve and pay premium
        mtk.approve(address(optionsBook), 10e18);
        optionsBook.enterAndPayPremium(putAddr);

        // Fast-forward past expiry
        vm.warp(block.timestamp + 6 minutes);

        // Mint 100 2TK to long for exercising
        twoTK.mint(long, 100e18);
        twoTK.approve(address(optionsBook), 100e18);

        // Exercise the PUT — should succeed
        optionsBook.resolveAndExercise(putAddr, 100e18);

        vm.stopPrank();
    }
}

// ✅ Placed outside the main contract
contract MockERC20 is ERC20 {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {}

    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }
}
