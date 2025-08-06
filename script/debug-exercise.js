require("dotenv").config();
const { ethers } = require("ethers");

const OPTION_ABI = require("../utils/OptionContractABI.json");
const MTK_ABI = require("../utils/MTKContractABI.json")
const OPTION_ADDRESS = "0x3dE2E6c1Ea958D76CC1d7d5D56237836Fa4807ec";
const MTK_ADDRESS = "0x2d03f1019f2B5e42F8361087640b11791D68fb0d";

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const signer = new ethers.Wallet(process.env.PRIVATE_KEY_TS1, provider);
const contract = new ethers.Contract(OPTION_ADDRESS, OPTION_ABI, signer);

async function debugExercise() {
  try {
    const mtkAmount = ethers.parseUnits("7", 18); // Adjust as needed

    const mtkToken = new ethers.Contract(MTK_ADDRESS, MTK_ABI, signer);
    await mtkToken.approve(OPTION_ADDRESS, ethers.parseUnits("7", 18));

    console.log("Approved")

    console.log("Calling exercise...");
    await contract.exercise(mtkAmount); // will fail if conditions not met
    console.log("Exercise succeeded!");
  } catch (err) {
    console.error("Exercise failed:", err.message);
    if (err?.error?.data?.message) {
      console.error("Revert reason:", err.error.data.message);
    }
  }
}

debugExercise();
