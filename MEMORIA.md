# Memoria del proyecto

## Enfoque del usuario
App DeFi Quatrivium Credit: Demo/Real separados, grafo credito conectado y 100% funcional

## Decisiones
- [2026-09-12] La UI nombra Cuenta Demo y Cuenta Real. Cada mundo limpia saldo y credito al cambiar. El USDT oficial no se trata como apagado por un RPC caido.
- [2026-09-12] No recortar funciones del nucleo por EIP-170. El protocolo crece con contratos hermanos, cada uno con su propio tope de 24 KB.
- [2026-09-11] La salud continua de Quatrivium se orquesta con python salud_proyecto.py, no solo qa_autonomo generico

## Cambios realizados
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
[2026-09-12] Cambio: En espera entre prestamos solo se ve la cuenta atras en vivo, no Solicitar.
