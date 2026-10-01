/** Abre AppKit y trata cancelar/rechazar como idle: no lanza ni pinta error rojo. */
export async function openWalletConnect(open: () => unknown): Promise<boolean> {
  try {
    await Promise.resolve(open());
    return true;
  } catch {
    return false;
  }
}
