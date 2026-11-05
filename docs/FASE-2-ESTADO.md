# Fase 2: estado técnico y plan de implementación

Fecha de auditoría: 4 de noviembre de 2026, America/Guatemala.

## Alcance y conclusión

Se leyó completamente `docs/FASE-2-SUPABASE.md` y se contrastó con tipos, rutas, componentes, reglas, store, repositorio, validadores, importadores, generador, dependencias y pruebas existentes. Este documento es el entregable de diagnóstico; las decisiones siguientes son propuestas para implementar después. No se implementaron Auth, SQL, RLS, Realtime ni endpoints, y no se crearon cuentas, proyectos o credenciales.

La aplicación local tiene una base reutilizable y las comprobaciones funcionales pasan. La integración remota exige sustituir la escritura síncrona del estado completo por comandos asíncronos y transacciones; envolver `LocalGameRepository.save()` en una llamada HTTP no resolvería concurrencia, identidad ni autorización.

La carpeta entregada no tiene `.git`: `git status --short` devuelve `fatal: not a git repository`. No es posible determinar rama, commit, archivos previamente modificados ni historial público. No se ejecutó `git init`, instalación, actualización, commit o push. Se conserva el código y la documentación existentes, incluido `Entre_Nosotros_Fase_2_Prompts_Codex.md`, presente durante la auditoría; este diagnóstico toma como contrato la propuesta solicitada en `FASE-2-SUPABASE.md`.

## Estado inicial verificable

### Stack y límites actuales

| Elemento | Estado observado |
| --- | --- |
| Runtime | Node `v24.13.0`; pnpm `10.28.1`, coincide con `packageManager` |
| Next.js | Declarado e instalado `16.4.3`; `eslint-config-next` también `16.4.3` |
| React / React DOM | Declarados e instalados `19.3.1`; cumplen los peers declarados por Next |
| TypeScript | Instalado `5.9.3`; `strict`, `noUncheckedIndexedAccess`, alias `@/*`, resolución `bundler` |
| UI | Tailwind/PostCSS `4.3.3` y Lucide `1.63.0` ya existentes; conservarlos |
| Tests | Vitest `5.0.5`, entorno Node; Playwright `1.64.1`; no hay Jest ni React Testing Library |
| Servicios remotos | No hay SDK Supabase, Auth, SQL/migraciones, Route Handlers, Server Actions ni suscripciones |
| Banco | 100 originales, 10 categorías; IDs `initial-001` a `initial-100`; fuente Markdown verificada contra JSON y HTML |
| Límites de entrada | 10.000 preguntas, 100 categorías, 2.000 caracteres por texto y 5 MiB por archivo |

`src/app/` usa App Router exclusivamente. Las páginas y el layout son Server Components que componen la UI interactiva cliente. `AppShell` inicializa el store tras hidratar y muestra carga hasta disponer de estado; el build actual prerenderiza las rutas como estáticas. No hay protección de acceso. `noindex` y las cabeceras de seguridad de `next.config.ts` no autentican usuarios.

### Comportamiento que debe preservarse

- `currentPlayer` identifica a quien pregunta; la otra posición responde. Completar la activa cambia una sola vez el turno; saltar no lo cambia.
- Marcar una pregunta no activa desde `/preguntas` modifica progreso sin alternar turno. Desmarcar permite volver a seleccionarla. No debe desaparecer este comportamiento al crear el backend.
- La elegibilidad considera categoría habilitada, activación, completado, saltos y destinatario. No se infieren destinatarios por nombre o texto.
- La ruleta guarda la selección antes de terminar su animación decorativa. Centro y tarjeta leen la misma pregunta; no hay sectores vinculados al número total de preguntas.
- El contenido original es inmutable; activación y destinatario sí se pueden cambiar. No se permite editar, eliminar ni reasignar la pregunta activa. Actualmente sí se permite desactivarla desde administración: la tarjeta permanece hasta completar o saltar.
- Progreso y porcentaje incluyen preguntas desactivadas. Los números eliminados no se reutilizan; “nueva partida” reinicia la ronda sobre el mismo banco.
- No se capturan ni almacenan respuestas escritas. Esto se mantiene en esquema, comandos, respaldos y logs.

### Persistencia e importación

`src/types/index.ts` define `GameState.schemaVersion = 2`, jugadores como tupla de nombres y `Player = 0 | 1`. `completed` solo guarda `questionId -> fecha`: no identifica quién respondió. El tema visual vive dentro del mismo estado que el juego.

