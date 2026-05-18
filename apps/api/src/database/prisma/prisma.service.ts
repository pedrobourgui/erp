import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { level: 'error', emit: 'stdout' },
        { level: 'warn', emit: 'stdout' },
      ],
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Database connected');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Database disconnected');
  }

  /**
   * Extensão para multi-tenancy: injeta tenantId automaticamente
   * em todas as queries de um contexto.
   */
  forTenant(tenantId: string) {
    return this.$extends({
      query: {
        $allModels: {
          async findMany({ args, query }) {
            args.where = { ...args.where, tenantId };
            return query(args);
          },
          async findFirst({ args, query }) {
            args.where = { ...args.where, tenantId };
            return query(args);
          },
          async findUnique({ args, query }) {
            return query(args);
          },
          async create({ args, query }) {
            args.data = { ...args.data, tenantId } as typeof args.data;
            return query(args);
          },
          async update({ args, query }) {
            args.where = { ...args.where, tenantId } as typeof args.where;
            return query(args);
          },
          async delete({ args, query }) {
            args.where = { ...args.where, tenantId } as typeof args.where;
            return query(args);
          },
          async count({ args, query }) {
            args.where = { ...args.where, tenantId };
            return query(args);
          },
        },
      },
    });
  }
}
