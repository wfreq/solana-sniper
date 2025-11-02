Pump Fun Sniper 🚀🔫

A minimal, fast Solana sniper for “pump fun” tokens — designed to watch buys and snipe token mints
Use responsibly. This repo is provided as-is for educational / experimental purposes.

Quick contents

✅ What this does

⚙️ Requirements

🛠️ Install

🧩 Configuration (.env)

▶️ Run (example)

🐞 Troubleshooting tips


# What it does

This project watches token activity (using your chosen RPC provider), and attempts to purchase a configured token amount when a token creation event occurs.

Not financial advice. Sniping and token trading carries risk. Only run with funds you can afford to lose.

There is a 1% user fee on buys to support the development of the program

# Requirements

Windows 10/11 (WSL recommended) or any Linux machine

Bun or ts-node (for dumping tokens)

A Solana keypair file (JSON) or Base58 private key

RPC (Free Helius works fine) — put it in .env 

Basic familiarity with the command line

# Install
```bash
git clone https://github.com/wfreq/solana-sniper
```
```bash
cd solana-sniper
```
OR download the zip and unzip and navigate to the folder in command line


# .env Configuration

You MUST edit the env-example file set the values and save it as .env or this will not work.

What the keys mean

RPC_URL — Fast RPC endpoint (if using helius replace your_api_key)

KEYPAIR_PATH — path to JSON keypair or Base58 private key.

TOKEN_AMOUNT — number of token units to purchase

MAX_SOL_COST — maximum SOL you're willing to spend per buy (acts like slippage cap)

BUY_EVERY_N_TOKENS — throttle logic: buy every Nth observed token event.

STOP_BALANCE_THRESHOLD — if wallet SOL balance falls below this, sniper stops to preserve fees.

# Run
to install WSL run in administrator command prompt
```
wsl --install
```
if using linux or WSL type
```bash
./sniper
```
if using Windows type
```bash
sniper.exe
```
You should see logs about RPC connection, wallet balance, and observed token events. The sniper will attempt buys according to your .env config.

# Dumping tokens (Requires Bun or ts-node)

Bun is recommended for executing the dump script

If you need to install bun refer to https://bun.com/docs/installation

Install dependencies
```bash
bun add @solana/web3.js @solana/spl-token bs58
```
Run the dump script
```bash
bun run dump.ts
```
It'll scan your wallet and dump balances and close the accounts to reclaim rent


# Troubleshooting

connection failed / RPC errors: Check RPC_URL

Insufficient funds/Balance errors: Ensure STOP_BALANCE_THRESHOLD leaves enough SOL for fees.

Keypair read errors: Make sure KEYPAIR_PATH is a valid relative path or a valid base58 string.

TX failure - custom program error: 6002 | slippage: Too much SOL required to buy the given amount of tokens"
(This offers protection from buying coins that have pumped a lot due to large dev buy)

Increase slippage


Dependency issues in Bun: run the following command

bun add @solana/web3.js @solana/spl-token bs58
