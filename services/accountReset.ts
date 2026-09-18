import { clearVerifiedEmail } from './accountEmail';
import { setPhoneActive } from './accountPhone';
import { clearClaimedUsername } from './accountUsername';
import { clearKycDeclaration } from './kycDeclaration';
import { clearOwnProfile } from './userProfile';
import { clearSavedSession } from './savedSession';

/** Solo al recuperar otra frase en este teléfono. No hay destruir cuenta en la app. */
export async function wipeLocalAccount(wallet: string): Promise<void> {
  await Promise.all([
    clearKycDeclaration(wallet),
    clearClaimedUsername(),
    clearVerifiedEmail(),
    setPhoneActive(false),
    clearOwnProfile(wallet),
    clearSavedSession(),
  ]);
}
