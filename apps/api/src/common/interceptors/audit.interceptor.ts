import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Request } from 'express';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditAction, Prisma } from '@prisma/client';

/**
 * Intercepta mutações (POST, PUT, PATCH, DELETE) e registra no audit log.
 * Espera que o controller retorne { entity, entityId, oldData?, newData? }
 * via metadata ou via o corpo da resposta.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const { method } = request;

    // Só audita mutações
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return next.handle();
    }

    const user = request.user as { sub?: string; tenantId?: string } | undefined;
    if (!user?.tenantId) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(async (responseData) => {
        try {
          const actionMap: Record<string, AuditAction> = {
            POST: AuditAction.CREATE,
            PUT: AuditAction.UPDATE,
            PATCH: AuditAction.UPDATE,
            DELETE: AuditAction.DELETE,
          };

          // Extrair info de auditoria do metadata do handler ou da URL
          const entity = this.extractEntity(request.url);
          const entityId = this.extractEntityId(responseData);

          if (entity && entityId) {
            await this.prisma.auditLog.create({
              data: {
                tenantId: user.tenantId!,
                userId: user.sub!,
                entity,
                entityId,
                action: actionMap[method] || AuditAction.UPDATE,
                newData: method !== 'DELETE' ? (responseData as Prisma.InputJsonValue) : undefined,
                ip: request.ip || request.socket.remoteAddress,
                userAgent: request.headers['user-agent'],
              },
            });
          }
        } catch (error) {
          // Audit log failure should not break the request
          this.logger.error('Failed to create audit log', error);
        }
      }),
    );
  }

  private extractEntity(url: string): string | null {
    const parts = url.replace(/^\/api\/v1\//, '').split('/');
    return parts[0] || null;
  }

  private extractEntityId(data: unknown): string | null {
    if (data && typeof data === 'object' && 'id' in data) {
      return String((data as { id: unknown }).id);
    }
    return null;
  }
}
