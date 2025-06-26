import { IExec, utils } from 'iexec';
import { ethers } from 'ethers';
import {WORKERPOOL_ADDRESS,APP_ADDRESS} from './config/config'
import {pushRequesterSecret} from './utils/utils';

// 1. Initialiser iExec
const ethProvider = utils.getSignerFromPrivateKey(
  'bellecour', // blockchain node URL
  ethers.Wallet.createRandom().privateKey,
);
const iexec = new IExec(
  {
    ethProvider,
  },
  {
    smsURL: "https://sms.labs.iex.ec",
  }
);

// 2. Infos
export async function handleSend(amount: string, receiver: string) {
  // 3. Récupérer les ordres App
  const { orders: appOrders } = await iexec.orderbook.fetchAppOrderbook(APP_ADDRESS, {
    minTag: ['tee', 'scone'],
    maxTag: ['tee', 'scone'],
    workerpool: WORKERPOOL_ADDRESS,
  });
  if (appOrders.length === 0) throw new Error('❌ Aucun AppOrder trouvé');
  const apporder = appOrders[0].order;
  console.log("🚀 ~ handleSend ~ apporder:", apporder)

  // 4. Récupérer les ordres Workerpool
  const { orders: wpOrders } = await iexec.orderbook.fetchWorkerpoolOrderbook({
    workerpool: WORKERPOOL_ADDRESS,
    app: APP_ADDRESS,
    minTag: ['tee', 'scone'],
    maxTag: ['tee', 'scone'],
    category: 0,
  });
  if (wpOrders.length === 0) throw new Error('❌ Aucun WorkerpoolOrder trouvé');
  const workerpoolorder = wpOrders[0].order;
  console.log("🚀 ~ handleSend ~ workerpoolorder:", workerpoolorder)

  // 5. Push RequesterSecret - FIXED
  const requesterSecrets = [
    { key: '1', value: process.env.PRIVATEKEY_SENDER! },
    { key: '2', value: amount },
    { key: '3', value: process.env.RPC! },
    { key: '4', value: receiver },
  ];

  let iexec_secrets;
  iexec_secrets = Object.fromEntries(
    await Promise.all(
      requesterSecrets.map(async ({ key, value }) => {
        const name = await pushRequesterSecret({ iexec, value });
        return [key, name];
      })
    )
  );

  // 6. Créer un RequestOrder
  const requestorderToSign = await iexec.order.createRequestorder({
    app: apporder.app,
    category: workerpoolorder.category,
    tag: ['tee', 'scone'],
    workerpool: workerpoolorder.workerpool,
    params:{
      iexec_secrets
    }
  });
  const requestorder = await iexec.order.signRequestorder(requestorderToSign);
  console.log("🚀 ~ handleSend ~ order:", requestorder)

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

  // 9. Fonction à appeler plus tard pour attendre la complétion
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
