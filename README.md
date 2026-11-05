# Entre Nosotros ❤️

Un juego de conexión para Julio y Naza: uno pregunta y el otro responde. Una evolución del HTML original en Next.js App Router, React y TypeScript, con persistencia local, administración de preguntas y respaldos.

## Ejecutar

Recomendado: **Node.js 24 LTS** y **pnpm 10.28.1**. También es compatible Node 22.12+ dentro de la rama 22; el requisito incluye las herramientas de prueba.

```bash
corepack enable
corepack prepare pnpm@10.28.1 --activate
pnpm install
pnpm dev
```

Abre `http://localhost:3000`. No necesitas variables de entorno, cuentas ni una base de datos. Si tu instalación de Node no incluye Corepack, instala pnpm siguiendo su documentación oficial.

Para probar desde el celular, conecta ambos dispositivos a la misma red y abre `http://IP_LOCAL_DE_TU_PC:3000`. El servidor escucha en `0.0.0.0`; permite el puerto en el firewall solo para tu red privada. Cada origen y dispositivo tendrá un progreso independiente. Detén el servidor al terminar de usarlo.

Producción local:

```bash
pnpm build
pnpm start
```

## Cómo jugar

1. Entra en **Jugar** y elige quién pregunta primero.
2. Si Julio pregunta, solo Naza responde. Si Naza pregunta, solo Julio responde.
3. Gira la ruleta. El resultado se elige uniformemente entre las preguntas elegibles y se guarda antes de terminar la animación.
4. La tarjeta permanece hasta completarla o saltarla. Recargar o navegar a otra sección no la completa ni la pierde.
5. **Naza ya respondió** / **Julio ya respondió** registra una sola pregunta completada y cambia el turno una sola vez.
6. **Saltar por ahora** conserva el turno y deja la pregunta pendiente. Las saltadas se excluyen durante la visita; la última saltada también se conserva al recargar. **Recuperar preguntas saltadas** las vuelve a habilitar explícitamente.

Cambiar el turno manualmente está disponible cuando no hay una pregunta activa. Una nueva partida permite elegir quién empieza y conservar el progreso o borrarlo con confirmación. Las preguntas personalizadas se conservan al reiniciar el progreso.

No se almacenan respuestas ni se solicita escribirlas. La categoría de sexualidad está desactivada inicialmente, igual que en el HTML de referencia. La selección «Sin preguntas íntimas» excluye intimidad emocional y sexualidad.

### Destinatarios y textos originales

Los textos se mantienen **exactamente** como están escritos, incluidas las referencias específicas a Naza. No se infieren destinatarios por género, redacción o nombre. En **Administrar → Destinatario** puedes asignar explícitamente una persona a cualquier pregunta, sin cambiar su texto o progreso. Esa pregunta solo participa cuando le toca responder a esa persona.

Sin destinatario asignado, la pregunta sigue el turno general; pueden saltarla si no corresponde. La asignación identifica la posición de jugador (0 o 1), de modo que cambiar los nombres no rompe el vínculo. No se puede editar, eliminar ni cambiar el destinatario de la pregunta que está en conversación.

## Pantallas

| Ruta | Función |
| --- | --- |
| `/` | Inicio, nombres y resumen de progreso |
| `/jugar` | Ruleta, turnos individuales, tarjeta y categorías |
| `/preguntas` | Búsqueda, filtros y checkboxes de completado |
| `/progreso` | Totales, porcentajes, categorías y sesión |
| `/administrar` | Preguntas, destinatarios, categorías, importación y respaldos |
| `/configuracion` | Nombres, tema, nueva partida, recuperación y privacidad |

Marcar la pregunta activa desde la lista también completa su turno. Marcar otras preguntas no cambia el turno. Desmarcar devuelve una pregunta a la selección si su categoría, activación y destinatario permiten seleccionarla. El progreso incluye todas las preguntas, incluso desactivadas.

## Fuentes de las preguntas

- `preguntas-originales.md`: fuente de verdad del texto y la numeración.
- `preguntas-originales.json`: referencia estructurada, comprobada contra el Markdown.
- `Verdad_o_Verdad_Julio_y_Naza_v2.html`: referencia preservada de diseño, interacción y estado legado. No se incrusta ni se ejecuta dentro de Next.js.
- `src/data/questions.json`: banco generado con IDs estables `initial-001` a `initial-100`.

