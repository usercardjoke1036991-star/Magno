import { getProviderWithFallback } from '../constants/rpcConfig';

const HASH = /^0x[0-9a-fA-F]{64}$/;
const DEFAULT_MS = 75_000;

type MinedTx = {
  hash?: string;
  wait?: (confirms?: number) => Promise<unknown>;
};

/** Espera el recibo en el RPC de la app. El provider de WalletConnect no emite bloques y deja el spinner colgado. */
export async function waitMined(tx: MinedTx, timeoutMs = DEFAULT_MS) {
  const hash = typeof tx.hash === 'string' ? tx.hash : '';
  if (!HASH.test(hash)) {
    if (typeof tx.wait === 'function') return tx.wait();
    throw new Error('tx-timeout');
  }
  const receipt = await getProviderWithFallback().waitForTransaction(hash, 1, timeoutMs);
  if (!receipt) throw new Error('tx-timeout');
  if (Number(receipt.status) === 0) throw new Error('tx-reverted');
  return receipt;
}
