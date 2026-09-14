# Digital Asset Links

La app declara `autoVerify` para `https://quatriviumcredit.app/invite` (y `/history`, `/room`).
Sin este archivo en el dominio, Android no abre esos enlaces en la app.

## Qué subir

Copia `store-assets/.well-known/assetlinks.json` a:

```
https://quatriviumcredit.app/.well-known/assetlinks.json
```

HTTPS, `Content-Type: application/json`, **sin** redirección HTTP→HTTPS rota y sin auth.

## Huella SHA-256

Después del primer `eas build --platform android --profile production`:

```powershell
eas credentials -p android
```

O en Play Console → Configuración → Integridad de la app → huella del certificado de firma de Play.

Sustituye `REEMPLAZAR_SHA256_DEL_CERTIFICADO_PLAY_O_EAS` por el valor con dos puntos (`AA:BB:…`).
Si usas Play App Signing, usa la huella **de Google**, no la de upload.