```bash
pnpm questions:generate
pnpm questions:check
```

El generador exige exactamente 100 originales, numerados del 1 al 100, diez por categoría, sin alterar su texto. El build verifica que el archivo generado siga coincidiendo. Las pruebas también comprueban la correspondencia con el HTML.

Para ampliar el juego, usa el administrador, **no agregues una pregunta 101 al Markdown original**. La lógica funciona con bancos variables; el límite operativo de esta versión es 10.000 preguntas, 100 categorías y 2.000 caracteres por pregunta, sujeto a la cuota del navegador.

## Agregar y administrar preguntas

**Administrar → Crear pregunta** permite escribir el texto y elegir categoría. Los IDs usan 128 bits aleatorios y los números crecen de forma consecutiva. Borrar una pregunta no reutiliza su número. Las preguntas personalizadas se pueden editar y eliminar con confirmación. Los originales son de solo lectura; sí puedes activarlos, desactivarlos y asignarles destinatario.

**Crear categoría** agrega un nombre y un color. El nuevo tema queda activado. La búsqueda muestra 30 resultados inicialmente y carga más al solicitarlos para evitar listas enormes.

## Importaciones y respaldos

Elige un archivo en **Administrar → Importar y respaldar**. Seleccionarlo solo valida y muestra una vista previa; no modifica la partida.

- **Fusionar** agrega preguntas y categorías. Conserva nombres, turno, pregunta activa, progreso y configuración existentes. Omite textos equivalentes (normalización Unicode, mayúsculas y espacios) y IDs existentes con el mismo contenido. Un ID que ya identifica otra pregunta produce un error; no se sobrescribe silenciosamente. Los números nuevos se reasignan consecutivamente.
- **Restaurar** requiere un respaldo completo o progreso del HTML. Reemplaza la partida y pide confirmación. Exporta antes un respaldo si quieres conservar tus datos actuales.
- **Exportar banco JSON** incluye preguntas y categorías, sin progreso ni configuración. Incluye activación y destinatarios.
- **Respaldo completo** incluye también completadas, nombres, filtros, turno, tema, pregunta activa y última saltada. No incluye respuestas personales.

Se validan esquema, versión, fechas, tipos, identidad de originales, referencias, IDs y tamaño. Un archivo inválido no se aplica parcialmente. El límite por archivo es 5 MB. Fusionar un respaldo **no importa sus completadas**; restaura el respaldo para recuperar todo el progreso.

### JSON

Para preparar un banco, parte de una exportación de la aplicación. Formato mínimo de un banco con una pregunta nueva:

```json
{
  "format": "entre-nosotros-bank",
  "version": 1,
  "categories": [
    { "id": "tema-propio", "name": "Nuestros rituales", "color": "#8f365c", "source": "custom" }
  ],
  "questions": [
    {
      "id": "custom-ritual-1",
      "number": 1,
      "text": "¿Qué ritual pequeño queremos inventar esta semana?",
      "categoryId": "tema-propio",
      "isActive": true,
      "createdAt": "2026-10-28T00:00:00.000Z",
      "source": "custom"
    }
  ]
}
```

La pregunta del ejemplo no forma parte de las originales. `intendedResponder` es opcional: `0` para la primera persona, `1` para la segunda. Omitirlo significa que ustedes no han asignado destinatario. Incluye en `categories` todas las categorías referenciadas por el archivo. La referencia histórica `preguntas-originales.json` tiene otro formato; se usa para verificar la generación, no como respaldo de partida.

### CSV

CSV UTF-8 con coma como separador. Encabezados obligatorios: `text,categoryId`. Opcionales: `id,number,isActive,createdAt,source`. Sin ID se genera uno, sin fecha se usa el momento de importación, y `source` es `custom` por defecto. `isActive` acepta `true` o `false`.

```csv
text,categoryId
"¿Qué ritual pequeño queremos inventar esta semana?",complicidad
```

Usa comillas para campos con comas o saltos de línea y duplica las comillas internas. Primero crea las categorías personalizadas en la aplicación. Hay un ejemplo descargable en el administrador. Los destinatarios se asignan en el administrador o mediante JSON.

