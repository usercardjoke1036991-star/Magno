# Memoria del proyecto

## Enfoque del usuario
Idioma primero. Luego usuario y contrasena de 8 a 66 con mayuscula, numero y simbolo. Despues las 24 palabras. Esa misma frase se ve o se reemplaza en Ajustes y sirve para cambiar de telefono.

## Decisiones
- [2026-09-14] Con 3 fundadoras se exigen 2 firmas. Llave perdida o hackeada: las otras 2 la quitan. Pausa inmediata se mantiene.
- [2026-09-14] El 1 USDT de acceso es obligatorio en Demo y Real, una vez. No se muestra el destino. Los niveles desbloqueados se pueden pedir cuando se quiera, con un prestamo a la vez y 48h.
- [2026-09-14] El usuario de sesion queda cifrado en el celular y no se edita. El nombre e imagen anonimos van a la red y no se cambian. No son el mismo texto.
- [2026-09-14] Hay dos nombres distintos: el de inicio de sesion va cifrado en el celular y no se edita; el anonimo lo ve la red, se elige una vez y no es el mismo.
- [2026-09-13] Como confirma: las cuatro acciones tienen interruptor y chips PIN, autenticador, huella y contrasena. Sin encender no se aplica ningun metodo. No se muestra Principal; el desbloqueo por defecto se entiende como contrasena.
- [2026-09-13] La contraseña es la unica principal del desbloqueo. En Confirmar el usuario suma PIN, huella o autenticador. Pedir, pagar y transferir (billeteras y plataformas) usan los mismos sistemas, sin correo.
- [2026-09-13] Con cuenta en este telefono no se vuelve a Iniciar sesion; Iniciar sesion solo si el almacen no responde.
- [2026-09-13] Por defecto entra en Real. Si el usuario abre Demo, al reabrir vuelve a Demo. Si no hay modo guardado, Real.
- [2026-09-12] Contraseña del celular: minimo 8, maximo 66, con mayuscula, numero y simbolo. Frase nueva siempre 24 palabras BIP-39; recuperar acepta 12 si la cuenta es antigua.
- [2026-09-12] Una sola frase BIP-39. Se revela solo tras el candado. En Ajustes se consulta o se sustituye. Cambiar de aparato exige esa frase.
- [2026-09-12] Una sola sesion iniciada a la vez por cuenta. El ultimo telefono que entra echa al anterior.
- [2026-09-12] Si se pierde el celular, Recuperar cuenta en uno nuevo con las 12 palabras. Luego usuario y contrasena de ese aparato y volver a vincular el numero. Una sola instalacion opera credito a la vez.
- [2026-09-12] Una billetera Quatrivium solo opera credito en el dispositivo donde se vinculo. WiFi o VPN no son identidad. Recuperar en otro telefono pide volver a vincular numero y dispositivo.
- [2026-09-12] No hay destruir cuenta en la app. Una persona una linea. Formatear o cambiar VPN no crea otra: se recupera con las 12 palabras. Telefono y KYC on-chain bloquean una segunda linea Real.
- [2026-09-12] Desbloqueo por defecto contraseña (correo ya guardado). El usuario elige solo la principal o varias opciones. Frase de 12 palabras obligatoria antes de pedir credito. No hay cerrar sesion. Recuperar con 12 palabras carga la cuenta anterior on-chain.
- [2026-09-12] Guardar sesion mantiene la cuenta en el telefono. Al abrir se muestra el bloqueo, no las tres pantallas. Contraseña por defecto; el usuario elige cuantos metodos y cual es el principal. Cerrar sesion solo en Seguridad.
- [2026-09-12] El progreso va con la billetera on-chain. Otro telefono se recupera con las 12 palabras, no creando otra cuenta. En un telefono con cuenta, Crear cuenta no se muestra.
- [2026-09-12] En Cuenta Real no se pide credito sin correo, telefono+dispositivo y KYC. Eso corta multicuentas faciles. Demo sigue libre para probar.
- [2026-09-12] Crear cuenta: correo, contraseña y guardar sesión. Luego una pantalla aparte verifica el código. Iniciar sesión: solo correo, contraseña y guardar sesión. Son funciones distintas.
- [2026-09-12] Crear cuenta pide contraseña y correo juntos. El código de correo solo la primera vez. Iniciar sesión pide contraseña y correo, sin código. Guardar sesión está en ambas pantallas y persiste de verdad.
- [2026-09-12] Cuenta Real se muestra completa antes del lanzamiento. Donar y aportar liquidez suman fama. La UI de donar no menciona destino ni USDT real.
- [2026-09-12] Bonos de hito en Demo y Real. Donar es sala aparte solo Real y solo suma fama. Real muestra el catalogo completo de 1000 niveles y 10 hitos aunque mainnet no este listo.
- [2026-09-12] Donar se ve en Cuenta Real aunque la billetera personal aun no este agregada. El pool es el banco general; donar no entra al pool.
- [2026-09-12] Donar es solo Cuenta Real (USDT de verdad). Demo no dona.
- [2026-09-12] Si el correo ya esta verificado en el telefono, iniciar sesion es solo contrasena. El codigo se pide una vez. Guardar sesion queda en esa pantalla y se aplica al entrar.
- [2026-09-12] El nombre visible es Quatrivium Finance. El paquete com.quatrivium.credit y el dominio EIP-712 Quatrivium Credit se mantienen.
- [2026-09-12] En Como confirma se pueden marcar varios sistemas por accion. Se piden todos, uno detras de otro.
- [2026-09-12] Crear cuenta, iniciar sesion y desbloquear son pantallas distintas. Iniciar sesion pide contrasena y correo a la vez, mas el paso extra de Como confirma. Desbloquear solo si la sesion esta guardada.
- [2026-09-12] Demo productivo es 0xD2d2A9eF0D1e4f253abc90Dd4ACb0E6C50B2de9f (1000 niveles + FamaLib). El 0x1E5118 queda fuera de servicio. Mainnet no se toca sin CONFIRM_MAINNET.
- [2026-09-12] El fundador no entra en mora ni gracia. Si al vencer se debita y no hay saldo, el pool cubre el principal. Sigue la espera de 48h. No se le liquida.

