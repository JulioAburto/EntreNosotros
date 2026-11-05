# Entre Nosotros ❤️ — Fase 2 por etapas para Codex

## Cómo usar este documento

**Objetivo:** implementar el backend y el modo multijugador en el repositorio existente de **Entre Nosotros ❤️**, respetando `docs/FASE-2-SUPABASE.md` como especificación principal. Los jugadores Julio y Naza usarán dos teléfonos distintos para jugar en una misma partida. **Cada pregunta la responde una sola persona**: quien tiene el turno pregunta, el otro responde, y completar alterna los turnos. Ninguna respuesta personal se almacena.

**Ejecución:** abre el repositorio real en Codex, selecciona el modelo y esfuerzo de cada etapa, copia **solo el prompt de esa etapa** y deja que Codex termine, pruebe e informe sus resultados antes de pasar a la siguiente. Trabaja en el mismo repositorio; no reinicialices el proyecto. Las etapas se han separado para minimizar relecturas y permitir revisar errores temprano. Si un modelo no aparece en tu selector, usa GPT-6.1 Sol High para las etapas de Astra, o GPT-6 Sol con el mismo esfuerzo si Sol 6.1 no está disponible.

**Regla de continuidad (aplica a todas las etapas):** Lee `docs/FASE-2-SUPABASE.md`, el estado relevante del repositorio y `docs/FASE-2-ESTADO.md` (si existe). Respeta cambios existentes, incluso cambios sin commit. No inventes credenciales, resultados de pruebas ni capacidades implementadas. Reutiliza los tipos, repositorios, componentes y pruebas cuando sea adecuado. Utiliza TypeScript estricto y App Router, y la documentación oficial de las versiones instaladas. Al cerrar cada etapa, actualiza `docs/FASE-2-ESTADO.md` con: implementado, cambios en archivos, migraciones y comandos ejecutados, pruebas y salidas reales, bloqueos, riesgos, decisiones y siguiente etapa. Evita logs con tokens, correos completos o respuestas íntimas. No publiques GitHub, no hagas despliegues y no modifiques datos cloud de producción sin autorización.

**Elección de modelos:** Sol High para la mayor parte del trabajo; Astra High para SQL/RLS y auditoría de seguridad; Sol Medium para la interfaz y preparación de Vercel. Es una distribución orientativa para calidad/cuota, no una garantía de consumo concreto.

| Etapa | Modelo | Reasoning |
|---|---|---|
| 1. Auditoría y arquitectura | GPT-6.1 Sol | High |
| 2. PostgreSQL, migraciones y RLS | GPT-6 Astra | High |
| 3. Supabase Auth | GPT-6.1 Sol | High |
| 4. Salas e invitaciones | GPT-6.1 Sol | High |
| 5. Motor de partida transaccional | GPT-6.1 Sol | High |
| 6. Repositorio remoto y Realtime | GPT-6.1 Sol | High |
| 7. Interfaz multijugador | GPT-6.1 Sol | Medium |
| 8. Migración del progreso local | GPT-6.1 Sol | High |
| 9. Pruebas integrales y E2E | GPT-6.1 Sol | High |
| 10. Auditoría de seguridad | GPT-6 Astra | High |
| 11. Preparación de Vercel | GPT-6.1 Sol | Medium |

---

## ETAPA 1 — Auditoría técnica y plan de integración
**Modelo:** GPT-6.1 Sol · **Reasoning:** High

### Prompt para Codex

Trabaja en el repositorio existente de **Entre Nosotros ❤️**. Necesito la auditoría que guiará la implementación real de `docs/FASE-2-SUPABASE.md`. No crees un proyecto nuevo.

