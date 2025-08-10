// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@prb/math/src/UD60x18.sol";
import { ud } from "@prb/math/src/ud60x18/Casting.sol";
import "./SimuOracle.sol";
import "./OptionsBook.sol";

contract LogarithmicPutOption {

    address public short;
    address public long;
    address public optionsBook;

    IERC20 public underlyingToken;
    IERC20 public strikeToken;

    string public underlyingSymbol;
    string public strikeSymbol;

    uint256 public strikePrice;
    uint256 public optionSize;
    uint256 public premium;
    uint256 public intensity;

    uint256 public expiry;
    bool public isActive;
    bool public isExercised;
    bool public isFunded;

    SimuOracle public oracle;
    uint256 public priceAtExpiry;
    bool public isResolved;

    bool private initialized;

    event OptionCreated(address indexed short);
    event OptionActivated(address indexed long, uint256 premium, uint256 expiry);
    event OptionExercised(address indexed long, uint256 twoTkSpent, uint256 mtkReceived);
    event PriceResolved(uint256 price);

    modifier onlyOptionsBook() {
        require(msg.sender == optionsBook, "Not OptionsBook");
        _;
    }

    function initialize(
        address _short,
        address _underlyingToken,
        address _strikeToken,
        string memory _underlyingSymbol,
        string memory _strikeSymbol,
        uint256 _strikePrice,
        uint256 _optionSize,
        uint256 _premium,
        uint256 _intensity,
        address _oracle,
        address _optionsBook
    ) external {
        require(!initialized, "Already initialized");
        initialized = true;

        short = _short;
        underlyingToken = IERC20(_underlyingToken);
        strikeToken = IERC20(_strikeToken);
        underlyingSymbol = _underlyingSymbol;
        strikeSymbol = _strikeSymbol;
        strikePrice = _strikePrice;
        optionSize = _optionSize;
        premium = _premium;
        intensity = _intensity;
        oracle = SimuOracle(_oracle);
        optionsBook = _optionsBook;

        emit OptionCreated(_short);
    }

    function fund() external onlyOptionsBook {
        require(!isFunded, "Already funded");
        isFunded = true;
    }

    function enterAsLong(address _long) external onlyOptionsBook {
        require(!isActive && isFunded && long == address(0), "Invalid state");
        long = _long;
        isActive = true;
        expiry = block.timestamp + 5 minutes;
        emit OptionActivated(_long, premium, expiry);
    }

    function resolve() public {
        require(block.timestamp >= expiry && !isResolved, "Too early or resolved");
        priceAtExpiry = oracle.getDerivedPriceBySymbols(underlyingSymbol, strikeSymbol);
        require(priceAtExpiry > 0, "Invalid oracle price");
        isResolved = true;
        emit PriceResolved(priceAtExpiry);
    }

    function exercise(uint256 /* amount2TK */, address _long) external onlyOptionsBook {
        require(block.timestamp >= expiry && isResolved && !isExercised, "Invalid exercise");
        require(_long == long, "Not long");
        require(intensity > 0, "Invalid intensity");

        // Must be deep enough in the money: x <= K - 1/I
        uint256 threshold = strikePrice - (1e18 / intensity);
        require(priceAtExpiry <= threshold, "Out of the money");

        // Compute log argument
        uint256 logArg = intensity * (strikePrice - priceAtExpiry);
        require(logArg >= 1e18, "Invalid log input"); // ln must be >= 0

        // Logarithmic payoff
        UD60x18 logArgUD = ud(logArg);
        UD60x18 lnValUD = logArgUD.ln();
        UD60x18 payoutUD = lnValUD.mul(ud(optionSize));

        uint256 mtkPayout = payoutUD.unwrap();

        // Optional cap based on how much collateral is available
        //uint256 availableCollateral = strikeToken.balanceOf(address(this));
        //if (mtkPayout > availableCollateral) {
        //    mtkPayout = availableCollateral;
        //}

        // Amount of 2TK the long must spend to buy `mtkPayout` MTK at strike price
        uint256 actualAmount2TK = (mtkPayout * 1e18) / strikePrice;

        require(strikeToken.transfer(_long, mtkPayout), "MTK payout failed");

        isExercised = true;
        OptionsBook(optionsBook).notifyExercised(mtkPayout);
        emit OptionExercised(_long, actualAmount2TK, mtkPayout);
    }

    function reclaim(address _short) external onlyOptionsBook {
        require(block.timestamp >= expiry && !isExercised, "Cannot reclaim");
        require(_short == short, "Not short");
        isExercised = true;
        require(strikeToken.transfer(_short, strikeToken.balanceOf(address(this))), "Reclaim failed");
    }
}