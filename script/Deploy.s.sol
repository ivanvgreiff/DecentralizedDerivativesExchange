// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/PutOptionContract.sol";
import "../contracts/CallOptionContract.sol";     // Call Option
import "../contracts/OptionsBook.sol";            // Factory
//import "../contracts/TransactionBundler.sol";     // UX Helper
import "../contracts/StakingVault.sol";

contract DeployOptionBook is Script {
    function run() external {
        // Load deployer key from .env if needed
        // uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        // vm.startBroadcast(deployerPrivateKey);

        vm.startBroadcast();

        // Deploy Put Option implementation with dummy values
        PutOptionContract putImpl = new PutOptionContract(
            address(0x1), address(0x2), "DUMMY", "USD", 1e18, 1e18, 1e18, address(0x3)
        );

        // Deploy Call Option implementation with dummy values
        CallOptionContract callImpl = new CallOptionContract(
            address(0x1), address(0x2), "DUMMY", "USD", 1e18, 1e18, 1e18, address(0x3)
        );

        // Deploy the OptionsBook factory with the above implementations
        OptionsBook book = new OptionsBook(address(putImpl), address(callImpl));

        // ✅ Deploy the TransactionBundler
        //TransactionBundler bundler = new TransactionBundler();

        // Staking Vault
        StakingVault vault = new StakingVault();

        vm.stopBroadcast();

        // Log deployment addresses
        console.log("Deployed to Sepolia:");
        console.log("PutOptionContract Impl: ", address(putImpl));
        console.log("CallOptionContract Impl:", address(callImpl));
        console.log("OptionsBook Factory:    ", address(book));
        //console.log("TransactionBundler:     ", address(bundler));
        console.log("Staking Vault:     ", address(vault));
    }
}
