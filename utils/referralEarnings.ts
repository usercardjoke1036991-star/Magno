export function asWei(value: string | number | bigint | undefined): bigint {
  try {
    if (typeof value === 'bigint') return value;
    if (typeof value === 'number') return BigInt(Math.max(0, Math.floor(value)));
    if (!value) return 0n;
    return BigInt(value);
  } catch {
    return 0n;
  }
}

export function sumReferralEarnings(
  nodes: Array<{ commissionWei?: string; bonusWei?: string }>
): { commissionWei: bigint; bonusWei: bigint; totalWei: bigint } {
  let commissionWei = 0n;
  let bonusWei = 0n;
  for (const node of nodes || []) {
    commissionWei += asWei(node.commissionWei);
    bonusWei += asWei(node.bonusWei);
  }
  return { commissionWei, bonusWei, totalWei: commissionWei + bonusWei };
}