1. Examina `docs/FASE-2-SUPABASE.md`, `package.json`, lockfile, estructura App Router, tipos, estado, repositorios, ruleta, turnos, preguntas, importación/exportación, `localStorage`, UI, scripts y pruebas. Identifica los cambios sin commit para no sobrescribirlos.
2. Contrasta el documento con el código real. Señala inconsistencias y dependencias entre pasos, particularmente: jugador que pregunta versus quien responde, IDs estables, categorías privadas, número arbitrario de preguntas, estado de partida y transiciones.
3. Verifica si las versiones de Next.js, React, Supabase y dependencias tienen alertas de seguridad conocidas y recomienda una ruta de actualización **compatible y comprobable**, sin actualizar todo indiscriminadamente. Si corresponde instalar herramientas de Supabase CLI, define cómo probarlas localmente.
4. Elige un diseño mínimo para autenticación, salas, almacenamiento, operaciones atómicas y Realtime. Conserva las entidades `games`, `game_members`, `categories`, `questions`, `completions`, salvo justificación concreta. Decide si hacen falta rondas e invitaciones. Explica cómo manejar la posible privacidad del banco inicial si actualmente está en el bundle público.
5. Prepara un mapa de archivos existentes→responsabilidades nuevas, contratos TypeScript que cambiarán, dependencias y riesgos. Identifica si hay un requisito que impediría desplegar sin credenciales o aprobación del propietario.
6. Crea o actualiza `docs/FASE-2-ESTADO.md` con un plan por etapas, estado inicial, verificaciones y próximos pasos. Actualiza documentación solo si es necesario; **no implementes aún Supabase ni refactorices toda la aplicación**.

**Entrega esperada:** diagnóstico fundamentado en rutas reales, decisiones concretas, bloqueos y estado de build/lint/tests de referencia. Ejecuta las comprobaciones que estén disponibles y muestra sus resultados, o indica con precisión por qué no pudieron ejecutarse. No declares implementación terminada.

**Criterio de salida:** ya sabemos qué reutilizar, qué migrar, las versiones efectivas y el orden real de cambios sin perder trabajo previo.

---

## ETAPA 2 — PostgreSQL, migraciones, privacidad y RLS
**Modelo:** GPT-6 Astra · **Reasoning:** High

### Prompt para Codex

Implementa la capa de datos de la Fase 2 de **Entre Nosotros ❤️**, basada en `docs/FASE-2-SUPABASE.md` y las decisiones registradas en `docs/FASE-2-ESTADO.md`. No reinicies el repositorio ni implementes todavía la interfaz multijugador.

1. Diseña e implementa migraciones versionadas de Supabase para `games`, `game_members`, `categories`, `questions`, `completions` y solo las tablas adicionales justificadas (p. ej., invitaciones, operaciones idempotentes o rondas). Incluye índices, claves primarias/foráneas, checks, unicidad, timestamps y cascadas seguras.
2. Asegura **dos posiciones estables por partida**, `0` y `1`: la sala puede tener solo un miembro mientras espera al otro. El límite de dos y la unicidad de posición deben mantenerse incluso ante solicitudes concurrentes. Identifica a los usuarios mediante Supabase Auth, nunca nombres editables. Conserva IDs y texto de las 100 preguntas originales; permite preguntas adicionales sin límite fijo.
3. Separa datos globales y de sala de forma que no se filtren preguntas personalizadas. Determina si los originales, actualmente enviados al cliente, son públicos o requieren servirlos solo a miembros autenticados; deja documentada la decisión, sin prometer privacidad del contenido que ya esté publicado.
4. Activa RLS en todas las tablas expuestas y aplica `REVOKE`/`GRANT` mínimos. Define políticas para miembro, creador, usuario ajeno y anónimo. Evita políticas recursivas y acceso directo a escritura de columnas sensibles (turnos, preguntas activas, membresías, roles). Si una operación requiere privilegios superiores, diseña una ruta controlada, no permisos de escritura amplios al cliente.
5. Si usas funciones `SECURITY DEFINER`, colócalas en un esquema no expuesto, usa `SET search_path = ''`, califica los objetos por esquema, revoca permisos públicos y documenta **cómo las invocará realmente el backend** (no asumas RPC directa desde un esquema privado no expuesto). Prefiere `SECURITY INVOKER` donde alcance.
6. Incluye seeds idempotentes de categorías y preguntas iniciales si los archivos originales están disponibles; si no, detente solo en ese paso, registra el bloqueo y no inventes preguntas. Incluye pruebas SQL locales de permisos, aislamiento entre salas, unicidad y relaciones.
7. Ejecuta migraciones y pruebas con Supabase local si el entorno lo permite. No apliques cambios a una base remota de producción sin autorización. Actualiza el estado y documentación.

