// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../sl-contracts/MyToken.sol";
import "../sl-contracts/DoubleToken.sol";
import "../sl-contracts/MyGovernor.sol";
import "../sl-contracts/Treasury.sol";
//import "../contracts/Delegate_n.sol"; 
//import "../contracts/DelegateFactory.sol";
import "../contracts/SimuOracle.sol";
import "../contracts/OptionContract.sol";

contract Deploy is Script {
    // Replace this with your actual multisig address

    function run() external {
        vm.startBroadcast();

        // 1. Deploy token
        //DoubleToken token = new DoubleToken();
        //console.log("Token deployed at:", address(token));

        // 2. Deploy governor with the token
        //MyGovernor governor = new MyGovernor(IVotes(address(token)));
        //console.log("Governor deployed at:", address(governor));

        // 3. Deploy treasury with governor and token
        //Treasury treasury = new Treasury(address(governor), address(token));
        //console.log("Treasury deployed at:", address(treasury));

        // Optional: mint delegation or transfer token ownership if needed
        // token.transfer(address(treasury), 500_000 * 10 ** token.decimals());

        // 4. Deploy delegate factory
        // Replace with your actual multisig
        //address MULTISIG_TWOTHIRD = 0x494f2DE44184F8466C8e786634077B525c07C7bf;
        //DelegateFactory factory = new DelegateFactory(MULTISIG_TWOTHIRD);
        //console.log("Delegate Factory deployed at:", address(factory));

        // 4. Deploy oracle
        SimuOracle oracle = new SimuOracle();
        console2.log("SimuOracle deployed at:", address(oracle));

        vm.stopBroadcast();
    }
}
