# 🧠 CONTEXTO DEL PROYECTO: Quatrivium Credit

## ¿Qué es este proyecto?
**Quatrivium Credit** es una app móvil de microcrédito on-chain sin colateral sobre BNB Smart Chain (BSC).
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
├── components/ (43 archivos)      # UI: WalletSection, LoanTierCard, AdminPanel, SecuritySettings…
├── hooks/                         # useWeb3Balances, useWeb3Transactions, useHomeHandlers
├── services/                      # quatriviumCreditService, appWallet, deviceBinding, kycDeclaration…
├── contracts/
│   ├── QuatriviumCredit.sol       # Contrato principal (1309 líneas)
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
- **i18n:** 17 idiomas, 703 claves, soporte RTL (árabe, urdu)

---

## Decisiones importantes tomadas
- **Un solo préstamo activo por wallet**: no se puede pedir otro hasta pagar o liquidar el actual
- **Sin colateral**: el pool absorbe el riesgo de impago (diseño intencional, no bug)
- **Pool no redimible**: `retirarLiquidez` hace `revert("pool locked")` — el capital queda para prestar
- **`tx.origin == msg.sender`**: bloquea contratos intermediarios en registro, préstamo, pago, depósito, liquidación y destrucción
- **Timelock de 72h + multisig** para todas las acciones admin (excepto pausa que es inmediata)
- **Wallet interna (app wallet)**: cada instalación genera una wallet HD (frase de 12 palabras BIP-39) cifrada en SecureStore
- **Identidad KYC inmutable**: nombre legal y tipo de documento se congelan en el primer submit on-chain; ciudad/región siguen editables
- **Cerrar cuenta exige deuda = 0 y !esMoroso**: el contrato y la UI bloquean a morosos
- **ZK es experimental**: `snarkjs` hace stub en Metro; el registro real es `registrarHumanoConPadre()`
- **Entornos separados en `eas.json`**: development/preview→chain 97, production→chain 56
- **`slug: "magno"` en `app.json`**: el projectId EAS es `0a9b20f0-900a-4d35-8541-14b6202d84f5`; el nombre visible es Quatrivium Credit
- **Liquidación en AdminPanel**: el servicio aprueba USDT automáticamente antes de `liquidate()`
- **`useHomeHandlers` hook**: handlers extraídos de `app/index.tsx` para reducir complejidad
- **Device binding es LOCAL** (SecureStore): la identidad on-chain es la dirección de la wallet + teléfono OTP, no el IMEI
- **Alta de cuenta**: idioma → crear o iniciar sesión → contraseña + confirmar → correo OTP → **usuario** → entrar. El nombre real se pide en KYC (no en demo).
- **Frase secreta BIP-39**: solo respaldo (ver y anotar). No cierra la cuenta. Cerrar o restaurar otra frase está en **Reemplazar esta cuenta**, y exige pagar mora/deuda antes.
- **Correo OTP**: solo al crear la cuenta y al recuperar la contraseña.
- **Demo y Real son mundos distintos**: Demo = BSC testnet (chain 97). Real = BSC mainnet (chain 56). El préstamo, el saldo y el registro de uno **no se copian** al otro. Hasta el deploy mainnet, Real muestra red en preparación (sin crédito on-chain).
- **Admin/fundadoras**: el panel no aparece hasta conectar una billetera fundadora (WalletConnect).
- **Crecer sin recortar el núcleo**: EIP-170 limita a 24 KB *cada* contrato, no el protocolo. Funciones nuevas (escalera de solicitudes, bono del 100, identidad, red) van a **contratos hermanos**. No se borran vistas ni pagos del núcleo para “hacer hueco”.

---

## Niveles de crédito (fuente: `constants/loanTiers.ts` + `LoanTierSeed.sol`)

**100 niveles**, del **$1** al **$10 000**. Reglas de la escalera (todas estrictas):
- el **principal** del siguiente > el anterior
- la **tasa** del anterior > la del siguiente (el préstamo viejo siempre es más caro en %)
- el **interés en $** del siguiente > el anterior (cada subida cobra más interés en dólares)
- el **total a devolver** también sube

