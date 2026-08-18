import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';
import {
  documentErrorMessage,
  documentTypeOf,
  isValidDocument,
  type DocumentType,
} from '@erp/validators';

/**
 * AE-04: valida CPF/CNPJ com dígito verificador, usando a mesma implementação
 * que o front (`@erp/validators`). Antes disto o DTO só exigia
 * `@IsString() @MaxLength(18)`, então `111.111.111-11` entrava no banco.
 *
 * O tipo vem do campo irmão quando existe (`documentType`); sem ele, o número
 * de dígitos decide — é o caso da importação de CSV.
 */
export function IsBrDocument(
  typeProperty?: string,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isBrDocument',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          // Campo opcional: a obrigatoriedade é decidida por @IsOptional().
          if (value === undefined || value === null || value === '') return true;
          if (typeof value !== 'string') return false;

          const declaredType = typeProperty
            ? ((args.object as Record<string, unknown>)[typeProperty] as
                | DocumentType
                | undefined)
            : undefined;

          return isValidDocument(value, declaredType ?? documentTypeOf(value));
        },
        defaultMessage(args: ValidationArguments) {
          const declaredType = typeProperty
            ? ((args.object as Record<string, unknown>)[typeProperty] as
                | DocumentType
                | undefined)
            : undefined;
          return documentErrorMessage(
            declaredType ?? documentTypeOf(args.value as string),
          );
        },
      },
    });
  };
}
