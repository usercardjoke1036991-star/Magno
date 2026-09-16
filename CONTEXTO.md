# 🧠 CONTEXTO DEL PROYECTO: Quatrivium Finance

## ¿Qué es este proyecto?
**Quatrivium Finance** es una app móvil de microcrédito on-chain sin colateral sobre BNB Smart Chain (BSC).
El usuario activa una wallet interna, pide un préstamo en USDT del pool de liquidez, lo paga antes del vencimiento
y sube de nivel para pedir montos mayores. Si no paga, entra en mora y queda bloqueado hasta regularizar.
**No puede cerrar la cuenta mientras tenga deuda o esté en mora.**

## Tipo de proyecto
- **Stack:** React Native 0.81 · Expo 54 · React 19 · TypeScript · Solidity 0.8.24 · ethers v6
- **Tipo:** Mobile DeFi App + Smart Contracts (EVM)
- **Estado actual:** Testnet operativo — mainnet pendiente de deploy (acción manual del fundador)

---

## Arquitectura y estructura

```
Magno/
├── app/index.tsx                  # Pantalla principal (~522 líneas, orquesta con hooks)
├── app/_layout.tsx                # Placeholder Expo Router (arranque real: App.js)
├── babel.config.js                # Babel / Expo
├── metro.config.js                # Metro + stub snarkjs
├── hardhat.config.cjs             # Hardhat: tests y deploy Solidity
├── zkService.ts                   # Reexport ZK experimental (stub Metro)
├── web3Config.tsx                 # AppKit / WalletConnect (BSC Demo y Real)
├── components/ (61 archivos)      # UI: WalletSection, LoanTierCard, AdminPanel, SecuritySettings…
├── hooks/                         # useWeb3Balances, useWeb3Transactions, useHomeHandlers
├── services/                      # quatriviumCreditService, appWallet, deviceBinding, kycDeclaration…
├── contracts/
│   ├── QuatriviumCredit.sol       # Núcleo (EIP-170 ≤ 24576)
│   ├── QuatriviumLeveling.sol     # Hermano: solicitudes/hitos
│   ├── libraries/QuatriviumFamaLib.sol # Fama de línea (delegatecall)
│   ├── Groth16Verifier.sol        # ZK experimental (no en producción)
│   ├── interfaces/                # AggregatorV3Interface (Chainlink)
│   └── mocks/                     # ERC20Mock, MockV3Aggregator (testnet)
├── test/ (15 archivos)            # accounting, circuitBreaker, cuotas, destroy, identity, kyc, mlm, demo-identity…
├── scripts/                       # deploy, security-check, production-check, notify-worker
├── salud_proyecto.py              # Reloj suizo: grafo UI→hooks→contrato + i18n/tsc (`npm run salud`)
├── i18n/ (17 locales)             # ar, bn, de, en, es, fr, hi, id, it, ja, ko, pt, ru, tr, ur, vi, zh
├── constants/                     # contractConfig, rpcConfig, tokens, loanTiers
├── stubs/zk-node-stub.js          # Metro stub: snarkjs no es bundleable en RN
├── .env.example                   # Variables requeridas documentadas
└── eas.json                       # Builds: development/preview (chain 97), production (chain 56)
```

---

## Stack tecnológico
- **App:** React Native 0.81 / Expo 54 / React 19 / TypeScript (strict)
- **Web3:** ethers v6 / Reown AppKit (WalletConnect) / wagmi
- **Contratos:** Solidity 0.8.24 / OpenZeppelin v5 (`Pausable`, `ReentrancyGuard`, `SafeERC20`) — **owner/admin es propio, no usa Ownable**
- **Red blockchain:** BSC Testnet (chain 97) en dev · BSC Mainnet (chain 56) en prod
- **Seguridad mobile:** expo-secure-store / device binding local / biometría / PIN 6 dígitos / frase BIP-39
- **Notificaciones:** Twilio SMS+WhatsApp / Telegram Bot / Resend / notify-worker
- **i18n:** 17 idiomas, 949 claves, soporte RTL (árabe, urdu)

---

