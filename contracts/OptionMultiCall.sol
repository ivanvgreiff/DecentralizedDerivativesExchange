// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function approve(address spender, uint256 amount) external returns (bool);
}

interface IOptionContract {
    function enterAsLong() external;
    function exercise(uint256 mtkAmount) external;
}

contract OptionMultiCall {
    
    function approveAndEnterAsLong(
        address strikeToken,
        address optionContract,
        uint256 premium
    ) external {
        // Step 1: Approve the option contract to spend premium from msg.sender
        IERC20(strikeToken).approve(optionContract, premium);
        
        // Step 2: Enter as long position
        IOptionContract(optionContract).enterAsLong();
    }
    
    function approveAndExercise(
        address strikeToken,
        address optionContract,
        uint256 mtkAmount
    ) external {
        // Step 1: Approve the option contract to spend MTK from msg.sender
        IERC20(strikeToken).approve(optionContract, mtkAmount);
        
        // Step 2: Exercise the option
        IOptionContract(optionContract).exercise(mtkAmount);
    }
}