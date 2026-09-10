# 🧠 CONTEXTO DEL PROYECTO: Quatrivium Credit

## ¿Qué es este proyecto?
**Quatrivium Credit** es una app móvil de microcrédito on-chain sin colateral sobre BNB Smart Chain (BSC).
El usuario conecta su wallet, pide un préstamo en USDT del pool de liquidez, lo paga antes del vencimiento
y sube de nivel para pedir montos mayores. Si no paga, entra en mora y queda bloqueado hasta regularizar.

## Tipo de proyecto
- **Stack:** React Native 0.81 · Expo 54 · React 19 · TypeScript · Solidity 0.8.24 · ethers v6
- **Tipo:** Mobile DeFi App + Smart Contracts (EVM)
- **Estado actual:** En desarrollo activo — testnet operativo, mainnet pendiente de deploy final

---

## Arquitectura y estructura

```
Magno/
├── app/index.tsx                  # Pantalla principal (orquesta todo)
├── components/ (55 archivos)      # UI: WalletSection, LoanTierCard, AdminPanel, etc.
├── hooks/                         # useWeb3Balances, useWeb3Transactions, useHomeHandlers
├── services/                      # quatriviumCreditService, appWallet, deviceBinding, etc.
├── contracts/
│   ├── QuatriviumCredit.sol       # Contrato principal (1305 líneas)
│   ├── Groth16Verifier.sol        # ZK experimental (no en producción)
│   ├── interfaces/                # AggregatorV3Interface (Chainlink)
│   └── mocks/                     # ERC20Mock, MockV3Aggregator (testnet)
├── test/ (14 archivos)            # accounting, circuitBreaker, cuotas, kyc, mlm, etc.
├── scripts/                       # deploy, security-check, production-check, notify-worker
├── i18n/ (16 locales)             # ar, bn, de, en, es, fr, hi, id, it, ja, ko, pt, ru, tr, ur, vi, zh
├── constants/                     # contractConfig, rpcConfig, tokens, loanTiers
├── stubs/zk-node-stub.js          # Metro stub: snarkjs no es bundleable en RN
├── .env.example                   # Variables requeridas documentadas
└── eas.json                       # Builds: development (chain 97), preview, production (chain 56)
```

---

## Stack tecnológico
- **App:** React Native 0.81 / Expo 54 / React 19 / TypeScript (strict)
- **Web3:** ethers v6 / Reown AppKit (WalletConnect) / wagmi
- **Contratos:** Solidity 0.8.24 / OpenZeppelin v5 / Hardhat
- **Red blockchain:** BSC Testnet (chain 97) en dev · BSC Mainnet (chain 56) en prod
- **Seguridad mobile:** expo-secure-store / device binding / biometría / app lock
- **Notificaciones:** Twilio SMS+WhatsApp / Telegram Bot / notify-worker
- **i18n:** 16 idiomas, 603+ claves, soporte RTL (árabe, urdu)

---

## Decisiones importantes tomadas
- **Un solo préstamo activo por wallet**: no se puede pedir otro hasta pagar o liquidar el actual
- **Sin colateral**: el pool absorbe el riesgo de impago (diseño intencional, no bug)
- **`tx.origin == msg.sender`**: bloquea contratos intermediarios en todas las operaciones críticas
- **Timelock de 72h + multisig** para todas las acciones admin (excepto pausa que es inmediata)
- **Wallet interna (app wallet)**: cada instalación genera una wallet HD guardada en SecureStore cifrado
- **ZK es experimental**: `snarkjs` hace stub en Metro; el registro real es `registrarHumanoConPadre()`
- **Entornos separados en `eas.json`**: development→chain 97, production→chain 56
- **`slug: "quatrivium-credit"` en `app.json`**: renombrado desde "magno" en sept 2026
- **Liquidación disponible en AdminPanel**: admins pueden liquidar deudores vencidos desde la app
- **`useHomeHandlers` hook**: handlers extraídos de `app/index.tsx` para reducir complejidad

---

