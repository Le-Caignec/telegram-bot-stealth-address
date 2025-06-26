import { IExec } from 'iexec';
import { ethers } from 'ethers';

// 1. Créer un wallet temporaire
const privateKey = ethers.Wallet.createRandom().privateKey;
const ethProvider = new ethers.Wallet(privateKey); // ou utiliser un provider réel

// 2. Initialiser iExec
const iexec = new IExec({ ethProvider });

// 3. Infos
const App = '0xa36e982af4adbac4c9a7305ae5b3c133cfd64b21';
const Workerpool = 'prod-v8-learn.main.pools.iexec.eth';

async function main() {
  // 4. Récupérer les ordres App
  const { orders: appOrders } = await iexec.orderbook.fetchAppOrderbook(App, {
    minTag: ['tee', 'scone'],
    maxTag: ['tee', 'scone'],
    workerpool: Workerpool,
  });

  if (appOrders.length === 0) throw new Error('❌ Aucun AppOrder trouvé');
  const apporder = appOrders[0].order;

  // 5. Récupérer les ordres Workerpool
  const { orders: wpOrders } = await iexec.orderbook.fetchWorkerpoolOrderbook({
    workerpool: Workerpool,
    app: App,
    minTag: ['tee', 'scone'],
    maxTag: ['tee', 'scone'],
    category: 0,
  });

  if (wpOrders.length === 0) throw new Error('❌ Aucun WorkerpoolOrder trouvé');
  const workerpoolorder = wpOrders[0].order;

  // 6. Créer un RequestOrder
  const requestorderToSign = await iexec.order.createRequestorder({
    app: apporder.app,
    category: workerpoolorder.category,
    tag: ['tee', 'scone'],
    workerpool: workerpoolorder.workerpool,
  });

  const requestorder = await iexec.order.signRequestorder(requestorderToSign);

  // 7. Matcher les ordres
  const { dealid, txHash } = await iexec.order.matchOrders({
    apporder,
    workerpoolorder,
    requestorder,
  });

  console.log('✅ Deal créé ! txHash:', txHash);

  // 8. Calculer le taskId
  const taskId = await iexec.deal.computeTaskId(dealid, 0);
  console.log('📦 taskId:', taskId);
}

main().catch(console.error);
