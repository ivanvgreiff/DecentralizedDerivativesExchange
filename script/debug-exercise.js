require("dotenv").config();
const { ethers } = require("ethers");

const ABI = require("../contract-utils/OptionContractABI.json");
const MTK_ABI = require("../contract-utils/MTKContractABI.json")
const CONTRACT_ADDRESS = "0x2D9BbC370d9113A37873e4a3096d143D7EB93A14";
const MTK_ADDRESS = "0x2d03f1019f2B5e42F8361087640b11791D68fb0d";

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const signer = new ethers.Wallet(process.env.PRIVATE_KEY_TS1, provider);
const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);

async function debugExercise() {
  try {
    const mtkAmount = ethers.parseUnits("7", 18); // Adjust as needed

    const mtkToken = new ethers.Contract(MTK_ADDRESS, MTK_ABI, signer);
    await mtkToken.approve(CONTRACT_ADDRESS, ethers.parseUnits("7", 18));

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
