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
- **i18n:** 17 idiomas, 640 claves, soporte RTL (árabe, urdu)

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

---

## Niveles de crédito (fuente: `constants/loanTiers.ts` + constructor del contrato)

`requiredCount` = préstamos **de este nivel** que hay que pagar a tiempo para desbloquear el siguiente.
El contrato usa la misma regla: nivel 1 → 3 pagos; niveles 2–9 → 5 pagos.

| Nivel | Nombre | Principal | Plazo | Interés (bps) | Cuotas | Pagos para subir |
|------:|:-------|----------:|------:|--------------:|:------:|:----------------:|
| 1 | Semilla | **$1 USDT** | 7 días | 10 000 bps (100%) | 1 | 3 |
| 2 | Inicial | **$2 USDT** | 10 días | 10 000 bps (100%) | 1 | 5 |
| 3 | Micro | **$5 USDT** | 15 días | 8 000 bps (80%) | 1 | 5 |
| 4 | Plus | **$10 USDT** | 20 días | 7 000 bps (70%) | 1 | 5 |
| 5 | Avance | **$20 USDT** | 25 días | 5 000 bps (50%) | 1 | 5 |
| 6 | Crecimiento | **$35 USDT** | 30 días | 5 714 bps (~57%) | 1 | 5 |
| 7 | Escala | **$50 USDT** | 35 días | 4 000 bps (40%) | 2 | 5 |
| 8 | Avanzado | **$60 USDT** | 40 días | 5 000 bps (50%) | 3 | 5 |
| 9 | Elite | **$80 USDT** | 45 días | 5 000 bps (50%) | 3 | 5 |
| 10 | Máximo | **$100 USDT** | 50 días | 5 000 bps (50%) | 3 | — (nivel final) |

> Los bps son tasa plana sobre el principal por el plazo del préstamo (no APR anual).
> Niveles 7–10 se pagan en cuotas. A partir de $50 se habilitan 2 pagos; a partir de $60, 3.

---

## Lo que está funcionando ✅
- Contrato `QuatriviumCredit.sol` (1309 líneas) — testnet en `0x5eB6c65f3e3b7DC555e690A83d61205F66700cC2`
- 15 suites Hardhat (81 tests): accounting, circuitBreaker, cuotas, destroy, identity, kyc, liquidation, mlm, morosity, peg, security, demo-identity…
- App móvil con 43 componentes React Native
- i18n: 17 idiomas, 640 claves
- Referidos Unilevel en contrato y UI
- Notify-worker: WhatsApp, Telegram, SMS, email, auto-fondeo BNB testnet (`/auto-fund`) e identidad demo (`/demo-identity`, solo chain 97)
- KYC on-chain + OTP de teléfono; nombre y documento congelados
- App lock: PIN 6 dígitos + huella real (detección por `expo-local-authentication`, no por NativeModules; PIN y llave de acceso comparten el mismo interruptor)
- Frase secreta BIP-39: ver/guardar; rotar o restaurar vive en Reemplazar cuenta
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

## Estado de verificaciones (última auditoría: 2026-09-11)

| Verificación | Estado | Detalle |
|---|---|---|
| `tsc --noEmit` | ✅ 0 errores | TypeScript strict, noUnusedLocals, noImplicitReturns |
| `check-i18n.mjs` | ✅ OK | 640 claves · 17 locales · sin BOM · sin discrepancias |
| `security-check.mjs` | ✅ OK | .env fuera de git · sin credenciales hardcodeadas |
| `hardhat test` | ✅ 81/81 | Incluye destroy + mora + identidad demo + gates + cooldown local |
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
| 2026-09-11 | Auditoría final: signer se reconecta al cambiar Demo/Real; crédito/pool bloqueados sin contrato mainnet; saldos BNB/USDT reales aunque el crédito esté en preparación | Evitar `wrong-network`, botones activos en Real vacío y préstamo/LP de Demo pegados |
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