`src/lib/storage/repository.ts` implementa `load/save/raw` síncronos sobre `entre-nosotros:game`. El token de concurrencia es el JSON previamente leído. Compararlo antes de guardar reduce sobrescrituras, pero lectura y escritura no forman una operación atómica entre pestañas. El evento `storage` solo alcanza el mismo origen; no sincroniza celulares.

`src/features/game/store.ts` es un singleton cliente con `useSyncExternalStore`. Publica estado y errores, bloquea corrupción y conserva datos para recuperación. Ante fallo de escritura puede publicar cambios solo en memoria y devolver éxito: comportamiento local deliberado que no debe trasladarse a mutaciones remotas. La dependencia local se construye dentro de `load()` y no existe un mecanismo público para cambiar repositorio.

La lista completa de saltadas y `sessionCompleted` viven en memoria; solo `lastSkippedId` persiste. Recargar libera las demás saltadas. Hay migraciones explícitas desde el esquema interno v1 y el HTML, con epoch como marcador de fecha desconocida.

Los importadores validan JSON/CSV, versiones, tamaño, fechas, referencias e identidad original; presentan vista previa. `mergeBank()` conserva progreso y turno actuales, deduplica y **renumera las preguntas nuevas**. Fusionar un respaldo no importa sus completadas. `restore()` reemplaza todo el estado local con confirmación. Son dos operaciones distintas: ninguna debe convertirse inadvertidamente en una restauración remota general.

## Dependencias y seguridad

Se consultaron el registro con `pnpm outdated`, `pnpm view` y los avisos oficiales el día de la auditoría. No se actualizaron versiones ni lockfile.

### Hallazgos de seguridad

