# Memoria del proyecto

## Enfoque del usuario
Producto listo en Demo con protocolo nuevo testnet. Real espera mainnet. No reinstalar APK. No mainnet sin CONFIRM_MAINNET=yes.

## Decisiones
- [2026-10-03] En Demo el TOTP de admin no bloquea: 2-de-2 y WalletConnect bastan. El codigo de 6 digitos sale en ventana emergente, no en el panel. En Real sigue el TOTP si el worker HTTPS esta configurado.
- [2026-10-03] Donar y aportar: 100 fama por cada USDT desde el primero. Si Ana no paga el primer L1 en 7 dias, el 1 de Pedro va al pool.
- [2026-10-02] Alta Real cobra 4 USDT de una vez. Correo y celular se confirman sin cobro. Admins: TOTP en el worker atado a su billetera.
- [2026-10-02] Verificar es correo + celular: 0,50 + 0,50 = 1 USDT al pool. Ese 1 es el sello del primer credito, no un cobro aparte.
- [2026-10-02] Hitos 100-1000 proporcionales. Padrino del 1 apartado en Alta, no de la caja. Reserva techo 12% segun lo bloqueado.
- [2026-10-02] Tras pagar, Solicitar se bloquea con cuenta atras de 48h. Con credito abierto se ve Pagar, no la cuenta atras. El texto de error de 48h es respaldo.
- [2026-10-02] El fondo emite si hay liquidez bajo el 80 por ciento. La primera de 1 USDT tras verificar no la puede tomar otro durante 7 dias.
- [2026-10-02] Cupo fractal B: no hay cifra magica de un millon. Chico o grande se mide contra la caja de ese momento.
- [2026-10-02] Carril chico hasta 50 USDT independiente del 10 por ciento. Un ballenero no tapa altas ni niveles bajos.
- [2026-10-02] El cupo de prestamos nuevos mide USDT del dia, no solo personas. 10 por ciento de caja, piso 50, freno 10000. El 80 por ciento de uso y el pool cerrado siguen.
- [2026-10-01] No hay cerrar cuenta on-chain. Demo y mainnet: se recupera con la frase.
- [2026-10-01] Los primeros 2 USDT donados en la vida no dan fama. El deudor no puede liquidarse a si mismo.
- [2026-10-01] Reserva usa guardianes 2-de-N para apply Credit/FamaCaja/fundador. El attester sigue pagando boost con tope diario y pausa de guardian. marcarMorosoSiVencido ya no hace pull.
- [2026-10-01] Token de Telegram ya rotado por el fundador. Tercer admin aplazado: proximo Demo nace 2-de-2 con 0x5023 y 0xD7af.
- [2026-10-01] Segundo admin para el proximo Demo (2-de-2): 0xD7afC0D64703B306feA2005773e78f2FC03071C6. Primera sigue 0x5023. Attester sigue 0x55D3. No es el 2-de-3 todavia. 0xD2d2 no se parchea.
- [2026-10-01] El fundador entra en mora y se puede liquidar. declararKyc exige identidad atestada. Confirmacion de fondos fail-closed con wrap de Keystore.
- [2026-09-30] Bono de hito L200 es 30000 USDT, no 4000. L100 sigue en 2000. Desde 200 hasta 1000: 30000 cada 100.
- [2026-09-30] Fama misma tasa, pero solo se cobra por la via que se gano: caja en Canje, red en pestaña red, racha solo en Racha. Si la racha se retrasa bajan dias, no fama.
- [2026-09-30] Reserva: el extra de comisiones multiplicadas sale del pool (fondo de prestamos), no del bote. El 12% de rendimiento sigue saliendo del bote.
- [2026-09-30] Real: 2 USDT de acceso a la fundadora y 0.50+0.50 de correo/telefono al pool, sin fama. Captacion 1 USDT sin fama. Fama de red solo gen 2+ y recorte de fundador. No se recorta _pagarBonosRed; deja de acreditarse.
- [2026-09-30] No recortar el nucleo por EIP-170. Si no cabe, hermano. No se borran cobrarBonoHito, _assertPeg ni _pagarBonosRed. L1000 cada 100 y cuotas opcionales viven en Credit porque el pago y la liquidacion no pueden delegarse.
- [2026-09-30] Cambiar PIN, huella, metodos de confirmacion o autenticador exige un metodo ya listo. El QR TOTP no se vuelve a mostrar salvo Reemplazar.
- [2026-09-30] Huella en Xiaomi: si requireAuthentication falla, no desbloquear. Pedir PIN o contraseña.
- [2026-09-30] El canje lee planPago del nucleo. No se anade estaVencido() a Credit: solo quedan 40 bytes de EIP-170.
- [2026-09-30] En Cuenta Real, si SecureStore no guarda el sobre de la billetera, la app para. No se usa AsyncStorage. Demo sigue con respaldo. Cuentas nuevas AES-256-GCM; v1 se abre y se reescribe cuando el cofre responde.
- [2026-09-30] Si Credit no cabe en EIP-170 se crea un hermano. No se borra cobrarBonoHito, _assertPeg ni _pagarBonosRed.
- [2026-09-30] El Dockerfile del worker declara USER node para Sonar. Persistencia /data se recupera si el runtime arranca como root; si no, fallback a /app/data.
- [2026-09-30] Las politicas informan y no sustituyen licencia ni abogado. Reserva no menciona al fundador en la UI.
- [2026-09-29] La recuperacion por correo solo cambia la contraseña en el mismo telefono. En uno nuevo se usa la frase. El wrap no sale del dispositivo.
- [2026-09-29] El bote de Reserva solo lo llenan owner/admins. Bloquear y renovar exigen nivel 10. Desbloquear principal no. No es Donar ni el pool.

