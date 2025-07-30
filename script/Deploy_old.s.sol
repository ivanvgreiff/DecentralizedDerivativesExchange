// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/Delegate_n.sol"; // or VoteExecutor.sol
import "../contracts/DelegateFactory.sol";

contract DeployDelegate is Script {
    // Replace this with your actual multisig address
    address constant MULTISIG_ONETHIRD = 0x5269f671c988E90F798de263a21807ac15d98977;
    //address constant MULTISIG_TWOTHIRD = 0x494f2DE44184F8466C8e786634077B525c07C7bf; 
    address constant GOVERNOR = 0x7C7ceBC4c180B04564a05446EF952D5C041f2C20;
    address constant TOKEN = 0x2d03f1019f2B5e42F8361087640b11791D68fb0d;
    //address constant DEPLOYER = 0x9BA03f1377E85Bb03D776C9745288BEC29cFF951;

    // Ben's accounts
    address constant DEPLOYER = 0x2be942f917ed17A6b95D0A245fcaA4DC6c9BB686;
    address constant MULTISIG_TWOTHIRD = 0x84224e66aDbAEf03015dD4f31dcB619233F85CB0;

    function run() external {
        vm.startBroadcast();

        //Delegate_n Delegate = new Delegate_n(MULTISIG_ONETHIRD, MULTISIG_TWOTHIRD);
        DelegateFactory factory = new DelegateFactory(MULTISIG_TWOTHIRD, DEPLOYER);
        console.log("Delegate Factory deployed at:", address(factory));

        vm.stopBroadcast();
    }
}
