import { syncAppKitNetwork } from '../web3Config';

/** Abre AppKit en la red del mundo activo (97 Demo, 56 Real). Cancelar no pinta error rojo. */
export async function openWalletConnect(open: () => unknown): Promise<boolean> {
  try {
    await syncAppKitNetwork();
    await Promise.resolve(open());
    return true;
  } catch {
    return false;
  }
}
