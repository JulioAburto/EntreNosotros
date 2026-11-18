# Bitácora de avance

## 17 de noviembre de 2026 — Integración Supabase, partida compartida

### Implementado en el repositorio

- Autenticación con Supabase SSR y acceso a la sala privada.
- Esquema para salas, invitaciones, comandos de juego, importación explícita y perfil de miembro, mediante cinco migraciones locales.
- Comandos de servidor con control de turno/revisión e idempotencia, gestión de invitaciones y roles de pregunta/respuesta.
- Actualización entre dispositivos bajo demanda: al entrar, recargar o usar **Actualizar partida** se lee el snapshot en base de datos; el cliente remoto no necesita chat, Realtime, WebSockets ni polling.
- Flujos de perfil, vista previa de importación y exportación del estado compartido.
- Documentación de alcance y estado en README y documentos de Fase 2.

### Evidencia de verificación reportada en esta sesión

- Vitest: 34 pruebas en 5 archivos.
- Typecheck, lint y build: completados.
- Pruebas de base local: 73 verificaciones pgTAP y 18 verificaciones HTTP/PostgREST.
- Pruebas locales de Auth: 14 verificaciones.
- Pruebas remotas en local: 45 verificaciones con PostgreSQL, Next y dos contextos Chromium.
- Auditoría de dependencias de producción: sin avisos conocidos; auditoría completa reportó 2 avisos altos de `picomatch` sin parche disponible y 1 moderado de `minimatch`.
- La configuración pública de Auth de Supabase respondió HTTP 200; correo habilitado y registro permitido. No se enviaron correos.

Estos resultados fueron reportados durante la sesión previa y no se volvieron a ejecutar al redactar esta bitácora. El proceso E2E anterior ya no está disponible para recuperar su salida; no se registra como aprobado.

### Pendiente

- Revisar el diff completo y repetir las verificaciones tras la migración final de perfil.
- Resolver/mitigar las dependencias transitivas vulnerables y volver a auditar.
- Probar flujo OTP con entrega de correo real y configurar SMTP/dominios/callbacks.
- Revisar y aplicar migraciones en el proyecto Supabase remoto solo después de inspección y autorización explícita del entorno de producción.
- Validar dos dispositivos reales; Chromium móvil es emulación.
- Mantener respuestas escritas fuera del modelo de datos.

### Límite importante

El código local no demuestra que el proyecto Supabase remoto ya tenga el esquema aplicado ni que el correo OTP esté configurado. No se aplicaron migraciones remotas ni se enviaron correos en esta sesión.

## 18 de noviembre de 2026 — Verificación con la migración de perfil

Docker Desktop y Supabase arrancaron con la base local existente. Las ocho migraciones del repositorio figuran aplicadas en PostgreSQL local, incluida `20261117000500_member_profile.sql`.

| Verificación | Resultado |
| --- | --- |
| Vitest, TypeScript y ESLint | 34 pruebas aprobadas, tipos y lint correctos |
| PostgreSQL y PostgREST | 73 pruebas pgTAP y 18 comprobaciones HTTP aprobadas |
| Autenticación local | 14 comprobaciones aprobadas |
| Playwright | Las 21 pruebas pasaron en serie con el límite original de 30 segundos. En la ejecución inicial con tres trabajadores pasaron 17 y cuatro escenarios de WebKit agotaron el tiempo |
| Sala compartida | 45 comprobaciones aprobadas, incluidos el cambio de nombre, la actualización manual desde dos navegadores y la persistencia del turno al recargar |
| Auditoría de dependencias | Producción sin avisos conocidos. La auditoría completa informó de un aviso moderado de minimatch en herramientas de desarrollo |

La siguiente etapa con infraestructura alojada requiere revisar las migraciones contra el proyecto de destino y validar que cada persona recibe su código de acceso. El formulario de la aplicación admite códigos numéricos de seis a ocho dígitos. La prueba de aceptación en teléfonos consiste en completar una pregunta en un dispositivo y comprobar en el otro que, tras actualizar, coinciden el turno y el progreso.

Julio autorizó aplicar las migraciones al proyecto alojado. Se confirmó el destino a partir de la URL configurada en la aplicación. La CLI devolvió `AccessTokenRequiredError` al intentar vincular el proyecto. Quedan pendientes el inicio de sesión de la CLI, la comparación del historial remoto, la simulación y la aplicación de las migraciones. El intento de vínculo terminó antes de modificar la base.

### Migraciones aplicadas en producción

Tras el inicio de sesión, se vinculó el proyecto EntreNosotros (`ybisxfkpjqvpjtpvdhbw`). El historial remoto estaba vacío. La simulación enumeró ocho migraciones y se aplicaron las ocho. La consulta posterior confirmó que cada versión local coincide con su versión remota, hasta `20261117000500`. Una segunda simulación devolvió `upToDate: true` y cero migraciones pendientes.

Quedan por validar la entrega del código por correo y una partida compartida desde dos teléfonos contra el proyecto alojado.
