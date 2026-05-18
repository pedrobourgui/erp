import {
  PipeTransform,
  Injectable,
  BadRequestException,
  ArgumentMetadata,
} from '@nestjs/common';
import { ZodSchema, ZodError } from 'zod';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(value: unknown, metadata?: ArgumentMetadata) {
    try {
      const parsed = this.schema.parse(value);
      return parsed;
    } catch (error) {
      if (error instanceof ZodError) {
        const messages = error.errors.map((e) => {
          const field = e.path.length > 0 ? e.path.join('.') : 'valor';
          return `${field}: ${e.message}`;
        });
        throw new BadRequestException({
          message: 'Erro de validação',
          errors: messages,
          statusCode: 400,
        });
      }
      throw new BadRequestException('Erro de validação desconhecido');
    }
  }
}
