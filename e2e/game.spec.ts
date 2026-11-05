import { expect, test } from "@playwright/test";

const storageKey = "entre-nosotros:game";

test("turnos individuales, tarjeta persistente, salto y progreso", async ({ page }) => {
  const errors: string[] = [];
  await page.exposeFunction("reportApplicationError", (message: string) => errors.push(message));
  await page.addInitScript(() => {
    const report = (window as unknown as { reportApplicationError: (message: string) => Promise<void> }).reportApplicationError;
    window.addEventListener("error", event => { void report(event.message); });
    window.addEventListener("unhandledrejection", event => { void report(String(event.reason)); });
  });
  await page.goto("/");
  await page.getByRole("link", { name: "Comenzar a jugar", exact: true }).click();
  await expect(page.locator(".turn-indicator")).toContainText("Julio pregunta");
  await expect(page.locator(".turn-indicator")).toContainText("Naza responde");
  await page.getByRole("button", { name: "Girar la ruleta", exact: true }).click();
  await expect(page.getByRole("button", { name: "Girando…", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Naza ya respondió", exact: true })).toBeVisible();
  const questionText = await page.getByRole("region", { name: "Pregunta seleccionada" }).getByRole("heading").textContent();
  const number = await page.locator(".question-number").textContent();
  await page.reload();
  await expect(page.getByRole("region", { name: "Pregunta seleccionada" }).getByRole("heading")).toHaveText(questionText!);
  await expect(page.getByRole("button", { name: "Naza ya respondió" })).toBeVisible();
  await page.getByRole("button", { name: "Saltar por ahora" }).click();
  await expect(page.locator(".turn-indicator")).toContainText("Julio pregunta");
  await page.getByRole("button", { name: "Girar la ruleta", exact: true }).click();
  await expect(page.getByRole("button", { name: "Naza ya respondió" })).toBeVisible();
  await expect(page.locator(".question-number")).not.toHaveText(number!);
  await page.getByRole("button", { name: "Naza ya respondió" }).click();
  await expect(page.locator(".turn-indicator")).toContainText("Naza pregunta");
  await expect(page.locator(".turn-indicator")).toContainText("Julio responde");
  await page.getByRole("button", { name: "Girar la ruleta", exact: true }).click();
  await page.getByRole("button", { name: "Julio ya respondió" }).click();
  await expect(page.locator(".turn-indicator")).toContainText("Julio pregunta");
  await page.goto("/progreso");
  await expect(page.locator(".stats-grid article").filter({ hasText: "Completadas" }).locator("strong")).toHaveText("2");
  await page.reload();
  await expect(page.locator(".stats-grid article").filter({ hasText: "Completadas" }).locator("strong")).toHaveText("2");
  expect(errors).toEqual([]);
});

test("crear, editar, asignar destinatario y seleccionar una pregunta personalizada", async ({ page }) => {
  await page.goto("/administrar");
  await page.getByRole("button", { name: "Crear pregunta", exact: true }).click();
  await page.getByRole("textbox", { name: "Tu pregunta", exact: true }).fill("¿Qué ritual nuevo vamos a inventar juntos?");
  await page.getByRole("button", { name: "Guardar pregunta", exact: true }).click();
  await page.getByRole("combobox", { name: "Filtrar por estado", exact: true }).selectOption("custom");
  await expect(page.getByText("¿Qué ritual nuevo vamos a inventar juntos?", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Editar pregunta 101", exact: true }).click();
  await page.getByRole("textbox", { name: "Tu pregunta", exact: true }).fill("¿Qué ritual queremos comenzar mañana?");
  await page.getByRole("button", { name: "Guardar pregunta", exact: true }).click();
  await page.getByRole("button", { name: "Destinatario", exact: true }).click();
  await page.getByRole("combobox", { name: "Quién puede responder", exact: true }).selectOption("1");
  await page.getByRole("button", { name: "Guardar destinatario" }).click();
  await expect(page.getByText("Destinatario: Naza")).toBeVisible();
  await page.evaluate(key => {
    const state = JSON.parse(localStorage.getItem(key)!);
    state.completed = Object.fromEntries(state.questions.filter((question: { source: string }) => question.source === "initial").map((question: { id: string }) => [question.id, new Date().toISOString()]));
    localStorage.setItem(key, JSON.stringify(state));
  }, storageKey);
  await page.goto("/jugar");
  await page.getByRole("button", { name: "Girar la ruleta", exact: true }).click();
  await expect(page.getByRole("heading", { name: "¿Qué ritual queremos comenzar mañana?", exact: true })).toBeVisible();
  await expect(page.locator(".question-number")).toHaveText("N.º 101");
  await page.getByRole("button", { name: "Naza ya respondió" }).click();
  await expect(page.getByRole("heading", { name: "¡Cuánto hemos compartido!" })).toBeVisible();
});

test("los filtros persisten y desmarcar permite repetir una pregunta", async ({ page }) => {
  await page.goto("/jugar");
  await page.getByText("El ambiente de hoy", { exact: true }).click();
  await page.getByRole("button", { name: "Futuro", exact: true }).click();
  await page.reload();
  await page.getByText("El ambiente de hoy", { exact: true }).click();
  await expect(page.getByRole("checkbox", { name: "Planes a futuro", exact: true })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Expresar amor", exact: true })).not.toBeChecked();
  await page.getByRole("button", { name: "Girar la ruleta", exact: true }).click();
  await expect(page.getByRole("region", { name: "Pregunta seleccionada" }).getByText("Planes a futuro", { exact: true })).toBeVisible();
  const number = Number((await page.locator(".question-number").textContent())!.replace("N.º ", ""));
  await page.getByRole("button", { name: "Naza ya respondió" }).click();
  await page.goto("/preguntas");
  await page.getByRole("combobox", { name: "Filtrar por estado", exact: true }).selectOption("completed");
  await expect(page.getByRole("checkbox", { name: `Completar pregunta ${number}`, exact: true })).toBeChecked();
  await page.getByRole("checkbox", { name: `Completar pregunta ${number}`, exact: true }).click();
  await expect(page.getByText("0 de 100 preguntas", { exact: false })).toBeVisible();
});

test("CSV se fusiona sin duplicados ni pérdida de progreso y el respaldo se restaura con confirmación", async ({ page }) => {
  await page.goto("/preguntas");
  await page.getByRole("checkbox", { name: "Completar pregunta 1", exact: true }).check();
  await page.goto("/administrar");
  const csv = Buffer.from('text,categoryId\n"¿Una tradición de prueba, para nosotros?",amor\n"¿Una tradición de prueba, para nosotros?",amor', "utf8");
  await page.getByLabel("Importar archivo de preguntas o respaldo").setInputFiles({ name: "nuevas.csv", mimeType: "text/csv", buffer: csv });
  await page.getByRole("button", { name: "Fusionar preguntas" }).click();
  await expect(page.getByRole("status").filter({ hasText: "1 preguntas agregadas; 1 duplicadas omitidas" })).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Respaldo completo", exact: true }).click();
  const download = await downloadPromise;
  const backupPath = await download.path();
  expect(backupPath).toBeTruthy();
  await page.getByLabel("Importar archivo de preguntas o respaldo").setInputFiles(backupPath!);
  await page.getByRole("radio", { name: "Restaurar respaldo", exact: true }).check();
  await page.getByRole("button", { name: "Restaurar respaldo", exact: true }).click();
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await page.getByRole("button", { name: "Restaurar respaldo", exact: true }).click();
  await page.getByRole("button", { name: "Reemplazar y restaurar" }).click();
  await page.goto("/progreso");
  await expect(page.locator(".stats-grid article").filter({ hasText: "Total de preguntas" }).locator("strong")).toHaveText("101");
  await expect(page.locator(".stats-grid article").filter({ hasText: "Completadas" }).locator("strong")).toHaveText("1");
});

test("migra explícitamente la partida del HTML y conserva la activa al recargar", async ({ page }) => {
  await page.goto("/administrar");
  await page.getByText("Traer mi progreso del HTML original", { exact: true }).click();
  await page.getByLabel("JSON del progreso anterior").fill(JSON.stringify({ completed: [1, 2], enabledCategories: [1], activeId: 3, activeAsker: "Naza", nextAsker: "Naza", lastSkippedId: 4 }));
  await page.getByRole("button", { name: "Validar progreso antiguo" }).click();
  await page.getByRole("button", { name: "Restaurar progreso antiguo", exact: true }).click();
  await page.goto("/jugar");
  await expect(page.locator(".question-number")).toHaveText("N.º 3");
  await expect(page.getByRole("button", { name: "Julio ya respondió" })).toBeVisible();
  await page.reload();
  await expect(page.locator(".question-number")).toHaveText("N.º 3");
  await page.getByRole("button", { name: "Julio ya respondió" }).click();
  await expect(page.locator(".turn-indicator")).toContainText("Julio pregunta");
});

test("datos corruptos no se sobrescriben y se recuperan solo con confirmación", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(key => localStorage.setItem(key, "{corrupt"), storageKey);
  await page.goto("/configuracion");
  await expect(page.getByRole("alert").filter({ hasText: "No sobrescribiremos tus datos" })).toBeVisible();
  expect(await page.evaluate(key => localStorage.getItem(key), storageKey)).toBe("{corrupt");
  await page.getByRole("button", { name: "Recuperar almacenamiento", exact: true }).click();
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  expect(await page.evaluate(key => localStorage.getItem(key), storageKey)).toBe("{corrupt");
  await page.getByRole("button", { name: "Recuperar almacenamiento", exact: true }).click();
  await page.getByRole("button", { name: "Reemplazar datos y recuperar" }).click();
  await expect(page.locator(".storage-alert")).toHaveCount(0);
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).schemaVersion, storageKey)).toBe(2);
});

test("320 px, modo oscuro, movimiento reducido y foco de diálogo", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Comenzar a jugar", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/inicio-320-${testInfo.project.name}.png`, fullPage: true });
  await page.goto("/configuracion");
  await page.getByRole("radio", { name: "Oscuro", exact: true }).check();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.goto("/administrar");
  await page.getByRole("button", { name: "Crear pregunta", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Tu pregunta", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Crear pregunta", exact: true })).toBeFocused();
  await page.goto("/jugar");
  await page.getByRole("button", { name: "Girar la ruleta", exact: true }).click();
  await expect(page.getByRole("button", { name: "Naza ya respondió" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/juego-oscuro-320-${testInfo.project.name}.png`, fullPage: true });
});
