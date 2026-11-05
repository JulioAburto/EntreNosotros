# Fase 2: una partida privada compartida

Este documento describe una propuesta, no una integración implementada. No requiere crear ahora cuentas, proyectos, secretos ni credenciales.

## Objetivo

Julio y Naza podrán continuar una misma partida desde celulares distintos y administrar preguntas sin intercambiar respaldos. La ausencia de respuestas escritas debe mantenerse por defecto.

## Modelo propuesto

- `games`: identidad de la pareja, turno, pregunta activa, revisión y configuración compartida.
- `game_members`: usuarios autorizados y posición estable de jugador; exactamente dos posiciones por partida.
- `categories`: categorías de la partida con IDs estables.
- `questions`: contenido, número único por partida, activación y destinatario opcional.
- `completions`: una fila por pregunta y partida, fecha y persona que respondió; sin texto de respuesta.
- Preferencias exclusivamente visuales como el tema pueden seguir siendo locales.

La identidad de jugador debe pasar de posiciones 0/1 a membresías estables durante la migración. No se debe inferir la membresía a partir de un nombre editable.

## Acceso privado

Usar autenticación e invitaciones privadas de una sola pareja; limitar los permisos mediante políticas de acceso por fila que verifiquen membresía. Las preguntas personalizadas son privadas tanto en lectura como en escritura.

Validar entradas en el servidor. No confiar en filtros del cliente como control de acceso. Una service-role key nunca debe formar parte del bundle cliente. Definir las variables de entorno y validarlas en módulos exclusivos de servidor cuando se implemente esta fase.

Los originales actualmente se distribuyen con el cliente. Si se requiere que también sean privados frente a visitantes no autorizados, servirlos después de autenticar y retirar el banco del bundle público y del historial público del repositorio, si lo hubiera.

## Operaciones y concurrencia

La transición «reservar pregunta» y «completar y alternar turno» debe hacerse en una transacción del servidor, usando revisión de partida e idempotencia. Dos celulares no pueden completar dos veces la misma pregunta ni avanzar dos turnos por un doble toque.

No basta con enviar el JSON entero después de cada clic. Añadir comandos tipados al contrato del repositorio: reservar, completar, saltar, editar configuración, fusionar banco y obtener snapshot. Un repositorio remoto será asíncrono; el store debe representar carga, envío, conflicto, reintento y desconexión.

La selección se hará sobre el conjunto elegible de la partida autorizada. El servidor será la autoridad sobre progreso y turno. La animación del cliente usará la reserva confirmada, conservando la coherencia entre centro de la ruleta y tarjeta.

Las notificaciones en tiempo real deben provocar la carga de una revisión actualizada. Tras reconexión se consulta el estado vigente antes de reintentar operaciones. No prometer funcionamiento sin conexión ni resolución automática de conflictos hasta implementar y probar esos contratos.

## Migración desde localStorage

1. Autenticar y crear una partida privada.
2. Exportar y validar el respaldo local con el importador existente.
3. Mostrar una vista previa de preguntas, completadas y asignación de jugadores.
4. Confirmar explícitamente la importación remota y ejecutarla en una transacción.
5. Mantener IDs de preguntas y números; asignar nuevos IDs de membresía a destinatarios y turno.
6. Verificar recuentos, identidad de originales y progreso en ambos dispositivos antes de cambiar el repositorio activo.
7. Conservar el respaldo local para recuperación. No borrar datos locales automáticamente.

Revisar las fechas desconocidas marcadas con epoch en migraciones del HTML: son desconocidas, no respuestas realizadas en 1970.

## Pruebas antes de habilitar

- Un usuario ajeno no puede leer ni modificar la partida.
- Dos clientes que completan simultáneamente provocan una sola transición.
- La misma pregunta activa aparece en ambos teléfonos y al reconectar.
- Los filtros, destinatarios y progresos se mantienen coherentes.
- Importar repetidamente un respaldo no duplica preguntas ni completadas.
- Un fallo parcial revierte la transacción y permite reintentar sin pérdida.
- Ningún token, texto íntimo ni respaldo termina en logs.

Las bibliotecas, políticas, límites del proveedor y configuración de Next.js se verificarán contra la documentación oficial vigente al implementar esta fase.
