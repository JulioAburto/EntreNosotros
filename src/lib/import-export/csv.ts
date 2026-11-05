export function parseCsv(input: string): Record<string, string>[] {
  const content = input.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let closedQuote = false;
  for (let index = 0; index < content.length; index++) {
    const character = content[index]!;
    if (quoted) {
      if (character === '"' && content[index + 1] === '"') {
        field += '"';
        index++;
      } else if (character === '"') {
        quoted = false;
        closedQuote = true;
      } else field += character;
    } else if (character === '"') {
      if (field || closedQuote) throw new Error("CSV: comillas inesperadas. Encierra todo el campo entre comillas.");
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
      closedQuote = false;
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && content[index + 1] === "\n") index++;
      row.push(field);
      if (row.some(cell => cell.trim())) rows.push(row);
      row = [];
      field = "";
      closedQuote = false;
    } else {
      if (closedQuote) throw new Error("CSV: hay texto después de cerrar comillas.");
      field += character;
    }
  }
  if (quoted) throw new Error("CSV: hay un campo con comillas sin cerrar.");
  row.push(field);
  if (row.some(cell => cell.trim())) rows.push(row);
  const headers = rows.shift()?.map(header => header.trim());
  const allowed = ["id", "number", "text", "categoryId", "isActive", "createdAt", "source"];
  if (!headers || !headers.includes("text") || !headers.includes("categoryId")) throw new Error("CSV: los encabezados obligatorios son text,categoryId.");
  if (new Set(headers).size !== headers.length || headers.some(header => !allowed.includes(header))) throw new Error("CSV: encabezados duplicados o desconocidos.");
  if (!rows.length) throw new Error("El CSV no contiene preguntas.");
  return rows.map((cells, index) => {
    if (cells.length !== headers.length) throw new Error(`CSV, fila ${index + 2}: cantidad de columnas incorrecta.`);
    return Object.fromEntries(headers.map((header, column) => [header, cells[column]!]));
  });
}
