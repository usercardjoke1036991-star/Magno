import type { Lang } from './languages';

export type LegalSection = {
  title: string;
  body: string;
};

export type LegalDoc = {
  privacy: LegalSection[];
  terms: LegalSection[];
};

function sections(...pairs: [string, string][]): LegalSection[] {
  return pairs.map(([title, body]) => ({ title, body }));
}

const es: LegalDoc = {
  privacy: sections(
    [
      'Nuestra casa',
      'Quatrivium Finance es una casa de crédito digital. Le ofrecemos una línea en USDT sobre una red pública. No somos un banco ni una entidad de depósito. Esta política explica únicamente cómo cuidamos su información.',
    ],
    [
      'Cómo trabaja la aplicación',
      'Usted abre su cuenta, guarda su frase de respaldo en este teléfono y, cuando lo desee, solicita crédito según su nivel. Un pago de acceso de 1 USDT se hace una sola vez. El correo y el teléfono sirven para su cuenta, avisos y para confirmar que la línea es suya. La foto del documento se toma en este aparato para verificar identidad; no se envía a nuestros archivos.',
    ],
    [
      'Información que tratamos',
      'Usamos correo, teléfono e imagen de perfil para operar su cuenta. El crédito, la reputación y los invitados que usted genere quedan anotados en la red, donde son visibles por diseño. Las claves de su cuenta y la frase de 24 palabras permanecen cifradas en su teléfono. No las custodiamos.',
    ],
    [
      'Lo que no haremos',
      'No vendemos sus datos. No leemos su agenda para cobrar. No usamos su ubicación para aprobar un crédito. Puede pedirnos que retiremos correo y teléfono de nuestros avisos. Lo escrito en la red no se puede borrar. El servicio es para mayores de 18 años.\n\nPrivacidad: privacidad@quatriviumcredit.app',
    ]
  ),
  terms: sections(
    [
      'Qué obtiene',
      'Accede a crédito sin aval, con mil niveles que crecen si paga a tiempo. Puede invitar y recibir recompensas de red, y reclamar bonos al cumplir hitos. Cada monto, plazo e interés se muestran en la aplicación antes de firmar. No hay compras dentro de Google Play: el dinero se mueve en la red.',
    ],
    [
      'Cómo opera el crédito',
      'El crédito vive en la cuenta de la aplicación. Los pagos de acceso, aportes al fondo y donaciones salen de la billetera que usted vincule. Hay un crédito a la vez y una espera entre solicitudes. El fondo común permanece destinado a prestar; aportar no es un producto de retiro. Donar es voluntario y no forma parte del fondo.',
    ],
    [
      'Con qué está de acuerdo',
      'Declara tener 18 años o más y usar una sola cuenta. Guardará su frase de respaldo: sin ella nadie puede reabrir esa cuenta. Acepta que las transferencias en la red no se deshacen y que pagará el plazo e interés que vio al firmar. Quatrivium Finance pone la aplicación; el protocolo se ejecuta en la red.',
    ],
    [
      'Si el pago se retrasa',
      'Hay un periodo para regularizar. No cobramos a través de sus contactos ni con amenazas. Mientras tanto, su reputación en la red se ve afectada hasta ponerse al día. El valor de USDT puede variar y un nivel alto puede no tener fondos disponibles.\n\nAtención: soporte@quatriviumcredit.app',
    ]
  ),
};

const en: LegalDoc = {
  privacy: sections(
    [
      'Our house',
      'Quatrivium Finance is a digital credit house. We offer a USDT line on a public network. We are not a bank and we do not take deposits. This policy explains only how we look after your information.',
    ],
    [
      'How the application works',
      'You open your account, keep your recovery phrase on this phone and, when you wish, request credit at your level. A 1 USDT access payment is made once. Email and phone serve your account, notices and to confirm the line is yours. The identity photo is taken on this device; it is not sent to our files.',
    ],
    [
      'Information we handle',
      'We use email, phone and a profile image to run your account. Credit, reputation and the people you invite are recorded on the network, where they are visible by design. Your account keys and 24-word phrase stay encrypted on your phone. We do not hold them.',
    ],
    [
      'What we will not do',
      'We do not sell your data. We do not read your contacts to collect a debt. We do not use your location to approve credit. You may ask us to remove email and phone from our notices. What is written on the network cannot be erased. The service is for people 18 or older.\n\nPrivacy: privacidad@quatriviumcredit.app',
    ]
  ),
  terms: sections(
    [
      'What you receive',
      'You obtain credit without collateral, across one thousand levels that grow when you pay on time. You may invite others and earn network rewards, and claim bonuses when you reach milestones. Amount, term and interest are shown in the app before you sign. There are no Google Play in-app purchases: funds move on the network.',
    ],
    [
      'How credit operates',
      'Credit lives in the in-app account. Access, fund contributions and donations are paid from the wallet you link. One credit at a time and a wait between requests. Capital in the common fund remains there to lend; a contribution is not a withdrawable product. Donations are voluntary and do not enter the fund.',
    ],
    [
      'What you agree to',
      'You confirm you are 18 or older and will use a single account. You will keep your recovery phrase: without it nobody can reopen that account. You accept that network transfers cannot be reversed and that you will pay the term and interest shown when you signed. Quatrivium Finance provides the application; the protocol runs on the network.',
    ],
    [
      'If payment is late',
      'There is a period to catch up. We do not collect through your contacts or with threats. Until you are current, your on-network reputation is affected. The value of USDT can change and a high level may not have funds available.\n\nSupport: soporte@quatriviumcredit.app',
    ]
  ),
};

