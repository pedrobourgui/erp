import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ImportStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { parseCsv } from './csv-parser';
import { ROW_IMPORTERS } from './row-importers';
import { IMPORT_QUEUE } from './imports.service';

interface ImportJobData {
  importJobId: string;
}

interface RowError {
  line: number;
  message: string;
}

@Processor(IMPORT_QUEUE)
export class ImportsProcessor extends WorkerHost {
  private readonly logger = new Logger(ImportsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {
    super();
  }

  async process(job: Job<ImportJobData>): Promise<void> {
    const { importJobId } = job.data;

    const importJob = await this.prisma.importJob.findUnique({
      where: { id: importJobId },
    });
    if (!importJob) {
      this.logger.warn(`Import job ${importJobId} not found`);
      return;
    }

    await this.prisma.importJob.update({
      where: { id: importJobId },
      data: { status: 'PROCESSING' },
    });

    try {
      const buffer = await this.storage.getObjectBuffer(importJob.fileKey);
      const rows = parseCsv(buffer.toString('utf-8'));
      const importer = ROW_IMPORTERS[importJob.type];

      const errors: RowError[] = [];
      let success = 0;

      // Each row is persisted independently → partial imports are supported.
      for (let i = 0; i < rows.length; i++) {
        try {
          await importer(this.prisma, importJob.tenantId, rows[i]);
          success++;
        } catch (err) {
          errors.push({
            line: i + 2, // +1 header row, +1 to be 1-based
            message: (err as Error).message ?? 'Erro desconhecido',
          });
        }
      }

      const status: ImportStatus =
        errors.length === 0
          ? 'COMPLETED'
          : success > 0
            ? 'COMPLETED_WITH_ERRORS'
            : 'FAILED';

      await this.prisma.importJob.update({
        where: { id: importJobId },
        data: {
          status,
          totalRows: rows.length,
          successRows: success,
          errorRows: errors.length,
          errors: errors as unknown as Prisma.InputJsonValue,
        },
      });

      this.logger.log(
        `Import ${importJobId} done: ${success} ok, ${errors.length} errors (${status})`,
      );
    } catch (err) {
      this.logger.error(
        `Import ${importJobId} failed: ${(err as Error).message}`,
      );
      await this.prisma.importJob.update({
        where: { id: importJobId },
        data: {
          status: 'FAILED',
          errors: [
            { line: 0, message: (err as Error).message ?? 'Falha no processamento' },
          ] as unknown as Prisma.InputJsonValue,
        },
      });
    }
  }
}
