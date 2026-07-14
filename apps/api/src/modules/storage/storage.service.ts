import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client as MinioClient } from 'minio';

/** Minimal shape of a Multer in-memory uploaded file (avoids @types/multer). */
export interface UploadedFileLike {
  originalname: string;
  buffer: Buffer;
  mimetype: string;
  size: number;
}

export interface StoredObject {
  key: string;
  url: string;
}

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: MinioClient;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;

  constructor(private readonly config: ConfigService) {
    const endpoint = this.config.get<string>('minio.endpoint', 'localhost');
    const port = this.config.get<number>('minio.port', 9000);
    const useSSL = this.config.get<boolean>('minio.useSSL', false);
    this.bucket = this.config.get<string>('minio.bucket', 'erp-files');

    this.client = new MinioClient({
      endPoint: endpoint,
      port,
      useSSL,
      accessKey: this.config.get<string>('minio.accessKey', ''),
      secretKey: this.config.get<string>('minio.secretKey', ''),
    });

    const scheme = useSSL ? 'https' : 'http';
    this.publicBaseUrl = `${scheme}://${endpoint}:${port}/${this.bucket}`;
  }

  async onModuleInit(): Promise<void> {
    try {
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) {
        await this.client.makeBucket(this.bucket, 'us-east-1');
        this.logger.log(`Created MinIO bucket ${this.bucket}`);
      }
      await this.ensurePublicReadPolicy();
    } catch (error) {
      this.logger.error(
        `Failed to initialize MinIO bucket ${this.bucket}: ${(error as Error).message}`,
      );
    }
  }

  /** Grants anonymous read on the bucket so stored URLs (avatars, images) are viewable. */
  private async ensurePublicReadPolicy(): Promise<void> {
    const policy = {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: { AWS: ['*'] },
          Action: ['s3:GetObject'],
          Resource: [`arn:aws:s3:::${this.bucket}/*`],
        },
      ],
    };
    await this.client.setBucketPolicy(this.bucket, JSON.stringify(policy));
  }

  /**
   * Uploads a buffer under the given object key and returns its public URL.
   * @param objectName full object key (e.g. `avatars/<userId>/<file>`)
   */
  async uploadBuffer(
    objectName: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<StoredObject> {
    await this.client.putObject(this.bucket, objectName, buffer, buffer.length, {
      'Content-Type': mimeType,
    });

    this.logger.log(`Uploaded object ${objectName} (${buffer.length} bytes)`);

    return { key: objectName, url: `${this.publicBaseUrl}/${objectName}` };
  }

  /** Reads an object fully into a buffer (used by background CSV import). */
  async getObjectBuffer(objectName: string): Promise<Buffer> {
    const stream = await this.client.getObject(this.bucket, objectName);
    const chunks: Buffer[] = [];
    return new Promise<Buffer>((resolve, reject) => {
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }

  async removeObject(objectName: string): Promise<void> {
    await this.client.removeObject(this.bucket, objectName);
  }
}