`requiredCount` live (núcleo `0x1E5118`): L1 → 3; L2–99 → 5; L100 no sube.
La escalera nueva (3 hasta L5, +5 desde $100, bono 2.000 USDT en L100) vive en `QuatriviumLeveling.sol` y se cableará en el próximo deploy, sin recortar el núcleo.

| Nivel | Principal | Plazo | Tasa | Interés $ | Cuotas | Live / planificado |
|------:|----------:|------:|-----:|----------:|:------:|:-------------------|
| 1 | $1 | 7 días | 100% | $1.00 | 1 | 3 / 3 |
| 5 | $20 | 25 días | 50% | $10.00 | 1 | 5 / 3 |
| 6 | $35 | 30 días | 48% | $16.80 | 1 | 5 / 5 |
| 10 | $100 | 50 días | 34% | $34.00 | 3 | 5 / 5 |
| 11 | $120 | 50 días | 33.71% | $40.45 | 3 | 5 / 10 |
| 50 | $825 | 68 días | 22.44% | $185.13 | 3 | 5 / 205 |
| 100 | **$10 000** | 90 días | 8% | $800.00 | 3 | — / 455 + bono 2.000 |

> Los bps son tasa plana sobre el principal por el plazo (no APR anual).
> A partir de $50: 2 cuotas. A partir de $60: 3. Tabla completa: `constants/loanTiers.ts`.
> Redeploy testnet 2026-09-11: `0x1E5118B378c7BCB3F3c5de7ec046B93E60f417a3`. Demo es un mundo nuevo: hay que volver a activar la línea. Pool semilla 2000 USDT.

---

## Lo que está funcionando ✅
- Contrato `QuatriviumCredit.sol` — testnet en `0x1E5118B378c7BCB3F3c5de7ec046B93E60f417a3` (100 niveles, bloque 130526896)
- 15 suites Hardhat (89 tests): accounting, circuitBreaker, cuotas, destroy, identity, kyc, liquidation, mlm, morosity, peg, security, demo-identity, accountWorld…
- App móvil con 43 componentes React Native
- i18n: 17 idiomas, 702 claves
- Referidos Unilevel en contrato y UI
- Notify-worker: WhatsApp, Telegram, SMS, email, auto-fondeo BNB testnet (`/auto-fund`) e identidad demo (`/demo-identity`, solo chain 97)
- KYC on-chain + OTP de teléfono; nombre y documento congelados
- App lock: contraseña y frase solo se reemplazan; PIN, huella y llave de acceso se pueden cambiar o quitar (huella y llave usan el mismo sensor)
- Frase secreta BIP-39: ver/anotar; rotar o restaurar vive en Reemplazar cuenta (no se elimina suelta)
- Device binding local + frase para recuperar en otro teléfono
- Liquidación de deudores desde AdminPanel (approve automático)
- Auto-refresh de balances cada 30 s

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
| Lock | `services/appLock.ts` + `components/BiometricLockSection.tsx` | PIN, password, huella, lockout |
| Storage seguro | `services/secureStorageService.ts` | Wrapper expo-secure-store |
| Red | `constants/rpcConfig.ts` | RPC, chainId, modo demo/live |
| Contrato | `constants/contractConfig.ts` | ABI + dirección según entorno |
| Tokens | `constants/tokens.ts` | Lista de stables soportados |
| ABI/contrato | `contracts/QuatriviumCredit.sol` | Lógica de crédito on-chain |
| Tests | `test/*.test.js` | 15 suites Hardhat · 81 tests |
| Errores tx | `utils/txErrors.ts` | Mensajes legibles de revert |

---

## Seguridad on-chain (contrato)
| Protección | Estado |
|---|---|
| ReentrancyGuard | ✅ Funciones de fondos |
| SafeERC20 | ✅ Transfers/approvals |
| Pausable (emergencia) | ✅ Inmediato (cualquier admin) · despausar con timelock |
| Timelock 72h + multisig | ✅ Acciones admin · 2-de-3 al tercer fundador |
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
| `check-i18n.mjs` | ✅ OK | 702 claves · 17 locales · sin BOM · sin discrepancias |
| `security-check.mjs` | ✅ OK | .env fuera de git · sin credenciales hardcodeadas |
| `hardhat test` | ✅ 83/83 | Incluye 100 niveles + destroy + mora + identidad demo + gates |
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
