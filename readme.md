![SKULD Banner](./assets/banner.png)

# 🤖 SKULD — Confidential Token Sender Bot

SKULD is a privacy-first Telegram bot that enables users to **send ETH confidentially** using stealth addresses and iExec Trusted Execution Environments (TEE).  
It aims to **mitigate sandwich attacks and market manipulation**, particularly by KOLs (Key Opinion Leaders), allowing users to buy tokens in a **non-traceable, non-manipulable** way.

---

## 🛡️ Why SKULD?

Market manipulation and MEV (Miner Extractable Value) attacks such as **sandwich attacks** affect retail investors by allowing bots and whales to frontrun or backrun their transactions.

SKULD addresses this problem by:

- Using **stealth addresses** to obfuscate destination wallets.
- Locking funds into an **Escrow contract** on-chain.
- Matching orders in a **trusted enclave** using [iExec TEE](https://iex.ec).
- Ensuring that the **transaction origin and content remain confidential**.

---

## ✨ Features

- 🧾 Confidential fund transfers via Telegram.
- 🔐 Escrow locking before task execution.
- 🔍 Secret Transaction tracking via Etherscan.
- 🧠 Lender task fulfillment using iExec infrastructure.
- 📬 Dynamic Telegram messaging (funds locked → order placed → filled → task complete).
- 🌐 Supports **Sepolia Testnet** (customizable).

---

## 🚀 Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/your-username/skuld-bot.git
cd skuld-bot
```

### 2. Start the bot

```bash
npm ci && npm run start
```
