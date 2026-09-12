export type SupportKind = 'none' | 'ally' | 'patron' | 'circle';

export const SUPPORT_PATRON_USD = 50;
export const SUPPORT_CIRCLE_USD = 200;

export function supportKind(donatedUsd: number, lpUsd: number): SupportKind {
  const donated = Number.isFinite(donatedUsd) ? Math.max(0, donatedUsd) : 0;
  const lp = Number.isFinite(lpUsd) ? Math.max(0, lpUsd) : 0;
  const total = donated + lp;
  if (total >= SUPPORT_CIRCLE_USD) return 'circle';
  if (total >= SUPPORT_PATRON_USD) return 'patron';
  if (total > 0) return 'ally';
  return 'none';
}

export function supportNameKey(kind: SupportKind): 'supportAlly' | 'supportPatron' | 'supportCircle' | null {
  if (kind === 'ally') return 'supportAlly';
  if (kind === 'patron') return 'supportPatron';
  if (kind === 'circle') return 'supportCircle';
  return null;
}
