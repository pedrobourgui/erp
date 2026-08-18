import {
  checkPassword,
  isStrongPassword,
  scorePassword,
  passwordStrengthLabel,
  PASSWORD_MIN_LENGTH,
} from '@erp/validators';
import { describe, it, expect } from 'vitest';

/**
 * FN-25: a política era "mínimo 6 caracteres", sem complexidade nenhuma. O
 * `owner` de um ERP enxerga faturamento, custo e contas a pagar da empresa
 * inteira — `123456` protegendo isso é indefensável.
 */

describe('checkPassword', () => {
  it('rejects anything shorter than the minimum', () => {
    const result = checkPassword('Ab1!');
    expect(result.valid).toBe(false);
    expect(result.message).toContain(String(PASSWORD_MIN_LENGTH));
  });

  it('rejects the old default of six characters', () => {
    expect(checkPassword('123456').valid).toBe(false);
  });

  it('rejects a long password that uses only one class', () => {
    expect(checkPassword('aaaaaaaaaaaaaaa').valid).toBe(false);
    expect(checkPassword('123456789012345').valid).toBe(false);
  });

  it('accepts three of the four classes', () => {
    // minúscula + maiúscula + dígito, sem símbolo
    expect(checkPassword('MinhaSenha7').valid).toBe(true);
  });

  it('accepts a long passphrase with a symbol', () => {
    expect(checkPassword('cavalo-bateria-grampo9').valid).toBe(true);
  });

  it('rejects predictable passwords even when they pass the rules', () => {
    // `Senha123` tem 8 caracteres e 3 classes — passaria em toda regra
    // mecânica e ainda assim é a primeira coisa que alguém tenta.
    expect(checkPassword('Senha123').valid).toBe(false);
    expect(checkPassword('password').valid).toBe(false);
    expect(checkPassword('admin123').valid).toBe(false);
  });

  it('accepts a password that merely looks similar to a forbidden one', () => {
    expect(checkPassword('Senha1234xyz').valid).toBe(true);
  });

  it('refuses a password containing the user e-mail', () => {
    const result = checkPassword('Joaquim2026', ['joaquim@example.com']);
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/nome ou e-mail/i);
  });

  it('refuses a password containing the user name', () => {
    expect(checkPassword('Vendedora99', ['Ana Vendedora']).valid).toBe(false);
  });

  it('ignores context values too short to be meaningful', () => {
    // "ana" tem 3 letras: bloquear toda senha que a contenha seria absurdo
    expect(checkPassword('BananaSplit7', ['ana@x.com']).valid).toBe(true);
  });

  it('counts the classes it found', () => {
    expect(checkPassword('MinhaSenha7').classes).toBe(3);
    expect(checkPassword('MinhaSenha7!').classes).toBe(4);
  });
});

describe('isStrongPassword', () => {
  it('is the boolean shortcut of checkPassword', () => {
    expect(isStrongPassword('MinhaSenha7')).toBe(true);
    expect(isStrongPassword('123456')).toBe(false);
  });
});

describe('scorePassword', () => {
  it('is zero for an empty password', () => {
    expect(scorePassword('')).toBe(0);
  });

  it('grows with length and variety', () => {
    expect(scorePassword('abc')).toBeLessThan(scorePassword('MinhaSenha7'));
    expect(scorePassword('MinhaSenha7')).toBeLessThan(
      scorePassword('MinhaSenhaMuitoLonga7!'),
    );
  });

  it('never exceeds four', () => {
    expect(scorePassword('U1!aaaaaaaaaaaaaaaaaaaaaaaaa')).toBeLessThanOrEqual(4);
  });
});

describe('passwordStrengthLabel', () => {
  it('labels each score in pt-BR', () => {
    expect(passwordStrengthLabel(0)).toBe('Muito fraca');
    expect(passwordStrengthLabel(4)).toBe('Forte');
  });

  it('clamps out-of-range scores', () => {
    expect(passwordStrengthLabel(-1)).toBe('Muito fraca');
    expect(passwordStrengthLabel(99)).toBe('Forte');
  });
});
