import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { ImportType } from '@prisma/client';
import { ImportsService } from './imports.service';
import { UploadedFileLike } from '../storage/storage.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CurrentTenant, CurrentUser } from '../../common/decorators/tenant.decorator';

const TYPE_MAP: Record<string, ImportType> = {
  products: 'PRODUCTS',
  customers: 'CUSTOMERS',
  expenses: 'EXPENSES',
};

function resolveType(raw: string): ImportType {
  const type = TYPE_MAP[raw?.toLowerCase()];
  if (!type) {
    throw new BadRequestException(
      `Tipo de importação inválido: ${raw}. Use products, customers ou expenses.`,
    );
  }
  return type;
}

@ApiTags('Imports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('imports')
export class ImportsController {
  constructor(private readonly importsService: ImportsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar importações do tenant' })
  async findAll(
    @CurrentTenant() tenantId: string,
    @Query('type') type?: string,
  ) {
    const filter = type ? resolveType(type) : undefined;
    const data = await this.importsService.findAll(tenantId, filter);
    return { success: true, data };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obter status e relatório de uma importação' })
  async findOne(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    const data = await this.importsService.findOne(tenantId, id);
    return { success: true, data };
  }

  @Post(':type')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Enviar um CSV para importação (products|customers|expenses)' })
  async upload(
    @CurrentTenant() tenantId: string,
    @CurrentUser() userId: string,
    @Param('type') type: string,
    @UploadedFile() file: UploadedFileLike,
  ) {
    const importType = resolveType(type);
    const job = await this.importsService.createImport(
      tenantId,
      userId,
      importType,
      file,
    );
    return { success: true, data: job };
  }
}
