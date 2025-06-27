import 'dotenv/config';
import TelegramBot from 'node-telegram-bot-api';
import { handleSend } from './send';
import { Wallet } from 'ethers';

const token = process.env.BOT_TOKEN!;
const bot = new TelegramBot(token, { polling: true });

const userStates = new Map<number, any>();

bot.setMyCommands([
  { command: '/start', description: 'Introduction to SKULD' },
  { command: '/send', description: 'Launch a confidential transaction' },
]);


// Commande /start ➜ questionnaire
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;

  const introMessage = `
👋 *Welcome to SKULD!*

SKULD is a decentralized investment app built on iExec & Ethereum.  
It enables you to send funds using a *stealth address* for full privacy and security.

To begin, use the */send* command.
  `;
  bot.sendMessage(chatId, introMessage, { parse_mode: 'Markdown' });
});

bot.onText(/\/send/, (msg) => {
  const chatId = msg.chat.id;
  userStates.set(chatId, { step: 'privateKey' });
  bot.sendMessage(chatId, '🔐 Please enter your *private key* (it will not be stored)', {
    parse_mode: 'Markdown',
  });
});

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text?.trim()!;
  const state = userStates.get(chatId);

  if (!state || text?.startsWith('/')) return;

  if (state.step === 'privateKey') {
    try {
      const wallet = new Wallet(text);
      state.wallet = wallet;
      state.step = 'amount';
      bot.sendMessage(chatId, '💰 What amount would you like to send (in ETH)?');
    } catch {
      bot.sendMessage(chatId, '❌ Invalid private key. Please try again.');
    }
  } else if (state.step === 'amount') {
    state.amount = text;
    state.step = 'receiver';
    bot.sendMessage(chatId, '🏦 What is the recipient wallet address?');
  } else if (state.step === 'receiver') {
    state.receiver = text;
    userStates.delete(chatId);

    const { amount, receiver, wallet } = state;

    try {
      await bot.sendMessage(chatId, '🚀 Preparing confidential transaction...');

      const { txHash, taskId, waitForCompletion } = await handleSend(wallet, amount, receiver, async (message) => {
        await bot.sendMessage(chatId, message);
      });

      await bot.sendMessage(
        chatId,
        `✅ Deal created!\n🔗 txHash: [${txHash}](https://explorer.iex.ec/bellecour/tx/${txHash})\n📦 taskId: [${taskId}](https://explorer.iex.ec/bellecour/task/${taskId})`,
        { parse_mode: 'Markdown' }
      );

      await bot.sendMessage(chatId, '⏳ Waiting for confidential execution...');
      await waitForCompletion();

      await bot.sendMessage(chatId, `✅ Task *completed*!`, {
        parse_mode: 'Markdown',
      });
    } catch (error) {
      console.error('Erreur dans send():', error);
      bot.sendMessage(chatId, `❌ Error: ${String(error)}`);
    }
  }
});
