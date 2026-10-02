# Quatrivium Finance


<!-- AUTO-README:START -->

## Quatrivium Finance

**Quatrivium Finance** es una app móvil de microcrédito on-chain sin colateral sobre BNB Smart Chain (BSC). El usuario activa una wallet interna, pide un préstamo en USDT del pool de liquidez, lo paga antes del vencimiento y sube de nivel para pedir montos mayores. Si no paga, entra en mora y queda bloqueado hasta regularizar. **No puede cerrar la cuenta mientras tenga deuda o esté en mora.**

- **Tipo de proyecto:** `node` (detectado automáticamente)
- **Estado:** Testnet operativo — mainnet pendiente de deploy (acción manual del fundador)
- **Tests detectados:** 44 archivo(s)

### Qué funciona
- Contrato `QuatriviumCredit.sol` — Demo live `0xD2d2A9eF0D1e4f253abc90Dd4ACb0E6C50B2de9f` (1000 niveles, FamaLib `0x6B98072a087B3fd856c24249232EE3fb40cB5003`, pool 2000 USDT)
- Sala **Reserva**: hermano `QuatriviumReserva.sol` (Hardhat 12/12). Visible desde el inicio, usable en nivel 10. Bote solo admin (no Donar ni pool). Extra de comisiones con corte del fundador. Demo práctica local; Real exige identidad. Sin contrato mainnet.
- Hermano **FamaCaja**: `canjearFama` usa el mismo criterio que Credit `_estaVencido` (cuota o vencimiento final) leyendo `planPago`; no se añade wrapper al núcleo.
- 17 suites Hardhat (210 tests): accounting, circuitBreaker, cuotas, destroy, identity, kyc, liquidation, mlm, morosity, peg, security, demo-identity, accountWorld, 1000 niveles, hitos, donación, endurecimiento, rankings, lock de referido y canje de fama (incluye cuota vencida antes del plazo final)…
- Foundry 1.8.3 en WSL (`npm run test:forge`): despliega FamaCaja + Credit (7 args). EIP-170, NAV préstamo/pago, pool locked, anti-contrato, extraño no paga deuda ajena, fuzz depósito 256 runs. Runtime compilado del núcleo 24536 B (margen 40). Live Demo sigue 24457 B hasta el redespliegue.
- Ciber WSL (producto, local, 2026-09-17 en vivo): Aderyn **0.6.8** High 1 CEI / Low 13 (se mantiene, `nonReentrant`). **Trivy 0.74.0** (examen 2026-10-01): lockfile de producción HIGH/MEDIUM 0; Dockerfile.notify 0; secretos 0 en app/services/scripts/contracts. Dev: se parchearon adm-zip 0.6.1, serialize-javascript 7.1.2, undici 6.28.1 y bn.js 4.12.5. Queda `tmp@0.0.33` de solc (sin parche 0.0.x). `.trivyignore` + `trivy.yaml`. **Semgrep 1.177.0** `p/smart-contracts` 202 INFO de gas (custom error / `++i`); worker JS 0 hallazgos; GCM sigue con `authTagLength: 16`. **Mythril 0.24.8** SWC-101 High en getters `BONO_HITOS_TOTAL`/`MAX_NIVEL`/`DIVISION_SIZE`, vista `calcularTasaUtilizacion` y `proposals(uint256)` — overflow de 0.8.24 que revierte, no envuelve. ZAP 2.17 baseline `/health` 0 alertas. Informes en `/root/cyber-scans` (fuera de git).
- App móvil con componentes React Native (seguridad a elección, autenticador, historial, sala Bonos, sala Reserva)
- i18n: 17 idiomas, 1040 claves
- Rankings: 7 tableros (incluye racha), divisiones de 100, premio mensual estimado, nombres y fotos públicas, visibles desde el nivel 15
- Referidos Unilevel en contrato y UI
- Notify-worker: WhatsApp, Telegram, SMS, email, auto-fondeo BNB testnet (`/auto-fund`) e identidad demo (`/demo-identity`, solo chain 97)
- KYC on-chain + OTP de teléfono; nombre y documento congelados; foto del documento en el teléfono

