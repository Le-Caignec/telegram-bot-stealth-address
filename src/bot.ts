import 'dotenv/config'
import TelegramBot from 'node-telegram-bot-api';
import { handleSend } from './send';

// Ton token
const token = process.env.BOT_TOKEN!;
const bot = new TelegramBot(token, { polling: true });

// Pour suivre l’état des users
const userStates = new Map<number, any>();

bot.setMyCommands([
  { command: '/start', description: 'Présentation de SKULD' },
  { command: '/send', description: 'Lancer une transaction confidentielle' },
]);


// Commande /start ➜ questionnaire
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;

  const introMessage = `
👋 *Bienvenue sur SKULD !*

SKULD est une application d’investissement décentralisée basée sur les technologies iExec et Ethereum.  
Elle vous permet d’envoyer des fonds avec une *stealth address* afin de garantir votre confidentialité et votre sécurité.

Pour commencer, utilisez la commande */send*.
  `;

  bot.sendMessage(chatId, introMessage, { parse_mode: 'Markdown' });
});



// Commande /send ➜ exécute test.ts directement
bot.onText(/\/send/, (msg) => {
  const chatId = msg.chat.id;
  userStates.set(chatId, { step: 'amount' });
  bot.sendMessage(chatId, '💰 Quel est le montant à envoyer ?');
});

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text?.trim();
  const state = userStates.get(chatId);

  // Ignore les commandes
  if (!state || text?.startsWith('/')) return;

  if (state.step === 'amount') {
    state.amount = text;
    state.step = 'receiver';
    bot.sendMessage(chatId, '🏦 Quelle est l’adresse du wallet destinataire ?');
  } else if (state.step === 'receiver') {
    state.receiver = text;
    userStates.delete(chatId); // Nettoyage

    const { amount, receiver } = state;

    try {
      bot.sendMessage(chatId, '🚀 Lancement de la tâche...');

      const { txHash, taskId, waitForCompletion } = await handleSend(amount, receiver);

      await bot.sendMessage(
        chatId,
        `✅ Deal créé !\n🧾 txHash: [${txHash}](https://explorer.iex.ec/bellecour/tx/${txHash})\n📦 taskId: [${taskId}](https://explorer.iex.ec/bellecour/task/${taskId})`,
        { parse_mode: 'Markdown' }
      );

      await waitForCompletion();

      await bot.sendMessage(chatId, `✅ La tâche est maintenant *terminée* !`, {
        parse_mode: 'Markdown',
      });
    } catch (error) {
      console.error('Erreur dans send():', error);
      bot.sendMessage(chatId, `❌ Erreur : ${String(error)}`);
    }
  }
});
 