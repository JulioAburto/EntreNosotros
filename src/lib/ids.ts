export function createId(prefix: "custom" | "category"): string {
  const values = crypto.getRandomValues(new Uint32Array(4));
  return `${prefix}-${Array.from(values, value => value.toString(16).padStart(8, "0")).join("")}`;
}