export const legalCopy: Record<Lang, LegalDoc> = {
  es,
  en,
  zh: {
    privacy: sections(
      ['我们的机构', 'Quatrivium Finance 是数字信贷机构，在公开网络上提供 USDT 额度。我们不是银行，也不吸收存款。本政策只说明如何保护您的信息。'],
      ['应用如何运作', '您开立账户，将恢复短语保存在本机，并按等级申请信贷。1 USDT 准入只支付一次。邮箱和电话用于账户、通知并确认线路属于您。证件照片在本机拍摄，不会存入我们的档案。'],
      ['我们处理的信息', '我们使用邮箱、电话和头像来运营账户。信贷、声誉和您邀请的人会记录在网络上，依设计可见。账户密钥与 24 个词在本机加密，我们不保管。'],
      ['我们不会做的事', '我们不出售您的数据，不读取通讯录催收，不用定位审批信贷。您可要求我们从通知中删除邮箱和电话。写入网络的内容无法删除。服务仅限 18 岁以上。\n\n隐私：privacidad@quatriviumcredit.app']
    ),
    terms: sections(
      ['您将获得', '无抵押信贷，一千个等级随按时还款提升。可邀请并获得网络奖励，达成里程碑可领取奖金。金额、期限与利息在签署前于应用内展示。没有 Google Play 内购：资金在网络上流动。'],
      ['信贷如何运作', '信贷存在于应用账户。准入、基金出资与捐赠由您关联的钱包支付。同一时间一笔信贷，申请之间需等待。共同基金用于放贷，出资不是可赎回产品。捐赠出于自愿，不进入基金。'],
      ['您同意的内容', '确认年满 18 岁并只使用一个账户。妥善保管恢复短语：没有它无人能重开该账户。接受网络转账不可撤销，并按签署时展示的期限与利息还款。Quatrivium Finance 提供应用，协议在网络上执行。'],
      ['若付款延迟', '有一段补缴时间。我们不会通过通讯录或威胁催收。在结清前，网络声誉会受影响。USDT 价值可能变动，高等级也可能没有足够资金。\n\n支持：soporte@quatriviumcredit.app']
    ),
  },
  hi: {
    privacy: sections(
      ['हमारा संस्थान', 'Quatrivium Finance एक डिजिटल ऋण संस्थान है। हम सार्वजनिक नेटवर्क पर USDT रेखा देते हैं। हम बैंक नहीं हैं और जमा नहीं लेते। यह नीति केवल आपकी जानकारी की रक्षा बताती है।'],
      ['ऐप कैसे काम करती है', 'आप खाता खोलते हैं, पुनर्प्राप्ति वाक्य इसी फ़ोन पर रखते हैं और अपने स्तर पर ऋण माँगते हैं। 1 USDT प्रवेश एक बार होता है। ईमेल और फ़ोन खाते, सूचनाओं और यह पुष्टि करने के लिए हैं कि रेखा आपकी है। पहचान फ़ोटो इसी उपकरण पर ली जाती है; हमारी फाइलों में नहीं जाती।'],
      ['जो जानकारी हम संभालते हैं', 'खाता चलाने के लिए ईमेल, फ़ोन और प्रोफ़ाइल चित्र। ऋण, प्रतिष्ठा और आपके आमंत्रित नेटवर्क पर दर्ज होते हैं और दिखते हैं। कुंजियाँ और 24 शब्द आपके फ़ोन पर सुरक्षित रहते हैं। हम उन्हें नहीं रखते।'],
      ['जो हम नहीं करेंगे', 'डेटा नहीं बेचते, वसूली के लिए संपर्क नहीं पढ़ते, स्थान से ऋण मंज़ूर नहीं करते। सूचनाओं से ईमेल और फ़ोन हटाने को कह सकते हैं। नेटवर्क पर लिखा मिटता नहीं। सेवा 18 वर्ष या अधिक के लिए है।\n\nगोपनीयता: privacidad@quatriviumcredit.app']
    ),
    terms: sections(
      ['आपको क्या मिलता है', 'बिना गारंटी ऋण, एक हज़ार स्तर समय पर चुकाने से बढ़ते हैं। आमंत्रण पर नेटवर्क पुरस्कार और पड़ाव पूरे करने पर बोनस। राशि, अवधि और ब्याज हस्ताक्षर से पहले ऐप में दिखते हैं। Google Play में खरीदारी नहीं: धन नेटवर्क पर चलता है।'],
      ['ऋण कैसे चलता है', 'ऋण ऐप खाते में रहता है। प्रवेश, कोष और दान आपकी जुड़ी वॉलेट से चुकाए जाते हैं। एक समय एक ऋण, अनुरोधों के बीच प्रतीक्षा। साझा कोष उधार देने के लिए रहता है; योगदान निकाला नहीं जाता। दान स्वैच्छिक है और कोष में नहीं जाता।'],
      ['आप किस बात से सहमत हैं', '18 वर्ष या अधिक और एक ही खाता। वाक्य संभालकर रखेंगे: उसके बिना वह खाता नहीं खुलता। नेटवर्क अंतरण उल्टे नहीं होते; हस्ताक्षर पर दिखी अवधि और ब्याज चुकाएँगे। Quatrivium Finance ऐप देती है; प्रोटोकॉल नेटवर्क पर चलता है।'],
      ['यदि भुगतान देर हो', 'सुधार की अवधि मिलती है। संपर्कों या धमकी से वसूली नहीं। जब तक चालू नहीं होते, नेटवर्क प्रतिष्ठा प्रभावित रहती है। USDT का मूल्य बदल सकता है और ऊँचे स्तर पर धन न हो।\n\nसहायता: soporte@quatriviumcredit.app']
    ),
  },
  ar: {
    privacy: sections(
      ['دارنا', 'Quatrivium Finance دار ائتمان رقمية. نقدّم خطاً بـ USDT على شبكة عامة. لسنا مصرفاً ولا نتلقى ودائع. توضّح هذه السياسة فقط كيف نحمي معلوماتك.'],
      ['كيف تعمل التطبيق', 'تفتح حسابك وتحفظ عبارة الاسترداد على هذا الهاتف وتطلب الائتمان حسب مستواك. دفع دخول 1 USDT مرة واحدة. البريد والهاتف للحساب والتنبيهات ولتأكيد أن الخط لك. صورة الهوية تُلتقط على هذا الجهاز ولا تُرسل إلى ملفاتنا.'],
      ['المعلومات التي نعالجها', 'نستخدم البريد والهاتف وصورة الملف لتشغيل حسابك. الائتمان والسمعة ومن تدعوهم يُسجَّلون على الشبكة ويظهرون بطبيعتها. مفاتيح الحساب وعبارة الـ 24 كلمة تبقى مشفّرة على هاتفك. لا نحتفظ بها.'],
      ['ما لن نفعله', 'لا نبيع بياناتك. لا نقرأ جهات الاتصال للتحصيل. لا نستخدم موقعك للموافقة على ائتمان. يمكنك طلب حذف البريد والهاتف من تنبيهاتنا. ما يُكتب على الشبكة لا يُمحى. الخدمة لمن أتمّ 18 عاماً.\n\nالخصوصية: privacidad@quatriviumcredit.app']
    ),
    terms: sections(
      ['ماذا تحصل', 'ائتمان بلا ضمان، ألف مستوى تنمو بالسداد في موعده. يمكنك الدعوة ومكافآت الشبكة والمكافآت عند الإنجاز. المبلغ والأجل والفائدة تظهر في التطبيق قبل التوقيع. لا مشتريات داخل Google Play: الأموال تتحرك على الشبكة.'],
      ['كيف يعمل الائتمان', 'الائتمان في حساب التطبيق. الدخول والمساهمة في الصندوق والتبرع تُدفع من المحفظة التي تربطها. ائتمان واحد في كل مرة وانتظار بين الطلبات. الصندوق المشترك يبقى للإقراض؛ المساهمة ليست منتج سحب. التبرع اختياري ولا يدخل الصندوق.'],
      ['بما توافق', 'تؤكد أن عمرك 18 أو أكثر وأنك تستخدم حساباً واحداً. تحفظ عبارة الاسترداد: بدونها لا يُعاد فتح ذلك الحساب. تقبل أن تحويلات الشبكة لا تُعكس وأنك تسدد الأجل والفائدة الظاهرين عند التوقيع. Quatrivium Finance تقدّم التطبيق؛ والبروتوكول يعمل على الشبكة.'],
      ['إذا تأخر الدفع', 'هناك مهلة للتسوية. لا نحصّل عبر جهات الاتصال ولا بالتهديد. حتى تسوية الحساب تتأثر سمعتك على الشبكة. قد يتغير سعر USDT وقد لا تتوفر أموال لمستوى مرتفع.\n\nالدعم: soporte@quatriviumcredit.app']
    ),
  },
  bn: {
    privacy: sections(
      ['আমাদের প্রতিষ্ঠান', 'Quatrivium Finance একটি ডিজিটাল ঋণপ্রতিষ্ঠান। আমরা পাবলিক নেটওয়ার্কে USDT সীমা দিই। আমরা ব্যাংক নই, আমানত নিই না। এই নীতি শুধু আপনার তথ্য কীভাবে রক্ষা করি তা বলে।'],
      ['অ্যাপ কীভাবে কাজ করে', 'আপনি অ্যাকাউন্ট খুলেন, পুনরুদ্ধার বাক্য এই ফোনে রাখেন এবং স্তর অনুযায়ী ঋণ চান। ১ USDT প্রবেশ একবার। ইমেইল ও ফোন অ্যাকাউন্ট, নোটিশ এবং লাইন আপনার কিনা নিশ্চিত করতে। পরিচয়ের ছবি এই যন্ত্রে তোলা হয়, আমাদের ফাইলে যায় না।'],
      ['যে তথ্য আমরা ব্যবহার করি', 'অ্যাকাউন্ট চালাতে ইমেইল, ফোন ও প্রোফাইল ছবি। ঋণ, সুনাম ও আপনার আমন্ত্রিতরা নেটওয়ার্কে লেখা হয় এবং দেখা যায়। চাবি ও ২৪ শব্দ আপনার ফোনে থাকে। আমরা সেগুলো রাখি না।'],
      ['যা আমরা করব না', 'ডেটা বেচি না, আদায়ে কন্টাক্ট পড়ি না, অবস্থান দিয়ে ঋণ পাস করি না। নোটিশ থেকে ইমেইল ও ফোন সরাতে বলতে পারেন। নেটওয়ার্কে লেখা মুছে যায় না। সেবা ১৮ বছর বা তার বেশি।\n\nগোপনীয়তা: privacidad@quatriviumcredit.app']
    ),
    terms: sections(
      ['আপনি যা পান', 'জামানত ছাড়া ঋণ, হাজার স্তর সময়মতো শোধে বাড়ে। আমন্ত্রণে নেটওয়ার্ক পুরস্কার, মাইলফলকে বোনাস। পরিমাণ, মেয়াদ ও সুদ স্বাক্ষরের আগে অ্যাপে দেখা যায়। Google Play কেনা নেই: অর্থ নেটওয়ার্কে চলে।'],
      ['ঋণ কীভাবে চলে', 'ঋণ অ্যাপ অ্যাকাউন্টে থাকে। প্রবেশ, তহবিল ও দান আপনার যুক্ত ওয়ালেট থেকে মেটে। এক সময়ে একটি ঋণ, আবেদনের মাঝে অপেক্ষা। সাধারণ তহবিল ধার দিতে থাকে; অবদান তোলা যায় না। দান স্বেচ্ছায়, তহবিলে যায় না।'],
      ['আপনি কীতে রাজি', '১৮ বা তার বেশি এবং একটিই অ্যাকাউন্ট। বাক্য সামলাবেন: ছাড়া সেই অ্যাকাউন্ট খোলে না। নেটওয়ার্ক স্থানান্তর ফেরে না; স্বাক্ষরে দেখা মেয়াদ ও সুদ শোধ করবেন। Quatrivium Finance অ্যাপ দেয়; প্রোটোকল নেটওয়ার্কে চলে।'],
      ['পরিশোধ দেরি হলে', 'নিয়মিত করার সময় আছে। কন্টাক্ট বা হুমকি দিয়ে আদায় নেই। পরিশোধ না হওয়া পর্যন্ত নেটওয়ার্ক সুনাম ক্ষতিগ্রস্ত। USDT মান বদলাতে পারে, উচ্চ স্তরে তহবিল নাও থাকতে পারে।\n\nসহায়তা: soporte@quatriviumcredit.app']
    ),
  },
  pt: {
    privacy: sections(
      ['A nossa casa', 'A Quatrivium Finance é uma casa de crédito digital. Oferecemos uma linha em USDT numa rede pública. Não somos um banco nem recebemos depósitos. Esta política explica apenas como cuidamos da sua informação.'],
      ['Como trabalha a aplicação', 'Abre a conta, guarda a frase de recuperação neste telefone e pede crédito segundo o seu nível. O acesso de 1 USDT paga-se uma vez. O correio e o telefone servem a conta, os avisos e a confirmar que a linha é sua. A foto do documento fica neste aparelho; não vai para os nossos ficheiros.'],
      ['Informação que tratamos', 'Usamos correio, telefone e imagem de perfil para operar a conta. O crédito, a reputação e os convidados ficam na rede, visíveis por desenho. As chaves e a frase de 24 palavras ficam cifradas no telefone. Não as custodiamos.'],
      ['O que não faremos', 'Não vendemos os seus dados. Não lemos a agenda para cobrar. Não usamos a localização para aprovar crédito. Pode pedir que retiremos correio e telefone dos avisos. O que está na rede não se apaga. O serviço é para maiores de 18 anos.\n\nPrivacidade: privacidad@quatriviumcredit.app']
    ),
    terms: sections(
      ['O que obtém', 'Crédito sem aval, mil níveis que crescem se pagar a tempo. Pode convidar e receber recompensas de rede, e bónus ao cumprir marcos. Montante, prazo e juro aparecem na aplicação antes de assinar. Não há compras na Google Play: o dinheiro move-se na rede.'],
      ['Como opera o crédito', 'O crédito vive na conta da aplicação. Acesso, aportes ao fundo e donativos saem da carteira que vincular. Um crédito de cada vez e uma espera entre pedidos. O fundo comum permanece para emprestar; aportar não é um produto de levantamento. Doar é voluntário e não entra no fundo.'],
      ['Com o que concorda', 'Declara ter 18 anos ou mais e usar uma só conta. Guardará a frase: sem ela ninguém reabre essa conta. Aceita que as transferências na rede não se desfazem e que pagará o prazo e o juro que viu ao assinar. A Quatrivium Finance oferece a aplicação; o protocolo corre na rede.'],
      ['Se o pagamento se atrasa', 'Há um período para regularizar. Não cobramos pelos contactos nem com ameaças. Até estar em dia, a reputação na rede é afetada. O valor do USDT pode variar e um nível alto pode não ter fundos.\n\nApoio: soporte@quatriviumcredit.app']
    ),
  },
  ru: {
    privacy: sections(
      ['Наш дом', 'Quatrivium Finance — цифровой кредитный дом. Мы даём линию в USDT в открытой сети. Мы не банк и не принимаем вклады. Эта политика объясняет лишь, как мы бережём ваши сведения.'],
      ['Как работает приложение', 'Вы открываете счёт, храните фразу восстановления на этом телефоне и запрашиваете кредит по своему уровню. Плата за доступ 1 USDT вносится один раз. Почта и телефон нужны для счёта, уведомлений и подтверждения, что линия ваша. Фото документа делается на устройстве и не уходит в наши файлы.'],
      ['Какие сведения мы обрабатываем', 'Почта, телефон и изображение профиля для ведения счёта. Кредит, репутация и приглашённые записываются в сети и видны по её устройству. Ключи и 24 слова остаются зашифрованными на телефоне. Мы их не храним.'],
      ['Чего мы не делаем', 'Не продаём данные. Не читаем контакты для взыскания. Не используем геолокацию для одобрения кредита. Можно попросить убрать почту и телефон из уведомлений. Записанное в сети нельзя стереть. Сервис для лиц 18 лет и старше.\n\nКонфиденциальность: privacidad@quatriviumcredit.app']
    ),
    terms: sections(
      ['Что вы получаете', 'Кредит без залога, тысяча уровней, растущих при своевременной оплате. Можно приглашать и получать сетевые вознаграждения, бонусы за этапы. Сумма, срок и процент показаны в приложении до подписи. Покупок в Google Play нет: средства движутся в сети.'],
      ['Как работает кредит', 'Кредит живёт в счёте приложения. Доступ, взносы в фонд и пожертвования оплачиваются с привязанного кошелька. Один кредит за раз и пауза между заявками. Общий фонд остаётся для выдачи; взнос нельзя вывести. Пожертвование добровольно и в фонд не входит.'],
      ['С чем вы соглашаетесь', 'Вам 18 или больше, и вы используете один счёт. Сохраните фразу: без неё счёт не открыть. Переводы в сети необратимы; вы оплатите срок и процент, показанные при подписи. Quatrivium Finance даёт приложение; протокол исполняется в сети.'],
      ['Если платёж задержан', 'Есть срок, чтобы погасить. Мы не взыскиваем через контакты и не угрожаем. Пока долг открыт, сетевая репутация страдает. Курс USDT может измениться, на высокий уровень может не хватить средств.\n\nПоддержка: soporte@quatriviumcredit.app']
    ),
  },
  ur: {
    privacy: sections(
      ['ہمارا ادارہ', 'Quatrivium Finance ایک ڈیجیٹل قرض ادارہ ہے۔ ہم عوامی نیٹ ورک پر USDT لائن دیتے ہیں۔ ہم بینک نہیں اور جمعہ نہیں لیتے۔ یہ پالیسی صرف یہ بتاتی ہے کہ آپ کی معلومات کیسے سنبھالتے ہیں۔'],
      ['ایپ کیسے کام کرتی ہے', 'آپ اکاؤنٹ کھولتے ہیں، بحالی کا جملہ اسی فون پر رکھتے ہیں اور اپنے درجے پر قرض مانگتے ہیں۔ 1 USDT رسائی ایک بار۔ ای میل اور فون اکاؤنٹ، نوٹس اور یہ تصدیق کہ لائن آپ کی ہے۔ شناختی تصویر اسی آلے پر لی جاتی ہے، ہماری فائلوں میں نہیں جاتی۔'],
      ['جو معلومات ہم سنبھالتے ہیں', 'اکاؤنٹ چلانے کے لیے ای میل، فون اور پروفائل تصویر۔ قرض، شہرت اور مدعو افراد نیٹ ورک پر درج اور نظر آتے ہیں۔ چابیاں اور 24 الفاظ آپ کے فون پر رہتے ہیں۔ ہم انہیں نہیں رکھتے۔'],
      ['جو ہم نہیں کریں گے', 'ڈیٹا نہیں بیچتے۔ وصولی کے لیے رابطے نہیں پڑھتے۔ مقام سے قرض منظور نہیں کرتے۔ نوٹس سے ای میل اور فون ہٹانے کو کہہ سکتے ہیں۔ نیٹ ورک پر لکھا مٹتا نہیں۔ خدمت 18 سال یا زیادہ کے لیے ہے۔\n\nرازداری: privacidad@quatriviumcredit.app']
    ),
    terms: sections(
      ['آپ کیا پاتے ہیں', 'بغیر ضمانت قرض، ہزار درجے وقت پر ادائیگی سے بڑھتے ہیں۔ دعوت پر نیٹ ورک انعام، سنگ میل پر بونس۔ رقم، مدت اور سود دستخط سے پہلے ایپ میں دکھتے ہیں۔ Google Play خرید نہیں: رقم نیٹ ورک پر چلتی ہے۔'],
      ['قرض کیسے چلتا ہے', 'قرض ایپ اکاؤنٹ میں رہتا ہے۔ رسائی، فنڈ اور عطیہ آپ کے منسلک والیٹ سے ادا ہوتے ہیں۔ ایک وقت ایک قرض، درخواستوں کے درمیان انتظار۔ مشترکہ فنڈ قرض دینے کے لیے رہتا ہے؛ حصہ نکالا نہیں جاتا۔ عطیہ رضاکارانہ ہے اور فنڈ میں نہیں جاتا۔'],
      ['آپ کس بات سے اتفاق کرتے ہیں', '18 سال یا زیادہ اور ایک ہی اکاؤنٹ۔ جملہ سنبھالیں گے: اس کے بغیر وہ اکاؤنٹ نہیں کھلتا۔ نیٹ ورک ترسیل واپس نہیں ہوتیں؛ دستخط پر دکھائی مدت اور سود ادا کریں گے۔ Quatrivium Finance ایپ دیتی ہے؛ پروٹوکول نیٹ ورک پر چلتا ہے۔'],
      ['اگر ادائیگی دیر ہو', 'درست کرنے کا وقت ہے۔ رابطوں یا دھمکی سے وصولی نہیں۔ جب تک حساب صاف نہ ہو، نیٹ ورک شہرت متاثر رہتی ہے۔ USDT کی قیمت بدل سکتی ہے اور اونچے درجے پر فنڈ نہ ہو۔\n\nمدد: soporte@quatriviumcredit.app']
    ),
  },
  id: {
    privacy: sections(
      ['Rumah kami', 'Quatrivium Finance adalah rumah kredit digital. Kami menawarkan jalur USDT di jaringan publik. Kami bukan bank dan tidak menerima simpanan. Kebijakan ini hanya menjelaskan cara kami menjaga informasi Anda.'],
      ['Cara kerja aplikasi', 'Anda membuka akun, menyimpan frasa pemulihan di ponsel ini, dan mengajukan kredit sesuai tingkat. Pembayaran akses 1 USDT sekali. Email dan telepon untuk akun, pemberitahuan, dan memastikan jalur itu milik Anda. Foto identitas diambil di perangkat ini; tidak dikirim ke berkas kami.'],
      ['Informasi yang kami kelola', 'Kami memakai email, telepon, dan gambar profil untuk menjalankan akun. Kredit, reputasi, dan undangan tercatat di jaringan dan terlihat secara desain. Kunci dan 24 kata tetap terenkripsi di ponsel. Kami tidak menyimpannya.'],
      ['Yang tidak akan kami lakukan', 'Kami tidak menjual data. Tidak membaca kontak untuk menagih. Tidak memakai lokasi untuk menyetujui kredit. Anda dapat meminta email dan telepon dihapus dari pemberitahuan. Tulisan di jaringan tidak dapat dihapus. Layanan untuk usia 18 tahun ke atas.\n\nPrivasi: privacidad@quatriviumcredit.app']
    ),
    terms: sections(
      ['Yang Anda peroleh', 'Kredit tanpa jaminan, seribu tingkat yang naik jika membayar tepat waktu. Anda dapat mengundang dan menerima imbalan jaringan, serta bonus saat mencapai tonggak. Jumlah, jangka, dan bunga tampil di aplikasi sebelum menandatangani. Tidak ada pembelian Google Play: dana bergerak di jaringan.'],
      ['Cara kredit beroperasi', 'Kredit berada di akun aplikasi. Akses, kontribusi dana, dan donasi dibayar dari dompet yang Anda tautkan. Satu kredit sekaligus dan jeda antar pengajuan. Dana bersama tetap untuk dipinjamkan; kontribusi bukan produk penarikan. Donasi sukarela dan tidak masuk dana.'],
      ['Yang Anda setujui', 'Anda berusia 18 tahun atau lebih dan memakai satu akun. Anda menjaga frasa pemulihan: tanpanya akun itu tidak dapat dibuka. Transfer jaringan tidak dapat dibatalkan dan Anda membayar jangka serta bunga yang terlihat saat menandatangani. Quatrivium Finance menyediakan aplikasi; protokol berjalan di jaringan.'],
      ['Jika pembayaran terlambat', 'Ada masa untuk menuntaskan. Kami tidak menagih lewat kontak atau ancaman. Hingga lunas, reputasi di jaringan terpengaruh. Nilai USDT dapat berubah dan tingkat tinggi mungkin tidak berdana.\n\nDukungan: soporte@quatriviumcredit.app']
    ),
  },
  fr: {
    privacy: sections(
      ['Notre maison', 'Quatrivium Finance est une maison de crédit numérique. Nous offrons une ligne en USDT sur un réseau public. Nous ne sommes pas une banque et n’acceptons pas de dépôts. Cette politique explique seulement comment nous protégeons vos informations.'],
      ['Comment l’application travaille', 'Vous ouvrez votre compte, conservez la phrase de reprise sur ce téléphone et demandez un crédit selon votre niveau. L’accès de 1 USDT se paie une fois. L’e-mail et le téléphone servent le compte, les avis et à confirmer que la ligne est la vôtre. La photo d’identité est prise sur cet appareil ; elle n’est pas envoyée dans nos dossiers.'],
      ['Informations que nous traitons', 'Nous utilisons l’e-mail, le téléphone et une image de profil pour tenir le compte. Le crédit, la réputation et les invités sont inscrits sur le réseau, visibles par conception. Les clés et la phrase de 24 mots restent chiffrées sur votre téléphone. Nous ne les conservons pas.'],
      ['Ce que nous ne ferons pas', 'Nous ne vendons pas vos données. Nous ne lisons pas l’agenda pour recouvrer. Nous n’utilisons pas la localisation pour accorder un crédit. Vous pouvez demander le retrait de l’e-mail et du téléphone de nos avis. Ce qui est écrit sur le réseau ne s’efface pas. Le service est réservé aux 18 ans et plus.\n\nConfidentialité : privacidad@quatriviumcredit.app']
    ),
    terms: sections(
      ['Ce que vous obtenez', 'Un crédit sans aval, mille niveaux qui grandissent si vous payez à temps. Vous pouvez inviter et recevoir des récompenses de réseau, et des bonus aux jalons. Montant, durée et intérêt apparaissent dans l’application avant signature. Pas d’achats Google Play : les fonds circulent sur le réseau.'],
      ['Comment le crédit opère', 'Le crédit vit dans le compte de l’application. Accès, apports au fonds et dons partent du portefeuille que vous liez. Un crédit à la fois et une attente entre demandes. Le fonds commun reste destiné à prêter ; un apport n’est pas un produit de retrait. Le don est volontaire et n’entre pas dans le fonds.'],
      ['Ce à quoi vous consentez', 'Vous avez 18 ans ou plus et n’utilisez qu’un compte. Vous garderez la phrase : sans elle, ce compte ne se rouvre pas. Les virements sur le réseau sont irréversibles ; vous paierez la durée et l’intérêt vus à la signature. Quatrivium Finance fournit l’application ; le protocole s’exécute sur le réseau.'],
      ['Si le paiement retarde', 'Il existe un délai pour régulariser. Nous ne recouvrons pas par vos contacts ni par menaces. Tant que le compte n’est pas à jour, la réputation sur le réseau est affectée. La valeur de l’USDT peut varier et un niveau élevé peut manquer de fonds.\n\nAssistance : soporte@quatriviumcredit.app']
    ),
  },
  ja: {
    privacy: sections(
      ['私たちの家', 'Quatrivium Finance はデジタル与信の家です。公開ネットワーク上で USDT の枠を提供します。銀行ではなく、預金は扱いません。本方針は情報の守り方のみを説明します。'],
      ['アプリの働き', '口座を開き、復旧フレーズをこの端末に保管し、等級に応じて与信を申込みます。1 USDT の入場は一度だけです。メールと電話は口座・通知・回線の確認に使います。身分証の写真はこの端末で撮り、当社のファイルには送りません。'],
      ['取り扱う情報', '口座運営にメール、電話、プロフィール画像を用います。与信・評価・招待先はネットワークに記録され、その性質上見えます。鍵と24語は端末で暗号化され、当社は預かりません。'],
      ['行わないこと', 'データを販売しません。取立てに連絡先を使いません。位置情報で与信を承認しません。通知からメールと電話の削除を依頼できます。ネットワーク上の記録は消せません。18歳以上向けです。\n\nプライバシー: privacidad@quatriviumcredit.app']
    ),
    terms: sections(
      ['得られるもの', '担保なしの与信、期限内返済で伸びる千の等級。招待によるネットワーク報酬と節目のボーナス。金額・期限・利息は署名前にアプリで示します。Google Play 内課金はありません。資金はネットワーク上で動きます。'],
      ['与信の運営', '与信はアプリ口座にあります。入場・基金への拠出・寄付は連携ウォレットから支払います。同時に一件、申込の間は待機。共同基金は貸付け用に残り、引出商品ではありません。寄付は任意で基金には入りません。'],
      ['同意する内容', '18歳以上であること、口座は一つであること。復旧フレーズを保管すること。それが無ければその口座は再開できません。ネットワーク送金は取り消せず、署名時に示された期限と利息を支払います。Quatrivium Finance がアプリを提供し、プロトコルはネットワーク上で実行されます。'],
      ['支払が遅れた場合', '是正の期間があります。連絡先や脅迫による取立てはありません。完済までネットワーク上の評価は影響を受けます。USDT の価値は変動し、高い等級に資金が無い場合があります。\n\nサポート: soporte@quatriviumcredit.app']
    ),
  },
  de: {
    privacy: sections(
      ['Unser Haus', 'Quatrivium Finance ist ein digitales Kreditshaus. Wir bieten eine USDT-Linie in einem öffentlichen Netz. Wir sind keine Bank und nehmen keine Einlagen. Diese Richtlinie erklärt nur, wie wir Ihre Angaben schützen.'],
      ['Wie die Anwendung arbeitet', 'Sie eröffnen Ihr Konto, bewahren die Wiederherstellungsphrase auf diesem Telefon und beantragen Kredit nach Ihrem Niveau. Die Zugangsgebühr von 1 USDT fällt einmal an. E-Mail und Telefon dienen Konto, Hinweisen und der Bestätigung, dass die Linie Ihnen gehört. Das Ausweisfoto entsteht auf diesem Gerät und geht nicht in unsere Akten.'],
      ['Angaben, die wir verarbeiten', 'Wir nutzen E-Mail, Telefon und ein Profilbild für Ihr Konto. Kredit, Ruf und Eingeladene stehen im Netz und sind so sichtbar. Schlüssel und 24 Wörter bleiben verschlüsselt auf dem Telefon. Wir verwahren sie nicht.'],
      ['Was wir nicht tun', 'Wir verkaufen Ihre Daten nicht. Wir lesen keine Kontakte zum Einzug. Wir nutzen keinen Standort zur Kreditfreigabe. Sie können E-Mail und Telefon aus den Hinweisen nehmen lassen. Im Netz Geschriebenes lässt sich nicht löschen. Der Dienst ist für Personen ab 18 Jahren.\n\nDatenschutz: privacidad@quatriviumcredit.app']
    ),
    terms: sections(
      ['Was Sie erhalten', 'Kredit ohne Sicherheit, tausend Stufen, die bei pünktlicher Zahlung wachsen. Einladungen bringen Netzprämien, Meilensteine bringen Boni. Betrag, Laufzeit und Zins stehen vor der Unterschrift in der App. Keine Käufe über Google Play: Mittel bewegen sich im Netz.'],
      ['Wie der Kredit läuft', 'Der Kredit lebt im App-Konto. Zugang, Fondsbeiträge und Zuwendungen kommen aus der verknüpften Wallet. Ein Kredit gleichzeitig und eine Pause zwischen Anträgen. Der gemeinsame Fonds bleibt zum Verleihen; ein Beitrag ist kein Auszahlungsprodukt. Zuwendungen sind freiwillig und fließen nicht in den Fonds.'],
      ['Womit Sie einverstanden sind', 'Sie sind 18 oder älter und nutzen ein Konto. Sie bewahren die Phrase: ohne sie öffnet sich dieses Konto nicht wieder. Netzüberweisungen sind unumkehrbar; Sie zahlen Laufzeit und Zins, die bei der Unterschrift sichtbar waren. Quatrivium Finance stellt die Anwendung; das Protokoll läuft im Netz.'],
      ['Wenn die Zahlung spät ist', 'Es gibt eine Frist zum Ausgleich. Wir ziehen nicht über Kontakte ein und drohen nicht. Bis Sie aktuell sind, leidet der Ruf im Netz. Der USDT-Wert kann schwanken, eine hohe Stufe kann ohne Mittel sein.\n\nSupport: soporte@quatriviumcredit.app']
    ),
  },
  ko: {
    privacy: sections(
      ['우리의 하우스', 'Quatrivium Finance는 디지털 신용 하우스입니다. 공개 네트워크에서 USDT 한도를 제공합니다. 은행이 아니며 예금을 받지 않습니다. 이 방침은 정보 보호 방식만 설명합니다.'],
      ['앱이 일하는 방식', '계정을 열고 복구 구문을 이 휴대폰에 두며 등급에 따라 신용을 신청합니다. 1 USDT 입장은 한 번입니다. 이메일과 전화는 계정, 알림, 회선 확인에 씁니다. 신분증 사진은 이 기기에서 찍으며 당사 파일로 보내지 않습니다.'],
      ['다루는 정보', '계정 운영에 이메일, 전화, 프로필 이미지를 씁니다. 신용, 평판, 초대는 네트워크에 기록되어 그 설계상 보입니다. 키와 24단어는 휴대폰에서 암호화되며 당사가 보관하지 않습니다.'],
      ['하지 않을 일', '데이터를 팔지 않습니다. 추심을 위해 연락처를 읽지 않습니다. 위치로 신용을 승인하지 않습니다. 알림에서 이메일과 전화 삭제를 요청할 수 있습니다. 네트워크에 적힌 것은 지울 수 없습니다. 만 18세 이상입니다.\n\n개인정보: privacidad@quatriviumcredit.app']
    ),
    terms: sections(
      ['받는 것', '담보 없는 신용, 제때 갚으면 오르는 천 개 등급. 초대로 네트워크 보상, 이정표 보너스. 금액, 기간, 이자는 서명 전 앱에 표시됩니다. Google Play 인앱 구매는 없습니다. 자금은 네트워크에서 움직입니다.'],
      ['신용이 운영되는 방식', '신용은 앱 계정에 있습니다. 입장, 기금 출자, 기부는 연결한 지갑에서 냅니다. 한 번에 한 건, 신청 사이 대기. 공동 기금은 대출용으로 남고 출자는 인출 상품이 아닙니다. 기부는 자발적이며 기금에 들어가지 않습니다.'],
      ['동의하는 내용', '만 18세 이상이며 계정은 하나입니다. 복구 구문을 보관합니다. 없으면 그 계정을 다시 열 수 없습니다. 네트워크 이체는 되돌릴 수 없으며 서명 때 보인 기간과 이자를 갚습니다. Quatrivium Finance가 앱을 제공하고 프로토콜은 네트워크에서 실행됩니다.'],
      ['납부가 늦을 때', '정리할 기간이 있습니다. 연락처나 위협으로 추심하지 않습니다. 정산 전까지 네트워크 평판이 영향을 받습니다. USDT 가치는 변할 수 있고 높은 등급에 자금이 없을 수 있습니다.\n\n지원: soporte@quatriviumcredit.app']
    ),
  },
  tr: {
    privacy: sections(
      ['Evimiz', 'Quatrivium Finance dijital bir kredi evidir. Kamuya açık ağda USDT hattı sunarız. Banka değiliz, mevduat almayız. Bu politika yalnızca bilgilerinizi nasıl koruduğumuzu anlatır.'],
      ['Uygulama nasıl çalışır', 'Hesabınızı açar, kurtarma cümlesini bu telefonda tutar ve düzeyinize göre kredi istersiniz. 1 USDT erişim bir kez ödenir. E-posta ve telefon hesap, bildirim ve hattın size ait olduğunu doğrulamak içindir. Kimlik fotoğrafı bu cihazda çekilir; dosyalarımıza gönderilmez.'],
      ['İşlediğimiz bilgi', 'Hesabı yürütmek için e-posta, telefon ve profil görseli kullanırız. Kredi, itibar ve davet ettikleriniz ağda kayıtlıdır ve tasarımı gereği görünür. Anahtarlar ve 24 sözcük telefonunuzda şifrelidir. Onları saklamayız.'],
      ['Yapmayacaklarımız', 'Verilerinizi satmayız. Tahsilat için rehberi okumayız. Konumla kredi onaylamayız. Bildirimlerden e-posta ve telefonun silinmesini isteyebilirsiniz. Ağa yazılan silinmez. Hizmet 18 yaş ve üzeri içindir.\n\nGizlilik: privacidad@quatriviumcredit.app']
    ),
    terms: sections(
      ['Ne elde edersiniz', 'Teminatsız kredi, zamanında ödeyince yükselen bin düzey. Davetle ağ ödülleri, eşiklerde bonus. Tutar, vade ve faiz imzadan önce uygulamada görünür. Google Play içi satın alma yoktur: fonlar ağda hareket eder.'],
      ['Kredi nasıl işler', 'Kredi uygulama hesabında durur. Erişim, fona katkı ve bağış bağladığınız cüzdandan ödenir. Aynı anda bir kredi, talepler arasında bekleme. Ortak fon ödünç vermek için kalır; katkı çekilebilir bir ürün değildir. Bağış isteğe bağlıdır ve fona girmez.'],
      ['Neyi kabul edersiniz', '18 yaşında veya daha büyüksünüz ve tek hesap kullanırsınız. Cümleyi saklarsınız: onsuz o hesap açılmaz. Ağ transferleri geri alınamaz; imzada gördüğünüz vade ve faizi ödersiniz. Quatrivium Finance uygulamayı sunar; protokol ağda çalışır.'],
      ['Ödeme gecikirse', 'Düzeltmek için bir süre vardır. Rehberden veya tehditle tahsilat yapmayız. Güncel olana dek ağ itibarı etkilenir. USDT değeri değişebilir ve yüksek düzeyde fon olmayabilir.\n\nDestek: soporte@quatriviumcredit.app']
    ),
  },
  vi: {
    privacy: sections(
      ['Ngôi nhà của chúng tôi', 'Quatrivium Finance là nhà tín dụng số. Chúng tôi cung cấp hạn mức USDT trên mạng công khai. Chúng tôi không phải ngân hàng và không nhận tiền gửi. Chính sách này chỉ giải thích cách chúng tôi bảo vệ thông tin của bạn.'],
      ['Ứng dụng làm việc thế nào', 'Bạn mở tài khoản, giữ cụm khôi phục trên điện thoại này và xin tín dụng theo cấp. Phí vào 1 USDT trả một lần. Email và điện thoại phục vụ tài khoản, thông báo và xác nhận đường dây là của bạn. Ảnh giấy tờ chụp trên máy này, không gửi vào hồ sơ của chúng tôi.'],
      ['Thông tin chúng tôi xử lý', 'Chúng tôi dùng email, điện thoại và ảnh hồ sơ để vận hành tài khoản. Tín dụng, uy tín và người bạn mời được ghi trên mạng, hiển thị theo thiết kế. Khóa và 24 từ được mã hóa trên điện thoại. Chúng tôi không giữ chúng.'],
      ['Điều chúng tôi không làm', 'Không bán dữ liệu. Không đọc danh bạ để đòi nợ. Không dùng vị trí để duyệt tín dụng. Bạn có thể yêu cầu gỡ email và điện thoại khỏi thông báo. Nội dung trên mạng không xóa được. Dịch vụ dành cho người từ 18 tuổi.\n\nQuyền riêng tư: privacidad@quatriviumcredit.app']
    ),
    terms: sections(
      ['Bạn nhận được gì', 'Tín dụng không thế chấp, một nghìn cấp tăng khi trả đúng hạn. Có thể mời và nhận thưởng mạng, nhận thưởng mốc. Số tiền, kỳ hạn và lãi hiện trong ứng dụng trước khi ký. Không mua trong Google Play: tiền chuyển trên mạng.'],
      ['Tín dụng vận hành thế nào', 'Tín dụng nằm trong tài khoản ứng dụng. Phí vào, góp quỹ và quyên góp trả từ ví bạn liên kết. Một khoản một lúc và chờ giữa các lần xin. Quỹ chung ở lại để cho vay; góp không phải sản phẩm rút. Quyên góp tự nguyện, không vào quỹ.'],
      ['Bạn đồng ý điều gì', 'Đủ 18 tuổi và dùng một tài khoản. Giữ cụm khôi phục: không có nó không mở lại tài khoản đó. Chuyển trên mạng không hoàn; bạn trả kỳ hạn và lãi đã thấy khi ký. Quatrivium Finance cung cấp ứng dụng; giao thức chạy trên mạng.'],
      ['Nếu thanh toán chậm', 'Có thời gian để hoàn tất. Chúng tôi không đòi qua danh bạ hay đe dọa. Khi chưa xong, uy tín trên mạng bị ảnh hưởng. Giá USDT có thể đổi và cấp cao có thể không có quỹ.\n\nHỗ trợ: soporte@quatriviumcredit.app']
    ),
  },
  it: {
    privacy: sections(
      ['La nostra casa', 'Quatrivium Finance è una casa di credito digitale. Offriamo una linea in USDT su una rete pubblica. Non siamo una banca e non raccogliamo depositi. Questa informativa spiega soltanto come custodiamo le sue informazioni.'],
      ['Come lavora l’applicazione', 'Apre il conto, conserva la frase di ripristino su questo telefono e chiede credito secondo il livello. L’accesso di 1 USDT si paga una volta. Posta e telefono servono il conto, gli avvisi e a confermare che la linea è sua. La foto del documento resta su questo dispositivo; non va nei nostri fascicoli.'],
      ['Informazioni che trattiamo', 'Usiamo posta, telefono e un’immagine di profilo per gestire il conto. Credito, reputazione e invitati restano sulla rete, visibili per disegno. Le chiavi e la frase di 24 parole restano cifrate sul telefono. Non le custodiamo.'],
      ['Ciò che non faremo', 'Non vendiamo i suoi dati. Non leggiamo la rubrica per riscuotere. Non usiamo la posizione per approvare un credito. Può chiedere di togliere posta e telefono dagli avvisi. Quanto è scritto sulla rete non si cancella. Il servizio è per chi ha 18 anni o più.\n\nPrivacy: privacidad@quatriviumcredit.app']
    ),
    terms: sections(
      ['Cosa ottiene', 'Credito senza garanzia, mille livelli che crescono se paga in tempo. Può invitare e ricevere ricompense di rete, e bonus al raggiungimento delle tappe. Importo, durata e interesse appaiono nell’app prima della firma. Non ci sono acquisti su Google Play: i fondi si muovono sulla rete.'],
      ['Come opera il credito', 'Il credito vive nel conto dell’app. Accesso, versamenti al fondo e donazioni escono dal portafoglio collegato. Un credito alla volta e un’attesa tra le richieste. Il fondo comune resta destinato a prestare; un versamento non è un prodotto di prelievo. Donare è volontario e non entra nel fondo.'],
      ['Con che cosa acconsente', 'Dichiara di avere 18 anni o più e di usare un solo conto. Custodirà la frase: senza di essa quel conto non si riapre. Accetta che i trasferimenti in rete non si annullano e che pagherà durata e interesse visti alla firma. Quatrivium Finance offre l’applicazione; il protocollo gira sulla rete.'],
      ['Se il pagamento ritarda', 'C’è un periodo per regolarizzare. Non riscuotiamo tramite i contatti né con minacce. Finché non è in regola, la reputazione in rete ne risente. Il valore di USDT può variare e un livello alto può restare senza fondi.\n\nAssistenza: soporte@quatriviumcredit.app']
    ),
  },
};

export function legalDocsFor(lang: Lang): LegalDoc {
  return legalCopy[lang] || legalCopy.es;
}
