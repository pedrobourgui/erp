import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { ZodQueryPipe } from './zod-query.pipe';

describe('ZodQueryPipe', () => {
  const querySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().optional(),
  });

  let pipe: ZodQueryPipe;

  beforeEach(() => {
    pipe = new ZodQueryPipe(querySchema);
  });

  it('should parse and coerce string query params to proper types', () => {
    const input = { page: '2', limit: '50', search: 'widget' };

    const result = pipe.transform(input);

    expect(result).toEqual({ page: 2, limit: 50, search: 'widget' });
  });

  it('should apply default values when params are missing', () => {
    const result = pipe.transform({});

    expect(result).toEqual({ page: 1, limit: 20 });
  });

  it('should throw BadRequestException for invalid query params', () => {
    expect(() => pipe.transform({ page: 'abc' })).toThrow(BadRequestException);
  });

  it('should throw BadRequestException when limit exceeds max', () => {
    expect(() => pipe.transform({ limit: '999' })).toThrow(BadRequestException);
  });

  it('should include field path in error messages', () => {
    try {
      pipe.transform({ page: '-1' });
      fail('Expected BadRequestException');
    } catch (error) {
      const response = (error as BadRequestException).getResponse() as Record<string, unknown>;
      expect(response.message).toBe('Erro nos parâmetros de consulta');
      expect(response.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining('page'),
        ]),
      );
    }
  });

  it('should include statusCode 400 in error response', () => {
    try {
      pipe.transform({ page: 'invalid' });
      fail('Expected BadRequestException');
    } catch (error) {
      const response = (error as BadRequestException).getResponse() as Record<string, unknown>;
      expect(response.statusCode).toBe(400);
    }
  });

  it('should throw for non-ZodError exceptions', () => {
    const brokenSchema = {
      parse: () => {
        throw new Error('Unexpected');
      },
    } as unknown as z.ZodSchema;
    const brokenPipe = new ZodQueryPipe(brokenSchema);

    expect(() => brokenPipe.transform({})).toThrow(BadRequestException);
    expect(() => brokenPipe.transform({})).toThrow('Erro de validação nos parâmetros de consulta');
  });
});