**Entrega esperada:** SQL real en `supabase/migrations`, política de acceso documentada, instrucciones para ejecución local y resultados de pruebas. **Criterio de salida:** el esquema puede reconstruirse desde cero y un tercer usuario no puede leer ni alterar la sala privada.

---

## ETAPA 3 — Autenticación con Supabase Auth
**Modelo:** GPT-6.1 Sol · **Reasoning:** High

### Prompt para Codex

Implementa autenticación real para **Entre Nosotros ❤️** sobre la arquitectura existente y las migraciones de la etapa anterior.

1. Integra Supabase Auth con correo electrónico + OTP, incluyendo solicitud de código, verificación, errores, expiración, cierre de sesión y persistencia segura. Crea clientes diferenciados para navegador/servidor con `@supabase/ssr` y cookies conforme a la versión instalada de Next.js.
2. Protege las rutas privadas y valida identidad **en cada operación sensible del servidor**. No dependas únicamente de `middleware.ts` (Next 15) o `proxy.ts` (Next 16). Implementa el archivo apropiado según la versión real. Evita cachés públicas de información privada.
3. Crea el perfil mínimo de usuario vinculado al ID de Auth; el nombre visible puede editarse, pero no determina permisos ni posición en la partida.
4. Proporciona pantallas móviles de login/OTP, estado de sesión y salida. Integra con componentes existentes y evita rediseños amplios.
5. Agrega `.env.example` con nombres de variables, sin valores secretos. Diferencia clave publishable de claves privadas. Documenta las Redirect URLs para localhost y futura URL Vercel, y la necesidad de SMTP de producción; no inventes credenciales.
6. Implementa pruebas unitarias/de integración razonables para protección de rutas, errores de OTP y manejo de sesión. Ejecuta TypeScript, lint y las pruebas disponibles. Si faltan credenciales cloud, verifica localmente lo posible y registra el bloqueo real.

**Criterio de salida:** dos usuarios distintos pueden tener identidades separadas; no se permite acceder a vistas privadas sin sesión válida. Actualiza `docs/FASE-2-ESTADO.md`.

---

## ETAPA 4 — Salas privadas, invitación y segundo participante
**Modelo:** GPT-6.1 Sol · **Reasoning:** High

### Prompt para Codex

Implementa la creación de sala privada y el ingreso autorizado del segundo participante en **Entre Nosotros ❤️**. Usa la base de datos, Auth y los contratos ya implementados; no crees identidades ficticias como sustituto de Auth.

1. Julio (o cualquier usuario autenticado con rol creador) puede crear una sala, ocupar la posición `0` y asignarle nombre. La posición `1` queda reservada para el invitado hasta que se una. El creador genera una invitación compartible.
2. Diseña tokens criptográficamente impredecibles, guardados como hash, con expiración, revocación y uso limitado. El enlace no constituye acceso permanente. Un usuario que abre el enlace debe autenticarse, solicitar acceso y esperar la aprobación del creador antes de convertirse en miembro.
3. La aprobación debe ser atómica: impedir tres miembros, duplicación de posición, carrera entre aceptaciones, reemplazo involuntario de un jugador y elevación de rol. No permitas insertar `game_members` libremente desde el navegador.
4. Implementa operaciones controladas y validaciones de identidad/membresía en servidor o funciones transaccionales correctamente expuestas. Define estados tipados de invitación y errores comprensibles. Aplica límites de frecuencia básicos a intentos de invitación/unión donde la plataforma lo permita.
5. Construye UI mínima y móvil para: crear sala, compartir invitación, solicitar ingreso, aprobar/rechazar y sala esperando al segundo integrante. Conserva estilo romántico.
6. Prueba casos: invitación válida, caducada, revocada, usada, tercero, usuario ya miembro, aprobaciones simultáneas y cambio de dispositivo. Ejecuta los checks disponibles y actualiza documentación.

**Criterio de salida:** solo dos identidades autorizadas pueden ocupar una sala; una tercera identidad no obtiene ni lectura ni escritura de los datos compartidos.

---

## ETAPA 5 — Motor de juego y transacciones atómicas
**Modelo:** GPT-6.1 Sol · **Reasoning:** High

### Prompt para Codex

Implementa el motor autoritativo de **Entre Nosotros ❤️**: selección de preguntas, turnos, completados, saltos y estado consistente de la sala. Debe basarse en el esquema existente y en `docs/FASE-2-SUPABASE.md`.

