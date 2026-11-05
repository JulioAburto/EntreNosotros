import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { initialQuestions } from "@/features/game/rules";
import { initialCategories } from "@/data/categories";

describe("fuentes originales", () => {
  it("conserva exactamente las 100 preguntas del Markdown, su orden y diez por categoría", () => {
    const markdown = readFileSync("preguntas-originales.md", "utf8");
    const originals = [...markdown.matchAll(/^(\d+)\. (.+)$/gm)];
    expect(originals).toHaveLength(100);
    expect(initialQuestions).toHaveLength(100);
    initialQuestions.forEach((question, index) => {
      expect(question.text).toBe(originals[index]?.[2]?.replace(/\r$/, ""));
      expect(question.number).toBe(index + 1);
      expect(question.id).toBe(`initial-${String(index + 1).padStart(3, "0")}`);
    });
    expect(initialCategories).toHaveLength(10);
    initialCategories.forEach(category => expect(initialQuestions.filter(question => question.categoryId === category.id)).toHaveLength(10));
  });

  it("mantiene la correspondencia numérica con el JSON y el HTML de referencia", () => {
    const reference = JSON.parse(readFileSync("preguntas-originales.json", "utf8")) as { categories: { id: number; title: string }[]; questions: { id: number; category: number; text: string }[] };
    const html = readFileSync("Verdad_o_Verdad_Julio_y_Naza_v2.html", "utf8");
    const match = html.match(/const QUESTIONS = (\[[^\n]+\]);/);
    expect(match).not.toBeNull();
    expect(JSON.parse(match![1]!)).toEqual(reference.questions);
    reference.questions.forEach(question => {
      const original = initialQuestions.find(item => item.number === question.id);
      expect(original?.text).toBe(question.text);
      expect(original?.categoryId).toBe(initialCategories[question.category - 1]?.id);
    });
    reference.categories.forEach(category => expect(initialCategories[category.id - 1]?.name).toBe(category.title));
  });
});
