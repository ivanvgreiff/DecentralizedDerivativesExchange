// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@prb/math/src/UD60x18.sol";
import { ud } from "@prb/math/src/ud60x18/Casting.sol";
import "./SimuOracle.sol";
import "./OptionsBook.sol";

contract LogarithmicCallOption {

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
    event OptionExercised(address indexed long, uint256 mtkSpent, uint256 twoTkReceived);
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

    function exercise(uint256 mtkAmount, address _long) external onlyOptionsBook {
        require(block.timestamp >= expiry && isResolved && !isExercised, "Invalid exercise");
        require(_long == long, "Not long");

        uint256 threshold = strikePrice + (1e18 / intensity);
        require(priceAtExpiry >= threshold, "Out of the money");

        uint256 logArg = intensity * (priceAtExpiry - strikePrice);
        UD60x18 logArgUD = ud(logArg);
        UD60x18 lnValUD = logArgUD.ln();
        uint256 lnVal = lnValUD.unwrap();

        uint256 twoTkPayout = (lnVal * optionSize) / 1e18;
        
        // Always use OptionsBook calculation mode for consistent logarithmic behavior
        uint256 actualMtkAmount;
        if (twoTkPayout > optionSize) {
            twoTkPayout = optionSize;
            // Full exercise at capped payout
            actualMtkAmount = (optionSize * strikePrice) / 1e18;
        } else {
            // Calculate linear profit that would produce this logarithmic payout
            uint256 priceDiff = priceAtExpiry - strikePrice;
            uint256 linearProfit = (optionSize * priceDiff) / 1e18;
            
            if (linearProfit > 0) {
                // Calculate proportional MTK payment based on logarithmic vs linear ratio
                actualMtkAmount = (twoTkPayout * strikePrice) / 1e18;
                // If logarithmic payout is less than linear, pay proportionally less
                if (twoTkPayout < linearProfit) {
                    actualMtkAmount = (actualMtkAmount * twoTkPayout) / linearProfit;
                }
            } else {
                actualMtkAmount = (optionSize * strikePrice) / 1e18;
            }
        }

        require(underlyingToken.transfer(_long, twoTkPayout), "2TK transfer failed");

        isExercised = true;
        OptionsBook(optionsBook).notifyExercised(actualMtkAmount);
        emit OptionExercised(_long, actualMtkAmount, twoTkPayout);
    }

    function reclaim(address _short) external onlyOptionsBook {
        require(block.timestamp >= expiry && !isExercised, "Cannot reclaim");
        require(_short == short, "Not short");
        isExercised = true;
        require(underlyingToken.transfer(_short, optionSize), "Reclaim failed");
    }
}