**Regla fundamental:** una pregunta la responde **solo una persona**. Turno de Julio: Julio pregunta, Naza responde. Al completar, Naza pregunta y Julio responde. El nombre visible no determina el rol; lo determina la posición de miembro persistida.

1. Define contratos TypeScript de `getGameSnapshot`, `reserveQuestion`, `completeQuestion`, `skipQuestion`, `updateGameSettings` y los comandos auxiliares imprescindibles. Las mutaciones críticas deben validar sesión, membresía, rol, revisión/version y estado de la pregunta en servidor.
2. Selecciona **uniformemente** desde el conjunto real de preguntas elegibles: activas, de categorías habilitadas, no completadas, del destinatario que corresponda. Conserva las preguntas saltadas como pendientes y evita repetir la última saltada cuando haya alternativas. Cuando solo quede una elegible, puede volver a salir; cuando no quede ninguna, presenta un estado final claro.
3. `reserveQuestion` debe persistir una sola pregunta activa con protección de concurrencia. Nada de dos resultados distintos según el teléfono. La ruleta visual mostrará el número confirmado por el servidor.
4. `completeQuestion` debe aceptar únicamente al jugador designado como respondedor, insertar una única finalización, limpiar la pregunta activa y alternar el turno **una sola vez** dentro de una transacción. `skipQuestion` mantiene turno, progreso y pregunta disponible.
5. Define semántica segura para cambiar turno manualmente, desmarcar una pregunta, modificar categorías con pregunta activa, eliminar una pregunta que se esté usando y reiniciar partida. No permitas mutaciones directas de las tablas saltándose los comandos.
6. Usa claves de idempotencia y revisiones monotónicas. Prueba doble clic, solicitudes concurrentes, retries, revisiones obsoletas y rollback de operaciones parciales. Devuelve errores tipados (`conflict`, `forbidden`, `not_found`, etc.) sin filtrar errores SQL al usuario.
7. Implementa operaciones en PostgreSQL transaccional o una vía de backend que preserve atomicidad real; no asumas que varias consultas independientes desde un Route Handler equivalen a una sola transacción. Documenta los mecanismos de bloqueo o actualización condicional usados.
8. Ejecuta las pruebas que puedas y actualiza el estado.

**Criterio de salida:** desde dos clientes, cada acción legítima produce exactamente una transición autoritativa, sin duplicados ni turnos adelantados.

---

## ETAPA 6 — Repositorio remoto, sincronización en tiempo real y reconexión
**Modelo:** GPT-6.1 Sol · **Reasoning:** High

### Prompt para Codex

Conecta la aplicación frontend de **Entre Nosotros ❤️** con el backend ya implementado; agrega sincronización entre dos sesiones de usuario sin reemplazar el estado autoritativo de PostgreSQL.

1. Conserva la abstracción de repositorio existente e introduce una implementación remota **asíncrona** con tipos y errores explícitos. El estado debe distinguir `loading`, `saving`, `conflict`, `error`, `offline`, `reconnecting` y `ready`. Evita sobrescrituras enviando JSON entero de la partida.
2. Usa Supabase Realtime sobre eventos autorizados. Para una sala de dos jugadores, evalúa Postgres Changes como opción simple; si eliges Broadcast, implementa autorización de canal privado con RLS. No expongas datos de salas ajenas en canales públicos.
3. Un cambio relevante provoca invalidación/refetch del snapshot autoritativo. Compara versiones monotónicas, coalesce eventos repetidos y evita respuestas HTTP antiguas sobrescribiendo una revisión nueva.
4. Suscríbete y desuscríbete correctamente al montar/desmontar o cambiar de sala. Trata reconexión, cambio de pestaña, sesión caducada, duplicación de eventos y errores de red. Al reconectar, vuelve a consultar el snapshot antes de permitir mutaciones.
5. Una pregunta activa debe sobrevivir a recargas y mostrarse igual en ambos teléfonos. Si se pierde conexión, conserva la pregunta en modo lectura y no simules éxito en operaciones no confirmadas.
6. Prueba con **dos contextos independientes de usuario**. Verifica propagación de pregunta, completado, turno, filtros y pregunta personalizada. Usa mocks solo para pruebas unitarias; los tests de integración deben verificar el backend real cuando sea posible.
7. Ejecuta TypeScript, lint, pruebas y actualiza `docs/FASE-2-ESTADO.md`.

