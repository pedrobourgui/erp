/**
 * Documentos brasileiros — CPF, CNPJ e afins.
 *
 * AE-04: o cadastro aceitava `111.111.111-11` porque os dois lados só contavam
 * dígitos — o front (`clientes/novo`) checava 11 ou 14 caracteres e o back
 * validava `@IsString() @MaxLength(18)`. Documento inválido em base de ERP vira
 * NF-e rejeitada pela SEFAZ e cadastro que não dá para corrigir depois.
 *
 * AE-15: `12345678909` e `123.456.789-09` conviviam como clientes diferentes,
 * porque a checagem de duplicidade comparava a string com a máscara. A regra é
 * guardar **só os dígitos** e formatar na exibição.
 *
 * Uma única implementação para os dois workspaces: o zod do front e o decorator
 * do back importam daqui.
 */

export type DocumentType = 'CPF' | 'CNPJ';

/** Só os dígitos — a forma canônica de armazenamento (AE-15). */
export function onlyDigits(value: string | null | undefined): string {
  return (value ?? '').replace(/\D/g, '');
}

/**
 * Dígito verificador por módulo 11, o algoritmo comum a CPF e CNPJ.
 * `weights` são os pesos aplicados da esquerda para a direita.
 */
function checkDigit(digits: string, weights: number[]): number {
  const sum = weights.reduce(
    (acc, weight, index) => acc + Number(digits[index]) * weight,
    0,
  );
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

/** `111.111.111-11` e `000…` passam em qualquer soma — são rejeitados à parte. */
function isRepeated(digits: string): boolean {
  return /^(\d)\1+$/.test(digits);
}

export function isValidCPF(value: string | null | undefined): boolean {
  const digits = onlyDigits(value);
  if (digits.length !== 11 || isRepeated(digits)) return false;

  const first = checkDigit(digits, [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  if (first !== Number(digits[9])) return false;

  const second = checkDigit(digits, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
  return second === Number(digits[10]);
}

export function isValidCNPJ(value: string | null | undefined): boolean {
  const digits = onlyDigits(value);
  if (digits.length !== 14 || isRepeated(digits)) return false;

  const first = checkDigit(digits, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  if (first !== Number(digits[12])) return false;

  const second = checkDigit(digits, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return second === Number(digits[13]);
}

/**
 * Valida pelo tipo declarado. Sem tipo, decide pelo tamanho — é o que a
 * importação de CSV precisa, onde a coluna nem sempre existe.
 */
export function isValidDocument(
  value: string | null | undefined,
  type?: DocumentType | null,
): boolean {
  const digits = onlyDigits(value);
  if (type === 'CPF') return isValidCPF(digits);
  if (type === 'CNPJ') return isValidCNPJ(digits);
  if (digits.length === 11) return isValidCPF(digits);
  if (digits.length === 14) return isValidCNPJ(digits);
  return false;
}

/** O tipo que o documento aparenta ser, pelo número de dígitos. */
export function documentTypeOf(
  value: string | null | undefined,
): DocumentType | null {
  const digits = onlyDigits(value);
  if (digits.length === 11) return 'CPF';
  if (digits.length === 14) return 'CNPJ';
  return null;
}

/** `12345678909` → `123.456.789-09`. Devolve a entrada se não reconhecer. */
export function formatDocument(value: string | null | undefined): string {
  const digits = onlyDigits(value);
  if (digits.length === 11) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  if (digits.length === 14) {
    return digits.replace(
      /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
      '$1.$2.$3/$4-$5',
    );
  }
  return value ?? '';
}

/** Mensagem única para as duas pontas, em pt-BR. */
export function documentErrorMessage(type?: DocumentType | null): string {
  if (type === 'CPF') return 'CPF inválido';
  if (type === 'CNPJ') return 'CNPJ inválido';
  return 'Documento inválido';
}
