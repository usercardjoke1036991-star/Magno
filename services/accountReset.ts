import { clearVerifiedEmail } from './accountEmail';
import { clearClaimedUsername } from './accountUsername';
import { clearKycDeclaration } from './kycDeclaration';
import { clearOwnProfile } from './userProfile';
import { clearSavedSession } from './savedSession';

/** Solo al destruir la cuenta para crear otra. Editar KYC o el usuario no llama esto. */
export async function wipeLocalAccount(wallet: string): Promise<void> {
  await Promise.all([
    clearKycDeclaration(wallet),
    clearClaimedUsername(),
    clearVerifiedEmail(),
    clearOwnProfile(wallet),
    clearSavedSession(),
  ]);
}
