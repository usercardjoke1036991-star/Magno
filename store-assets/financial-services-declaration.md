# 📋 Guía: Financial Services Declaration — Google Play Console

Google exige esta declaración para apps que manejan dinero real, préstamos o criptomonedas.

---

## ¿Dónde la encuentras?

1. Ve a [play.google.com/console](https://play.google.com/console)
2. Selecciona tu app
3. Menú izquierdo → **Política de la app** → **Contenido de la app**
4. Busca la sección **"Servicios financieros"**

---

## Cómo responder cada pregunta

### Pregunta 1: ¿Tu app ofrece servicios financieros?
**Respuesta: SÍ**

### Pregunta 2: ¿Tu app ofrece préstamos o créditos?
**Respuesta: SÍ**

→ Google abrirá un formulario adicional. Responde así:

| Campo | Respuesta |
|---|---|
| ¿Es una app de préstamos personales? | **Sí** |
| Tasa de interés anual (APR) mínima | **40%** (Nivel 7, la más baja) |
| Tasa de interés anual (APR) máxima | **100%** (Niveles 1 y 2) |
| Plazo mínimo del préstamo (días) | **7** |
| Plazo máximo del préstamo (días) | **50** |
| ¿Requiere acceso a contactos del teléfono? | **No** |
| ¿Requiere acceso a fotos/multimedia para aprobación? | **No** |
| ¿Requiere acceso a ubicación para aprobación? | **No** |
| País/países de operación | Los países donde distribuyes la app |
| URL de política de privacidad | `https://quatriviumcredit.app/privacy-policy` |
| URL de términos de servicio | `https://quatriviumcredit.app/terms` (crear) |

### Pregunta 3: ¿Tu app involucra criptomonedas?
**Respuesta: SÍ** — la app usa USDT (stablecoin) sobre BNB Smart Chain.

→ Aclarar en el formulario:
- No es una exchange de criptomonedas
- No permite comprar/vender cripto con dinero fiat
- El token USDT se usa como medio de pago en el protocolo de préstamos

---

## ⚠️ Política de Google sobre Apps de Préstamos Personales

Google tiene políticas MUY estrictas para apps de préstamos. Los puntos críticos:

### ✅ LO QUE DEBES CUMPLIR:
- Mostrar APR, plazos y costos totales ANTES de que el usuario acepte
- No acceder a contactos, fotos ni ubicación para gestión de deudas
- No amenazar ni humillar a usuarios morosos
- No compartir datos de usuarios con terceros sin consentimiento

### ✅ LO QUE YA TIENE TU APP (puntos a favor):
- Sin acceso a contactos (✅ no pedido en permisos)
- Sin acceso a cámara para préstamos (✅)
- Sin ubicación requerida (✅)
- APR y plazos visibles en las tarjetas de niveles (✅)
- Sistema de reputación en lugar de cobranza agresiva (✅)

---

## Documentos adicionales que Google puede pedir

Para apps de servicios financieros, Google puede solicitar durante la revisión:

1. **Licencia o registro regulatorio** (si operas en países con regulación cripto)
   - Si solo distribuyes globalmente sin apuntar a un país específico regulado, generalmente no es necesario
   - Si apuntas a USA, UK o UE: requiere investigación legal adicional

2. **Términos de Servicio** (URL pública obligatoria)
   - Ver archivo `terms-of-service.html` en esta carpeta

3. **Evidencia de que el protocolo es descentralizado**
   - URL del contrato en BscScan: `https://bscscan.com/address/TU_CONTRATO_MAINNET`
   - Código fuente verificado en BscScan (hacerlo tras el deploy)

---

## Verificar el contrato en BscScan (hacer tras deploy mainnet)

```bash
npx hardhat verify --network bscMainnet TU_DIRECCION_CONTRATO
```

Esto hace el contrato de código abierto y verificado en BscScan — un punto MUY positivo para la revisión de Google ya que demuestra transparencia.

---

## Países donde NO deberías distribuir (restricciones legales cripto)

Considera excluir estos países en Play Console para evitar problemas regulatorios:
- 🇨🇳 China (prohibición cripto total)
- 🇷🇺 Rusia (restricciones)
- 🇸🇦 Arabia Saudita (en revisión)

Para excluirlos: Play Console → Distribución → Países → Excluir