### En progreso
- Deploy de contrato en BSC Mainnet (`CONFIRM_MAINNET=yes` + `npm run deploy:bsc`)
- Configurar `EXPO_PUBLIC_CONTRACT_ADDRESS_MAINNET` en `eas.json` production **después** del deploy
- Credenciales Textbelt (`TEXTBELT_API_KEY`) en `.env.worker` y en Render; Resend para correo
- Publicación en Google Play Store (`eas build --platform android --profile production`)

### Módulos
- Pantalla home — `app/index.tsx`
- Layout Expo — `app/_layout.tsx`
- Tooling RN — `babel.config.js` · `metro.config.js`
- Contratos JS — `hardhat.config.cjs`
- ZK stub — `zkService.ts`
- Handlers — `hooks/useHomeHandlers.ts`
- Estado on-chain — `hooks/useWeb3Balances.ts`
- Transacciones — `hooks/useWeb3Transactions.ts`
- Servicio contrato — `services/quatriviumCreditService.ts`
- Identidad demo — `services/demoIdentity.ts` + worker `/demo-identity`
- Wallet interna — `services/appWallet.ts`
- KYC local — `services/kycDeclaration.ts`
- Lock — `services/appLock.ts` + `authPrefs.ts` + `authenticator.ts`
- Historial — `services/movementHistory.ts` + `MovementHistory.tsx`
- Storage seguro — `services/secureStorageService.ts`

### Funciones reales (código)
- `actualizar_contexto.py`
  - `cmd_mostrar()`
  - `cmd_actualizar_estado()`
  - `cmd_agregar_cambio()`
  - `cmd_init()`
  - `main()`
- `actualizar_readme.py`
  - `class InfoReadme`
  - `detectar_tipo_proyecto()`
  - `iterar_fuentes()`
  - `extraer_simbolos_python()`
  - `extraer_exports_js()`
  - `extraer_handlers_mql()`
  - `extraer_tipos_android()`
  - `extraer_simbolos_archivo()`
  - `analizar_codigo()`
  - `detectar_comandos()`
  - `detectar_herramientas_qa()`
  - `recolectar_info()`
- `App.js`
  - `App()`
- `aprender_error.py`
  - `cargar_errores()`
  - `guardar_errores()`
  - `generar_id()`
  - `validar_tipos()`
  - `validar_severidad()`
  - `validar_patron_regex()`
  - `modo_interactivo()`
  - `registrar_error()`
  - `mostrar_confirmacion()`
  - `main()`
- `detectar_lenguaje.py`
  - `hay_ext_cercana()`
  - `formatear_simbolo()`
  - `lenguaje_de_archivo()`
  - `detectar_tipo_lenguaje()`
  - `extraer_simbolos_etiquetados()`
  - `extraer_simbolos()`
  - `extraer_simbolos_formateados()`
  - `analizar_ruta()`
  - `imprimir_reporte()`
  - `main()`
- `detectar_logica.py`
  - `class ProblemaLogica`
  - `detectar_division_por_cero()`
  - `detectar_none_sin_verificar()`
  - `detectar_bucle_infinito()`
  - `detectar_modificacion_en_iteracion()`
  - `detectar_return_en_bucle_acumulador()`
  - `detectar_comparacion_con_asignacion()`
  - `detectar_logica_trading_invertida()`
  - `detectar_volumen_cero()`
  - `detectar_operacion_sin_verificar_spread()`
  - `detectar_magic_number_cero()`
  - `detectar_mutacion_estado_react()`
- `hardhat.config.cjs`
  - `accountsFromEnv()`
- `io_utf8.py`
  - `run_utf8()`
