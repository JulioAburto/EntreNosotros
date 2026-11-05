import type { Category } from "@/types";

export const initialCategories: Category[] = [
  { id: "amor", name: "Expresar amor", color: "#ad3d62", source: "initial" },
  { id: "distancia", name: "Cuando nos extrañamos", color: "#936096", source: "initial" },
  { id: "historia", name: "Recordar nuestra historia", color: "#a06938", source: "initial" },
  { id: "gratitud", name: "Expresar gratitud", color: "#50806a", source: "initial" },
  { id: "admiracion", name: "Expresar admiración", color: "#9b7231", source: "initial" },
  { id: "conocernos", name: "Conocernos más profundamente", color: "#537d94", source: "initial" },
  { id: "intimidad", name: "Intimidad emocional", color: "#87609a", source: "initial" },
  { id: "futuro", name: "Planes a futuro", color: "#527c75", source: "initial" },
  { id: "deseo", name: "Deseo, atracción y fantasías sexuales", color: "#b3494e", source: "initial" },
  { id: "complicidad", name: "Nuestra complicidad", color: "#a34d7c", source: "initial" },
];

export const categoryPresets = [
  { name: "Solo románticas", ids: ["amor", "distancia", "gratitud", "admiracion", "complicidad"] },
  { name: "Amor y gratitud", ids: ["amor", "gratitud"] },
  { name: "Recuerdos y nostalgia", ids: ["historia", "distancia"] },
  { name: "Futuro", ids: ["futuro"] },
  { name: "Intimidad y sexualidad", ids: ["intimidad", "deseo"] },
];
