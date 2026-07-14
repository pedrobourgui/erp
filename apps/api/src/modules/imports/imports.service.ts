import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ImportType } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { StorageService, UploadedFileLike } from '../storage/storage.service';

export const IMPORT_QUEUE = 'imports';
export const PROCESS_IMPORT_JOB = 'process-import';

const MAX_CSV_BYTES = 10 * 1024 * 1024; // 10 MB

@Injectable()
export class ImportsService {
  private readonly logger = new Logger(ImportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    @InjectQueue(IMPORT_QUEUE) private readonly queue: Queue,
  ) {}

  /** Stores the CSV in MinIO, records an ImportJob and enqueues background processing. */
  async createImport(
    tenantId: string,
    userId: string,
    type: ImportType,
    file?: UploadedFileLike,
  ) {
    if (!file) {
      throw new BadRequestException('Nenhum arquivo enviado');
    }
    const isCsv =
      file.mimetype.includes('csv') ||
      file.mimetype === 'application/vnd.ms-excel' ||
      file.originalname.toLowerCase().endsWith('.csv');
    if (!isCsv) {
      throw new BadRequestException('O arquivo deve ser um CSV');
    }
    if (file.size > MAX_CSV_BYTES) {
      throw new BadRequestException('O arquivo deve ter no máximo 10 MB');
    }

    const objectName = `imports/${tenantId}/${type.toLowerCase()}/${Date.now()}-${file.originalname}`;
    const stored = await this.storage.uploadBuffer(
      objectName,
      file.buffer,
      file.mimetype || 'text/csv',
    );

    const job = await this.prisma.importJob.create({
      data: {
        tenantId,
        type,
        status: 'PENDING',
        fileName: file.originalname,
        fileKey: stored.key,
        createdBy: userId,
      },
    });

    await this.queue.add(PROCESS_IMPORT_JOB, { importJobId: job.id });

    this.logger.log(`Import ${job.id} (${type}) enqueued for tenant ${tenantId}`);

    return job;
  }

  async findAll(tenantId: string, type?: ImportType) {
    return this.prisma.importJob.findMany({
      where: { tenantId, ...(type ? { type } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async findOne(tenantId: string, id: string) {
    const job = await this.prisma.importJob.findFirst({
      where: { id, tenantId },
    });
    if (!job) {
      throw new NotFoundException('Importação não encontrada');
    }
    return job;
  }
}
