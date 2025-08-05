// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/CallOptionContract.sol";
import "../contracts/PutOptionContract.sol";
import "../contracts/OptionsBook.sol";

contract DeployOptionContract is Script {
    function run() external {
        // Load private key and get deployer address
        //uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        //address deployer = vm.addr(deployerPrivateKey);
        //address deployer = 0x9BA03f1377E85Bb03D776C9745288BEC29cFF951;

        vm.startBroadcast();

        // Deploy Put Option implementation with dummy values
        PutOptionContract putImpl = new PutOptionContract();

        // Deploy Call Option implementation with dummy values
        CallOptionContract callImpl = new CallOptionContract();

        // Deploy the OptionsBook factory with the above implementations
        OptionsBook book = new OptionsBook(address(callImpl), address(putImpl));

        vm.stopBroadcast();

        console.log("PutOptionContract Impl: ", address(putImpl));
        console.log("CallOptionContract Impl:", address(callImpl));
        console.log("OptionsBook Factory:    ", address(book));
    }
}