import { IExec, utils } from 'iexec';
import { ethers } from 'ethers';
import {WORKERPOOL_ADDRESS,APP_ADDRESS} from './config/config'

// 1. Créer un wallet temporaire
//const privateKey = ethers.Wallet.createRandom().privateKey;
const privateKey = process.env.WALLET_PRIVATE_KEY;
// 2. Initialiser iExec
const ethProvider = utils.getSignerFromPrivateKey(
  'bellecour', // blockchain node URL
  ethers.Wallet.createRandom().privateKey,
);
const iexec = new IExec({
  ethProvider,
});

// 3. Infos
export async function handleSend(): Promise<{
  txHash: string;
  taskId: string;
  waitForCompletion: () => Promise<void>;
}> {
  // 1. Récupérer les ordres App
  const { orders: appOrders } = await iexec.orderbook.fetchAppOrderbook(APP_ADDRESS, {
    minTag: ['tee', 'scone'],
    maxTag: ['tee', 'scone'],
    workerpool: WORKERPOOL_ADDRESS,
  });
  if (appOrders.length === 0) throw new Error('❌ Aucun AppOrder trouvé');
  const apporder = appOrders[0].order;

  // 2. Récupérer les ordres Workerpool
  const { orders: wpOrders } = await iexec.orderbook.fetchWorkerpoolOrderbook({
    workerpool: WORKERPOOL_ADDRESS,
    app: APP_ADDRESS,
    minTag: ['tee', 'scone'],
    maxTag: ['tee', 'scone'],
    category: 0,
  });
  if (wpOrders.length === 0) throw new Error('❌ Aucun WorkerpoolOrder trouvé');
  const workerpoolorder = wpOrders[0].order;

  // 3. Créer un RequestOrder
  const requestorderToSign = await iexec.order.createRequestorder({
    app: apporder.app,
    category: workerpoolorder.category,
    tag: ['tee', 'scone'],
    workerpool: workerpoolorder.workerpool,
    params:{
      iexec_secrets:{
        1:process.env.PRIVATEKEY_SENDER
        2:process.env.AMOUNT
        3:process.env.RPC
        4:process.env.RECEIVER
      }
    }
  });
  const requestorder = await iexec.order.signRequestorder(requestorderToSign);

  // 4. Matcher les ordres
  const { dealid, txHash } = await iexec.order.matchOrders({
    apporder,
    workerpoolorder,
    requestorder,
  });
  console.log('✅ Deal créé ! txHash:', txHash);

  // 5. Calculer le taskId
  const taskId = await iexec.deal.computeTaskId(dealid, 0);
  console.log('📦 taskId:', taskId);

  // 6. Fonction à appeler plus tard pour attendre la complétion
  const waitForCompletion = async () => {
    const taskObservable = await iexec.task.obsTask(taskId, { dealid });
    await new Promise((resolve, reject) => {
      taskObservable.subscribe({
        next: () => {},
        error: (e) => reject(e),
        complete: () => {
          console.log('✅ Tâche terminée !');
          resolve(undefined);
        },
      });
    });
  };

  return { txHash, taskId, waitForCompletion };
}
