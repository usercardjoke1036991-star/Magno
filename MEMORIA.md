# Memoria del proyecto

## Enfoque del usuario
App DeFi Quatrivium Credit: Demo/Real separados, grafo credito conectado y 100% funcional

## Decisiones
- [2026-09-11] La salud continua de Quatrivium se orquesta con python salud_proyecto.py, no solo qa_autonomo generico

## Cambios realizados
- [2026-09-11] Auditoria live del contrato 0x1E5118: mundo nuevo pide Activar (no hereda linea vieja). Cache de credito ahora incluye la direccion del contrato y no barre 100 niveles cada 30s.
- [2026-09-11] Redeploy testnet 100 niveles 0x1E5118B378c7BCB3F3c5de7ec046B93E60f417a3 bloque 130526896
- [2026-09-11] 100 niveles de credito hasta 10000 USDT: tasa del anterior siempre mayor, interes en dolares creciente
- [2026-09-11] Historial de referidos: ABI BonoActivacionPagado, startBlock del contrato, fechas y seccion visible
- [2026-09-11] Auditoria final: caché de crédito no pisa on-chain; pago multi-cuota exige saldo; worker rota RPC ante caídas
- [2026-09-11] Unificado el reloj suizo en salud_proyecto.py (npm run salud / --watch)

## No olvidar / no romper
(puntos críticos)

## Última sesión
[2026-09-11] Cambio: Auditoria live del contrato 0x1E5118: mundo nuevo pide Activar (no hereda linea vieja). Cache de credito ahora incluye la direccion del contrato y no barre 100 niveles cada 30s.
