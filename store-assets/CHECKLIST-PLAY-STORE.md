# ✅ CHECKLIST COMPLETO — Subir a Google Play Store

## 🤖 LO QUE HIZO EL AGENTE (ya listo en el repo)
- [x] `store-assets/privacy-policy.html` — Política de Privacidad completa
- [x] `store-assets/terms-of-service.html` — Términos de Servicio completos
- [x] `store-assets/play-store-listing.md` — Títulos y descripciones ES + EN
- [x] `store-assets/financial-services-declaration.md` — Guía para llenar el formulario de Google
- [x] ProGuard activado en `app.json`
- [x] Permisos Android explícitos declarados en `app.json`
- [x] expo-updates configurado para parches OTA
- [x] Canales EAS (development / preview / production)
- [x] `eas.json` perfil production con chain 56 (BSC Mainnet)

---

## 👤 LO QUE DEBES HACER TÚ — En orden

### PASO 1: Hospedar los documentos legales
- [ ] Comprar o configurar dominio `quatriviumcredit.app` (si no lo tienes)
- [ ] Subir `privacy-policy.html` a `https://quatriviumcredit.app/privacy-policy`
- [ ] Subir `terms-of-service.html` a `https://quatriviumcredit.app/terms`
- [ ] Verificar que ambas URLs sean accesibles públicamente

> 💡 Opción gratis: sube los archivos HTML a GitHub Pages o Cloudflare Pages si no tienes hosting.

---

### PASO 2: Cuenta de Google Play Developer
- [ ] Ir a [play.google.com/apps/publish](https://play.google.com/apps/publish)
- [ ] Crear cuenta de desarrollador — pago único de **$25 USD**
- [ ] Verificar identidad (puede pedir foto de DNI)
- [ ] Crear la app en Play Console con package: `com.quatrivium.credit`

---

### PASO 3: Desplegar el contrato en BSC Mainnet
- [ ] Tener BNB en la wallet deployer para gas (~0.01 BNB)
- [ ] Configurar `ADMINS=`, `FEE_COLLECTOR=` en `.env`
- [ ] Ejecutar: `CONFIRM_MAINNET=yes npm run deploy:bsc`
- [ ] Copiar la dirección del contrato desplegado
- [ ] Actualizar `EXPO_PUBLIC_CONTRACT_ADDRESS_MAINNET` en `eas.json` perfil production
- [ ] Verificar el contrato en BscScan: `npx hardhat verify --network bscMainnet DIRECCION`

---

### PASO 4: Construir el APK de producción
- [ ] Instalar EAS CLI: `npm install -g eas-cli`
- [ ] Login: `eas login`
- [ ] Construir: `eas build --platform android --profile production`
- [ ] Esperar ~10-20 minutos. EAS descarga el APK firmado automáticamente.

---

### PASO 5: Completar el listing en Play Console
- [ ] **Título:** Quatrivium Finance
- [ ] **Descripción corta:** (copiar de `play-store-listing.md`)
- [ ] **Descripción larga:** (copiar de `play-store-listing.md`)
- [ ] **Categoría:** Finanzas
- [ ] **Email de soporte:** soporte@quatriviumcredit.app
- [ ] **Política de privacidad:** https://quatriviumcredit.app/privacy-policy
- [ ] **Subir screenshots** (mínimo 2, ver especificaciones en `play-store-listing.md`)
- [ ] **Subir Feature Graphic** (1024×500px)
- [ ] **Subir el APK** desde EAS

---

### PASO 6: Completar las declaraciones en Play Console
- [ ] Completar cuestionario de **clasificación de contenido** (automático en Play Console)
- [ ] Completar declaración de **Servicios Financieros** (ver `financial-services-declaration.md`)
- [ ] Declarar que la app **no accede a contactos** para gestión de deuda
- [ ] Confirmar que la app es para **mayores de 18 años**

---

### PASO 7: Enviar a revisión
- [ ] Revisar que todo esté completo en Play Console (sin íconos de advertencia ⚠️)
- [ ] Clic en **"Enviar para revisión"**
- [ ] Esperar entre 1-7 días hábiles
- [ ] Si Google pide documentación adicional → responder en máximo 3 días

---

## 📊 Resumen de tiempo estimado

| Tarea | Tiempo estimado |
|---|---|
| Hospedar documentos legales | 1-2 horas |
| Crear cuenta Play Developer | 1 día (verificación) |
| Deploy mainnet | 30 minutos |
| Build EAS production | 20 minutos |
| Completar listing + screenshots | 2-3 horas |
| Revisión de Google | 1-7 días hábiles |
| **TOTAL** | **~3-10 días** |
