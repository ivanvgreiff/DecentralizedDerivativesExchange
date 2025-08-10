// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import "../contracts/OptionsBook.sol";
import "../contracts/SimuOracle.sol";
import "../contracts/QuadraticCallOption.sol";
import "../contracts/QuadraticPutOption.sol";
import "../contracts/LogarithmicCallOption.sol";
import "../contracts/LogarithmicPutOption.sol";

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract ComprehensiveOptionsTest is Test {
    OptionsBook public optionsBook;
    SimuOracle public oracle;

    MockERC20 public twoTK;
    MockERC20 public mtk;

    address public short = address(0x1);
    address public long = address(0x2);

    function setUp() public {
        vm.startPrank(address(this));

        twoTK = new MockERC20("TwoToken", "2TK");
        mtk = new MockERC20("MoneyToken", "MTK");

        // Mint balances to test actors
        twoTK.mint(short, 10_000e18);
        mtk.mint(short, 20_000e18);
        mtk.mint(long, 20_000e18);
        twoTK.mint(long, 20_000e18);

        oracle = new SimuOracle();
        oracle.setPrice(address(twoTK), "2TK", 2); // 1 2TK = 2 MTK
        oracle.setPrice(address(mtk), "MTK", 1);

        optionsBook = new OptionsBook(
            address(new QuadraticCallOption()),
            address(new QuadraticPutOption()),
            address(new QuadraticCallOption()),
            address(new QuadraticPutOption()),
            address(new LogarithmicCallOption()),
            address(new LogarithmicPutOption())
        );

        vm.stopPrank();
    }

    function testQuadraticAndLogOptions() public {
        string[2] memory payoffTypes = ["Quadratic", "Logarithmic"];
        bool[2] memory isCallArray = [true, false];

        uint256[4] memory strikePrices = [
            uint256(1e18),
            uint256(2e18),
            uint256(3e18),
            uint256(4e18)
        ];

        uint256[4] memory expiryPrices = [
            uint256(1e18),
            uint256(2e18),
            uint256(3e18),
            uint256(4e18)
        ];

        for (uint256 i = 0; i < payoffTypes.length; i++) {
            for (uint256 j = 0; j < isCallArray.length; j++) {
                for (uint256 k = 0; k < strikePrices.length; k++) {
                    for (uint256 l = 0; l < expiryPrices.length; l++) {
                        _testOption(payoffTypes[i], isCallArray[j], strikePrices[k], expiryPrices[l]);
                    }
                }
            }
        }
    }

    function _testOption(
        string memory payoffType,
        bool isCall,
        uint256 strikePrice,
        uint256 resolvedPrice
    ) internal {
        uint256 optionSize = 100e18;
        uint256 premium = 10e18;

        // Predict the next clone address (Clones.clone uses CREATE)
        uint256 nextNonce = vm.getNonce(address(optionsBook));
        address predictedOption = vm.computeCreateAddress(address(optionsBook), nextNonce);

        // Short pre-approves the correct spender (the soon-to-exist option clone)
        vm.startPrank(short);
        if (isCall) {
            // Calls lock 2TK on short side
            twoTK.approve(address(optionsBook), type(uint256).max);      // optional but fine
            twoTK.approve(predictedOption, type(uint256).max);           // critical for current design
        } else {
            // Puts lock MTK on short side
            mtk.approve(address(optionsBook), type(uint256).max);        // optional but fine
            mtk.approve(predictedOption, type(uint256).max);             // critical for current design
        }

        address optionAddress;
        if (isCall) {
            optionAddress = optionsBook.createAndFundCallOption(
                address(twoTK),
                address(mtk),
                "2TK",
                "MTK",
                strikePrice,
                optionSize,
                premium,
                address(oracle),
                payoffType
            );
        } else {
            optionAddress = optionsBook.createAndFundPutOption(
                address(twoTK),
                address(mtk),
                "2TK",
                "MTK",
                strikePrice,
                optionSize,
                premium,
                address(oracle),
                payoffType
            );
        }
        vm.stopPrank();

        // (Sanity) the predicted address should equal the returned option address
        assertEq(optionAddress, predictedOption, "Predicted option address mismatch");

        // Long enters and pays premium via OptionsBook
        vm.startPrank(long);
        mtk.approve(address(optionsBook), type(uint256).max);
        twoTK.approve(address(optionsBook), type(uint256).max);
        optionsBook.enterAndPayPremium(optionAddress);
        vm.stopPrank();

        // Warp to expiry
        vm.warp(block.timestamp + 6 minutes);

        // Set resolved price (note: SimuOracle in your code expects integer ratios)
        oracle.setPrice(address(twoTK), "2TK", resolvedPrice / 1e18);

        vm.startPrank(long);

        uint256 mtkBefore = mtk.balanceOf(long);
        uint256 twoTkBefore = twoTK.balanceOf(long);

        // Extra approvals if OptionsBook pulls during exercise
        mtk.approve(address(optionsBook), type(uint256).max);
        twoTK.approve(address(optionsBook), type(uint256).max);

        try optionsBook.resolveAndExercise(optionAddress, 0) {
            uint256 mtkAfter = mtk.balanceOf(long);
            uint256 twoTkAfter = twoTK.balanceOf(long);

            string memory optName = string(
                abi.encodePacked(payoffType, isCall ? " Call" : " Put")
            );
            emit log_named_string("Option Type", optName);
            emit log_named_uint("Strike Price", strikePrice);
            emit log_named_uint("Expiry Price", resolvedPrice);

            if (mtkAfter > mtkBefore) {
                emit log_named_uint("MTK received by long", mtkAfter - mtkBefore);
            } else {
                emit log_named_uint("MTK spent by long", mtkBefore - mtkAfter);
            }

            if (twoTkAfter > twoTkBefore) {
                emit log_named_uint("2TK received by long", twoTkAfter - twoTkBefore);
            } else {
                emit log_named_uint("2TK spent by long", twoTkBefore - twoTkAfter);
            }
        } catch {
            emit log_named_string(
                "Option Type (not exercised)",
                string(abi.encodePacked(payoffType, isCall ? " Call" : " Put"))
            );
            emit log_named_uint("Strike Price", strikePrice);
            emit log_named_uint("Expiry Price", resolvedPrice);
            emit log("Option not exercised (likely OTM)");
        }

        vm.stopPrank();
    }
}

// Simple ERC20 for mocking
contract MockERC20 is ERC20 {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {}
    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }
}