## Recuperar el progreso del HTML

La clave anterior es `verdad_o_verdad_julio_naza_v1`. La nueva aplicación **no asume** que puede leer el almacenamiento de un archivo `file://`, otro puerto, localhost o Vercel.

1. Abre el HTML original en el navegador y ubicación donde jugaron.
2. En herramientas de desarrollo, abre **Application/Almacenamiento → Local Storage** y copia el valor de la clave anterior. Alternativamente, la consola del HTML permite consultarlo con `localStorage.getItem("verdad_o_verdad_julio_naza_v1")`.
3. En la nueva aplicación abre **Administrar → Traer mi progreso del HTML original**, pega el JSON y pulsa **Validar progreso antiguo**. También puedes guardarlo como `.json` e importarlo mediante el selector de archivos.
4. Revisa el resumen y confirma la restauración. Exporta la partida nueva antes si ya contiene datos.

**Buscar en este navegador y origen** solo funciona si ambas aplicaciones comparten origen. La clave anterior no se elimina ni modifica.

Se conservan `completed`, `enabledCategories`, `activeId`, `activeAsker`, `nextAsker` y `lastSkippedId`. Los IDs numéricos se traducen a los IDs originales estables. Si la activa ya estaba completada, se libera y se respeta `nextAsker`; si sigue pendiente, se conserva `activeAsker`. Fechas desconocidas del formato antiguo usan `1970-01-01T00:00:00.000Z` como marcador técnico, no como fecha real de respuesta.

## Persistencia y privacidad

`LocalGameRepository` implementa `GameRepository` sobre un puerto de almacenamiento tipado. Guarda el estado con `schemaVersion: 2` en `entre-nosotros:game`. Existe una migración explícita del esquema interno v1 con `completedIds`; las versiones desconocidas se rechazan.

- Los datos permanecen en **este navegador y origen**. No hay sincronización entre dispositivos ni almacenamiento en la nube.
- La sesión actual y su lista completa de saltadas viven en memoria; recargar inicia una nueva sesión. La última saltada se conserva para evitar repetirla justo después de recargar.
- La pregunta activa, completadas, configuración y turno sí sobreviven a recargas.
- Si los datos están corruptos o son de una versión desconocida, se bloquean las escrituras. Puedes descargar los datos sin modificar y recuperarlos con confirmación desde Configuración. Después puedes restaurar un respaldo válido.
- Si se agota la cuota de localStorage, la partida sigue en memoria y muestra un aviso persistente. Exporta un respaldo antes de cerrar y usa **Reintentar guardado**.
- Se escuchan cambios de otras pestañas y se comprueba la versión leída antes de escribir para reducir sobrescrituras. localStorage no ofrece transacciones distribuidas; usen una pestaña para jugar. No es sincronización en tiempo real entre celulares.
- No se guardan respuestas personales o sexuales. No hay analíticas, rastreadores, fuentes remotas ni solicitudes a servicios de terceros desde la aplicación.
- localStorage y los respaldos **no están cifrados**. Quien acceda al perfil del navegador puede leerlos. La navegación privada y borrar datos del sitio pueden eliminar el progreso.
- Una URL pública **no es privada**. Los originales forman parte de los archivos del proyecto y del sitio descargable. Un repositorio público expondrá estos textos, incluidos nombres y referencias personales. `noindex` no sustituye protección de acceso.
- El alojamiento puede conservar registros técnicos de solicitudes. Las herramientas de desarrollo pueden tener su propia telemetría; no se les envían respuestas porque la aplicación nunca las captura.

## Arquitectura

```text
src/
  app/                  App Router, páginas, metadatos, estilos y favicon
  components/           Presentación por juego, preguntas, progreso y ajustes
  data/                 Originales generados y categorías base
  features/game/        Reglas puras y store cliente con useSyncExternalStore
  lib/
    storage/            Contrato del repositorio y adaptador localStorage
    validation/         Validación de datos y migración de esquema
    import-export/      JSON, CSV, respaldos y formato legado
  types/                Modelos compartidos
  tests/                Pruebas unitarias
e2e/                    Recorridos Playwright
scripts/                Generación y verificación de originales
docs/                   Plan de integración futura
```

