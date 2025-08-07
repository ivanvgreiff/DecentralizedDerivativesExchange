// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/OptionsBook.sol";
import "../contracts/LogarithmicCallOption.sol";
import "../contracts/SimuOracle.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract LogarithmicCallOptionTest is Test {
    OptionsBook public optionsBook;
    LogarithmicCallOption public logCallImpl;
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

        // Mint balances to test users
        twoTK.mint(short, 1_000e18);
        mtk.mint(short, 1_000e18);
        mtk.mint(long, 1_000e18);

        // Deploy Oracle
        oracle = new SimuOracle();
        oracle.setPrice(address(twoTK), "2TK", 2);
        oracle.setPrice(address(mtk), "MTK", 1);

        // Deploy LogarithmicCallOption template
        logCallImpl = new LogarithmicCallOption();

        // Deploy OptionsBook with logCallImpl set
        optionsBook = new OptionsBook(
            address(0), // linear call impl
            address(0), // linear put impl
            address(0), // quad call
            address(0), // quad put
            address(logCallImpl), // log call
            address(0) // log put
        );

        vm.stopPrank();
    }

    function testLogCallResolveAndExercise() public {
        // ----- SHORT FUNDS OPTION THROUGH OPTIONSBOOK -----
        vm.startPrank(short);

        uint256 optionSize = 100e18;
        uint256 strikePrice = 1e18; // 1 MTK
        uint256 premium = 10e18;

        // Short approves 2TK to be transferred to option contract
        twoTK.approve(address(optionsBook), optionSize);

        address callOption = optionsBook.createAndFundCallOption(
            address(twoTK),
            address(mtk),
            "2TK",
            "MTK",
            strikePrice,
            optionSize,
            premium,
            address(oracle),
            "Logarithmic"
        );

        vm.stopPrank();

        // ----- LONG ENTERS OPTION THROUGH OPTIONSBOOK -----
        vm.startPrank(long);
        mtk.approve(address(optionsBook), premium);
        optionsBook.enterAndPayPremium(callOption);
        vm.stopPrank();

        // Advance time past expiry
        vm.warp(block.timestamp + 6 minutes);

        // ----- Set price to make it in-the-money -----
        // New price = 3 → priceAtExpiry > strike + 1/intensity
        oracle.setPrice(address(twoTK), "2TK", 3);

        // ----- LONG EXERCISES THE CALL THROUGH OPTIONSBOOK -----
        vm.startPrank(long);

        // Long approves MTK for optimal exercising
        // The contract will calculate and collect the optimal amount
        uint256 mtkToApprove = 100e18;
        mtk.approve(address(optionsBook), mtkToApprove);

        optionsBook.resolveAndExercise(callOption, 0);

        vm.stopPrank();
    }
}

// Simple ERC20 Mintable Token
contract MockERC20 is ERC20 {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {}
    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }
}