## Niveles de crédito (fuente: `constants/loanTiers.ts`)
| Nivel | Nombre | Principal | Plazo | Interés (bps) | Cuotas | Préstamos previos |
|------:|:-------|----------:|------:|--------------:|:------:|:-----------------:|
| 1 | Semilla | **$1 USDT** | 7 días | 10 000 bps (100%) | 1 | — |
| 2 | Inicial | **$2 USDT** | 10 días | 10 000 bps (100%) | 1 | 3 pagados |
| 3 | Micro | **$5 USDT** | 15 días | 8 000 bps (80%) | 1 | 5 pagados |
| 4 | Plus | **$10 USDT** | 20 días | 7 000 bps (70%) | 1 | 5 pagados |
| 5 | Avance | **$20 USDT** | 25 días | 5 000 bps (50%) | 1 | 5 pagados |
| 6 | Crecimiento | **$35 USDT** | 30 días | 5 714 bps (~57%) | 1 | 5 pagados |
| 7 | Escala | **$50 USDT** | 35 días | 4 000 bps (40%) | 2 | 5 pagados |
| 8 | Avanzado | **$60 USDT** | 40 días | 5 000 bps (50%) | 3 | 5 pagados |
| 9 | Elite | **$80 USDT** | 45 días | 5 000 bps (50%) | 3 | 5 pagados |
| 10 | Máximo | **$100 USDT** | 50 días | 5 000 bps (50%) | 3 | — (nivel final) |

> Los bps son tasa plana sobre el principal por el plazo del préstamo (no APR anual).
> Niveles 7–10 se pagan en cuotas. A partir del nivel 7 se habilitan automáticamente 2 o 3 pagos.

---

## Lo que está funcionando ✅
- Contrato `QuatriviumCredit.sol` (1305 líneas) — testnet desplegado en `0x5eB6c65f3e3b7DC555e690A83d61205F66700cC2`
- 14 suites de tests Hardhat (accounting, circuitBreaker, cuotas, kyc, liquidation, mlm, morosity, peg, security...)
- App móvil completa con 55 componentes React Native
- i18n para 16 idiomas con 603 claves
- Sistema de referidos Unilevel en contrato y UI
- Notificaciones de deuda (WhatsApp, Telegram, SMS via Twilio)
- Sistema de KYC (declaración on-chain) + OTP de teléfono
- App lock con PIN/biometría + cifrado de wallet en SecureStore
- Device binding (wallet ligada al dispositivo)
- `useHomeHandlers.ts` — lógica extraída de pantalla principal
- Liquidación de deudores desde AdminPanel

## Lo que está en progreso 🔄
- Deploy de contrato en BSC Mainnet (pendiente configurar `EXPO_PUBLIC_CONTRACT_ADDRESS_MAINNET` en eas.json production)
- Publicación en Google Play Store

## Lo que NO funciona o está pendiente ❌
- **ZK real en producción**: snarkjs hace stub en React Native. El registro es `registrarHumanoConPadre()` sin prueba ZK
- **Liquidación en testnet UI**: disponible en código, pero el botón requiere USDT aprobado por el liquidador
- **`eas.json` production**: falta `EXPO_PUBLIC_CONTRACT_ADDRESS_MAINNET` (se inyecta post-deploy)
- **Java 25 rompe build Android**: usar JDK 17 para builds nativos

---

## Dependencias críticas

```
app/index.tsx → useHomeHandlers (handlers)
             → useWeb3Balances (estado on-chain)
             → useWeb3Transactions (transacciones)

useHomeHandlers → useWeb3Transactions → quatriviumCreditService → CONTRACT_ABI + ethers v6
useWeb3Balances → quatriviumCreditService → RPC BSC (fallback 3 URLs)

AdminPanel → onLiquidar → useHomeHandlers → useWeb3Transactions.liquidarDeudor
                                          → quatriviumCreditService.liquidar

services/appWallet → expo-secure-store (cifrado)
                  → deviceBinding (ligada al dispositivo)
                  → walletSession (clave de cifrado)

contracts/QuatriviumCredit.sol → OpenZeppelin v5 (Ownable, Pausable, ReentrancyGuard, SafeERC20)
                               → AggregatorV3Interface (oráculo Chainlink)
```

---