**Criterio de salida:** ambos clientes ven el mismo estado y pueden reconectarse sin corromper el progreso.

---

## ETAPA 7 — Experiencia multijugador mobile-first
**Modelo:** GPT-6.1 Sol · **Reasoning:** Medium

### Prompt para Codex

Integra visualmente el modo multijugador online en la interfaz existente de **Entre Nosotros ❤️**. No rehagas el diseño desde cero ni cambies la lógica transaccional. Conserva la identidad romántica: rosa, vino, crema, acentos discretos, tarjetas legibles, modo claro/oscuro.

1. Completa pantallas existentes o faltantes: inicio, autenticación, sala privada, invitación, espera/aprobación, juego, biblioteca de preguntas, progreso y configuración. Reutiliza componentes y estilo antes de crear otros.
2. Diferencia roles: a quien pregunta, `Vos preguntás — Naza responde` (o nombre correspondiente); al respondedor, `Te toca responder`. Solo el preguntador autorizado puede girar; solo el respondedor confirma. Actualiza etiquetas según el estado autoritativo.
3. La tarjeta activa conserva texto completo, categoría, número y destinatario hasta completar/saltar. La ruleta anima únicamente un resultado ya confirmado por servidor; no muestres selecciones locales ficticias. Incluye `prefers-reduced-motion`.
4. Visualiza conexión/reconexión, errores, permisos insuficientes, final de categoría, ausencia de preguntas elegibles y conflictos por actualización simultánea. Un cambio confirmado debe aparecer en ambos teléfonos sin reload manual.
5. Optimiza desde 320px, área de toque, contraste, navegación con teclado, focus visible, lectores de pantalla, carga y rendimiento móvil. No agregues dependencias innecesarias ni efectos pesados.
6. Añade pruebas de componentes para estados clave y un smoke test responsive si existe Playwright. Ejecuta checks y actualiza documentación.

**Criterio de salida:** dos teléfonos muestran roles y estado coherentes, con UI clara y accesible, sin regresiones de las 100 preguntas existentes.

---

## ETAPA 8 — Migración segura del progreso desde localStorage
**Modelo:** GPT-6.1 Sol · **Reasoning:** High

### Prompt para Codex

Implementa la migración **explícita, verificable y reversible** de la partida local de **Entre Nosotros ❤️** a la sala cloud, siguiendo literalmente el procedimiento de `docs/FASE-2-SUPABASE.md`.

1. Audita formatos locales y respaldos disponibles; identifica la clave heredada del HTML `verdad_o_verdad_julio_naza_v1` si está documentada o presente y la representación actual de IDs, turnos, completados, categorías y destinatarios. No asumas que una web Vercel puede acceder al localStorage de un HTML abierto como `file://` ni al de otro origen.
2. Proporciona exportación JSON desde la versión antigua si es viable y carga/importación explícita en la versión autenticada. Valida tamaño, esquema, versión, IDs, identidad de las preguntas originales y contenido. No inventes o cambies textos.
3. Muestra una **vista previa** antes de importar: número de preguntas, coincidencias, preguntas nuevas, completadas, categorías, jugador asignado a cada posición, conflictos y efecto sobre el progreso cloud. Requiere confirmación explícita para sobrescrituras.
4. Fusiona datos en una transacción idempotente. Conserva IDs y números estables, evita preguntas/completados duplicados, verifica correspondencia de 0/1 con membresías y previene pérdida de información ante un fallo parcial.
5. Trata timestamps epoch heredados como fecha desconocida, **no** como evidencia de respuesta en 1970. Mantén respaldos locales intactos, ofrece resultado resumido y una forma segura de reintentar.
6. Prueba importación repetida, corrupción de archivo, conflicto de identidad, fallo transaccional, grandes bancos, diferencias de versión y rollback. Actualiza documentación y estado.

**Criterio de salida:** los datos anteriores pueden incorporarse con vista previa, autorización y sin modificar silenciosamente el progreso remoto.

---

## ETAPA 9 — Pruebas de integración, concurrencia y E2E
**Modelo:** GPT-6.1 Sol · **Reasoning:** High

