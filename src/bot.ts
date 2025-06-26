import 'dotenv/config'
import TelegramBot from 'node-telegram-bot-api';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { handleSend } from './send';

// Ton token
const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

// Pour suivre l’état des users
const userStates = new Map<number, any>();

// Commande /start ➜ questionnaire
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  userStates.set(chatId, { step: 'wallet' });
  bot.sendMessage(chatId, '👋 Bienvenue ! Envoie ton adresse de wallet :');
});

// Commande /send ➜ exécute test.ts directement
bot.onText(/\/send/, async (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, '🚀 Exécution en cours...');

  try {
    const { txHash, taskId } = await handleSend();

    const txUrl = `https://explorer.iex.ec/bellecour/tx/${txHash}`;
    const taskUrl = `https://explorer.iex.ec/bellecour/task/${taskId}`;

    const message = `✅ Deal créé !\n🔗 [Voir le deal](${txUrl})\n📦 [Voir le task](${taskUrl})`;

    bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Erreur dans handleSend():', error);
    bot.sendMessage(chatId, `❌ Erreur : ${String(error)}`);
  }
});



// Gestion des messages utilisateur pour /start
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text?.trim();
  const state = userStates.get(chatId);

  // Ignore les commandes
  if (!state || text?.startsWith('/')) return;

  if (state.step === 'wallet') {
    state.wallet = text;
    state.step = 'amount';
    bot.sendMessage(chatId, '✅ Reçu. Quel est le montant ?');
  } else if (state.step === 'amount') {
    state.amount = text;
    state.step = 'chain';
    bot.sendMessage(chatId, '🧠 Merci. Quel est le Chain ID ?');
  } else if (state.step === 'chain') {
    state.chainId = text;
    userStates.delete(chatId);

    const input = {
      wallet: state.wallet,
      amount: state.amount,
      chainId: state.chainId,
    };

    const inputPath = path.resolve(__dirname, 'bot-input.json');
    fs.writeFileSync(inputPath, JSON.stringify(input, null, 2));

    bot.sendMessage(chatId, '🎉 Merci ! Données enregistrées.');
  }
});

