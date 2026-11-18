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
