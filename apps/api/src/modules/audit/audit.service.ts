import { Injectable, Logger } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';

export interface AuditRecord {
  tenantId: string;
  userId?: string | null;
  /** Model name, e.g. `AccountsReceivable`. */
  entity: string;
  entityId: string;
  action: AuditAction;
  oldData?: Prisma.InputJsonValue;
  newData?: Prisma.InputJsonValue;
  metadata?: Prisma.InputJsonValue;
}

/**
 * Writes the audit trail.
 *
 * The `AuditLog` table and the module shell existed since the beginning, but
 * nothing ever wrote to them. Lote 5 gave the financial module operations that
 * *must* leave a trail — reversing a settlement, editing a título, deleting one
 * — because each of them changes money that somebody already reconciled.
 *
 * Recording never fails the operation it describes: an audit write that throws
 * would roll back a correct reversal. It is logged and swallowed instead.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditRecord): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          tenantId: entry.tenantId,
          userId: entry.userId ?? null,
          entity: entry.entity,
          entityId: entry.entityId,
          action: entry.action,
          oldData: entry.oldData,
          newData: entry.newData,
          metadata: entry.metadata,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to write audit log for ${entry.entity} ${entry.entityId}: ${
          error instanceof Error ? error.message : error
        }`,
      );
    }
  }
}
