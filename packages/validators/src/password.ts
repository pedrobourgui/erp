/**
 * Política de senha.
 *
 * FN-25: o mínimo era 6 caracteres, sem exigência nenhuma de complexidade —
 * para o `owner` de um ERP, que enxerga faturamento, custo e contas a pagar da
 * empresa inteira, isso é fraco demais.
 *
 * A regra: 8 caracteres e pelo menos **três das quatro** classes. Exigir as
 * quatro empurra o usuário para o padrão `Senha@123`, que é pior do que uma
 * frase longa — a força vem de tamanho e variedade, não de um símbolo obrigatório.
 */

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MIN_CLASSES = 3;

/** Senhas óbvias demais para serem aceitas, mesmo passando nas regras. */
const FORBIDDEN_PASSWORDS = [
  '12345678',
  '123456789',
  '1234567890',
  'senha123',
  'password',
  'password1',
  'qwerty123',
  'admin123',
  'abc12345',
  'iloveyou',
  'principal',
];

export interface PasswordCheck {
  valid: boolean;
  /** Quantas das quatro classes a senha usa. */
  classes: number;
  /** Mensagem em pt-BR, `null` quando a senha passa. */
  message: string | null;
  /** 0 a 4, para o medidor de força. */
  score: number;
}

function countClasses(password: string): number {
  return [/[a-z]/, /[A-Z]/, /\d/, /[^\w\s]/].filter((re) => re.test(password))
    .length;
}

/**
 * Avalia a senha. `context` são valores que não podem aparecer nela — o e-mail
 * e o nome do usuário, tipicamente.
 */
export function checkPassword(
  password: string,
  context: (string | null | undefined)[] = [],
): PasswordCheck {
  const value = password ?? '';
  const classes = countClasses(value);

  const base: Omit<PasswordCheck, 'valid' | 'message'> = {
    classes,
    score: scorePassword(value, classes),
  };

  if (value.length < PASSWORD_MIN_LENGTH) {
    return {
      ...base,
      valid: false,
      message: `A senha precisa de pelo menos ${PASSWORD_MIN_LENGTH} caracteres`,
    };
  }

  if (classes < PASSWORD_MIN_CLASSES) {
    return {
      ...base,
      valid: false,
      message:
        'Use pelo menos três destes: letra maiúscula, letra minúscula, número e símbolo',
    };
  }

  const lowered = value.toLowerCase();

  if (FORBIDDEN_PASSWORDS.includes(lowered)) {
    return { ...base, valid: false, message: 'Esta senha é previsível demais' };
  }

  // Cada palavra do contexto conta: "Ana Vendedora" tem que barrar
  // `Vendedora99`, não só a string inteira. Palavras curtas são ignoradas —
  // bloquear toda senha que contenha "ana" seria absurdo.
  const needles = context
    .filter((item): item is string => !!item)
    .flatMap((item) => item.split('@')[0].split(/[\s._-]+/))
    .map((word) => word.toLowerCase())
    .filter((word) => word.length >= 4);

  if (needles.some((needle) => lowered.includes(needle))) {
    return {
      ...base,
      valid: false,
      message: 'A senha não pode conter seu nome ou e-mail',
    };
  }

  return { ...base, valid: true, message: null };
}

/** Só o booleano, para o zod. */
export function isStrongPassword(
  password: string,
  context: (string | null | undefined)[] = [],
): boolean {
  return checkPassword(password, context).valid;
}

/**
 * Força de 0 a 4, para o medidor. É uma medida de *conforto*, não de validade:
 * uma senha pode ser válida (score 2) e ainda assim melhorável.
 */
export function scorePassword(password: string, classes?: number): number {
  const value = password ?? '';
  if (!value) return 0;

  const usedClasses = classes ?? countClasses(value);
  let score = 0;

  if (value.length >= PASSWORD_MIN_LENGTH) score += 1;
  if (value.length >= 12) score += 1;
  if (usedClasses >= 3) score += 1;
  if (usedClasses === 4 || value.length >= 16) score += 1;

  return Math.min(score, 4);
}

export const PASSWORD_STRENGTH_LABELS = [
  'Muito fraca',
  'Fraca',
  'Razoável',
  'Boa',
  'Forte',
] as const;

export function passwordStrengthLabel(score: number): string {
  return PASSWORD_STRENGTH_LABELS[Math.min(Math.max(score, 0), 4)];
}