### Prompt para Codex

Realiza la validación integral de la implementación de **Entre Nosotros ❤️ Fase 2**. No reemplaces pruebas reales por mocks donde la seguridad y concurrencia dependan de PostgreSQL o Auth.

1. Revisa la cobertura actual y crea pruebas de unidad (dominio/selector/turnos/validación), integración real de DB/RLS/operaciones y Playwright end-to-end de dos contextos independientes.
2. Flujo E2E principal: usuario A inicia sesión y crea sala; invita a B; B solicita y A aprueba; A gira; A y B ven la misma pregunta; B completa; turno cambia una sola vez; B gira; A responde; ambos recargan y recuperan progreso; pregunta completada no se repite.
3. Prueba un **tercer usuario autenticado** y usuario anónimo: prohibir lectura y escritura, incorporación ilícita, enumeración de preguntas, elevación de rol e invitación inválida. Verifica RLS y grants reales.
4. Prueba dos reservas simultáneas, doble completado, petición repetida con misma idempotency key, saltos, revisión obsoleta, eliminar categoría/pregunta activa, cambio de turno, reinicio, conectividad intermitente y reconexión.
5. Verifica importación idempotente de respaldos y conservación de las 100 preguntas originales. Prueba que no se registran respuestas personales, secretos, tokens o respaldos en logs.
6. Ejecuta los comandos concretos de typecheck, lint, unit, integration, build y E2E según scripts reales. Corrige errores pertinentes; si falta Supabase local, configuración SMTP o credenciales de prueba, deja pruebas pendientes explícitas con procedimiento para ejecutarlas, sin simular resultados.
7. Resume cobertura funcional, riesgos, regresiones y resultados reales en `docs/FASE-2-ESTADO.md`.

**Criterio de salida:** evidencia ejecutable de dos usuarios sincronizados y controles de seguridad/concurrencia, con bloqueos declarados.

---

## ETAPA 10 — Auditoría de seguridad y corrección de fallos críticos
**Modelo:** GPT-6 Astra · **Reasoning:** High

### Prompt para Codex

Audita la implementación real de **Entre Nosotros ❤️ Fase 2** como una revisión adversarial de seguridad, privacidad, consistencia y despliegue. Lee las migraciones, funciones, RLS, grants, rutas, autenticación, estado React, Realtime y pruebas; no te limites a recomendaciones generales.

1. Construye un modelo de amenazas específico: usuario anónimo, tercero autenticado, invitación filtrada, sesión caducada, doble envío, cliente malicioso, usuario miembro intentando ejecutar el turno del otro y claves expuestas.
2. Revisa grants y RLS por tabla y operación; prueba aislamiento con tres usuarios. Audita `SECURITY DEFINER`, `search_path`, exposición de esquemas RPC, validación de identidad, tokens de invitación, expiración y autorización por sala. Confirma que los originales/client bundle no se presenten falsamente como privados.
3. Verifica que las operaciones sean atómicas e idempotentes: una pregunta activa, un completado por ronda y pregunta, turnos estables, versiones monotónicas; sin TOCTOU, condiciones de carrera ni bypass directo de tablas.
4. Audita cache de Next.js, protección de Route Handlers/Server Actions, cookies, CSRF/origen cuando aplique, SSR, variables `NEXT_PUBLIC_*`, logs, errores, dependencias con advisories y exposición de tokens en URLs.
5. **Corrige** vulnerabilidades de severidad alta/crítica dentro del alcance y agrega pruebas de regresión. Para cambios peligrosos o destructivos, explica la mitigación y requiere autorización antes de tocar producción. No hagas refactors cosméticos extensos.
6. Produce `docs/FASE-2-AUDITORIA-SEGURIDAD.md`: hallazgo, evidencia en archivo/línea, severidad, explotación conceptual, corrección, prueba y riesgo residual. Actualiza `docs/FASE-2-ESTADO.md`. Declara claramente cualquier prueba no ejecutada.

**Criterio de salida:** ningún fallo crítico conocido sin mitigación ni alertas de falsa sensación de seguridad; se distinguen riesgos reales y supuestos.

---

## ETAPA 11 — Preparación verificable para GitHub y Vercel
**Modelo:** GPT-6.1 Sol · **Reasoning:** Medium

