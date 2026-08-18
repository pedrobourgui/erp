import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';
import { checkPassword } from '@erp/validators';

/**
 * FN-25: política de senha, com a mesma implementação do front.
 *
 * Vale apenas onde a senha é **definida** — cadastro, convite, redefinição e
 * troca. O login continua aceitando o que o usuário tem: endurecer a validação
 * lá trancaria para fora quem cadastrou senha sob a política antiga, e a
 * migração dessas senhas é assunto de outro fluxo.
 *
 * `contextProperties` são campos do mesmo DTO que não podem aparecer na senha
 * — tipicamente `email` e `name`.
 */
export function IsStrongPassword(
  contextProperties: string[] = [],
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isStrongPassword',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          if (typeof value !== 'string') return false;
          return checkPassword(value, contextOf(args, contextProperties)).valid;
        },
        defaultMessage(args: ValidationArguments) {
          const result = checkPassword(
            (args.value as string) ?? '',
            contextOf(args, contextProperties),
          );
          return result.message ?? 'Senha inválida';
        },
      },
    });
  };
}

function contextOf(
  args: ValidationArguments,
  properties: string[],
): (string | undefined)[] {
  const target = args.object as Record<string, unknown>;
  return properties.map((property) => {
    const value = target[property];
    return typeof value === 'string' ? value : undefined;
  });
}
