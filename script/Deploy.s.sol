// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/OptionContract.sol";

contract DeployOptionContract is Script {
    function run() external {
        // Load private key and get deployer address
        //uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        //address deployer = vm.addr(deployerPrivateKey);
        //address deployer = 0x9BA03f1377E85Bb03D776C9745288BEC29cFF951;

        // --- Configurable Parameters ---
        address underlyingToken = 0xe37EC0B116247aF4caCD8D7CCA340230D03efC5E; // 2TK
        address strikeToken     = 0x2d03f1019f2B5e42F8361087640b11791D68fb0d; // MTK

        string memory underlyingSymbol = "2TK";
        string memory strikeSymbol = "MTK";

        uint256 strikePrice = 1e18;      // 1 MTK per 2TK
        uint256 optionSize  = 30e18;     // 30 2TK
        uint256 premium     = 2e18;      // 2 MTK

        address oracle = 0xba7603E31a7C5989cDF8610557F53117Cab4736f;

        // --- Start Broadcasting ---
        vm.startBroadcast();

        // Deploy the OptionContract
        OptionContract option = new OptionContract(
            underlyingToken,
            strikeToken,
            underlyingSymbol,
            strikeSymbol,
            strikePrice,
            optionSize,
            premium,
            oracle
        );

        vm.stopBroadcast();

        console.log("OptionContract deployed at:", address(option));
    }
}