1. **Next.js necesita una actualización previa a la integración.** Está instalado `16.4.3`; el aviso oficial del 3 de noviembre recomienda `16.4.5`. Incluye problemas de caché, respuestas, cookies Edge y optimización de imágenes. La inspección no encontró Cache Components, `use cache`, `unstable_cache`, rutas Edge, proxy de respuestas ni uso de `next/image` en la aplicación actual. Esto limita la exposición observada, pero no sustituye aplicar el parche antes de añadir sesiones privadas. Mantener `next` y `eslint-config-next` alineados y repetir comprobaciones. [Aviso de noviembre](https://nextjs.org/blog/november-2026-security-release).
2. **Discrepancia real con el escáner:** `pnpm audit --prod` salió con código 0 y sin avisos; no detectó el aviso de Next anterior. No interpretar “0” como certificación de seguridad.
3. **Una vulnerabilidad moderada de herramientas:** `pnpm audit --json` salió con código 1 y reportó `minimatch@10.2.6`, `GHSA-g3hv-75wg-m249` / `CVE-2026-118764`. Se confirmó con `pnpm why minimatch` la ruta a través de `eslint-config-next`, `eslint-plugin-import`, el parser y `typescript-estree`. El aviso describe consumo excesivo de CPU/memoria al procesar patrones controlados por un atacante con `optimizationLevel >= 2`; publica parche `11.0.1`. Priorizar actualización compatible del árbol de ESLint y volver a auditar; no forzar un override de major sin comprobar compatibilidad. [Aviso del mantenedor](https://github.com/isaacs/minimatch/security/advisories/GHSA-g3hv-75wg-m249).
4. React y React DOM `19.3.1` coinciden con la versión `latest` consultada. Los avisos RSC históricos no deben extrapolarse a toda versión 19: revisar paquetes y rangos concretos. El aviso de octubre de Next indicaba parches desde `16.4.1`, anterior a la versión instalada. No se detectó otro aviso de React en esta ejecución; esto es un resultado acotado, no una garantía futura. [Seguridad de Next en octubre](https://nextjs.org/blog/nextjs-security-update-october-14-2026), [aviso RSC de React](https://react.dev/blog/2025/12/03/critical-security-vulnerability-in-react-server-components).

El JSON de auditoría clasifica algunos nodos transitivos de forma poco útil (`dev: false` y contadores de desarrollo en cero). La distinción anterior se basa también en `package.json`, `pnpm why` y la consulta `--prod`, no solo en esos contadores.

### Versiones disponibles y política de cambios

| Dependencia | Instalada | Disponible en la consulta | Decisión para la implementación |
| --- | --- | --- | --- |
| Next / eslint-config-next | 16.4.3 | 16.4.5 | Parche prioritario en un cambio separado |
| React / React DOM | 19.3.1 | 19.3.1 | Conservar y comprobar peers tras actualizar Next |
| Tailwind / PostCSS | 4.3.3 | 4.3.4 | Actualización de mantenimiento separada |
| Lucide | 1.63.0 | 1.68.0 | Sin relación necesaria con Supabase |
| Vitest | 5.0.5 | 5.1.0 | No bloquear integración por migrar de runner |
| ESLint | 9.39.5 | 10.14.0 | Evitar salto de major automático |
| TypeScript | 5.9.3 | 7.0.2 | Mantener versión actual durante la integración |
| @types/node | 24.19.2 | 26.6.6 | Mantener tipos de la rama de runtime elegida |

Dependencias nuevas propuestas para la siguiente fase: `@supabase/supabase-js` y `@supabase/ssr`, necesarias para datos, Realtime y sesiones SSR. Elegir versiones y solicitar aprobación al instalarlas. No añadir ORM, Zod, gestor de estado, biblioteca de consultas o runner de tests nuevo: no son necesarios para este alcance. Conservar validación propia, Vitest y Playwright.

## Módulos reutilizables y modificaciones necesarias

| Módulo existente | Reutilización | Modificación prevista |
| --- | --- | --- |
| `src/app/**/page.tsx`, `layout.tsx` | Rutas, metadatos, composición Server Components | Comprobar sesión/membresía en zona privada y cargar snapshot por petición; añadir login/callback sin cambiar rutas actuales |
| `components/ui/primitives.tsx`, `globals.css` | Componentes, diálogos, accesibilidad y diseño | Solo estados de envío/error cuando lo requieran los formularios |
| `features/game/rules.ts` | Reglas observables y pruebas como especificación; progreso y muestreo por rechazo | Separar catálogo inicial de funciones puras; ejecutar selección/transiciones autoritativas en PostgreSQL y comprobar paridad |
| `features/game/store.ts` | Patrón de snapshot y suscripción React | Inyectar repositorio, esperar comandos, representar carga/envío/conflicto/desconexión, limpiar por sesión/partida y descartar respuestas antiguas |
| `lib/storage/repository.ts` | Adaptador local para recuperación y compatibilidad | Mantenerlo; añadir contrato remoto asíncrono aparte, sin fingir que `save(state)` remoto conserva garantías |
| `types/index.ts` | Modelos de categorías/preguntas y archivos locales como contrato legado | Añadir snapshot/comandos remotos y `MemberId`; separar preferencias visuales; no reinterpretar 0/1 como IDs Auth |
| `lib/validation/schema.ts` | Primitivas, límites y validación de archivos históricos | Separar validación genérica de identidad del catálogo; añadir validación de comandos y constraints SQL equivalentes |
| `lib/import-export/csv.ts`, `legacy.ts` | Parser y lectura de formatos existentes | Traducir al DTO de migración; representar fecha y autor desconocidos sin inventarlos |
| `lib/import-export/index.ts` | Parseo, normalización, vista previa, deduplicación y exportación | Separar descarga de funciones puras; distinguir fusión cotidiana de migración inicial; versionar respaldo remoto |
| `data/questions.json`, `data/categories.ts`, generador y referencias | Semilla e integridad de originales | Llevar catálogo a semilla/validación exclusiva de servidor para modo privado; conservar fuentes sin modificarlas en esta etapa |
| `components/roulette/game.tsx` | Animación, tarjeta, foco y movimiento reducido | Esperar reserva confirmada; mostrar envío y conflictos; animar solo el resultado vigente y cancelar temporizador al cambiar sesión/reserva |
| `roulette/category-filters.tsx` | Controles y presets | Configuración compartida validada por servidor; deshabilitar durante comandos incompatibles |
| `questions/*` | Formularios, búsqueda, listado, confirmaciones y previews | Acciones async, errores por operación, membresías y conflicto de revisión; revalidar formularios abiertos frente a cambios remotos |
| `settings/settings-page.tsx`, `layout/app-shell.tsx` | Tema, navegación, recuperación local y avisos | Separar tema local; autenticación, cierre de sesión, limpieza de estado privado, copy de privacidad real y confirmaciones remotas |
| `progress/progress-page.tsx`, `home.tsx` | Totales, porcentajes y presentación | Proyectar snapshot confirmado; mantener “en esta sesión” como métrica local explícita |
| `src/tests/*`, `e2e/game.spec.ts` | Regresión de originales, reglas, formatos y UX | Añadir tests de store async, contratos remotos, SQL/RLS y dos contextos autenticados |

## Arquitectura mínima propuesta

### Capas y límites

```text
Server Components privados ── sesión verificada ── servicio de partida
UI cliente ── store async ── repositorio HTTP ── Route Handlers App Router
                                                │ JWT del usuario
                                                ▼
                                  RPC PostgreSQL + RLS + constraints
                                                │ commit + revisión
UI cliente ◀── Supabase Realtime: games UPDATE ───┘
                 └── volver a consultar snapshot autorizado
```

Mantener Server Components para acceso inicial; reservar Client Components para interacción y suscripción. Las mutaciones pasan por Route Handlers Node en `src/app/api/games/[gameId]/**/route.ts`; autenticación callback en App Router. Un servicio exclusivo de servidor comparte lógica entre páginas y handlers, sin que los Server Components hagan HTTP a su propia aplicación. Elegir esta única entrada HTTP para comandos evita duplicar los mismos casos en Server Actions.

Crear, cuando corresponda, módulos pequeños en `lib/supabase/{browser,server,env}.ts`, un servicio de partida exclusivo de servidor y un adaptador remoto del repositorio. Las migraciones SQL versionadas irán en `supabase/migrations/`. Son ubicaciones previstas; no se crearon en esta auditoría.

Auth usa cookies mediante `@supabase/ssr`, `await cookies()` y renovación con `src/proxy.ts` conforme a Next 16. Verificar identidad con `getClaims()` o `getUser()` según el caso; no autorizar confiando solo en `getSession()`. La comprobación de membresía ocurre también en cada lectura/comando y dentro de PostgreSQL. No cachear globalmente snapshots, HTML privado ni respuestas con cookies; respuestas privadas con `Cache-Control: private, no-store`. [Guía SSR oficial](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [cookies async](https://nextjs.org/docs/app/api-reference/functions/cookies).

Proponer invitaciones administrativas a las dos identidades, sin registro público ni pantalla genérica de gestión de parejas. El alta inicial crea partida y las dos membresías en una transacción cuando se conocen ambos IDs Auth. No crear partida utilizable con un tercer miembro o con posiciones ambiguas. Configurar redirecciones Auth permitidas y HTTPS al desplegar. La política de esta fase mantiene controles compartidos para ambos miembros, como en la UI local: registrar por separado actor autenticado y persona que respondió.

Variables previstas: `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, validadas sin aserciones `!`. La clave publicable no sustituye RLS. Una eventual credencial administrativa para invitaciones queda en tooling seguro o módulo exclusivo de servidor, nunca `NEXT_PUBLIC_*`, snapshot, log o bundle. El tráfico normal opera con JWT de usuario y no necesita service-role. No crear `.env` con valores en esta etapa.

En handlers: validar tamaño y contenido antes de ejecutar; verificar Origin frente al origen permitido para mutaciones con cookies, no habilitar CORS abierto y no mutar vía GET. Usar parámetros de RPC; no concatenar SQL. Mostrar errores públicos acotados y no registrar tokens, cookies, correos, textos de preguntas o respaldos.

### Las cinco entidades de dominio

| Entidad | Datos y restricciones mínimas propuestas |
| --- | --- |
| `games` | UUID, `revision` monotónica, miembro que pregunta, pregunta activa, siguiente número, filtros y saltos compartidos. La configuración estructurada puede usar JSONB acotado y validado; no guardar todo `GameState` como un blob |
| `game_members` | UUID estable, `game_id`, `user_id` de Auth, posición 0/1 y nombre visible. `UNIQUE(game_id, position)`, `UNIQUE(game_id, user_id)` y check de posición; creación controlada de ambas filas |
| `categories` | Clave `(game_id, id)` con ID de texto estable; nombre, color y origen. Conservar categorías iniciales e impedir alteración de su identidad |
| `questions` | Clave `(game_id, id)`; número único por partida, contenido, categoría, origen, fecha, activación y `intended_responder_member_id` nullable. Asignar números bajo bloqueo de partida |
| `completions` | Clave única `(game_id, question_id)`; fecha de respuesta y membresía de quien respondió, ambas desconocidas si el respaldo no las contiene; procedencia de importación y actor que registró la operación, sin texto de respuesta |

Usar claves foráneas compuestas para impedir referencias a categorías, preguntas, destinatarios o turnos de otra partida. UUID para partida/membresía; conservar IDs de texto actuales en preguntas y categorías. Un `CHECK(position IN (0,1))` y un índice único solo garantizan **hasta** dos miembros: completar la garantía de dos posiciones mediante bootstrap transaccional y prohibición de altas/bajas directas. No eliminar membresías referenciadas como historial; revocar acceso mediante flujo controlado.

Fechas nuevas: reloj de PostgreSQL en UTC. Epoch legado se convierte en fecha desconocida (`NULL` con procedencia); no afirmar que ocurrió en 1970. El respaldo local tampoco permite reconstruir quién respondió cada pregunta, aunque sí conozca nombres y turno actual. Mantener `responder_member_id = NULL` en ese historial y no atribuirlo al importador. Para completados nuevos el servidor exige/resuelve una persona válida; si se marca una no activa desde la lista, el contrato debe permitir indicar respondiente o mantenerlo explícitamente desconocido, sin inventar una respuesta histórica.

Normalización de texto: preservar NFC, espacios y minúsculas de `normalizedText()`, con pruebas de paridad Unicode en servidor/SQL antes de imponer unicidad. No asumir equivalencia entre `lower()` y `toLocaleLowerCase('es')`. Para el tamaño del MVP se acepta serializar mutaciones por partida; índices por `game_id`, usuario, número y referencias. Evitar validar/buscar originales repetidamente con recorridos cuadráticos en cada comando.

### Autorización y transacciones

RLS habilitada en las cinco tablas, sin permisos de lectura para `anon`. SELECT autorizado por membresía, tanto para HTTP como para Realtime. Evitar una política autorreferencial de `game_members` que cause recursión: helper de membresía privado y revisado, con privilegios mínimos. Indexar el acceso por `user_id` y `game_id`. [RLS oficial](https://supabase.com/docs/guides/database/postgres/row-level-security).

**RLS de membresía por sí sola no protege turnos.** Revocar INSERT/UPDATE/DELETE directos a clientes en tablas de dominio. Las escrituras solo se realizan mediante RPC estrechas que verifican `auth.uid()`, membresía, referencias y reglas. Para escribir con DML revocado, estas funciones requieren privilegios controlados (`SECURITY DEFINER`), `search_path` fijo/vacío, nombres de esquema explícitos y EXECUTE revocado a PUBLIC/anon; conceder únicamente a authenticated. No aplicar definer indiscriminadamente: probar cada frontera, incluidas llamadas directas que eludan Next. [Seguridad de funciones](https://supabase.com/docs/guides/database/functions).

Cada mutación lleva `commandId` UUID y `expectedRevision`. Hace falta un registro persistente de idempotencia: se propone una tabla técnica privada `command_receipts`, fuera del modelo de dominio, con clave `(game_id, command_id)`, actor, huella del payload y resultado mínimo sin contenido íntimo. La unicidad de `completions` evita duplicar filas, pero no basta para idempotencia después de desmarcar o reiniciar progreso. No basta con guardar solo el último comando en `games`.

Dentro de una transacción: comprobar identidad/membresía, bloquear `games` con `FOR UPDATE`, buscar recibo antes de exigir revisión, rechazar reutilización de ID con distinto actor/payload, validar revisión y precondiciones, aplicar cambio, incrementar revisión y guardar recibo. Un replay devuelve el resultado ya registrado sin repetir la transición; una revisión obsoleta devuelve conflicto. No borrar recibos al reiniciar progreso. Definir cualquier retención futura junto con un plazo verificable de reintento.

Obtener snapshot mediante una sola consulta/RPC coherente con revisión, no ensamblar consultas independientes de tablas mientras otros comandos escriben. Toda mutación compartida, incluso pregunta/categoría, debe incrementar `games.revision`; de lo contrario la suscripción no avisaría del cambio.

### Contrato remoto y store

El contrato local actual se mantiene para datos existentes. Añadir un contrato remoto que devuelva Promises y DTOs con membresías; no enviar el estado completo para cada clic.

| Comando/consulta | Semántica propuesta |
| --- | --- |
| `getSnapshot(gameId)` | Snapshot consistente autorizado con revisión, membresías y pregunta activa |
| `reserveQuestion(meta)` | Servidor selecciona uniformemente del conjunto elegible; guarda reserva y responde con pregunta/revisión confirmadas; no confía en pregunta propuesta por cliente |
| `completeQuestion(meta, questionId)` | Exige que coincida con la activa; registra respondiente, libera pregunta y alterna una vez |
| `skipQuestion(meta, questionId)` | Exige activa vigente; mantiene turno, libera y agrega a exclusiones compartidas |
| `updateSettings(meta, patch)` | Filtros, nombres y turno manual con reglas; no incluye tema ni permite sustituir membresías |
| `mergeBank(meta, bank)` | Fusión cotidiana con deduplicación y numeración del servidor; conserva progreso y configuración |
| Comandos de administración | Crear/editar/eliminar custom, activación, destinatario y categoría; protección de originales y activa |
| `setCompletion(meta, questionId, completed, responder?)` | Preserva semántica de lista; completar la activa usa la misma transición que `completeQuestion` |
| `recoverSkipped` / `resetRound` | Recuperación explícita o nueva ronda; confirmación antes de borrar progreso; banco y membresías se conservan |
| `importLocalBackup(meta, validatedBackup, playerMapping)` | Migración inicial transaccional específica, con IDs y números preservados; distinta de fusión y de reemplazo arbitrario |

`meta` contiene partida, revisión esperada e idempotencia; el actor se deriva del JWT, nunca del payload. Respuestas discriminadas: éxito/replay con revisión, conflicto, entrada inválida, sesión vencida, acceso denegado y error recuperable. Separar ausencia de elegibles de fallo de red.

El store representa carga inicial, envío pendiente, conflicto, reintento y desconexión; conserva el último snapshot confirmado. No alterna turnos ni marca completadas optimistamente. Un timeout puede haber ocurrido después del commit: consultar snapshot y reintentar el mismo `commandId`, nunca generar automáticamente otra operación. Descartar snapshots de revisión menor y respuestas de una sesión/partida anterior. Al salir, cancelar suscripciones/peticiones y vaciar preguntas privadas de memoria; no copiar respaldo remoto completo a localStorage por defecto.

La UI de ruleta puede mostrar espera al enviar, pero solo anima y muestra la reserva confirmada. Un bloqueo local evita doble toque accidental; no reemplaza el bloqueo SQL. Ante cambio remoto de la activa, cancelar animación obsoleta y mostrar el estado vigente. Formularios esperan respuesta antes de cerrarse y conservan entrada si hay conflicto.

### Realtime y desconexión

Para dos dispositivos basta Postgres Changes sobre UPDATE de `games`, filtrado por ID y autorizado por RLS, con publicación configurada explícitamente. No suscribir textos de todas las tablas ni añadir Presence/Broadcast para el MVP. El filtro de canal no es control de acceso. [Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes).

El evento invalida el snapshot; no aplica parches confiando en orden de entrega. Suscribirse y sincronizar al confirmar conexión, volver a consultar tras reconexión/foco, agrupar avisos y no retroceder de revisión. Consultar también después de cada comando. Ante caída del canal mostrar desconexión y revalidar antes de nuevas mutaciones o reintentos; al revocar membresía o vencer sesión, bloquear acceso y limpiar estado. No prometer modo offline, colas durables ni fusión automática de conflictos.

Decisión ajustada al juego compartido: llevar la lista de saltadas a configuración de `games`, compartida hasta “recuperar” o “nueva ronda”; no reiniciarla cuando un celular recarga. Conservar `lastSkippedId` para traducir el respaldo legado. Esto cambia la duración de los saltos frente a la visita local y debe reflejarse en copy y tests. `sessionCompleted` sigue siendo un contador visual por dispositivo, explícitamente local.

### Privacidad del catálogo

Propuesta: proteger también los originales en el modo remoto. Actualmente se distribuyen por `rules.ts -> data/questions.json` y por validación/importadores que importan esas reglas. Mover solo el import directo de la ruleta sería insuficiente. Separar funciones genéricas, catálogo servidor y adaptadores locales/legados; inspeccionar el grafo y los chunks de producción, incluidas pantallas de login/administración, para confirmar que no incluyen el banco sin autenticar.

Conservar las referencias originales para integridad y migración en tooling privado. No alterar ni reescribir historial en esta auditoría. Si existió publicación previa, proteger despliegues/artefactos e historial requiere una tarea explícita adicional; aquí no hay Git para comprobarlo. Actualizar README y los textos de privacidad/configuración cuando cambie el modo de almacenamiento.

## Migración de los datos locales

1. Ofrecer acceso al respaldo local antes de cambiar la inicialización del store. No generar una partida remota vacía y sustituir silenciosamente los datos existentes.
2. Autenticar ambos usuarios invitados y crear las dos membresías estables. La UI presenta asignación explícita `posición 0 -> memberId`, `posición 1 -> memberId`; los nombres son etiquetas editables.
3. Exportar y validar con el importador existente; revalidar en servidor. Mostrar cantidades, categorías, activa, filtros, turno, fechas desconocidas y autoría desconocida. Un banco/CSV sin estado no es respaldo completo.
4. Confirmar importación remota explícitamente. Permitir migración inicial solo a la partida sin actividad; detectar colisiones o actividad concurrente con revisión. No restaurar sobre progreso remoto existente por defecto.
5. En una transacción conservar IDs de pregunta/categoría, números, `nextQuestionNumber` y originales; mapear destinatarios y quien pregunta a membresías. Importar completadas como historial, sin simular clics que alternen turnos. Conservar activa y última saltada válidas.
6. Registrar huella del respaldo validado y asignación como clave de migración estable. Un segundo intento con otro `commandId` también debe reconocer la misma migración y no duplicar ni resucitar progreso antiguo; el recibo técnico persiste tras reinicios. Un archivo distinto o mapeo distinto exige revisión y resolución explícitas.
7. Consultar snapshot y verificar IDs/contenido original, recuentos, progreso, activa, filtros y turno en ambos dispositivos antes de activar el repositorio remoto. Conservar localStorage y archivo de respaldo; nunca borrarlos automáticamente.

Mantener lectores de banco v1, backup v1/v2 y HTML. Para exportar membresías, respondientes y fechas nullable sin pérdida, diseñar backup remoto versionado (propuesto v3); no reutilizar silenciosamente `BackupFile.version = 2`. Exportar IDs de membresía como referencia a mapear al importar en otra partida, nunca tokens ni credenciales. La validación remota no debe convertir una fecha desconocida en fecha real para satisfacer el esquema local.

## Comprobaciones ejecutadas

| Comando | Resultado real |
| --- | --- |
| `node --version` / `pnpm --version` | `v24.13.0` / `10.28.1` |
| `pnpm list --depth 0` | Dependencias instaladas coinciden con versiones base indicadas |
| `pnpm questions:check` | Código 0; 100 originales, diez por categoría, texto y numeración intactos |
| `pnpm test` | Código 0; **4 archivos, 30 pruebas aprobadas** |
| `pnpm lint` | Código 0; sin errores ni warnings de ESLint |
| `pnpm typecheck` | Código 0; sin errores TypeScript |
| `pnpm build` | Código 0; Next 16.4.3/Turbopack compiló y generó las 9 páginas estáticas del build |
| `pnpm test:e2e --config .fase2-audit-20261104/playwright.audit.config.ts` | Código 0; **21/21 aprobadas**, siete casos por proyecto: chromium, mobile-chromium y mobile-webkit; duración informada 1,0 min |
| `pnpm audit --json` | Código 1; un aviso moderado de minimatch, cero altos/críticos reportados por el escáner |
| `pnpm audit --prod` y `--prod --json` | Código 0; sin vulnerabilidades reportadas; véase aviso oficial de Next no detectado |
| `pnpm outdated` / `pnpm view` / `pnpm why minimatch` | Consultas realizadas; versiones disponibles y cadena vulnerable documentadas arriba |
| `git status --short` | No ejecutable como revisión Git: carpeta sin metadatos `.git` |

E2E se ejecutó sobre el build recién generado, con servidor propio en puerto 3100 y `reuseExistingServer: false`. Se copiaron temporalmente configuración y spec: los escenarios/aserciones no cambiaron, solo las rutas de capturas/resultados se aislaron para preservar `test-results/` anterior. Se observaron avisos de Node por coexistencia de `NO_COLOR` y `FORCE_COLOR`, sin fallo de pruebas. Las copias temporales se retiran tras la verificación. Chromium móvil y WebKit son emulaciones, no teléfonos físicos.

Los scripts disponibles son `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `test:watch`, `test:e2e`, `questions:generate` y `questions:check`. `build` ya exige integridad del banco. Los scripts de servidor escuchan en `0.0.0.0`; no se cambió esa configuración. No se ejecutó `questions:generate` porque reescribiría el banco sin necesidad, ni `test:watch` por ser interactivo. No hay script de cobertura ni pipeline CI en el inventario inspeccionado.

Las pruebas actuales cubren reglas puras, originales, parser/importaciones, migración, errores del adaptador local y UI local. No hay pruebas unitarias del singleton/store ni de formularios aislados; los E2E sí recorren formularios. Los tests de “doble completado” verifican reglas locales secuenciales, no concurrencia distribuida. No se probaron RLS, Auth o Realtime porque aún no existen; no se debe presentar la suite verde como validación del backend futuro.

## Riesgos y prioridades

| Prioridad | Riesgo | Acción y evidencia de cierre |
| --- | --- | --- |
| P0 antes de desplegar datos privados | Dependencia Next anterior al parche oficial | Actualizar Next/config, revisar transitorios y repetir tests/build/audit contra avisos oficiales |
| P0 | Lectura o escritura de otra partida, RPC que eluda turnos | RLS, grants y funciones probadas desde cliente ajeno/anon y llamadas directas |
| P0 | Completar/saltar/reservar con revisión obsoleta o timeout | Bloqueo, revisión y recibos persistentes; carreras de dos clientes y replay probado |
| P0 | Pérdida o atribución falsa durante migración | Preview/mapeo explícitos, transacción y recuentos; fechas/autor desconocidos preservados |
| P1 | Catálogo privado en chunks, caché de sesión o logs | Separación del grafo, `no-store`, revisión de build y logs/trazas con datos sintéticos |
| P1 | Dispositivos divergen por saltos o eventos perdidos | Saltos compartidos, snapshot coherente y reconsulta al reconectar/foco |
| P1 | Formularios o singleton conservan datos de otra sesión | Cancelación/limpieza, revisión de formularios y pruebas de logout/login |
| P1 | DoS moderado en tooling minimatch | Resolver vía árbol compatible; no ejecutar globs de origen no confiable |
| P2 | Validación costosa y snapshot de 10.000 preguntas | Medir límites/payload; usar índices/maps y evitar recorridos cuadráticos; paginar si mediciones lo exigen |

## Etapas y criterios de aceptación

1. **Preparación y contrato.** Actualizar el parche de Next en un cambio separado; resolver o acotar aviso de minimatch; fijar DTOs remotos, errores, backups v3 y política de saltos. Separar catálogo/validación sin cambiar reglas observables. Cierre: suite actual verde, contrato escrito y originales intactos.
2. **Persistencia y aislamiento.** Crear migraciones de las cinco entidades, recibos técnicos, constraints, grants, RLS y bootstrap privado. Cierre: anon/tercero no leen ni escriben; referencias cruzadas y tercer miembro rechazados; rollback probado. Todavía sin cambiar el repositorio activo.
3. **Auth SSR.** Instalar las dos dependencias aprobadas; añadir clientes separados, env validado, invitación/login/callback, renovación y límites de caché. Cierre: dos identidades correctas, sesión vencida/revocada controlada y datos privados ausentes de respuestas públicas/bundle.
4. **Comandos y adaptación de UI.** Implementar RPC transaccionales, servicio/handlers, repositorio y store async; adaptar ruleta/formularios/lista/configuración. Cierre: reserva y completado simultáneos causan una sola transición; completar vs. saltar tiene un único ganador; replay tras timeout no duplica; una mutación fallida no aparece confirmada.
5. **Migración y respaldos.** Implementar preview, mapeo, importación inicial atómica, huella de migración y exportación remota versionada. Cierre: importar repetidamente no duplica; colisiones no sobrescriben; fallo parcial revierte; IDs/números y progreso se verifican sin borrar localStorage.
6. **Realtime y habilitación.** Publicación `games`, suscripción autorizada, limpieza y reconexión; actualizar privacidad/README. Cierre: ambos contextos ven misma activa/turno/filtros/progreso y convergen después de desconexión, incluso si se perdieron eventos. Probar sesión vencida, logout, eventos duplicados y respuestas HTTP fuera de orden.

Para las etapas de backend, añadir pruebas de integración contra Supabase de prueba/local con fixtures sintéticos y dos sesiones independientes; no usar cuentas ni preguntas íntimas reales en trazas CI. Mantener Vitest para dominio/contratos y Playwright para navegador. No añadir una biblioteca nueva sin aprobación.

## Supuestos y pendientes explícitos

- Una sola pareja, dos identidades autenticadas y una partida activa compartida; no se diseña una plataforma multiusuario general.
- Ambos miembros pueden operar los controles compartidos. El actor de un comando no se confunde con quien respondió. Restringir acciones al dispositivo de cada rol sería una decisión de producto adicional.
- Los originales serán privados en modo remoto; el modo local legado permanece disponible como fuente de migración/recuperación, sin cargar su catálogo desde páginas públicas del modo privado.
- Nuevos saltos compartidos duran hasta recuperarlos o iniciar ronda; no existe un concepto remoto de “visita” basado en recargar un teléfono.
- Proveedor de correo, dominios de callback, entorno de pruebas y despliegue todavía deben configurarse al implementar. No hacen falta credenciales para completar este diagnóstico.
- Esta etapa termina aquí: el backend y su seguridad quedan pendientes de implementación y pruebas; no hay integración Supabase habilitada.
