/**
 * Campos fiscais brasileiros — NCM, GTIN/EAN, CEST e CFOP.
 *
 * AE-08: o QA cadastrou um produto com `ncm: 'ABCDEFG'` e `ean: '123'`, porque
 * os dois lados só exigiam `@IsString()`. Em produção isso é NF-e rejeitada
 * pela SEFAZ — e o erro só aparece na hora de faturar, quando já há estoque
 * comprado e venda fechada.
 *
 * Como nos documentos (AE-04), uma implementação só para os dois workspaces.
 */

/** Só os dígitos — a forma canônica de armazenamento. */
function digitsOf(value: string | null | undefined): string {
  return (value ?? '').replace(/\D/g, '');
}

// ─── NCM ─────────────────────────────────────────────────────────────────

/** NCM tem 8 dígitos. A máscara `0000.00.00` é aceita na entrada. */
export function isValidNCM(value: string | null | undefined): boolean {
  return digitsOf(value).length === 8;
}

/** `12345678` → `1234.56.78`. */
export function formatNCM(value: string | null | undefined): string {
  const digits = digitsOf(value);
  if (digits.length !== 8) return value ?? '';
  return digits.replace(/(\d{4})(\d{2})(\d{2})/, '$1.$2.$3');
}

// ─── CEST ────────────────────────────────────────────────────────────────

/**
 * CEST tem 7 dígitos.
 *
 * O `CLAUDE.md` do front dizia 9 — é o tamanho da coluna com máscara
 * (`00.000.00`), não o do dado. Aqui vale o dado.
 */
export function isValidCEST(value: string | null | undefined): boolean {
  return digitsOf(value).length === 7;
}

export function formatCEST(value: string | null | undefined): string {
  const digits = digitsOf(value);
  if (digits.length !== 7) return value ?? '';
  return digits.replace(/(\d{2})(\d{3})(\d{2})/, '$1.$2.$3');
}

// ─── GTIN / EAN ──────────────────────────────────────────────────────────

const GTIN_LENGTHS = [8, 12, 13, 14];

/**
 * GTIN-8/12/13/14 com dígito verificador.
 *
 * O algoritmo é o mesmo para os quatro tamanhos: pesos 3 e 1 alternados da
 * direita para a esquerda, e o dígito é o que completa a próxima dezena.
 * `'123'` (o caso do QA) falha já no tamanho.
 */
export function isValidGTIN(value: string | null | undefined): boolean {
  const digits = digitsOf(value);
  if (!GTIN_LENGTHS.includes(digits.length)) return false;
  if (/^0+$/.test(digits)) return false;

  const body = digits.slice(0, -1);
  const expected = Number(digits[digits.length - 1]);

  let sum = 0;
  for (let i = body.length - 1, weight = 3; i >= 0; i -= 1, weight = 4 - weight) {
    sum += Number(body[i]) * weight;
  }

  return (10 - (sum % 10)) % 10 === expected;
}

/** Alias de leitura: no cadastro o campo se chama EAN. */
export const isValidEAN = isValidGTIN;

// ─── CFOP ────────────────────────────────────────────────────────────────

/**
 * CFOPs de saída mais usados no varejo, para pré-listar no cadastro.
 *
 * A tabela oficial é grande e muda; estes são os que uma loja usa no dia a dia.
 * A validação não se limita a esta lista — CFOP é qualquer código de 4 dígitos
 * cujo primeiro dígito identifique a natureza da operação.
 */
export const COMMON_SALE_CFOPS = [
  { code: '5101', description: 'Venda de produção do estabelecimento' },
  { code: '5102', description: 'Venda de mercadoria adquirida de terceiros' },
  { code: '5405', description: 'Venda de mercadoria com ST (substituto)' },
  { code: '5403', description: 'Venda de mercadoria com ST (substituído)' },
  { code: '5910', description: 'Remessa em bonificação, doação ou brinde' },
  { code: '5920', description: 'Remessa para venda fora do estabelecimento' },
  { code: '6101', description: 'Venda de produção — outro estado' },
  { code: '6102', description: 'Venda de mercadoria de terceiros — outro estado' },
  { code: '6108', description: 'Venda a consumidor final — outro estado' },
] as const;

/**
 * Primeiro dígito válido de um CFOP: 1/2/3 são entradas, 5/6/7 são saídas.
 * `4` e `8`/`9` não existem na tabela.
 */
const CFOP_FIRST_DIGITS = ['1', '2', '3', '5', '6', '7'];

export function isValidCFOP(value: string | null | undefined): boolean {
  const digits = digitsOf(value);
  if (digits.length !== 4) return false;
  return CFOP_FIRST_DIGITS.includes(digits[0]);
}

/** Se o CFOP é de saída (venda) — o que um produto de loja usa. */
export function isSaleCFOP(value: string | null | undefined): boolean {
  const digits = digitsOf(value);
  return isValidCFOP(digits) && ['5', '6', '7'].includes(digits[0]);
}

// ─── Mensagens ───────────────────────────────────────────────────────────

export const FISCAL_MESSAGES = {
  ncm: 'NCM deve ter 8 dígitos (ex.: 6109.10.00)',
  cest: 'CEST deve ter 7 dígitos (ex.: 28.038.00)',
  ean: 'Código de barras inválido — informe um EAN/GTIN de 8, 12, 13 ou 14 dígitos',
  cfop: 'CFOP deve ter 4 dígitos e começar com 1, 2, 3, 5, 6 ou 7',
} as const;
