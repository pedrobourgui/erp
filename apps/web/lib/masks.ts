/**
 * Apply a mask pattern to a value.
 * '#' represents a digit placeholder.
 */
function applyMask(value: string, mask: string): string {
  let result = '';
  let Idx = 0;
  for (let i = 0; i < mask.length && Idx < value.length; i++) {
    if (mask[i] === '#') {
      result += value[Idx++];
    } else {
      result += mask[i];
    }
  }   
  return result;
}

export function maskCPF(value: string): string {
  const digits = value.replace(/\D/g, '');
  return applyMask(digits, '###.###.###-##');
}

export function maskCNPJ(value: string): string {
  const chars = value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

  // primeiros 12 caracteres: alfanuméricos
  const body = chars.slice(0, 12);

  // últimos 2 caracteres: somente dígitos
  const dv = chars
    .slice(12)
    .replace(/\D/g, '')
    .slice(0, 2);

  const full = body + dv;
  return applyMask(full, '##.###.###/####-##');
}

export function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 10) {
    return applyMask(digits, '(##) ####-####');
  }
  return applyMask(digits, '(##) #####-####');
}

export function maskCEP(value: string): string {
  const digits = value.replace(/\D/g, '');
  return applyMask(digits, '#####-###');
}

export function maskDocument(value: string, type: 'CPF' | 'CNPJ'): string {
  return type === 'CPF' ? maskCPF(value) : maskCNPJ(value);
}

// Remova todos os caracteres que não sejam dígitos. 
export function unmaskCPF(value: string): string {
  return value.replace(/\D/g, '');
}

export function unmaskCNPJ(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, '');
}

export function unmaskPhone(value: string): string {
  return value.replace(/\D/g, '');
}
