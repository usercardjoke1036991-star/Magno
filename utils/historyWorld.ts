export function historyJournalSuffix(input: {
  mode: string;
  chainId: number;
  contract: string;
  address: string;
}): string {
  const mode = input.mode === 'live' ? 'live' : 'demo';
  const contract = String(input.contract || '').toLowerCase();
  const address = String(input.address || '').toLowerCase();
  return `${mode}_${Number(input.chainId) || 0}_${contract}_${address}`;
}

export function movementBelongsToWorld(item: { world?: string }, mode: string): boolean {
  const world = mode === 'live' ? 'live' : 'demo';
  return !item.world || item.world === world;
}
