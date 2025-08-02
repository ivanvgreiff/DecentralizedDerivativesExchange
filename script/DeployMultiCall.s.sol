// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/OptionMultiCall.sol";

contract DeployMultiCall is Script {
    function run() external {
        // Start broadcasting
        vm.startBroadcast();

        // Deploy the OptionMultiCall contract
        OptionMultiCall multiCall = new OptionMultiCall();

        vm.stopBroadcast();

        console.log("OptionMultiCall deployed at:", address(multiCall));
    }
}