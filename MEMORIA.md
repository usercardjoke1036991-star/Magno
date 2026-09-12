# Memoria del proyecto

## Enfoque del usuario
Demo productivo alineado al contrato live; 1000 niveles, bonos y donar quedan listos para el redespliegue

## Decisiones
- [2026-09-12] Donar e inyectar dan reputacion y titulo visible. No hay descuento de prestamo para no farmear el pool.
- [2026-09-12] Tras 100 USDT cada nivel pide 5 prestamos mas. Rangos: 12 piedras/metales con marco SVG distinto.
- [2026-09-12] 1000 niveles. 1-100 intactos. 101-1000 formula en runtime para caber en EIP-170. Live Demo sigue en contrato de 100 hasta redeploy testnet.
- [2026-09-12] Desbloqueo, dinero e inicio de sesion usan el metodo que elija el usuario. El autenticador es TOTP local. El historial mezcla logs on-chain y envios de la app.
- [2026-09-12] Tras Guardar sesion, el telefono solo pide contraseña, PIN o huella. El correo recupera la clave y vincula avisos de pago.
- [2026-09-12] El correo sirve para crear cuenta e iniciar sesion. Se modifica o reemplaza solo en Seguridad, no en Perfil.
- [2026-09-12] Contraseña y frase secreta solo se reemplazan. PIN, huella y llave de acceso se pueden cambiar o quitar.
- [2026-09-12] La UI nombra Cuenta Demo y Cuenta Real. Cada mundo limpia saldo y credito al cambiar. El USDT oficial no se trata como apagado por un RPC caido.
- [2026-09-12] No recortar funciones del nucleo por EIP-170. El protocolo crece con contratos hermanos, cada uno con su propio tope de 24 KB.
- [2026-09-11] La salud continua de Quatrivium se orquesta con python salud_proyecto.py, no solo qa_autonomo generico

## Cambios realizados
- [2026-09-12] Auditoria en vivo: Metro y worker estaban caidos; ADB colgado; RPC Ankr y getLogs tumbaron avisos. Se reanimaron y se filtraron nodos publicos.
- [2026-09-12] Auditoria: la app detecta si el contrato live es de 100 o 1000 niveles; no ofrece donar/cobrar si el ABI no existe
- [2026-09-12] Sala Bonos, bono proporcional 20xnivel, donacion al fundador y titulos de apoyo
- [2026-09-12] Añadido cobrarBonoHito cada 100 niveles (2000 USDT) en núcleo, Leveling, UI e i18n
- [2026-09-12] Curva +5 solicitudes desde 100 USDT y 12 rangos de piedras con marco propio
- [2026-09-12] Escalera de 1000 niveles hasta 1000000 USDT: 1-100 iguales, 101-1000 por formula, cuotas 6/12 en montos altos
- [2026-09-12] Auditoria: autenticador abre la billetera, destruir pide clave, cooldown e historial alineados.
- [2026-09-12] Metodos de seguridad a eleccion, autenticador TOTP e historial de movimientos.
- [2026-09-12] Guardar sesion al crear o entrar. Correo recupera contraseña y se vincula a avisos de pago.
- [2026-09-12] Correo: alta e inicio de sesion. Reemplazo solo en Seguridad. Quitado del Perfil. Iniciar sesion pide codigo al correo.
- [2026-09-12] Verificado en el telefono: Crédito muestra historial y 1/100; Perfil muestra nivel y Bronce. Deep link room/profile abre Ajustes.
- [2026-09-12] Historial de credito visible: a tiempo, mora y penalizaciones. Docs ya no hablan de 10 niveles.
- [2026-09-12] Marco de rango: useWalletLevel ya no recorta a 10; usa clampLoanLevel 1-100.
- [2026-09-12] Montos de prestamo desde 1000 se ven 1.000.00 para no confundir con mas dinero.
- [2026-09-12] Tema Minimalista blanco y negro. Foto de perfil por defecto: silueta gris estilo Facebook.
- [2026-09-12] Apariencia: Claro, Oscuro y Sistema se ven distintos en el selector. Sistema sigue el tema del telefono.
- [2026-09-12] Panel de seguridad sin avisos de reemplazar o no eliminar. La interfaz se entiende por los botones.
- [2026-09-12] Panel de seguridad: contraseña aparte; PIN se puede quitar; huella y llave se apagan; confirmar fondos acepta contraseña.
- [2026-09-12] En espera entre prestamos solo se ve la cuenta atras en vivo, no Solicitar.
- [2026-09-12] Revert vacio en Demo ya no pide pasar a Demo: avisa la espera de 48h.
- [2026-09-12] Signer interno se recupera si HMR lo limpia. errNoWallet ya no pide billetera externa. gitignore cubre __pycache__ y .venv.
- [2026-09-12] Textos Demo/Real recortados a lo esencial: que cuenta es y si vale dinero.
- [2026-09-12] Cuentas Demo y Real visibles y aisladas. Token oficial no se apaga si cae el RPC. Cooldown antes que aviso de token.
- [2026-09-12] Auditoria: Demo alineado con contrato live 3/5. Escalera nueva en QuatriviumLeveling. eas.json production sin testnet. Salud 14/14, Hardhat 85/85.
- [2026-09-12] Ficha de nivel bloqueado: toda la tarjeta es pulsable para desplegar o plegar la info.
- [2026-09-12] Niveles bloqueados: catalogo completo plegable con ficha (monto, tasa, plazo, interes).
- [2026-09-12] Perfil: se quito la paleta de color del avatar; quedan foto y marco de rango.
- [2026-09-12] Primera cuenta: Real. Demo/Real se persiste al cerrar. El APK de tienda ya no fuerza Real ni oculta Demo.
- [2026-09-11] Demo productivo: identidad local si ngrok falla; worker reinicia barrido al cambiar de contrato; ficha de nivel pide Activar si no hay registro; aviso si el atestado demo falla.
- [2026-09-11] Auditoria live del contrato 0x1E5118: mundo nuevo pide Activar (no hereda linea vieja). Cache de credito ahora incluye la direccion del contrato y no barre 100 niveles cada 30s.
- [2026-09-11] Redeploy testnet 100 niveles 0x1E5118B378c7BCB3F3c5de7ec046B93E60f417a3 bloque 130526896
- [2026-09-11] 100 niveles de credito hasta 10000 USDT: tasa del anterior siempre mayor, interes en dolares creciente
- [2026-09-11] Historial de referidos: ABI BonoActivacionPagado, startBlock del contrato, fechas y seccion visible
- [2026-09-11] Auditoria final: caché de crédito no pisa on-chain; pago multi-cuota exige saldo; worker rota RPC ante caídas
- [2026-09-11] Unificado el reloj suizo en salud_proyecto.py (npm run salud / --watch)

## No olvidar / no romper
(puntos críticos)

## Última sesión
[2026-09-12] Cambio: Auditoria en vivo: Metro y worker estaban caidos; ADB colgado; RPC Ankr y getLogs tumbaron avisos. Se reanimaron y se filtraron nodos publicos.