- `mapa_proyecto.py`
  - `detectar_tipo_proyecto()`
  - `extraer_simbolos()`
  - `inventariar_partes()`
  - `comprobar_al_dia()`
  - `comprobar_conexion()`
  - `escribir_mapa_md()`
  - `mapa_proyecto()`
  - `imprimir_reporte()`
  - `main()`
- `memoria_proyecto.py`
  - `class MemoriaProyecto`
  - `resolver_directorio()`
  - `ruta_memoria_md()`
  - `ruta_memoria_json()`
  - `leer_memoria()`
  - `renderizar_memoria()`
  - `escribir_memoria()`
  - `cmd_init()`
  - `cmd_cambio()`
  - `cmd_decision()`
  - `cmd_enfoque()`
  - `cmd_mostrar()`
- `polyfills.js`
  - `class AbortController`
  - `class AbortSignal`
  - `class URL`
  - `class URLSearchParams`
- `qa_autonomo.py`
  - `class ResultadoQA`
  - `class ReporteQA`
  - `detectar_tipo_proyecto()`
  - `verificar_python()`
  - `verificar_mql5()`
  - `verificar_nodejs()`
  - `verificar_android()`
  - `verificar_rust()`
  - `verificar_go()`
  - `verificar_ci()`
  - `verificar_readme()`
  - `verificar_errores_aprendidos()`
- `qa_safe_io.py`
  - `confine()`
  - `confine_read()`
  - `confine_write()`
  - `write_under()`
  - `under_root()`
  - `resto_bullet_estado()`
- `reestructurar_peticion.py`
  - `resolver_directorio()`
  - `normalizar()`
  - `detectar_intencion()`
  - `detectar_tipo_proyecto()`
  - `habla_espanol()`
  - `leer_contexto_una_linea()`
  - `inferir_alcance()`
  - `sugerir_herramientas()`
  - `inferir_entregable()`
  - `reformular_objetivo()`
  - `construir_restricciones()`
  - `construir_prompt_agente()`
- `run_tests.py`
  - `class ResultadoTests`
  - `detectar_tipo_proyecto()`
  - `ejecutar_tests_python()`
  - `ejecutar_tests_node()`
  - `ejecutar_tests_android()`
  - `ejecutar_tests_mql5()`
  - `ejecutar_tests_proyecto()`
  - `detectar_subproyectos()`
  - `imprimir_reporte()`
  - `main()`
- `salud_proyecto.py`
  - `class Hallazgo`
  - `class ReporteSalud`
  - `verificar_identidad()`
  - `verificar_archivos()`
  - `verificar_simbolos()`
  - `verificar_decisiones()`
  - `verificar_comando()`
  - `verificar_herramientas()`
  - `ejecutar_salud()`
  - `imprimir_reporte()`
  - `main()`
- `verificar_conectores.py`
  - `detectar_imports_rotos()`
  - `detectar_llamadas_sin_definicion()`
  - `detectar_imports_js_rotos()`
  - `detectar_handlers_jsx_sin_definir()`
  - `detectar_rutas_api_js()`
  - `detectar_conectores_mql()`
  - `verificar_conectores()`
  - `imprimir_reporte()`
  - `main()`
- `verificar_modulos.py`
  - `detectar_tipo_proyecto()`
  - `detectar_modulos_documentados_ausentes()`
  - `detectar_imports_relativos_rotos()`
  - `detectar_submodulos_paquete_ausentes()`
  - `detectar_init_faltante()`
  - `detectar_docstring_modulo_faltante()`
  - `detectar_ciclos_simples()`
  - `detectar_includes_mql_ausentes()`
  - `detectar_exports_index_rotos()`
  - `detectar_modales_ui()`
  - `verificar_modulos()`
  - `imprimir_reporte()`
