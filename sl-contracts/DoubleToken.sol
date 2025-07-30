// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

contract DoubleToken is ERC20Votes {
    constructor() 
        ERC20("DoubleToken", "2TK") 
        EIP712("DoubleToken", "1") 
    {
        _mint(msg.sender, 1_000_000 * 10 ** decimals());
    }
}