### Prompt para Codex

Prepara **Entre Nosotros ❤️ Fase 2** para desplegarse en **Vercel** con **Supabase Cloud**, sin publicarlo ni crear recursos externos sin mi autorización explícita. Respeta la implementación y decisiones de las etapas previas.

1. Revisa versiones de Next.js/React y dependencias instaladas; aplica únicamente actualizaciones seguras y compatibles que puedas probar. Verifica SSR, rutas privadas, cachés, producción, iconos, metadatos y build.
2. Completa `.env.example`, `.gitignore` y documentación sin incluir credenciales reales. Identifica variables públicas y secretas; valida fallos de configuración sin mostrar secretos. Configura y documenta URLs de Auth/redirect en localhost, Vercel Preview y dominio definitivo.
3. Revisa `supabase/migrations`, seeds y tests: explica cómo desplegar cambios sin borrar datos, cómo revisar permisos, cómo usar un entorno de pruebas separado y cómo verificar una copia de seguridad. Nunca apliques migraciones destructivas a producción sin aprobación.
4. Completa scripts `pnpm install`, `pnpm dev`, `pnpm build`, `pnpm start`, typecheck, lint, unit, integration y e2e de acuerdo con el `package.json` real. Incluye pasos de Windows 11 + PowerShell y Supabase CLI.
5. Actualiza `README.md` y `docs/FASE-2-SUPABASE.md` reflejando **implementado, probado, pendiente y no verificado**. Documenta autenticación/SMTP, invitaciones, RLS, Realtime, migración de localStorage, privacidad, límites/costos potenciales, solución de errores y prueba con dos teléfonos.
6. Ejecuta build y checks realmente disponibles. Prepara un checklist de despliegue con pasos exactos para GitHub → Vercel → variables → migraciones → Auth redirects → smoke tests desde dos usuarios. Si es posible ejecutar entorno preview sin consumir recursos productivos y con autorización, ofrece la opción, pero **no despliegues automáticamente**.
7. Cierra `docs/FASE-2-ESTADO.md` con los resultados reales, riesgos pendientes y pasos manuales concretos.

**Criterio de salida:** proyecto listo para que yo autorice el despliegue, sin secretos expuestos, sin pruebas inventadas y con una guía reproducible desde Windows 11.

---

## Cómo distribuir el esfuerzo sin desperdiciar cuota

- Mantén los 11 prompts en la **misma conversación de Codex y el mismo repositorio** mientras el contexto siga siendo útil; si abrís otra sesión, comienza remitiendo al estado persistido en `docs/FASE-2-ESTADO.md`.
- **No pases a la siguiente etapa** hasta ver el reporte de pruebas y bloqueos de la anterior. Si existen errores que invalidan la siguiente, corrígelos primero con el mismo modelo; para correcciones pequeñas usa **GPT-6 Luna · Low** si aparece en Codex.
- La selección de **GPT-6 Astra · High** para SQL/RLS y seguridad está pensada como control de riesgos, no como razón para repetir toda la implementación.
- En etapas de UI o documentación, comienza con **GPT-6.1 Sol · Medium**; sube a High solo cuando haya un bloqueo técnico real.
- Si no tenés aún un proyecto Supabase Cloud, el trabajo local con Supabase CLI puede avanzar; **Auth e integración cloud no deben declararse comprobadas** hasta ejecutar verificaciones reales.
- Para comprobar tu cuota real de Codex usa **Settings → Usage**. Las cuotas varían según modelo, plan, configuración y complejidad.

## Documentación de referencia

- Next.js App Router: https://nextjs.org/docs/app
- Next.js Proxy: https://nextjs.org/docs/app/api-reference/file-conventions/proxy
- Supabase Auth SSR: https://supabase.com/docs/guides/auth/server-side
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase Database Functions: https://supabase.com/docs/guides/database/functions
- Supabase Realtime: https://supabase.com/docs/guides/realtime/subscribing-to-database-changes
- Vercel deployments: https://vercel.com/docs/deployments
- Model selection: https://developers.openai.com/api/docs/guides/model-selection
- Codex usage: https://help.openai.com/en/articles/20001516-managing-usage-with-gpt-6-astra-in-work-and-codex
