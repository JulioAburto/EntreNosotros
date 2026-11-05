"use client";

import { categoryPresets } from "@/data/categories";
import { gameActions, useGame } from "@/features/game/store";
import { Button } from "@/components/ui/primitives";

export function CategoryFilters() {
  const { state, blocked } = useGame();
  if (!state) return null;
  return <fieldset disabled={blocked} className="category-filters"><legend className="sr-only">Categorías de la ruleta</legend>
    <p className="muted mb-4">Elijan de qué tienen ganas de conversar. Desactivar una categoría conserva su progreso.</p>
    <div className="flex flex-wrap gap-2 mb-5"><Button variant="secondary" onClick={() => gameActions.setCategories(state.categories.map(category => category.id))}>Todas</Button><Button variant="secondary" onClick={() => gameActions.setCategories(state.categories.filter(category => !["intimidad", "deseo"].includes(category.id)).map(category => category.id))}>Sin preguntas íntimas</Button>{categoryPresets.map(preset => <Button key={preset.name} variant="ghost" onClick={() => gameActions.setCategories(preset.ids)}>{preset.name}</Button>)}</div>
    <div className="category-check-grid">{state.categories.map(category => <label key={category.id} className="category-option"><input type="checkbox" checked={state.enabledCategoryIds.includes(category.id)} onChange={event => gameActions.setCategories(event.target.checked ? [...state.enabledCategoryIds, category.id] : state.enabledCategoryIds.filter(id => id !== category.id))} /><span className="category-dot" style={{ backgroundColor: category.color }} /><span>{category.name}</span></label>)}</div>
    {state.enabledCategoryIds.includes("deseo") && <p className="gentle-note mt-4">Compartir una fantasía no compromete a realizarla. Pueden saltar cualquier pregunta, sin explicaciones.</p>}
  </fieldset>;
}
