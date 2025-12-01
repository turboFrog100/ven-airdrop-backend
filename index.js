require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { ethers } = require("ethers");

const app = express();
app.use(cors());
app.use(express.json());

const PORT            = process.env.PORT || 4000;
const RPC_URL         = process.env.RPC_URL;
const PRIVATE_KEY     = process.env.PRIVATE_KEY;
const TOKEN_ADDRESS   = process.env.TOKEN_ADDRESS;
const TOKEN_DECIMALS  = Number(process.env.TOKEN_DECIMALS || 18);
const AMOUNT_PER_USER = process.env.AMOUNT_PER_USER || "50";

if (!RPC_URL || !PRIVATE_KEY || !TOKEN_ADDRESS) {
  console.error("Fill RPC_URL, PRIVATE_KEY and TOKEN_ADDRESS in .env / env vars");
  process.exit(1);
}

const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet   = new ethers.Wallet(PRIVATE_KEY, provider);

const ERC20_ABI = [
  "function transfer(address to, uint256 value) public returns (bool)"
];

const token = new ethers.Contract(TOKEN_ADDRESS, ERC20_ABI, wallet);

console.log("Airdrop wallet:", wallet.address);
console.log("Token:", TOKEN_ADDRESS);

// простая защита от повторных клеймов (в памяти)
const claimed = new Set();

app.post("/claim", async (req, res) => {
  try {
    const { address, signature } = req.body;

    if (!address || !signature) {
      return res.status(400).json({ error: "address & signature required" });
    }

    const message = `I want to claim 50 VEN on Polygon for address ${address}`;

    let recovered;
    try {
      recovered = ethers.verifyMessage(message, signature);
    } catch (e) {
      return res.status(400).json({ error: "bad signature" });
    }

    if (recovered.toLowerCase() !== address.toLowerCase()) {
      return res.status(400).json({ error: "signature mismatch" });
    }

    const addrLower = address.toLowerCase();
    if (claimed.has(addrLower)) {
      return res.status(400).json({ error: "already claimed" });
    }

    const amount = ethers.parseUnits(AMOUNT_PER_USER, TOKEN_DECIMALS);

    console.log(`Sending ${AMOUNT_PER_USER} VEN to`, address);
    const tx = await token.transfer(address, amount);
    await tx.wait();

    claimed.add(addrLower);

    return res.json({ txHash: tx.hash });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "internal error" });
  }
});

app.listen(PORT, () => {
  console.log("Vecna airdrop backend listening on port", PORT);
});
