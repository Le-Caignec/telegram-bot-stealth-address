import { IExec, utils } from 'iexec';
import { ethers, JsonRpcProvider, Wallet } from 'ethers';
import { WORKERPOOL_ADDRESS, APP_ADDRESS, PROTECTED_DATA_ADDRESS, ESCROW_ADDRESS } from './config/config';
import { pushRequesterSecret } from './utils/utils';

// Initialiser iExec
const ethProvider = utils.getSignerFromPrivateKey(
  'bellecour',
  ethers.Wallet.createRandom().privateKey
);
const iexec = new IExec({ ethProvider }, { smsURL: 'https://sms.labs.iex.ec' });

// Infos
export async function handleSend(senderWallet: Wallet, amount: string, receiver: string) {
  if (isNaN(Number(amount))) throw new Error('❌ Le montant doit être un nombre valide');
  if (!ethers.isAddress(receiver)) throw new Error('❌ L’adresse du destinataire n’est pas valide');

  // Convertir le montant
  const amountToSend = ethers.parseEther(amount);

  // Appeler lockFunds sur le contrat Escrow
  console.log('🔐 Envoi de lockFunds au contrat Escrow...');
  const escrowAbi = ["function lockFunds() external payable"];
   const provider = new JsonRpcProvider(process.env.RPC!); // ou URL directe
  const connectedWallet = senderWallet.connect(provider);
  const escrowContract = new ethers.Contract(ESCROW_ADDRESS, escrowAbi, connectedWallet);

  const tx = await escrowContract.lockFunds({ value: amountToSend });
  console.log(`✅ lockFunds envoyé ! Tx: ${tx.hash}`);
  const receipt = await tx.wait();
  if (receipt.status !== 1) {
    throw new Error('❌ Échec du lockFunds');
  }
  console.log('✅ lockFunds confirmé.');

  // Ordres Dataset
  const { orders: datasetOrders } = await iexec.orderbook.fetchDatasetOrderbook(PROTECTED_DATA_ADDRESS, {
    app: APP_ADDRESS,
    workerpool: WORKERPOOL_ADDRESS,
    minTag: ['tee', 'scone'],
    maxTag: ['tee', 'scone'],
  });
  if (datasetOrders.length === 0) throw new Error('❌ Aucun DatasetOrder trouvé');
  const datasetorder = datasetOrders[0].order;

  // Ordres App
  const { orders: appOrders } = await iexec.orderbook.fetchAppOrderbook(APP_ADDRESS, {
    minTag: ['tee', 'scone'],
    maxTag: ['tee', 'scone'],
    workerpool: WORKERPOOL_ADDRESS,
    dataset: PROTECTED_DATA_ADDRESS,
  });
  if (appOrders.length === 0) throw new Error('❌ Aucun AppOrder trouvé');
  const apporder = appOrders[0].order;

  // Ordres Workerpool
  const { orders: wpOrders } = await iexec.orderbook.fetchWorkerpoolOrderbook({
    workerpool: WORKERPOOL_ADDRESS,
    app: APP_ADDRESS,
    minTag: ['tee', 'scone'],
    maxTag: ['tee', 'scone'],
    category: 0,
  });
  if (wpOrders.length === 0) throw new Error('❌ Aucun WorkerpoolOrder trouvé');
  const workerpoolorder = wpOrders[0].order;

  // Push secrets
  const requesterSecrets = [
    { key: '1', value: amount },
    { key: '2', value: process.env.RPC! },
    { key: '3', value: receiver },
    { key: '4', value: senderWallet.address },
  ];
  
  const iexec_secrets = Object.fromEntries(
    await Promise.all(
      requesterSecrets.map(async ({ key, value }) => {
        const name = await pushRequesterSecret({ iexec, value });
        return [key, name];
      })
    )
  );

  // RequestOrder
  const requestorderToSign = await iexec.order.createRequestorder({
    dataset: datasetorder.dataset,
    app: apporder.app,
    category: workerpoolorder.category,
    tag: ['tee', 'scone'],
    workerpool: workerpoolorder.workerpool,
    params: { iexec_secrets },
  });
  const requestorder = await iexec.order.signRequestorder(requestorderToSign);

  // Match orders
  const { dealid, txHash } = await iexec.order.matchOrders({
    datasetorder,
    apporder,
    workerpoolorder,
    requestorder,
  });
  console.log('✅ Deal créé ! txHash:', txHash);

  // Task
  const taskId = await iexec.deal.computeTaskId(dealid, 0);
  console.log('📦 taskId:', taskId);

  // Wait
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
