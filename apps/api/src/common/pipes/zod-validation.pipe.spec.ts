import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe';

describe('ZodValidationPipe', () => {
  const schema = z.object({
    name: z.string().min(1),
    email: z.string().email(),
    age: z.number().int().min(18).optional(),
  });

  let pipe: ZodValidationPipe;

  beforeEach(() => {
    pipe = new ZodValidationPipe(schema);
  });

  it('should return parsed value when input is valid', () => {
    const input = { name: 'Joao', email: 'joao@test.com', age: 25 };

    const result = pipe.transform(input);

    expect(result).toEqual(input);
  });

  it('should return parsed value with defaults applied', () => {
    const schemaWithDefault = z.object({
      name: z.string(),
      status: z.string().default('ACTIVE'),
    });
    const pipeWithDefault = new ZodValidationPipe(schemaWithDefault);

    const result = pipeWithDefault.transform({ name: 'Test' });

    expect(result).toEqual({ name: 'Test', status: 'ACTIVE' });
  });

  it('should throw BadRequestException when required field is missing', () => {
    expect(() => pipe.transform({ email: 'test@test.com' })).toThrow(BadRequestException);
  });

  it('should throw BadRequestException when email is invalid', () => {
    expect(() => pipe.transform({ name: 'Joao', email: 'not-an-email' })).toThrow(BadRequestException);
  });

  it('should include field path in error messages', () => {
    try {
      pipe.transform({ name: '', email: 'bad' });
      fail('Expected BadRequestException');
    } catch (error) {
      const response = (error as BadRequestException).getResponse() as Record<string, unknown>;
      expect(response.message).toBe('Erro de validação');
      expect(response.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining('name'),
          expect.stringContaining('email'),
        ]),
      );
    }
  });

  it('should include status code 400 in error response', () => {
    try {
      pipe.transform({});
      fail('Expected BadRequestException');
    } catch (error) {
      const response = (error as BadRequestException).getResponse() as Record<string, unknown>;
      expect(response.statusCode).toBe(400);
    }
  });

  it('should throw BadRequestException for non-ZodError exceptions', () => {
    // Use a schema that throws a non-Zod error via a .refine or similar
    const brokenSchema = {
      parse: () => {
        throw new Error('Something unexpected');
      },
    } as unknown as z.ZodSchema;
    const brokenPipe = new ZodValidationPipe(brokenSchema);

    expect(() => brokenPipe.transform({})).toThrow(BadRequestException);
    expect(() => brokenPipe.transform({})).toThrow('Erro de validação desconhecido');
  });

  it('should strip unknown properties', () => {
    const strictSchema = z.object({ name: z.string() }).strict();
    const strictPipe = new ZodValidationPipe(strictSchema);

    expect(() => strictPipe.transform({ name: 'Test', extra: 'field' })).toThrow(BadRequestException);
  });
});