## Cambios realizados
- [2026-10-03] Textos de Reserva dejan de decir bote o premio. 31 pantallas que seguian en ingles quedaron traducidas en los 15 idiomas.
- [2026-10-03] Si la sesion WalletConnect se cierra, la tarjeta deja de decir Vinculado y pide Conectar de nuevo. El vinculo guardado sigue.
- [2026-10-03] Vincular en Real cambia la billetera de la red de prueba 0x61 a BNB Smart Chain 0x38 antes de firmar.
- [2026-10-03] Conectar abre la billetera externa. Vincular es la firma. Si WalletConnect caduca, el boton deja de girar.
- [2026-10-03] En Real, Vincular solo pasa a Vinculado despues de firmar la billetera externa. Conectarla ya no marca el vinculo.
- [2026-10-03] Servicios se abren para verlos. El candado solo impide usarlos hasta pagar el alta y registrarse.
- [2026-10-03] Iconos de Servicios siempre en verde. En Alta ya no se dice que correo y telefono van sin cargo.
- [2026-10-03] Hub siempre visible: candado en servicios hasta alta pagada y registro. Banner de Pagar alta al entrar.
- [2026-10-03] Alta visible en Servicios: baldosa Pagar alta y recuadro encima del hub.
- [2026-10-03] Boton de alta: Pagar alta, al completar Alta pagada. Sin desglose del cobro.
- [2026-10-03] Sin desglose de 4 USDT en la app. Aparato pasa a telefono. Frase de 24 palabras como llave local, no en la red.
- [2026-10-03] Textos institucionales en 17 idiomas: Vincular/Vinculado, guia sin jerga interna, privacidad y terminos estilo auditoria Play.
- [2026-10-03] Textos de app alineados al protocolo: alta 4 USDT 1+1+1+1, fama 100 desde el primero, padrino del alta, hitos 400-20000. Limpiados temp y residuos.
- [2026-10-03] Sonar S2699 en alta-registro: expect de registroHecho y expectAmt como asercion reconocida
- [2026-10-03] App Demo+Alta: candado 4 USDT, banner Pagar 4, textos legales. Xiaomi con Metro ya muestra el alta. Credit no crecio.
- [2026-10-03] Desplegado protocolo nuevo en BSC testnet: Credit 0xdF21, Fama 0x7491, Reserva 0x9058, Alta 0xa590. Pool 500 USDT. 2-de-2. 0xD2d2 no se toco. Mainnet vacio.
- [2026-10-03] App: Alta se puede pagar aunque sea Demo si hay contrato Alta. El Xiaomi sigue con APK del 13-sep y Demo 0xD2d2 sin Alta; por eso no se ve el protocolo nuevo.
- [2026-10-03] ptsDonacion sin puerta de 2 USDT. Alta.vencerPadrinoAlPool manda el padrino vencido al pool. Credit no crecio (EIP-170).
- [2026-10-03] Auditoria: candado Alta en la app, comisiones no pagan a baneados, deep links solo de Quatrivium. Credit no crece (EIP-170). Sin MagnoPay ni pausa automatica.
- [2026-10-02] Auditoria: verificar correo/celular pide confirmacion de fondos y evita doble tap en alta. Sin MagnoPay ni pausa automatica.
- [2026-10-02] Mejoras sin deploy: app Alta 3+1, APY Reserva, attester 2-de-2, panel de caja, tests de padrino/cuotas/sello.
- [2026-10-02] Invariantes Foundry de NAV Credit y caja Reserva, mas centinela Python de solo lectura por Telegram.
- [2026-10-02] Contratos: alta 4 USDT, hitos proporcionales, Reserva 12% movil y retiro bote. Sin deploy testnet.
- [2026-10-02] El pool manda: 80 por ciento de uso, grandes al 70, sello de 7 dias en el USDT de verificar. Sin cupo diario de credito.
- [2026-10-02] Formula B en el contrato: umbral max(50, 0.5% caja), potometros 10% chico y 10% grande. Hardhat cupo 8/8 Foundry 38/38.
- [2026-10-02] Dos carriles de originacion: 1-50 USDT no comen el 10 por ciento. Los grandes si. Hardhat cupo 7/7.
- [2026-10-02] Cupo diario: 10 por ciento de caja libre, piso 50 USDT, max 10000 altas. Foundry 37/37 y Hardhat del modulo en verde.
- [2026-10-02] SonarCloud en cero. CEI en depositar donar y liquidate. Sin PoC de exploit.
- [2026-10-02] Imagen del worker: ws 8.21.0 y sin npm de Node. Trivy image HIGH MEDIUM 0. DB actualizada 2026-10-02.
- [2026-10-02] Examen Trivy: parcheados adm-zip serialize-javascript undici y bn.js. Queda tmp de solc. Docker y lock de produccion en cero.
- [2026-10-01] Sin destruirCuenta en nucleo ABI y servicio. Identidad no se libera.
- [2026-10-01] Foundry: puerta 2 USDT sin fama (ni con polvo), sin autoliquidar, execute admin solo si corre, Reserva reanuda boost 2-de-N
- [2026-10-01] Blindaje: Reserva 2-de-N, tope diario 50 USDT y pausa de boost; Credit mora sin pull, peg en donar y bucle de bonos acotado; pinning GTS; destroy sin approve si hay shares del pool
- [2026-10-01] 17 idiomas: etiquetas que estaban en ingles, avisos sin variables internas y Reserva sin mencionar fundador.
- [2026-10-01] Sonar usa tsconfig propio y deja fuera JSON de i18n. Guardar no muestra listo si falta la billetera.
- [2026-10-01] Ajustes: Guardar queda desactivado tras guardar y se activa solo si hay cambios nuevos.
- [2026-10-01] Red: enlace de invitacion en tarjeta con copiar (HTTPS quatriviumcredit.app/invite). El codigo de referido acepta guiones, espacios o el enlace al crear la cuenta.
- [2026-10-01] Avisos: se puede cambiar el Telegram si pierde la cuenta; un vinculo por billetera.
- [2026-10-01] Avisos: un vinculo Telegram por cuenta; el boton se bloquea si ya esta vinculado.
- [2026-10-01] Telegram: el codigo de vinculo era 16 chars y la app solo aceptaba 8-12. Alineado a 12 hex.
- [2026-10-01] Bot de avisos verificado: QuatriviumFinance_bot. Token de Render ya coincide (getMe).
- [2026-10-01] Avisos: Telegram en vivo; textos de usuario sin notas internas de correo/numero.
- [2026-10-01] Pantalla de carga con emblema y wordmark; textos de usuario en tono institucional; 17 idiomas alineados (1177 claves).
- [2026-10-01] Auditoria 1 oct: Hardhat 243/244 (test de copy del pool alineado). Worker Render attester nuevo 0x140F coincide con .env.worker. Demo live 0xD2d2 sigue legado (owner=attester 0xdb13). Mainnet vacio.
- [2026-10-01] 5+6: vincular pide EIP-712 BindWallet antes de guardar address; Pool y Como funciona dicen que lo aportado no se retira
- [2026-10-01] Implementadas remediaciones de auditoria: contratos (nonce, pausa, KYC, fundador, destroy, boost) y app (Keystore, fail-closed, PII, PIN 20000, health).
- [2026-09-30] SonarCloud: 5 S5845 de bigint en tests MLM/canje pasados a expectAmt. Snyk Code/SCA high 0. MobSF CLI solo abre apk/aab/ipa.
- [2026-09-30] Auditoria E2E: Hardhat 223/223, Foundry 11/11 (arreglado test Reserva DestinoCero), tsc/salud verdes. Demo live 0xD2d2 y mainnet siguen sin el protocolo nuevo. Premios de ranking solo display.
- [2026-09-30] Guia de Ajustes reescrita en tres partes con como se gana. Bono L200 a 30000. Red: invitacion con enlace, comisiones por generacion y tablero con refresco.
- [2026-09-30] Cerrado el paquete pendiente: extra Reserva desde pool; botones de cobro de racha 7/30/100/365; fama por via; verificacion oculta; guia en Ajustes; hitos 30000 desde L300; rankings desde nivel 15; textos de usuario sin fundador ni tarifa de verificar.

## No olvidar / no romper
- Con 3 fundadoras el contrato exige 2 firmas. Si una se pierde o la hackean, las otras 2 la echan. Una sola no gobierna.
- Pausa de emergencia sigue inmediata.

## Última sesión
[2026-10-03] Cambio: Textos de Reserva dejan de decir bote o premio. 31 pantallas que seguian en ingles quedaron traducidas en los 15 idiomas.
