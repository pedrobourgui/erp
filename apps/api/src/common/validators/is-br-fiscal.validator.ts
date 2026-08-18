import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';
import {
  FISCAL_MESSAGES,
  isValidCEST,
  isValidCFOP,
  isValidGTIN,
  isValidNCM,
} from '@erp/validators';

type FiscalField = keyof typeof FISCAL_MESSAGES;

const VALIDATORS: Record<FiscalField, (value: string) => boolean> = {
  ncm: isValidNCM,
  cest: isValidCEST,
  ean: isValidGTIN,
  cfop: isValidCFOP,
};

/**
 * AE-08: valida NCM, CEST, EAN/GTIN e CFOP com as mesmas funções do front
 * (`@erp/validators`). Antes disto os campos eram `@IsString()` puro e
 * `ncm: 'ABCDEFG'` entrava no banco — NF-e rejeitada pela SEFAZ meses depois.
 *
 * Campo vazio passa: a obrigatoriedade continua sendo do `@IsOptional()`.
 */
export function IsBrFiscal(field: FiscalField, options?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: `isBrFiscal_${field}`,
      target: object.constructor,
      propertyName,
      options,
      validator: {
        validate(value: unknown) {
          if (value === undefined || value === null || value === '') return true;
          if (typeof value !== 'string') return false;
          return VALIDATORS[field](value);
        },
        defaultMessage(_args: ValidationArguments) {
          return FISCAL_MESSAGES[field];
        },
      },
    });
  };
}