## Cambios realizados
- [2026-09-14] Si la llave de la billetera no esta en el telefono, se pide la contrasena una vez y se vuelve a guardar. Textos recortados a tono financiero.
- [2026-09-14] Lectura de billetera en frio: SecureStore 4s en paralelo con el respaldo local para que MIUI no deje Reintentar al abrir.
- [2026-09-14] Textos recortados a tono financiero. Banner de acceso sin boton gris. Errores sin nombres de APIs internas.
- [2026-09-14] Gobernanza 2-de-3: si una fundadora se pierde o la hackean, las otras 2 la echan. Una sola llave no gobierna.
- [2026-09-14] Gobernanza unanime: cada cambio admin exige las firmas de todas las fundadoras (3-de-3). La pausa de emergencia sigue inmediata.
- [2026-09-14] Registrar billetera es opcional: se puede saltar con Ahora no.
- [2026-09-14] Tras foto y nombre anonimo hay que conectar una billetera. Si es la fundadora del contrato, Admin aparece sin fila en Ajustes.
- [2026-09-14] Fundadoras ya no aparece en Ajustes. Solo se abre manteniendo el logo. El panel Admin del inicio sigue solo si la MetaMask es la del contrato.
- [2026-09-14] El panel admin ya propone el sello del telefono (setAttester). La clave sigue solo en el worker.
- [2026-09-14] Contraseña de sesion bloqueada en Ajustes. 1 USDT visible en el hub. Apagar Desbloquear guarda y abre sin pedir clave. Lupa de personas por nombre.
- [2026-09-14] Auditoria: el 1 USDT de acceso en Demo estaba bloqueado porque Donar es solo Real. Ahora el contrato Demo puede cobrar el acceso y Donar sigue oculto.
- [2026-09-14] Historial de personas: cada referido abre su grupo al toque y las generaciones bajan bajo demanda, sin cargar el arbol mundial.
- [2026-09-14] Requisito de 1 USDT de acceso antes de pedir prestamo. La UI dice pagar a la app; el envio va a la billetera fundadora.
- [2026-09-14] Flujo de alta: crear/recuperar en telefono nuevo; iniciar sesion en aparato que ya tuvo cuenta; identidad publica de galeria y alias fijos en la red
- [2026-09-14] Identidad publica: usuario e imagen anonima se eligen una vez y es lo que ve la red; la foto de galeria solo vive en este telefono
- [2026-09-14] El historial de personas de Red vive en su ventana con foto, fechas y paginas 1 2 3
- [2026-09-13] La fila de Ajustes que era Como confirma ahora se llama Candado
- [2026-09-13] El boton de Ajustes para sustituir el respaldo dice Reemplazar; Entrar sigue en el alta
- [2026-09-13] Ajustes: ver y sustituir el respaldo BIP-39 quedan en una sola fila
- [2026-09-13] Auditoria de contratos y ABI: Demo live alineado con el repo (24457 B). ABI de cliente sin dispersionCongelada duplicada y con cancelAdminAction.
- [2026-09-13] Auditoria en vivo: tablero de referidos arriba y visible, activar credito gris en Real sin contrato, onNewIntent para salas por enlace. Cuenta Real restaurada.
- [2026-09-13] Auditoria en vivo: Metro caido, ADB colgado, app recargada. Hardhat 121/121, Demo live operativo. Texto MIUI: se quita fontWeight sintetizado.
- [2026-09-13] Historial de referidos muestra comisiones, bono de primer pago y total generado
- [2026-09-13] Historial Demo y Real separados. Reloj rojo en el hub: gracia cuenta atras, mora cuenta adelante hasta pagar.
- [2026-09-13] Historial: transferencias y prestamos en ventanas aparte. Mora muestra dias, fama quitada, beneficios bloqueados y comisiones al pool.
- [2026-09-13] Los avisos de frase, correo, KYC y telefono desaparecen de la pantalla principal al confirmarlos.
- [2026-09-13] Eliminados dumps temporales .tmp, logs y capturas de auditoria que no usa la app. Anadidos al gitignore.
- [2026-09-13] Autenticador muestra QR otpauth y la clave para copiar. El codigo de 6 digitos es TOTP real.
- [2026-09-13] Como confirma muestra interruptor y las cuatro opciones en Desbloquear, Transferir, Pedir y Pagar. Guardar no aplica nada si el interruptor esta apagado.
- [2026-09-13] Como confirma: solo titulos, chips y Guardar. Sin parrafos.
- [2026-09-13] Confirmar: sin texto de contraseña y correo obligatorios. Desbloqueo principal es contraseña; PIN, huella y autenticador son extras. Pedir, pagar y transferir eligen esos sistemas.
- [2026-09-13] Si hay contraseña en el telefono abre Desbloquear, no Iniciar sesion. Demo live 2000 USDT.
- [2026-09-13] Auditoria en vivo: Metro se habia caido; app abre Iniciar sesion con cuenta en el telefono. Idioma ya no pinta el selector antes de leer AsyncStorage.
- [2026-09-13] Primera apertura en Real. Luego se recuerda el ultimo modo (Demo o Real) en AsyncStorage.
- [2026-09-13] Alta: no marca la frase hasta Confirmar; candado no pinta Crear antes de boot; wrap key async; identidad Real falla cerrada si el RPC no responde.
- [2026-09-13] Auditoria: candado ya no trata un timeout de SecureStore como alta nueva; Demo live operativo; mainnet sigue sin contrato
- [2026-09-12] Auditoria en vivo: Iniciar sesion se quedaba en spinner porque el hash de 8000 vueltas bloqueaba el hilo. Ahora cede el hilo y suelta el boton.
- [2026-09-12] Auditoria: tsc/i18n/salud 14/14, Hardhat 116/116, Demo live operativo. failOpen ya no finge alta si SecureStore tarda. Alta muestra requisitos 8-66.
- [2026-09-12] Politica de candado: contraseña 8-66 con mayuscula, numero y simbolo. Alta genera frase de 24 palabras.
- [2026-09-12] Alta: idioma, luego usuario+contrasena, luego las 12 palabras. Ajustes pide contrasena para ver o reemplazar la misma frase.
- [2026-09-12] Textos de alta recortados: una linea de accion y botones. Sin parrafos extras en bienvenida, frase y credenciales.
- [2026-09-12] Auditoria: tsc verde (AppLockGate/authPrefs/LoanTierCard), Metro y notify restaurados, bundle Android OK, Hardhat 114/114, Demo live operativo. Inicio de sesion es usuario+contrasena.
- [2026-09-12] Sesion exclusiva: al abrir la cuenta en otro telefono se cierra aqui. El aparato viejo no entra con la contrasena; recupera con las 12 palabras.
- [2026-09-12] Alta empieza por las 12 palabras o Recuperar cuenta. Luego usuario y contrasena de este telefono. Al reinstalar pide frase, usuario y contrasena. Desbloqueo por defecto con contrasena.
- [2026-09-12] Billetera atada al dispositivo: al reinstalar pide iniciar sesion o las 12 palabras; no se crea otra cuenta en un aparato ya vinculado. En Real, Solicitar exige que este dispositivo coincida con el hash on-chain.
- [2026-09-12] Quitada la funcion de destruir/generar otra cuenta. Seguridad solo recupera con 12 palabras. VPN y formateo no abren una segunda linea de credito.
- [2026-09-12] Quito Cerrar sesion. Desbloqueo con principal o varias opciones. Frase 12 palabras obligatoria para Solicitar. Recuperar con frase reemplaza la billetera local.
- [2026-09-12] Sesion guardada abre bloqueo con contraseña por defecto. Cerrar sesion en Seguridad. Sin eso la sesion no se cierra.
- [2026-09-12] Inicio sin cuenta: tres botones iguales Crear cuenta, Recuperar cuenta e Iniciar sesion.
- [2026-09-12] Recuperar cuenta con 12 palabras en la bienvenida. Si este telefono ya tiene cuenta, Crear cuenta desaparece.

## No olvidar / no romper
- Con 3 fundadoras el contrato exige 2 firmas. Si una se pierde o la hackean, las otras 2 la echan. Una sola no gobierna.
- Pausa de emergencia sigue inmediata.

## Última sesión
[2026-09-14] Cambio: Si la llave de la billetera no esta en el telefono, se pide la contrasena una vez y se vuelve a guardar. Textos recortados a tono financiero.
