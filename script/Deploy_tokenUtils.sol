// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../sl-contracts/MyToken.sol";
import "../sl-contracts/DoubleToken.sol";
import "../sl-contracts/MyGovernor.sol";
import "../sl-contracts/Treasury.sol";
//import "../contracts/Delegate_n.sol"; 
//import "../contracts/DelegateFactory.sol";

contract DeployDelegate is Script {
    // Replace this with your actual multisig address
    address constant MULTISIG_ONETHIRD = 0x5269f671c988E90F798de263a21807ac15d98977;
    address constant MULTISIG_TWOTHIRD = 0x494f2DE44184F8466C8e786634077B525c07C7bf; 
    address constant GOVERNOR = 0x7C7ceBC4c180B04564a05446EF952D5C041f2C20;
    address constant TOKEN = 0x2d03f1019f2B5e42F8361087640b11791D68fb0d;

    function run() external {
        vm.startBroadcast();

        // 1. Deploy token
        DoubleToken token = new DoubleToken();
        console.log("Token deployed at:", address(token));

        // 2. Deploy governor with the token
        MyGovernor governor = new MyGovernor(IVotes(address(token)));
        console.log("Governor deployed at:", address(governor));

        // 3. Deploy treasury with governor and token
        Treasury treasury = new Treasury(address(governor), address(token));
        console.log("Treasury deployed at:", address(treasury));

        // Optional: mint delegation or transfer token ownership if needed
        // token.transfer(address(treasury), 500_000 * 10 ** token.decimals());

        // 4. Deploy delegate factory
        // Replace with your actual multisig
        //address MULTISIG_TWOTHIRD = 0x494f2DE44184F8466C8e786634077B525c07C7bf;
        //DelegateFactory factory = new DelegateFactory(MULTISIG_TWOTHIRD);
        //console.log("Delegate Factory deployed at:", address(factory));

        vm.stopBroadcast();
    }
}