## Decisiones importantes tomadas
- **Un solo préstamo activo por wallet**: no se puede pedir otro hasta pagar o liquidar el actual
- **Sin colateral**: el pool absorbe el riesgo de impago (diseño intencional, no bug)
- **Pool no redimible**: `retirarLiquidez` hace `revert("pool locked")` — el capital queda para prestar
- **`tx.origin == msg.sender`**: bloquea contratos intermediarios en registro, préstamo, pago, depósito, liquidación y destrucción
- **Timelock de 72h + 2-de-3** para todas las acciones admin (excepto pausa, que es inmediata). Si una llave se pierde o la hackean, las otras 2 la echan.
- **Wallet interna (app wallet)**: cada instalación genera una wallet HD (frase de 24 palabras BIP-39) cifrada en SecureStore. Recuperar aún acepta 12 palabras de cuentas antiguas. Pedir y pagar préstamos y guardar el saldo viven en esa cuenta. Depositar, retirar, donar, aportar al pool y el 1 USDT de acceso se pagan con una billetera externa vinculada (WalletConnect); el USDT pasa a la interna y luego el contrato ve `msg.sender` = interna. Saltarse el vínculo en el alta no basta para mover fondos. La contraseña no se edita en Ajustes: se pide al desbloquear y para ver la frase. **La frase no se reemplaza**: es la llave de esa billetera; en otro teléfono se recupera con las mismas palabras.
- **Identidad KYC inmutable**: nombre legal y tipo de documento se congelan en el primer submit on-chain; ciudad/región siguen editables. Verificar KYC permite escanear el documento con la cámara (foto local, sin OCR ni envío a la red). El contrato solo ve `declararKyc()`.
- **Cerrar cuenta exige deuda = 0 y !esMoroso**: el contrato y la UI bloquean a morosos
- **ZK es experimental**: `snarkjs` hace stub en Metro; el registro real es `registrarHumanoConPadre()`
- **Entornos separados en `eas.json`**: development/preview→chain 97, production→chain 56
- **`slug: "magno"` en `app.json`**: el projectId EAS es `0a9b20f0-900a-4d35-8541-14b6202d84f5`; el nombre visible es Quatrivium Finance
- **Liquidación en AdminPanel**: el servicio aprueba USDT automáticamente antes de `liquidate()`
- **`useHomeHandlers` hook**: handlers extraídos de `app/index.tsx` para reducir complejidad
- **Device binding es LOCAL** (SecureStore): la identidad on-chain es la dirección de la wallet + teléfono OTP, no el IMEI
- **Alta de cuenta**: si este teléfono no tiene cuenta, el inicio muestra **Crear frase secreta** y **Recuperar cuenta**. La app **no destruye ni genera otra cuenta**. Formatear o cambiar de VPN/red no abre una segunda línea: se recupera con las 24 palabras (o 12 si la cuenta es antigua). En Real, el mismo teléfono o dispositivo on-chain no puede atarse a otra billetera. Recuperar pide la frase y luego usuario+contraseña de este aparato. Si el dispositivo ya tiene dueño on-chain, Crear desaparece. **Guardar sesión** abre el bloqueo. Contraseña es el método principal: 8 a 66 caracteres, con mayúscula, número y símbolo. Antes de pedir crédito hay que anotar las 24 palabras. En Real también correo, teléfono, KYC y que este dispositivo coincida con el hash on-chain.
- **Frase secreta BIP-39**: alta y respaldo. No cierra la cuenta. No hay destruir ni generar otra cuenta en la app.
- **Usuario y contraseña son el candado de este teléfono.** El correo sigue para Real, recuperar contraseña y OTP. Desbloquear, pedir, pagar o transferir pueden usar contraseña, correo, PIN, huella o autenticador si el usuario los elige.
- **Métodos de seguridad**: desbloquear, pedir, pagar y transferir son opcionales (interruptor + método ya registrado: contraseña, correo, PIN, huella o autenticador). Huella y llave son el mismo sensor. Los cambios se confirman con Guardar. El autenticador es TOTP real: al activarlo muestra un QR `otpauth://` escaneable y la clave por si la cámara no enfoca.
- **Historial**: Demo y Real tienen diarios distintos (modo + chain + contrato + billetera). Dos ventanas (transferencias y préstamos) y mora. En el hub, al vencer empieza un reloj rojo: 30 días de gracia en cuenta atrás; al acabarse, cuenta hacia adelante hasta que pague. El fundador no entra en gracia ni mora.
- **Demo y Real son mundos distintos**: Demo = BSC testnet (chain 97). Real = BSC mainnet (chain 56). El préstamo, el saldo y el registro de uno **no se copian** al otro. **Primera apertura = Real.** Después la app recuerda el último modo abierto (`quatrivium.appMode.v2`). Hasta el deploy mainnet, Real muestra red en preparación (sin crédito on-chain).
- **Admin/fundadoras**: el panel no aparece hasta conectar una billetera fundadora (WalletConnect).
- **Crecer sin recortar el núcleo**: EIP-170 limita a 24 KB *cada* contrato, no el protocolo. Funciones nuevas (escalera de solicitudes, bono del 100, identidad, red) van a **contratos hermanos**. No se borran vistas ni pagos del núcleo para “hacer hueco”.
- **Fama y dinero no se mezclan**: al registrar, la reputación recorre toda la línea (misma escala 15/8/6/4/2/0,8/0,4 %) y el fundador suma de cada alta. El USDT solo se mueve al pagar (interés + bono de activación). Los puntos de red y el bono del pool son solo del referidor directo, para no drenar la caja.
- **Mora con mes de gracia**: al vencer se cobra de la billetera. Si no hay saldo, 30 días sigue cobrando para poder pagar. Luego la reputación baja 10 × nivel por día y sus comisiones/bonos van al pool hasta que pague. El **fundador no entra en mora ni gracia**: si al vencer no hay saldo, el pool cubre el principal restante (se perdona el interés). Sigue sujeto a la espera de 48 h entre préstamos y no se le puede liquidar. La fama de línea vive en `QuatriviumFamaLib` (delegatecall) para no romper EIP-170.

---

## Niveles de crédito (fuente: `constants/loanTiers.ts` + `LoanTierSeed.sol` + `LoanLadder.sol`)

**1000 niveles**, del **$1** al **$1 000 000**. Los 1–100 siguen en tabla (`LoanTierSeed`). Los 101–1000 son fórmula (`LoanLadder`) para no meter 900 filas en el constructor ni romper EIP-170.

Reglas:
- el **principal** del siguiente > el anterior
- el **interés en $** del siguiente > el anterior
- el **total a devolver** también sube
- **1–100**: la tasa del anterior > la del siguiente (estricta)
- **101–1000**: la tasa no sube (baja 1 bps/nivel hasta 4,06 % y luego se sostiene; si bajara más el interés $ se rompería)

`requiredCount` (la velocidad de llegada marca la de pago): L1 → 3; L2–9 → 5; desde **$100 (L10)** cada nivel pide **5 más** (5, 10, 15…; L100 = 455; L999 = 4950). L1000 no sube.
Bono de pool cada 100 niveles: **20 USDT × nivel del hito**. Sala **Bonos** en Demo y Real. **Donar** (sala aparte, solo Real) y **aportar liquidez** suman fama **proporcional al monto** (10 y 5 puntos por USDT). El pool es el banco común. Cuenta Real muestra el producto completo (KYC, niveles 1–1000, hitos, donar, pool) antes del lanzamiento; firmar espera mainnet.
Rangos: 12 gemas del catálogo (granate, aguamarina, citrino, topacio, turmalina, peridoto, esmeralda, zafiro, rubí, ónix, diamante, amatista). Cada banda se parte en I / II / III. El marco es el logo 3D, más ancho que la foto, con incrustaciones fotográficas de esa piedra.

| Nivel | Principal | Plazo | Tasa | Interés $ | Cuotas | Solicitudes |
|------:|----------:|------:|-----:|----------:|:------:|:------------|
| 1 | $1 | 7 días | 100% | $1.00 | 1 | 3 |
| 10 | $100 | 50 días | 34% | $34 | 3 | 5 |
| 11 | $120 | 50 días | 33,71% | $40.45 | 3 | 10 |
| 100 | $10 000 | 90 días | 8% | $800 | 3 | 455 |
| 101 | $11 100 | 90 días | 7,99% | $886.89 | 3 | 460 |
| 1000 | **$1 000 000** | 180 días | 4,06% | $40 600 | 12 | — |

