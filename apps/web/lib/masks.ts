/**
 * Apply a mask pattern to a value.
 * '#' represents a digit placeholder.
 */
function applyMask(value: string, mask: string): string {
  const digits = value.replace(/\D/g, '');
  let result = '';
  let digitIdx = 0;
  for (let i = 0; i < mask.length && digitIdx < digits.length; i++) {
    if (mask[i] === '#') {
      result += digits[digitIdx++];
    } else {
      result += mask[i];
    }
  }
  return result;
}

export function maskCPF(value: string): string {
  return applyMask(value, '###.###.###-##');
}

export function maskCNPJ(value: string): string {
  return applyMask(value, '##.###.###/####-##');
}

export function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 10) {
    return applyMask(value, '(##) ####-####');
  }
  return applyMask(value, '(##) #####-####');
}

export function maskCEP(value: string): string {
  return applyMask(value, '#####-###');
}

export function maskDocument(value: string, type: 'CPF' | 'CNPJ'): string {
  return type === 'CPF' ? maskCPF(value) : maskCNPJ(value);
}

/** Remove all non-digit characters */
export function unmask(value: string): string {
  return value.replace(/\D/g, '');
}
