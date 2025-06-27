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

export async function handleSend(
  senderWallet: Wallet,
  amount: string,
  receiver: string,
  notify: (msg: string) => Promise<void> // 👈 callback pour messages dynamiques
) {
  if (isNaN(Number(amount))) throw new Error('❌ Invalid amount');
  if (!ethers.isAddress(receiver)) throw new Error('❌ Invalid recipient address');

  const amountToSend = ethers.parseEther(amount);
  
  const escrowAbi = ["function lockFunds() external payable"];
  const provider = new JsonRpcProvider(process.env.RPC!);
  const connectedWallet = senderWallet.connect(provider);
  const escrowContract = new ethers.Contract(ESCROW_ADDRESS, escrowAbi, connectedWallet);

  await notify('🔐 Locking funds in Escrow...');
  const tx = await escrowContract.lockFunds({ value: amountToSend });
  const receipt = await tx.wait();
  if (receipt.status !== 1) {
    throw new Error('❌ Failed to lock funds');
  }
  await notify(
    `✅ Funds successfully locked in Escrow.\n` +
    `🔗 [View on Sepolia Etherscan](https://sepolia.etherscan.io/tx/${tx.hash})\n\n` +
    `The lender can now proceed using a stealth address.`
  );
  await notify('📤 Order placed...');
  const { orders: datasetOrders } = await iexec.orderbook.fetchDatasetOrderbook(PROTECTED_DATA_ADDRESS, {
    app: APP_ADDRESS,
    workerpool: WORKERPOOL_ADDRESS,
    minTag: ['tee', 'scone'],
    maxTag: ['tee', 'scone'],
  });
  if (datasetOrders.length === 0) throw new Error('❌ No DatasetOrder found');
  const datasetorder = datasetOrders[0].order;

  const { orders: appOrders } = await iexec.orderbook.fetchAppOrderbook(APP_ADDRESS, {
    minTag: ['tee', 'scone'],
    maxTag: ['tee', 'scone'],
    workerpool: WORKERPOOL_ADDRESS,
    dataset: PROTECTED_DATA_ADDRESS,
  });
  if (appOrders.length === 0) throw new Error('❌ No AppOrder found');
  const apporder = appOrders[0].order;

  const { orders: wpOrders } = await iexec.orderbook.fetchWorkerpoolOrderbook({
    workerpool: WORKERPOOL_ADDRESS,
    app: APP_ADDRESS,
    minTag: ['tee', 'scone'],
    maxTag: ['tee', 'scone'],
    category: 0,
  });
  if (wpOrders.length === 0) throw new Error('❌ No WorkerpoolOrder found');
  const workerpoolorder = wpOrders[0].order;

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

  const requestorderToSign = await iexec.order.createRequestorder({
    dataset: datasetorder.dataset,
    app: apporder.app,
    category: workerpoolorder.category,
    tag: ['tee', 'scone'],
    workerpool: workerpoolorder.workerpool,
    params: { iexec_secrets },
  });
  const requestorder = await iexec.order.signRequestorder(requestorderToSign);
  await notify('📥 Order filled by a lender ✅');

  const { dealid, txHash } = await iexec.order.matchOrders({
    datasetorder,
    apporder,
    workerpoolorder,
    requestorder,
  });

  const taskId = await iexec.deal.computeTaskId(dealid, 0);

  const waitForCompletion = async () => {
    const taskObservable = await iexec.task.obsTask(taskId, { dealid });
    await new Promise((resolve, reject) => {
      taskObservable.subscribe({
        next: () => {},
        error: (e) => reject(e),
        complete: () => resolve(undefined),
      });
    });
  };

  return { txHash, taskId, waitForCompletion };
}