> Los bps son tasa plana sobre el principal por el plazo (no APR anual).
> Cuotas: $50 → 2; $60 → 3; $25 000 → 6; $100 000 → 12.
> Contrato **Demo live** `0xD2d2A9eF0D1e4f253abc90Dd4ACb0E6C50B2de9f` (bloque 130652258): 1000 niveles, mora, hitos y donar. El anterior `0x1E5118` queda fuera de servicio.
> Un millón sin colateral exige pool enorme. La semilla Demo (~2000 USDT) no cubre ni L100.

---

## Lo que está funcionando ✅
- Contrato `QuatriviumCredit.sol` — Demo live `0xD2d2A9eF0D1e4f253abc90Dd4ACb0E6C50B2de9f` (1000 niveles, FamaLib `0x6B98072a087B3fd856c24249232EE3fb40cB5003`, pool 2000 USDT)
- 15 suites Hardhat (134 tests): accounting, circuitBreaker, cuotas, destroy, identity, kyc, liquidation, mlm, morosity, peg, security, demo-identity, accountWorld, 1000 niveles, hitos, donación y endurecimiento…
- App móvil con componentes React Native (seguridad a elección, autenticador, historial, sala Bonos)
- i18n: 17 idiomas, 949 claves
- Referidos Unilevel en contrato y UI
- Notify-worker: WhatsApp, Telegram, SMS, email, auto-fondeo BNB testnet (`/auto-fund`) e identidad demo (`/demo-identity`, solo chain 97)
- KYC on-chain + OTP de teléfono; nombre y documento congelados; foto del documento en el teléfono
- App lock: la contraseña se pide al desbloquear y para ver o reemplazar la frase; ya no hay fila de contraseña en Ajustes. PIN y huella se pueden cambiar o quitar. Huella y llave de acceso son el mismo sensor (una sola fila: Huella).
- Fondos: depositar, retirar, donar, aportar al pool y pagar el 1 USDT de acceso salen de una billetera externa vinculada. El USDT pasa a la cuenta interna; desde ahí se piden y pagan préstamos o se guarda el saldo. Saltarse el vínculo en el alta no basta para mover dinero.
- Frase secreta BIP-39: ver/anotar; rotar o restaurar vive en Reemplazar cuenta (no se elimina suelta)
- Device binding local + frase para recuperar en otro teléfono
- Liquidación de deudores desde AdminPanel (approve automático)
- Auto-refresh de balances cada 30 s
- Primera apertura en Cuenta Real; al cambiar a Demo o Real se restaura ese modo al reabrir (`wallet/AppModeContext.tsx`)

## Lo que está en progreso 🔄 (solo el fundador puede completar)
- Deploy de contrato en BSC Mainnet (`CONFIRM_MAINNET=yes` + `npm run deploy:bsc`)
- Configurar `EXPO_PUBLIC_CONTRACT_ADDRESS_MAINNET` en `eas.json` production **después** del deploy
- Credenciales Twilio o WhatsApp Cloud API en `.env.worker`
- Publicación en Google Play Store (`eas build --platform android --profile production`)

## Lo que NO es un bug (deuda de diseño, no hay que “arreglarlo”)
- **ZK real en React Native**: `snarkjs` no es bundleable; el registro es `registrarHumanoConPadre()`. Decisión consciente.
- **Pool no se retira**: no hay circuit breaker de retiros al 50% — el pool está cerrado a propósito (`revert("pool locked")`). La pausa de emergencia es el freno.
- **`eas.json` sin dirección mainnet**: correcto hasta el deploy. No rellenar con un placeholder.
- **Java 25 en la máquina local**: puede romper `expo run:android` local. Los builds EAS usan imagen `sdk-54` (JDK correcto). En local: usar JDK 17.

---

## Dependencias críticas

```
app/index.tsx → useHomeHandlers (handlers)
             → useWeb3Balances (estado on-chain)
             → useWeb3Transactions (transacciones)

useHomeHandlers → useWeb3Transactions → quatriviumCreditService → CONTRACT_ABI + ethers v6
useWeb3Balances → quatriviumCreditService → RPC BSC (fallback 3 URLs)

AdminPanel → onLiquidar → useHomeHandlers → useWeb3Transactions.liquidarDeudor
                                          → quatriviumCreditService.liquidar (approve + liquidate)

services/appWallet → expo-secure-store (cifrado)
                  → deviceBinding (ligada al dispositivo, LOCAL)
                  → walletSession (clave de cifrado)

contracts/QuatriviumCredit.sol → OpenZeppelin v5 (Pausable, ReentrancyGuard, SafeERC20)
                               → AggregatorV3Interface (oráculo Chainlink)
                               → owner/admins/timelock propios (NO Ownable)
```

---

## Módulos del proyecto
| Módulo | Archivo(s) | Función |
|---|---|---|
| Pantalla home | `app/index.tsx` | Orquesta UI (handlers extraídos a `useHomeHandlers`) |
| Layout Expo | `app/_layout.tsx` | Placeholder; el arranque real es `App.js` |
| Tooling RN | `babel.config.js` · `metro.config.js` | Babel/Expo y Metro (stub ZK) |
| Contratos JS | `hardhat.config.cjs` | Tests y deploy Hardhat |
| ZK stub | `zkService.ts` | Reexport experimental; no va a producción |
| Handlers | `hooks/useHomeHandlers.ts` | Lógica de cada acción del usuario |
| Estado on-chain | `hooks/useWeb3Balances.ts` | Lee contrato + RPC · auto-refresh 30 s |
| Transacciones | `hooks/useWeb3Transactions.ts` | Approve + préstamo + pago + LP + liquidación |
| Servicio contrato | `services/quatriviumCreditService.ts` | Capa ethers sobre ABI |
| Identidad demo | `services/demoIdentity.ts` + worker `/demo-identity` | Atestigua KYC/teléfono on-chain solo en testnet |
| Wallet interna | `services/appWallet.ts` | HD wallet + frase BIP-39 cifrada |
| KYC local | `services/kycDeclaration.ts` | Nombre/documento congelados; fingerprint keccak |
| Lock | `services/appLock.ts` + `authPrefs.ts` + `authenticator.ts` | PIN, password, huella, TOTP; el usuario elige para qué usa cada uno |
| Historial | `services/movementHistory.ts` + `MovementHistory.tsx` | Préstamos, pagos y envíos entre billeteras |
| Storage seguro | `services/secureStorageService.ts` | Wrapper expo-secure-store |
| Red | `constants/rpcConfig.ts` | RPC, chainId, modo demo/live |
| Contrato | `constants/contractConfig.ts` | ABI + dirección según entorno |
| Tokens | `constants/tokens.ts` | Lista de stables soportados |
| ABI/contrato | `contracts/QuatriviumCredit.sol` | Lógica de crédito on-chain |
| Tests | `test/*.test.js` | 15 suites Hardhat · 131 tests |
| Errores tx | `utils/txErrors.ts` | Mensajes legibles de revert |