- `vision_proyecto.py`
  - `class VisionProyecto`
  - `detectar_tipo_proyecto()`
  - `analizar_modulos_existentes()`
  - `leer_vision()`
  - `escribir_vision()`
  - `cmd_init()`
  - `cmd_agregar_idea()`
  - `cmd_actualizar()`
  - `cmd_mostrar()`
  - `cmd_completar_modulo()`
  - `cmd_json()`
  - `main()`
- `web3Config.tsx`
  - `Web3Provider()`
  - `toEthersWeb3Provider()`
  - `getEthersSignerFromProvider()`
  - `web3ConfigDebug()`

### Cómo usarlo

```powershell
npm run start
npm run android
npm run ios
npm run audit
npm run audit:fix
npm run test
npm run test:forge
npm run test:coverage
npm run typecheck
npm run compile
npm run security:check
npm run security:slither
npm run security:mobsf
npm run security:mobsf:purge
npm run security:trivy
npm run security:snyk
npm run security:snyk:code
npm run security:sonar
npm run deploy:bsc
npm run deploy:testnet
npm run deploy:reserva
npm run notify
npm run notify:prod
npm run notify:sms
npm run notify:deploy
npm run notify:hetzner
npm run tunnel
npm run tunnel:ngrok
npm run production:check
npm run production:prepare
npm run salud
npm run salud:watch
npm run salud:tests
python qa_autonomo.py
python actualizar_contexto.py --mostrar
python vision_proyecto.py --mostrar
python actualizar_readme.py
```

### Herramientas QA

| Script | Uso | Descripción |
|--------|-----|-------------|
| `qa_autonomo.py` | `python qa_autonomo.py` | Auditoría QA del proyecto |
| `aprender_error.py` | `python aprender_error.py --lista` | Memoria de errores (ERR-XXX) |
| `actualizar_contexto.py` | `python actualizar_contexto.py --mostrar` | Gestiona CONTEXTO.md |
| `vision_proyecto.py` | `python vision_proyecto.py --mostrar` | Gestiona VISION.md |
| `verificar_conectores.py` | `python verificar_conectores.py` | Detecta conectores sueltos (ERR-008) |
| `detectar_logica.py` | `python detectar_logica.py` | Detecta errores de lógica (ERR-009..012) |
| `verificar_modulos.py` | `python verificar_modulos.py` | Verifica módulos documentados y modales UI |
| `mapa_proyecto.py` | `python mapa_proyecto.py --actualizar` | Cerebro del proyecto activo: piezas, docs vs código y conexión (MAPA.md) |
| `detectar_lenguaje.py` | `python detectar_lenguaje.py [ruta]` | Lenguaje adaptativo: detecta tipo y extrae símbolos multi-lenguaje |
| `run_tests.py` | `python run_tests.py` | Ejecuta tests según el tipo de proyecto |
| `actualizar_readme.py` | `python actualizar_readme.py` | Actualiza este README con el estado real |
| `memoria_proyecto.py` | `python memoria_proyecto.py --mostrar` | Memoria de sesión (MEMORIA.md) |
| `reestructurar_peticion.py` | `python reestructurar_peticion.py "texto"` | Reestructura una petición informal en prompt profesional |

_Actualizado automáticamente el 2026-10-02 por `actualizar_readme.py`. El texto fuera de estos marcadores no se toca._

<!-- AUTO-README:END -->
Quatrivium Finance es crédito on-chain **sin colateral**: pides un préstamo, lo pagas dentro del plazo y subes de nivel para pedir más.

## Qué lo hace distinto

- No bloqueas tokens para pedir.
- Un préstamo activo a la vez.
- Si pagas a tiempo, subes de nivel (más monto, más plazo).
- Si no pagas, quedas en mora y no puedes pedir otro hasta regularizar.

## App

React Native (Expo) + WalletConnect/Reown en BNB Smart Chain.

```bash
npm install
npx expo run:android
```

## Contratos

```bash
npx hardhat test
npx hardhat run scripts/deploy.cjs --network bscMainnet
```