Los layouts y páginas son Server Components; solo la experiencia interactiva y su store se ejecutan en cliente. La lectura de localStorage ocurre después de hidratar, con un estado inicial de carga coherente. La ruleta usa `crypto.getRandomValues` con muestreo por rechazo para evitar sesgo modular. El anillo visual es decorativo: el único resultado numérico es el que se muestra en su centro y en la tarjeta. El banco no depende de 100 sectores ni del ángulo del dibujo.

Las animaciones usan CSS y respetan `prefers-reduced-motion`, sin una biblioteca adicional. Tailwind y Lucide se usan por petición explícita del proyecto. La validación y el parser CSV son propios, pequeños y probados; no se añadió una dependencia de formularios o esquemas.

## Verificación

```bash
pnpm questions:check
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm exec playwright install chromium webkit
pnpm test:e2e
```

Playwright inicia automáticamente el **build de producción** en el puerto 3100 y lo detiene al finalizar; ejecuta `pnpm build` antes. Los proyectos prueban Chromium de escritorio, Chromium con dispositivo Pixel 7 y WebKit con dispositivo iPhone 13. Son emulaciones de navegador y viewport, no pruebas físicas en teléfonos. En Linux/CI, instala dependencias del sistema con `pnpm exec playwright install --with-deps chromium webkit`.

Los casos cubren turnos individuales, doble completado, saltos, filtros, desmarcado, destinatarios explícitos, originales idénticos, bancos de más de 100 preguntas, importación sin duplicados, restauración, migración legado, corrupción, cuotas y conflictos entre pestañas. Los recorridos de navegador comprueban persistencia al recargar, formularios, confirmaciones, tema oscuro, foco de diálogo y anchura de 320 px.

Los resultados de ejecución se reportan al entregar el proyecto; este README no supone que una ejecución futura pase. Las trazas de errores quedan en `test-results/`, ignorado por Git.

El recorrido principal vigila los eventos reales `error` y `unhandledrejection` de la página. WebKit puede reportar cancelaciones de prefetch durante una recarga como diagnósticos nativos de acceso; no son errores JavaScript emitidos por la aplicación. Véase el [reporte del motor en Playwright](https://github.com/microsoft/playwright/issues/43120).

## Publicar en GitHub

Antes de publicar, revisa si quieres que las preguntas personales sean públicas. **Recomendación: repositorio privado.** No publiques exportaciones de partidas ni respaldos.

```bash
git init
git add .
git diff --cached
git commit -m "feat: build Entre Nosotros couples game"
git branch -M main
git remote add origin URL_DE_TU_REPOSITORIO
git push -u origin main
```

Crea primero el repositorio vacío en GitHub y sustituye `URL_DE_TU_REPOSITORIO`. Estos comandos son instrucciones: no se ejecutaron commits ni pushes automáticamente. El lockfile de pnpm debe incluirse en el repositorio.

## Desplegar en Vercel

1. Importa el repositorio en Vercel y selecciona el preset **Next.js**.
2. Usa Node.js 24, instalación `pnpm install --frozen-lockfile` y build `pnpm build`. Conserva el directorio de salida predeterminado.
3. No agregues variables de entorno: la primera versión no necesita ninguna.
4. Configura protección de acceso al despliegue antes de compartir preguntas privadas. Verifica qué protección ofrece tu plan; un enlace difícil de adivinar no es protección.
5. Despliega y prueba el flujo de juego, exportación y restauración desde ambos celulares.
6. Restaura manualmente un respaldo si deseas trasladar el progreso local al nuevo dominio. El almacenamiento del dominio de preview es distinto al de producción y al de un dominio personalizado.

No se ha publicado un repositorio ni desplegado automáticamente.

## Segunda fase

Consulta [docs/FASE-2-SUPABASE.md](docs/FASE-2-SUPABASE.md) para autenticación privada, partidas compartidas, sincronización y migración a Supabase. Esta versión no incluye credenciales, servicios backend, PWA, sonido ni sincronización cloud.

Referencias del stack: [Next.js App Router](https://nextjs.org/docs/app/getting-started/installation), [Tailwind con Next.js](https://tailwindcss.com/docs/installation/framework-guides/nextjs), [pnpm](https://pnpm.io/installation), [Playwright](https://playwright.dev/docs/intro).
