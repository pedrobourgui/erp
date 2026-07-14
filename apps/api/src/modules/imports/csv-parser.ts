/**
 * Minimal, dependency-free CSV parser.
 * Supports quoted fields (with embedded commas, quotes and newlines),
 * and auto-detects `,` or `;` as the delimiter from the header row.
 */
export type CsvRow = Record<string, string>;

function detectDelimiter(headerLine: string): ',' | ';' {
  const commas = (headerLine.match(/,/g) ?? []).length;
  const semis = (headerLine.match(/;/g) ?? []).length;
  return semis > commas ? ';' : ',';
}

/** Tokenizes raw CSV text into an array of string-cell rows. */
function tokenize(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }

  // Flush the last field/row if the file doesn't end with a newline.
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

/**
 * Parses CSV text into an array of objects keyed by the (trimmed) header row.
 * Empty lines are skipped.
 */
export function parseCsv(text: string): CsvRow[] {
  const normalized = text.replace(/^﻿/, ''); // strip BOM
  const firstLineEnd = normalized.indexOf('\n');
  const headerLine =
    firstLineEnd === -1 ? normalized : normalized.slice(0, firstLineEnd);
  const delimiter = detectDelimiter(headerLine);

  const matrix = tokenize(normalized, delimiter);
  if (matrix.length === 0) return [];

  const headers = matrix[0].map((h) => h.trim());
  const rows: CsvRow[] = [];

  for (let i = 1; i < matrix.length; i++) {
    const cells = matrix[i];
    // Skip fully-empty lines.
    if (cells.every((c) => c.trim() === '')) continue;

    const obj: CsvRow = {};
    headers.forEach((header, idx) => {
      obj[header] = (cells[idx] ?? '').trim();
    });
    rows.push(obj);
  }

  return rows;
}