## Módulos del proyecto
| Módulo | Archivo(s) | Función |
|---|---|---|
| Pantalla home | `app/index.tsx` | Orquesta UI (renduce con useHomeHandlers) |
| Handlers | `hooks/useHomeHandlers.ts` | Lógica de cada acción del usuario |
| Estado on-chain | `hooks/useWeb3Balances.ts` | Lee contrato + RPC |
| Transacciones | `hooks/useWeb3Transactions.ts` | Approve + préstamo + pago + LP + liquidación |
| Servicio contrato | `services/quatriviumCreditService.ts` | Capa ethers sobre ABI |
| Wallet interna | `services/appWallet.ts` | HD wallet cifrada en SecureStore |
| Storage seguro | `services/secureStorageService.ts` | Wrapper expo-secure-store |
| Red | `constants/rpcConfig.ts` | RPC, chainId, AppKit |
| Contrato | `constants/contractConfig.ts` | ABI + dirección según entorno |
| Tokens | `constants/tokens.ts` | Lista de stables soportados |
| ABI/contrato | `contracts/QuatriviumCredit.sol` | Lógica de crédito on-chain |
| Tests | `test/*.test.js` | 14 suites Hardhat |
| Errores tx | `utils/txErrors.ts` | Mensajes legibles de revert |

---

## Seguridad on-chain (contrato)
| Protección | Estado |
|---|---|
| ReentrancyGuard | ✅ Todas las funciones de fondos |
| SafeERC20 | ✅ Transfers/approvals |
| Pausable (emergencia) | ✅ Inmediato |
| Timelock 72h + multisig | ✅ Acciones admin |
| tx.origin == msg.sender | ✅ Registro, préstamo, pago, depósito, retiro |
| Oráculo Chainlink (stale 1h) | ✅ Precio USDT/USD |
| Circuit breaker retiros | ✅ >50% en 1h → pause |
| Cooldown 48h entre préstamos | ✅ Anti-spam |
| Tope 50 originaciones/día | ✅ Límite global |
| Utilización máx 80% | ✅ No presta el pool entero |

---

## Estado de verificaciones (última auditoría: 2026-09-10)

| Verificación | Estado | Detalle |
|---|---|---|
| `tsc --noEmit` | ✅ 0 errores | TypeScript strict, noUnusedLocals, noImplicitReturns |
| `check-i18n.mjs` | ✅ OK | 611 claves en 16 locales, sin discrepancias |
| `security-check.mjs` | ✅ OK | .env fuera de git, sin credenciales hardcodeadas |
| `hardhat test` | ✅ 68/68 pasan | accounting, circuitBreaker, cuotas, identity, kyc, liquidation, mlm, morosity, peg, security |
| `npm audit` (runtime) | ✅ OK | Vulns ws GHSA-58qx/96hv corregidas con override ws^8.21.0 |
| `npm audit` (devDeps) | ⚠️ 66 vulns | En hardhat/solidity-coverage/expo SDK — devDeps, no en bundle de la app |
| `production:check` | 🟡 9/14 | 5 faltantes son acciones manuales de deploy |
| Imports rotos | ✅ 0 | Todos los módulos resuelven correctamente |
| console sin __DEV__ | ✅ 0 | Sin logging de producción sin guardia |

---

## Historial de cambios importantes
| Fecha | Cambio | Razón |
|-------|--------|-------|
| 2026-09-10 | CONTEXTO.md inicializado y poblado | Auditoría completa del proyecto |
| 2026-09-10 | `app.json` slug cambiado: "magno" → "quatrivium-credit" | Consistencia con package name |
| 2026-09-10 | `hooks/useHomeHandlers.ts` creado | Extraer handlers de app/index.tsx (783→521 líneas) |
| 2026-09-10 | Liquidación añadida a AdminPanel + servicio + hook | Admins pueden liquidar deudores sin script externo |
| 2026-09-10 | Claves i18n de liquidación añadidas (16 locales) | 611 claves, soporte multiidioma para nueva función |
| 2026-09-10 | `package.json` override `ws: ^8.21.0` | Corregir GHSA-58qx-3vcg-4xpx y GHSA-96hv-2xvq-fx4p |
| 2026-09-10 | Auditoría profunda final — 0 errores TS, 68/68 tests | Proyecto listo para deploy en producción |
