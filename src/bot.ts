import TelegramBot, { Message } from 'node-telegram-bot-api';

// Remplace avec ton token
const token = '7241138521:AAH3drvlj-SMk8abgkP1hSmvGQ0gdXakobE';
const bot = new TelegramBot(token, { polling: true });

// On stocke l'état des utilisateurs en mémoire (simple)
interface UserState {
  step: 'wallet' | 'amount' | 'chainId';
  wallet?: string;
  amount?: string;
  chainId?: string;
}
const userStates = new Map<number, UserState>();

// Commande /start
bot.onText(/\/start/, (msg: Message) => {
  const chatId = msg.chat.id;
  userStates.set(chatId, { step: 'wallet' });
  bot.sendMessage(chatId, "Bienvenue ! Quel est ton wallet address ?");
});

// Réponse aux messages
bot.on('message', (msg: Message) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  // On ignore le /start ici (déjà géré)
  if (text?.startsWith('/start')) return;

  const state = userStates.get(chatId);

  if (!state) {
    bot.sendMessage(chatId, "Envoie /start pour commencer.");
    return;
  }

  if (state.step === 'wallet') {
    state.wallet = text;
    state.step = 'amount';
    bot.sendMessage(chatId, "Merci. Quel montant veux-tu envoyer ?");
  } else if (state.step === 'amount') {
    state.amount = text;
    state.step = 'chainId';
    bot.sendMessage(chatId, "Parfait. Quelle est la chain ID ?");
  } else if (state.step === 'chainId') {
    state.chainId = text;

    bot.sendMessage(
      chatId,
      `✅ Récapitulatif :\n\nWallet: ${state.wallet}\nMontant: ${state.amount}\nChain ID: ${state.chainId}`
    );

    userStates.delete(chatId); // Reset après fin
  }
});
