// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IOptionsBook {
    function createAndFundPutOption(
        address tokenHolder,
        address underlyingToken,
        address strikeToken,
        string memory underlyingSymbol,
        string memory strikeSymbol,
        uint256 strikePrice,
        uint256 optionSize,
        uint256 premium,
        address oracle
    ) external returns (address);

    function createAndFundCallOption(
        address tokenHolder,
        address underlyingToken,
        address strikeToken,
        string memory underlyingSymbol,
        string memory strikeSymbol,
        uint256 strikePrice,
        uint256 optionSize,
        uint256 premium,
        address oracle
    ) external returns (address);

    function enterAndPayPremium(
        address optionAddress,
        address strikeToken,
        uint256 premium
    ) external;
}

contract TransactionBundler {
    /// @notice Pull user tokens, approve to OptionsBook, and create a new funded Put Option
    function approveAndCreatePutOption(
        address tokenToApprove,
        address optionsBook,
        uint256 amountToApprove,
        address underlyingToken,
        address strikeToken,
        string memory underlyingSymbol,
        string memory strikeSymbol,
        uint256 strikePrice,
        uint256 optionSize,
        uint256 premium,
        address oracle
    ) external {
        // Step 1: Pull tokens from user to TransactionBundler
        require(
            IERC20(tokenToApprove).transferFrom(msg.sender, address(this), amountToApprove),
            "Transfer to bundler failed"
        );

        // Step 2: Approve tokens from TransactionBundler to OptionsBook
        require(
            IERC20(tokenToApprove).approve(optionsBook, amountToApprove),
            "Approve failed"
        );

        // Step 3: Create option (OptionsBook will pull from TransactionBundler)
        IOptionsBook(optionsBook).createAndFundPutOption(
            address(this), // TransactionBundler is now the token holder
            underlyingToken,
            strikeToken,
            underlyingSymbol,
            strikeSymbol,
            strikePrice,
            optionSize,
            premium,
            oracle
        );
    }

    /// @notice Pull user tokens, approve to OptionsBook, and create a new funded Call Option
    function approveAndCreateCallOption(
        address tokenToApprove,
        address optionsBook,
        uint256 amountToApprove,
        address underlyingToken,
        address strikeToken,
        string memory underlyingSymbol,
        string memory strikeSymbol,
        uint256 strikePrice,
        uint256 optionSize,
        uint256 premium,
        address oracle
    ) external {
        // Step 1: Pull tokens from user to TransactionBundler
        require(
            IERC20(tokenToApprove).transferFrom(msg.sender, address(this), amountToApprove),
            "Transfer to bundler failed"
        );

        // Step 2: Approve tokens from TransactionBundler to OptionsBook
        require(
            IERC20(tokenToApprove).approve(optionsBook, amountToApprove),
            "Approve failed"
        );

        // Step 3: Create option (OptionsBook will pull from TransactionBundler)
        IOptionsBook(optionsBook).createAndFundCallOption(
            address(this), // TransactionBundler is now the token holder
            underlyingToken,
            strikeToken,
            underlyingSymbol,
            strikeSymbol,
            strikePrice,
            optionSize,
            premium,
            oracle
        );
    }

    /// @notice Approve premium and enter an existing option as the long
    function approveAndEnterAsLong(
        address premiumToken,
        address optionsBook,
        uint256 premiumAmount,
        address optionContract
    ) external {
        require(
            IERC20(premiumToken).approve(optionsBook, premiumAmount),
            "Approve failed"
        );

        IOptionsBook(optionsBook).enterAndPayPremium(
            optionContract,
            premiumToken,
            premiumAmount
        );
    }
}
