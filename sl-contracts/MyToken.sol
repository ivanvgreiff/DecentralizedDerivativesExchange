// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

contract MyToken is ERC20Votes {
    constructor() 
        ERC20("MyToken", "MTK") 
        EIP712("MyToken", "1") 
    {
        _mint(msg.sender, 1_000_000 * 10 ** decimals());
    }
}