---

## Seguridad on-chain (contrato)
| Protección | Estado |
|---|---|
| ReentrancyGuard | ✅ Funciones de fondos |
| SafeERC20 | ✅ Transfers/approvals |
| Pausable (emergencia) | ✅ Inmediato (cualquier admin) · despausar con timelock |
| Timelock 72h + multisig | ✅ Acciones admin · 2-de-3 al tercer fundador. Si una se pierde o la hackean, las otras 2 la echan |
| tx.origin == msg.sender | ✅ Registro, préstamo, pago, depósito, liquidación, destrucción |
| Oráculo Chainlink (stale 1h) | ✅ Precio USDT/USD · peg ≥ 0.98 |
| Pool locked | ✅ `retirarLiquidez` siempre revierte — no hay retiros LP |
| Cooldown 48h entre préstamos | ✅ Anti-spam |
| Tope 50 originaciones/día | ✅ Límite global |
| Utilización máx 80% | ✅ No presta el pool entero |
| destruirCuenta | ✅ Exige sin préstamo activo **y** `!esMoroso` |

---

## Estado de verificaciones (última auditoría: 2026-09-11 noche)

| Verificación | Estado | Detalle |
|---|---|---|
| `tsc --noEmit` | ✅ 0 errores | TypeScript strict, noUnusedLocals, noImplicitReturns |
| `check-i18n.mjs` | ✅ OK | 756 claves · 17 locales · sin BOM · sin discrepancias |
| `security-check.mjs` | ✅ OK | .env fuera de git · sin credenciales hardcodeadas |
| `hardhat test` | ✅ 103/103 | Incluye mora del fundador (pool cubre, 48h intacta) + FamaLib |
| `npm audit` (ws high) | ✅ OK | GHSA-58qx/96hv corregidas con `override ws^8.21.0` |
| `npm audit` (devDeps) | ⚠️ ~66 vulns | hardhat / solidity-coverage / expo SDK — **no van al APK** · no correr `--force` |
| `production:check` | 🟡 **12/14** | Faltan 2 acciones **manuales**: deploy mainnet + Twilio/WhatsApp |
| Imports rotos | ✅ 0 | TypeScript confirma resolución |
| `.env.worker` en git | ✅ 0 | No trackeado |
| ProGuard (APK release) | ✅ ON | Via Gradle en EAS, no en `app.json` (schema inválido) |
| expo-updates (OTA) | ✅ OK | canales development / preview / production |
| ngrok túnel dev | ✅ OK | `rundown-shelf-mongoose.ngrok-free.dev` · `npm run tunnel:ngrok` |
| EAS Android image | ✅ `sdk-54` | Evita JDK 25 en builds cloud |
| ATTESTER_PRIVATE_KEY | ✅ Generada | Distinta del deployer · no en git |
| RESEND_API_KEY | ✅ Configurada | En `.env.worker` · no en git |

---

