// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/CallOptionContract.sol";
import "../contracts/PutOptionContract.sol";
import "../contracts/QuadraticCallOption.sol";
import "../contracts/QuadraticPutOption.sol";
import "../contracts/OptionsBook.sol";

contract DeployOptionContract is Script {
    function run() external {
        // Load private key and get deployer address
        //uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        //address deployer = vm.addr(deployerPrivateKey);
        //address deployer = 0x9BA03f1377E85Bb03D776C9745288BEC29cFF951;

        vm.startBroadcast();

        // Deploy Linear Option implementations (existing)
        CallOptionContract callImpl = new CallOptionContract();
        PutOptionContract putImpl = new PutOptionContract();

        // Deploy Quadratic Option implementations (new)
        QuadraticCallOption quadraticCallImpl = new QuadraticCallOption();
        QuadraticPutOption quadraticPutImpl = new QuadraticPutOption();

        // Deploy the OptionsBook factory with all implementations
        OptionsBook book = new OptionsBook(
            address(callImpl),
            address(putImpl),
            address(quadraticCallImpl),
            address(quadraticPutImpl)
        );

        vm.stopBroadcast();

        console.log("CallOptionContract Impl:     ", address(callImpl));
        console.log("PutOptionContract Impl:      ", address(putImpl));
        console.log("QuadraticCallOption Impl:    ", address(quadraticCallImpl));
        console.log("QuadraticPutOption Impl:     ", address(quadraticPutImpl));
        console.log("OptionsBook Factory:         ", address(book));
    }
}