import { readFile, writeFile, mkdir } from "node:fs/promises";

const categoryIds = ["amor", "distancia", "historia", "gratitud", "admiracion", "conocernos", "intimidad", "futuro", "deseo", "complicidad"];
const source = await readFile(new URL("../preguntas-originales.md", import.meta.url), "utf8");
const matches = [...source.matchAll(/^(\d+)\. (.+)$/gm)];
if (matches.length !== 100) throw new Error(`Se esperaban 100 preguntas originales, se encontraron ${matches.length}.`);
const questions = matches.map((match, index) => {
  const number = Number(match[1]);
  if (number !== index + 1) throw new Error(`Numeración original inválida en ${number}.`);
  return {
    id: `initial-${String(number).padStart(3, "0")}`,
    number,
    text: match[2].replace(/\r$/, ""),
    categoryId: categoryIds[Math.floor(index / 10)],
    isActive: true,
    createdAt: "2026-10-28T00:00:00.000Z",
    source: "initial",
  };
});
for (const categoryId of categoryIds) {
  if (questions.filter(question => question.categoryId === categoryId).length !== 10) throw new Error(`Categoría incompleta: ${categoryId}`);
}
const output = `${JSON.stringify(questions, null, 2)}\n`;
const reference = JSON.parse(await readFile(new URL("../preguntas-originales.json", import.meta.url), "utf8"));
if (reference.questions.length !== 100 || reference.categories.length !== 10) throw new Error("La referencia JSON debe incluir 100 preguntas y 10 categorías.");
for (const question of questions) {
  const structured = reference.questions.find(item => item.id === question.number);
  if (!structured || structured.text !== question.text || structured.category !== Math.floor((question.number - 1) / 10) + 1) throw new Error(`La referencia JSON difiere del Markdown en la pregunta ${question.number}.`);
}
const destination = new URL("../src/data/questions.json", import.meta.url);
if (process.argv.includes("--check")) {
  if (await readFile(destination, "utf8") !== output) throw new Error("El banco difiere del original. Ejecuta pnpm questions:generate y revisa el diff.");
} else {
  await mkdir(new URL("../src/data/", import.meta.url), { recursive: true });
  await writeFile(destination, output, "utf8");
}
console.log("100 preguntas originales verificadas; 10 por categoría. Texto y numeración intactos.");