## Historial de cambios importantes
| Fecha | Cambio | Razón |
|-------|--------|-------|
| 2026-09-16 | MobSF del APK debug (37/100): endurecido release con plugin withQuatriviumAndroidSecurity, expo-build-properties minSdk 29 y R8. Debug/dev-client no puede sacar A en MobSF. Hace falta eas build production y volver a escanear. | — |
| 2026-09-15 | Integración MobSF: scripts/scan-mobile.mjs + npm run security:mobsf. Informe en mobsf-report.json (gitignore). Requiere MOBSF_API_KEY y MobSF en localhost:8000. | — |
| 2026-09-15 | security:slither usa scripts/run-slither.mjs + run-slither-wsl.sh para encontrar pipx en WSL y no el npm de Windows. Slither 0 findings con la config del repo. | — |
| 2026-09-15 | Slither: fee de liquidacion multiplica antes de dividir; hitos con modulo; ==0 de pool/mora a <1; detector timestamp excluido (plazos de credito). Demo live no cambia hasta redesplegar. | — |
| 2026-09-14 | Auditoria 2026-09-14: Demo live 0xD2d2 alineado (24457 B, 1000 niveles, pool 2000 USDT). prepare-production ya no pisa el contrato con 0x1E5118. fundInternalFromExternal no vuelve a sacar USDT si la interna ya tiene el monto. OTP trial usa Twilio Verify. Mainnet sigue sin desplegar. | — |
| 2026-09-14 | Notify 24/7: Dockerfile.notify + fly.toml + npm run notify:sms / notify:deploy. Worker escucha PORT de PaaS. Twilio pendiente de SID/token/FROM. flyctl instalado, sin login. | — |
| 2026-09-14 | Alta y recuperacion: no se auto-crea otra billetera si el wrap existe y el blob falta; PhoneOtpSection exige deviceMatches; contrato Demo 0xD2d2 con kyc e identidad exigidos, selectores de prestamo/pago/donar/pool/KYC presentes. Hardhat 143/143, tsc 0, i18n 962. | — |
| 2026-09-14 | Auditoria profunda visual y de codigo: LegalDocuments estable, politicas en Ajustes, codigo de invitacion sin partir grupos, Demo/Real verificados en el telefono. tsc 0, i18n 962, salud 14/14. | — |
| 2026-09-14 | Privacidad y condiciones reescritas con tono de casa financiera: como trabaja, que acepta y que obtiene. Sin jerga interna ni proveedores en el texto al usuario. | — |
| 2026-09-14 | Tras el idioma, privacidad y terminos con Acepto al llegar al final. Las mismas politicas se leen en Ajustes. | — |
| 2026-09-14 | Ficha Play, privacidad, terminos, Data safety y grafico 1024x500 alineados al producto real. Camera/fotos declaradas. Assetlinks plantilla pendiente de SHA-256. | — |
| 2026-09-14 | Auditoria cuenta/credito/niveles/bonos/red/historial/donar: historial muestra acceso, bonos y donaciones sin destino; codigo de referido se copia; correo del banner abre verificacion; deposito de entrada cambia de red; donar no mezcla el 1 USDT de acceso. | — |
| 2026-09-14 | Pool de liquidez: sala visible en Demo (caja publica, sin depositar). Real sin contrato no muestra 0 USDT ni el formulario. LP y aviso de no retiro visibles. Hardhat 135/135. Demo live NAV 2000.7 USDT, peg fresco. | — |
| 2026-09-14 | Ciberseguridad: wrap de sesion migrada fuera de AsyncStorage; /session/check exige firma EIP-712 purpose session; plugin expo-screen-capture; frase no seleccionable y se oculta al recorte o al cerrar el panel. Hardhat 135/135. | — |
| 2026-09-14 | Auditoria Demo vs Real: Demo live 0xD2d2 operativo 24457 B; worker /health OK; Real sin contrato. LoanTierCard respeta contractReady; billetera externa cambia a chain 97/56 antes de pagar. | — |
| 2026-09-14 | Auditoria de contratos: bytecode Demo = repo. ABI de gobernanza completo (despausarContrato, setFeeBP, setNivel, cancelAdminAction). LoanLadder en lockstep con el nucleo. Mainnet sigue sin desplegar. | — |
| 2026-09-14 | Catalogo de rangos restaurado: Granate, Aguamarina, Citrino, Topacio, Turmalina, Peridoto, Esmeralda, Zafiro, Rubi, Onix, Diamante, Amatista. Sin Bronce/Oro/Platino. Auditoria: tsc 0, Hardhat 131/131, i18n 943, salud 14/14, conectores 210. Telefono en vivo muestra Granate I II III. | — |
| 2026-09-14 | Rangos usan las 12 gemas del catalogo (granate a amatista) como incrustaciones fotograficas en el marco. | — |
| 2026-09-14 | Incrustaciones transparentes tipo cristal: luz interior, destellos y talla de vidrio. El metal del marco se ve a traves de la gema. | — |
| 2026-09-14 | Incrustaciones de rango con talla de joyeria: cabujon, perla, corte esmeralda y talla brillante segun la piedra. Division I/II/III suma gemas, garras y fuego. | — |
| 2026-09-14 | Marcos mas anchos que la foto con incrustaciones 4/8/12. Colores de I II III mas nitidos, sin mezclar con el tono oscuro. | — |
| 2026-09-14 | El marco de rango es el logo 3D de la app pintado como metal de cada piedra. Entrelaza la foto. I denso, II vivo con mas agarre, III luminoso. Sin dibujos infantiles. | — |
| 2026-09-14 | Marcos de rango recuperan el detalle creciente del boceto original (I sobrio, II anillos y esquinas, III diamantes y filigrana). El emblema 3D metalizado se mantiene. | — |
| 2026-09-14 | Marcos: tinte por luma (no lava el metal), bisel con filigrana por division y gemas con talla y engaste. | — |
| 2026-09-14 | Sala Marcos en el hub: vitrina I/II/III por piedra. Los referidos muestran marco y rango (Granate I · nivel). | — |
| 2026-09-14 | Auditoria en vivo: banners de acceso usan onPrimary (texto negro sobre verde). Contraste KYC verificado en el telefono. Docs alineadas a 939 claves, 131 tests y 61 componentes. Demo live 24457 B. | — |
| 2026-09-14 | Marcos de rango usan el emblema 3D original (assets/ranks) teñido por division I-III. Tarjeta externa solo dice Billetera y Vincular billetera. Botones verdes con texto negro. | — |
| 2026-09-14 | KYC permite escanear el documento con la camara (foto local, sin OCR). Los marcos de rango son cuadrados y se enriquecen por division I-III y por familia. Copy recortado a tono financiero. | — |
| 2026-09-14 | Frase secreta solo se consulta. Contraseña del alta con requisitos visibles. Billetera externa en el hub y en el panel de cuenta. | — |
| 2026-09-14 | Ajustes ya no tiene panel de contraseña. Depositar, retirar, donar, pool y 1 USDT se pagan con la billetera externa vinculada; el USDT llega a la cuenta interna, que pide y paga prestamos. | — |
| 2026-09-14 | Arranque: si falta la llave de la billetera se pide la contrasena una vez y se vuelve a guardar. Textos profesionales (Depositar/Retirar). | — |
| 2026-09-14 | Textos recortados a tono financiero. Acceso Real sin botón gris. Errores de correo/SMS sin nombres de APIs. | Menos relleno en pantalla. |
| 2026-09-14 | Gobernanza 2-de-3: una llave perdida o hackeada la echan las otras 2. Una sola no gobierna. Pausa inmediata. | El 3-de-3 dejaba el contrato muerto si una se perdía. |
| 2026-09-14 | Alta: despues de la cara publica se registra una billetera externa (WalletConnect). El contrato reconoce a la fundadora por esa direccion. | — |
| 2026-09-14 | Panel admin: proponer atestador (sello del telefono) con la direccion 0x; la clave privada no entra en la app. | — |
| 2026-09-14 | Ajustes: contraseña no editable. Hub muestra acceso 1 USDT. Candado off persiste wrap. Personas: busqueda por nombre. | — |
| 2026-09-14 | Auditoria 2026-09-14: 127 tests, Demo live operativo. Acceso 1 USDT usa capacidad on-chain, no la sala Donar. Metro reiniciado. | — |
| 2026-09-14 | Personas: grupos por referido con generaciones expandibles al toque (loadReferralChildren). | — |
| 2026-09-14 | Antes de Solicitar hay que pagar 1 USDT de acceso. Internamente usa donar() hacia el fundador. Los niveles desbloqueados siguen eligibles. | — |
| 2026-09-14 | Alta separa credenciales de sesion e identidad publica. Perfil quitado de Ajustes. Directorio remoto guarda publicPhoto. | — |
| 2026-09-14 | Perfil publico: nombre e imagen anonima fijos. El historial de referidos muestra esa cara, no la foto del celular. | — |
| 2026-09-14 | Red: el historial de personas es una ventana aparte paginada (nombre, foto, alta y ganancias). El tablero de comisiones se queda en Red. | — |
| 2026-09-13 | Seguridad: ver y reemplazar la frase BIP-39 viven en un solo panel de Ajustes | — |
| 2026-09-13 | Auditoria contratos: nucleo + FamaLib + Leveling, 123 tests, Demo 0xD2d2 alineado. ABI cliente con cancelAdminAction; mainnet sin deploy. | — |
| 2026-09-13 | Auditoria en vivo: el tablero de comisiones/bono/total queda arriba en Red; Activar linea se desactiva si no hay contrato; MainActivity reenvia onNewIntent. | — |
| 2026-09-13 | Auditoria: Hardhat 121 tests, i18n 877 claves, Demo live operativo. gradle.properties newArchEnabled alineado con app.json (false). remapAndroidText ya no sintetiza fontWeight en MIUI. | — |
| 2026-09-13 | Red: tablero de comisiones, bono de primer pago y total generado a partir de eventos on-chain | — |
| 2026-09-13 | Historial aislado por mundo. Reloj de gracia/mora en pantalla principal. | — |
| 2026-09-13 | Historial partido en transferencias y prestamos. Mora on-chain: dias, fama, freeze y pool. | — |
| 2026-09-13 | KycAccessBanner: solo muestra requisitos de prestamo pendientes. Al confirmar, desaparecen. | — |
| 2026-09-13 | Como confirma: interruptor por accion y chips PIN, autenticador, huella y contrasena. Sin interruptor no se pide confirmacion. | — |
| 2026-09-13 | Como confirma recortado: Desbloquear, Transferir, Pedir, Pagar y metodos. Sin texto extra. | — |
| 2026-09-13 | Cómo confirma ya no dice que contraseña y correo son obligatorios. Desbloqueo fija contraseña como principal. Pedir, pagar y transferir eligen PIN, huella, autenticador o contraseña. | — |
| 2026-09-13 | Auditoria profunda: nextEntryScreen va a desbloqueo si hay cuenta local. Demo 2000 USDT operativo. Real y Twilio siguen del fundador. | — |
| 2026-09-13 | Auditoria 2026-09-13: Demo live 2000 USDT operativo; Real sin contrato; LanguageWelcome espera el idioma guardado. | — |
| 2026-09-13 | Primera apertura en Real; AppMode espera AsyncStorage y recuerda el ultimo modo abierto. | — |
| 2026-09-13 | Auditoria 2026-09-13: probePasswordSet distingue vacio de almacén colgado. Hardhat 116/116, cyber 28/28, Demo 0xD2d2A9 OPERATIVO. Mainnet y Twilio siguen siendo acciones del fundador. | — |
| 2026-09-12 | Auditoria profunda: 116 tests Hardhat, Demo live OPERATIVO. failOpen no abre Crear frase si el candado no responde. | — |
| 2026-09-12 | Auditoria 2026-09-12: TypeScript sin errores. Alta frase-primero. Sesion exclusiva viva en notify-worker. Metro y worker restaurados. Demo 0xD2d2A9eF operativo. Mainnet sigue sin desplegar. | — |
| 2026-09-12 | Sesion exclusiva por dispositivo via notify-worker /session/claim. Al recuperar o entrar en otro telefono, el anterior se bloquea. | — |
| 2026-09-12 | Onboarding: crear o recuperar frase BIP-39, luego usuario y contrasena. Reinstalar en el mismo telefono pide frase+usuario+clave. Telefono perdido se recupera con las 12 palabras. | — |
| 2026-09-12 | Vinculo dispositivo-billetera: walletOfDevice oculta Crear al reinstalar; restore solo de esa billetera; Solicitar Real exige deviceMatches. | — |
| 2026-09-12 | Sin destruir cuenta en la app. Recuperar con 12 palabras. Formatear o VPN no crean segunda linea: telefono y KYC on-chain la bloquean. | — |
| 2026-09-12 | Desbloqueo: contraseña principal, correo guardado, una o varias opciones. Frase 12 palabras obligatoria antes de credito. Sin cerrar sesion. Recuperar 12 palabras abre la cuenta on-chain. | — |
| 2026-09-12 | Guardar sesion ya no vuelve a Crear/Iniciar/Recuperar. Abre bloqueo; contraseña por defecto; metodos y principal en Como confirma. Cerrar sesion en Seguridad. | — |
| 2026-09-12 | Inicio sin cuenta: tres botones Crear cuenta, Recuperar cuenta e Iniciar sesion. Recuperar pide las 12 palabras. | — |
| 2026-09-12 | Recuperacion: 12 palabras traen el mismo nivel, saldo y credito. Crear cuenta se oculta cuando este telefono ya tiene cuenta. | — |
| 2026-09-12 | En Cuenta Real, Solicitar exige correo de la cuenta, telefono+dispositivo on-chain y KYC. El boton se bloquea; Demo no cambia. | — |
| 2026-09-12 | Login: hash de contrasena local (ya no 8000 hops nativos) y tope en checkPassword/guardar sesion para que Iniciar sesion no se quede girando en MIUI. | — |
| 2026-09-12 | Crear cuenta e iniciar sesion son flujos distintos. El codigo de correo es una pantalla aparte. El login ya no se queda girando si el keystore de MIUI no responde. | — |
| 2026-09-12 | Alta: contraseña y correo en la misma pantalla, OTP solo la primera vez. Inicio de sesión sin código. Guardar sesión persiste la wrap. | — |
| 2026-09-12 | Arranque en vivo: AppKit ya no se crea al importar el bundle; el modo y el idioma no bloquean el primer frame. Worker de avisos con backoff activo. | — |
| 2026-09-12 | Auditoria: arranque con tope de espera (fuentes, idioma, mundo, candado, billetera, usuario, biometria Xiaomi). Donar muestra vista previa sin firmar. Pool bloqueado en Demo. Worker de avisos con backoff si el RPC tiene cupo. | — |
| 2026-09-12 | Fama proporcional al USDT donado o aportado al pool. Preview en Donar y Pool. | — |
| 2026-09-12 | Real visible al 100 por ciento antes del lanzamiento. Fama por donar y por liquidez. Copy profesional sin destino de donacion. | — |
| 2026-09-12 | Bonos en ambos mundos. Donar sala aparte solo Real (fama). Catalogo Real completo 1000 niveles / 10 hitos. | — |
| 2026-09-12 | Donar visible en Real con destino pendiente (DEPLOYED_MAINNET.founder vacio). Pool = banco general. Envio solo con mainnet. | — |
| 2026-09-12 | Donar solo en Real: UI oculta en Demo, servicio y handler bloqueados, isDonationEnabled exige mainnet. | — |
| 2026-09-12 | Inicio de sesion: correo ya verificado no pide codigo. Guardar sesion en la misma pantalla. | — |
| 2026-09-12 | Auditoria profunda: Demo 0xD2d2A9 operativo (1000 niveles, pool 2000 USDT). Si la huella esta marcada pero el sensor no responde, se salta y se pide el siguiente metodo. | — |
| 2026-09-12 | Nombre visible de la app: Quatrivium Finance. Paquete Android/iOS y firmas EIP-712 sin cambiar. | — |
| 2026-09-12 | Como confirma permite varios metodos a la vez; se confirman en secuencia (AND). | — |
| 2026-09-12 | Inicio de sesion (correo+contrasena juntos + paso extra de Como confirma) separado de desbloquear. La sesion guardada se persiste; sin ella no se muestra Desbloquear. | — |
| 2026-09-12 | Demo live 0xD2d2A9eF0D1e4f253abc90Dd4ACb0E6C50B2de9f bloque 130652258: 1000 niveles, donar, hitos, mora fundador. FamaLib 0x6B98072a087B3fd856c24249232EE3fb40cB5003. Pool 2000 USDT NAV ok. | — |
| 2026-09-12 | Fundador exento de mora/gracia: el pool cubre su principal al vencer sin saldo. Espera 48h intacta. QuatriviumFamaLib por delegatecall. Nucleo 24457/24576. | — |
| 2026-09-12 | Fundador exento de mora/gracia: si no hay saldo al vencer, el pool cubre el principal. Sigue la espera de 48h. Fama de linea en QuatriviumFamaLib. Nucleo 24457/24576. | — |
| 2026-09-12 | Mora: debito al vencimiento, 30 dias de gracia cobrando, luego 10x nivel/dia y ganancias al pool. Nucleo 24474/24576. | — |
| 2026-09-12 | Fama unilevel decreciente al registrar (misma escala que comisiones). Fundador suma de cada alta. Puntos de red/bono pool solo del referidor directo. | — |
| 2026-09-12 | Auditoria: unlock por defecto OFF al migrar prefs; signer estable ante remount; Bonos solo si el contrato tiene hitos o donar. | — |
| 2026-09-12 | Correo y contrasena obligatorios al iniciar sesion; ambos tambien eligibles para desbloquear, pedir, pagar y transferir. | — |
| 2026-09-12 | Inicio de sesion obligatorio con contrasena y correo. Como confirma ya no permite apagar eso. | — |
| 2026-09-12 | Como confirma: 5 acciones opcionales con interruptor y metodo. Huella unica. Boton Guardar en ajustes editables. i18n 794 claves. | — |
| 2026-09-12 | Contraseña obligatoria al desbloquear e iniciar sesion. Huella o llave opcionales. Confirmar pedir o pagar prestamo es opcional (apagado por defecto). i18n 792 claves. | — |
| 2026-09-12 | Auditoria live 12-sep: stack caido (8081/8787), ADB trabado, Ankr 401 y eth_getLogs rate-limit. Worker ahora sondea RPC, salta atraso y no rota por cupo. App en telefono abre candado. | — |
| 2026-09-12 | Bonos 20 USDT x nivel de hito, sala Bonos, donar() al fundador y reputacion por donar o inyectar pool | — |
| 2026-09-12 | Bono de hito: 2000 USDT del pool al llegar a cada 100 niveles, cobro uno a uno con caja libre sobre el piso del 20% | — |
| 2026-09-12 | RequiredCount +5 por nivel desde 100 USDT. 12 rangos de piedras (ambar, perla, jade, esmeralda, zafiro, rubi) con marcos. | — |
| 2026-09-12 | Escalera 1000 niveles hasta 1M USDT. Nucleo lee formula 101-1000. App, rangos y tests alineados. Live Demo sigue en 100 niveles hasta redeploy. | — |
| 2026-09-12 | Correcciones de auditoria: wrap TOTP, confirmar fondos sin colgar, cooldown en vivo, deep link history e historial por mundo. | — |
| 2026-09-12 | Seguridad: el usuario elige metodo para desbloquear, mover dinero e iniciar sesion. Autenticador TOTP. Historial de prestamos, pagos y envios. | — |
| 2026-09-12 | Seguridad: el usuario elige método para desbloquear, mover dinero e iniciar sesión. Autenticador TOTP. Historial de préstamos, pagos y transferencias. | — |
| 2026-09-12 | Guardar sesion al crear o iniciar. Correo para recuperar clave y avisos de pago (interruptor en Avisos). | — |
| 2026-09-12 | Correo para crear e iniciar sesion. Se reemplaza en Seguridad, no en Perfil. Iniciar sesion envia codigo al correo. | — |
| 2026-09-12 | Deep links: quatrivium://room/credit y /profile. Verificado en Demo: historial 0 a tiempo / mora / penaliz. y Perfil Nivel 1/100 Bronce. | — |
| 2026-09-12 | UserMetrics muestra historial on-chain (a tiempo, mora, penalizaciones). Perfil enseña nivel/100. DOCUMENTO alineado a 100 niveles. | — |
| 2026-09-12 | useWalletLevel deja de recortar el nivel a 10. El marco de rango en Ajustes y referidos sigue el nivel on-chain 1-100. | — |
| 2026-09-12 | Tema Minimalista (blanco y negro). Avatar sin foto: silueta gris tipo Facebook. | — |
| 2026-09-12 | Panel de seguridad: contraseña y frase solo se reemplazan; PIN, huella y llave se pueden quitar. | — |
| 2026-09-12 | Auditoria: recoverAppSigner ante signer nulo; i18n errNoWallet; gitignore Python; Hardhat 89/89; salud 14/14. | — |
| 2026-09-12 | UI de Cuenta Demo/Real inconfundible; isOfficialWorldToken evita falso token apagado; cooldown se muestra antes. | — |
| 2026-09-12 | Auditoria productiva: UI y nucleo coinciden con 0x1E5118 (L1=3, resto=5). QuatriviumLeveling guarda la escalera+bono para el proximo deploy. eas.json production ya no inyecta testnet. | — |
| 2026-09-12 | Vista de niveles superiores: todos los bloqueados se listan; pulse para ver la ficha completa. Siguen sin poder pedirse. | — |
| 2026-09-12 | Avatar: solo imagen y marco de rango. Sin foto: silueta gris estilo Facebook. | — |
| 2026-09-12 | Decisión: alta nueva = Real. El último modo (Demo o Real) se restaura al reabrir. Demo disponible también en tienda (mundo testnet aislado). | — |
| 2026-09-11 | Fixes Demo: notifyApiBases localhost, lastBlock por contrato, CTA Activar en LoanTierCard, prepareDemoCredit visible tras registrar. | — |
| 2026-09-11 | Auditoria live post-redeploy 100 niveles: UI pide Activar, L1  / L2 bloqueado, historial vacio. Cache de credito keyed por contrato; refresh silencioso no reescanea niveles. | — |
| 2026-09-11 | Escalera de 100 niveles hasta $10 000: tasa del anterior siempre mayor; interés $ y monto siempre suben | Completar la línea de crédito y corregir el desorden de tasas 5→6 y 7→8 |
| 2026-09-11 | Historial de referidos: ABI con `BonoActivacionPagado`, bloque de deploy en `deployedAddresses`, fechas de actividad y sección abierta | El historial fallaba al abrir y solo miraba ~3 días de bloques |
| 2026-09-11 | Auditoría final productividad: hidratación de caché no revierte préstamo/registro on-chain; assertEnoughToPay en todas las cuotas; worker rota RPC y no tumba el HTTP | — |
| 2026-09-11 | salud_proyecto.py orquesta grafo critico + i18n/tsc/security/conectores (npm run salud) | — |
| 2026-09-11 | Auditoría final: caché de préstamo se limpia al pagar; ficha activa por `tierId`; saldo de pago usa el token de la deuda; AppKit sigue Demo/Real; worker rota RPC | Evitar deuda fantasma, botón Pagar en la ficha equivocada y avisos parados por Ankr |
| 2026-09-11 | Demo y Real son mundos distintos (testnet vs mainnet); logo en billetera Quatrivium | Real heredaba préstamo y saldo de Demo porque ambos leían el mismo contrato de prueba |
| 2026-09-11 | Cooldown de préstamo en cliente + FallbackProvider `quorum: 1` | `obtenerCooldownRestante` cambiaba cada segundo y LogBox mostraba `quorum not met` |
| 2026-09-11 | Modo Real vuelve a exigir KYC/teléfono; demo solo si se elige en Ajustes | `isDemoMode()` (testnet) ocultaba el KYC de las cuentas reales |
| 2026-09-11 | Frase secreta solo respaldo; OTP correo solo alta/recuperar; admin oculto sin wallet fundadora; demo sin KYC/teléfono | Alinear seguridad y demo con el flujo real |
| 2026-09-11 | Huella: detección real (sin NativeModules), PIN y llave de acceso unificados, textos sin Face ID en Android | La app decía que no había huella aunque el teléfono sí la tenía |
| 2026-09-11 | Auditoría productividad: no saltar onboarding si falla la wallet; errores device-bound/locked; KYC no cierra si falla on-chain; auto-fund con safeFetch | Huecos al crear cuenta y verificar correo |
| 2026-09-11 | Alta: idioma → crear/entrar → clave → correo OTP. Demo se elige en Ajustes. Textos de avisos/Proton quitados. Botón crear con Gmail. | Flujo de cuenta real, no demo por defecto |
| 2026-09-11 | `tx.origin` añadido a `depositarLiquidez` y `pagarPrestamo` | CONTEXTO lo daba por hecho y el contrato no lo tenía |
| 2026-09-11 | `eas.json` imagen Android `sdk-54` en los 3 perfiles | Evita Java 25 en EAS cloud |
| 2026-09-11 | Auto-fondeo BNB testnet + auto-refresh balances 30s + `EXPO_PUBLIC_NOTIFY_API` | Demo sin error de gas |
| 2026-09-11 | KYC: nombre y tipo de documento congelados | Identidad inmutable |
| 2026-09-11 | PIN para rotar frase · mora bloquea cierre · bio para desactivar huella | Acciones destructivas protegidas |
| 2026-09-11 | Contrato: `destruirCuenta` exige `!esMoroso` | Deuda = no puedes salir |
| 2026-09-11 | i18n 617 claves × 17 locales | kycNameLocked, destroyDelinquent, seedRotatePinRequired… |
| 2026-09-10 | CONTEXTO.md inicializado | Auditoría completa |
| 2026-09-10 | slug `quatrivium-credit` · `useHomeHandlers` · liquidación AdminPanel | Modularización |
| 2026-09-10 | override `ws: ^8.21.0` · expo-updates · ProGuard · ngrok · attester | Hardening |
| 2026-09-11 | Textos UI sin tecnicismos · app.json schema 18/18 · EAS dev client | Pulido de producción |
