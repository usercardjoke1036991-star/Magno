import type { Lang } from './languages';

type ExtraDoc = {
  privacy: { title: string; body: string }[];
  terms: { title: string; body: string }[];
};

function sections(...pairs: [string, string][]): ExtraDoc {
  return {
    privacy: pairs.filter((_, i) => i < 4).map(([title, body]) => ({ title, body })),
    terms: pairs.filter((_, i) => i >= 4).map(([title, body]) => ({ title, body })),
  };
}

const en = sections(
  [
    'Data on the device and on the network',
    'The 24-word phrase, PIN, password, authenticator and biometric unlock stay encrypted on this phone. We do not hold them. Wallet addresses, credit, reputation, invitations and Reserva locks are written on a public network and can be seen by anyone who reads that network. A profile photo and a local identity photo may stay on the device; the identity photo is not sent to our files. Email and phone are used for the account and notices.',
  ],
  [
    'Permissions and notices',
    'The app may ask for camera (document or profile), notifications (payment and account alerts) and biometrics (to unlock this phone). Notices may be sent by specialised providers acting only on our instructions. If you link an external wallet, that wallet’s own policy also applies. We do not sell your data, do not read your contacts to collect a debt and do not use location to approve credit.',
  ],
  [
    'Retention, children and your rights',
    'Off-network data (email, phone, notice records) is kept only while the account needs it. You may ask us to stop notices and to delete off-network copies. What is written on the public network cannot be erased. The service is for people 18 or older. We do not knowingly serve children. Privacy: privacidad@quatriviumcredit.app',
  ],
  [
    'Changes',
    'If this policy changes in a material way, the app will ask you to read and accept the new version before you continue. The date of the version in force is shown when you accept.',
  ],
  [
    'Reserva',
    'Reserva lets you lock USDT for 30 days. The locked amount returns to your account when the period ends. If a separate pot has funds, an estimated yield of up to 12% a year may be added for those days. That yield is not guaranteed and can be zero. Reserva is not a bank deposit, not a fixed term and not an investment product. Locking is available from level 10 and, on the Real account, after the same identity steps as credit.',
  ],
  [
    'Common fund and donations',
    'USDT placed in the common fund stays there to lend. A contribution is not a product you can withdraw. Donations are voluntary, go to the project wallet and do not enter the fund. There are no purchases inside Google Play: value moves on the public network.',
  ],
  [
    'Risks and the law of your country',
    'USDT and network fees can change in value. Transfers on the network cannot be reversed. If you lose the recovery phrase, that account cannot be reopened. A high credit level may have no funds. Quatrivium Finance provides the application; the protocol runs on the network. Credit, referrals and Reserva may be regulated where you live. You are responsible for using the app only where you are allowed to do so. These texts are information, not a licence, not legal advice and not a promise that the service is authorised in every country.',
  ],
  [
    'Limits of the service',
    'We do not collect through your contacts or with threats. Late payment affects on-network reputation until you catch up. We may pause the protocol or refuse a request if the rules of the network or the law require it. Support: soporte@quatriviumcredit.app',
  ]
);

const es = sections(
  [
    'Datos en el aparato y en la red',
    'La frase de 24 palabras, el PIN, la contraseña, el autenticador y el desbloqueo biométrico quedan cifrados en este teléfono. No los custodiamos. Las direcciones, el crédito, la reputación, las invitaciones y los bloqueos de Reserva quedan escritos en una red pública y puede verlos quien consulte esa red. La foto de perfil y la foto local de identidad pueden permanecer en el aparato; la del documento no se envía a nuestros archivos. El correo y el teléfono sirven a la cuenta y a los avisos.',
  ],
  [
    'Permisos y avisos',
    'La aplicación puede pedir cámara (documento o perfil), notificaciones (avisos de pago y de cuenta) y biometría (para desbloquear este teléfono). Los avisos pueden salir por proveedores especializados que actúan solo bajo nuestras instrucciones. Si vincula una billetera externa, rige también la política de ese servicio. No vendemos sus datos, no leemos su agenda para cobrar y no usamos su ubicación para aprobar un crédito.',
  ],
  [
    'Conservación, menores y derechos',
    'Los datos fuera de la red (correo, teléfono, registro de avisos) se guardan solo mientras la cuenta los necesite. Puede pedirnos que dejemos de avisar y que borremos las copias fuera de la red. Lo escrito en la red pública no se puede borrar. El servicio es para mayores de 18 años. No atendemos a menores a sabiendas. Privacidad: privacidad@quatriviumcredit.app',
  ],
  [
    'Cambios',
    'Si esta política cambia de forma relevante, la aplicación le pedirá leer y aceptar la nueva versión antes de continuar. La fecha de la versión vigente se muestra al aceptar.',
  ],
  [
    'Reserva',
    'Reserva permite bloquear USDT durante 30 días. El monto bloqueado vuelve a su cuenta al terminar el periodo. Si un bote aparte tiene fondos, puede sumarse un rendimiento estimado de hasta el 12% anual sobre esos días. Ese rendimiento no está garantizado y puede ser cero. Reserva no es un depósito bancario, no es un plazo fijo y no es un producto de inversión. Se puede bloquear desde el nivel 10 y, en la cuenta Real, con los mismos pasos de identidad que el crédito.',
  ],
  [
    'Fondo común y donaciones',
    'El USDT que entra al fondo común permanece ahí para prestar. Aportar no es un producto que se pueda retirar. Donar es voluntario, va a la billetera del proyecto y no entra al fondo. No hay compras dentro de Google Play: el valor se mueve en la red pública.',
  ],
  [
    'Riesgos y la ley de su país',
    'USDT y las comisiones de red pueden cambiar de valor. Las transferencias en la red no se deshacen. Si pierde la frase de respaldo, esa cuenta no se reabre. Un nivel alto de crédito puede no tener fondos. Quatrivium Finance pone la aplicación; el protocolo se ejecuta en la red. El crédito, los referidos y Reserva pueden estar regulados donde usted vive. Usted es responsable de usar la aplicación solo donde le esté permitido. Estos textos informan; no son una licencia, no son asesoría legal y no prometen que el servicio esté autorizado en todos los países.',
  ],
  [
    'Límites del servicio',
    'No cobramos a través de sus contactos ni con amenazas. El retraso afecta la reputación en la red hasta ponerse al día. Podemos pausar el protocolo o rechazar una solicitud si las reglas de la red o la ley lo exigen. Atención: soporte@quatriviumcredit.app',
  ]
);

export function legalExtrasFor(lang: Lang): ExtraDoc {
  if (lang === 'es') return es;
  return en;
}
