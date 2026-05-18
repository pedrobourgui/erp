import {
  PipeTransform,
  Injectable,
  BadRequestException,
  ArgumentMetadata,
} from '@nestjs/common';
import { ZodSchema, ZodError } from 'zod';

/**
 * Pipe de validação Zod para query parameters.
 * Query params chegam como strings — os schemas devem usar z.coerce
 * para converter automaticamente strings em números, booleans, etc.
 */
@Injectable()
export class ZodQueryPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(value: unknown, metadata?: ArgumentMetadata) {
    try {
      const parsed = this.schema.parse(value);
      return parsed;
    } catch (error) {
      if (error instanceof ZodError) {
        const messages = error.errors.map((e) => {
          const field = e.path.length > 0 ? e.path.join('.') : 'parâmetro';
          return `${field}: ${e.message}`;
        });
        throw new BadRequestException({
          message: 'Erro nos parâmetros de consulta',
          errors: messages,
          statusCode: 400,
        });
      }
      throw new BadRequestException('Erro de validação nos parâmetros de consulta');
    }
  }
}
