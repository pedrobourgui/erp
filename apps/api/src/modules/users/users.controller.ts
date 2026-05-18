import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto, InviteUserDto, PaginationDto } from './dto/user.dto';
import { CurrentTenant } from '../../common/decorators/tenant.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequirePermissions('users:read')
  @ApiOperation({ summary: 'Listar usuários do tenant' })
  async findAll(
    @CurrentTenant() tenantId: string,
    @Query() pagination: PaginationDto,
  ) {
    const result = await this.usersService.findAll(tenantId, {
      page: pagination.page ?? 1,
      limit: pagination.limit ?? 20,
    });

    return {
      success: true,
      ...result,
    };
  }

  @Get(':id')
  @RequirePermissions('users:read')
  @ApiOperation({ summary: 'Obter usuário por ID' })
  async findById(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    const user = await this.usersService.findById(tenantId, id);

    return {
      success: true,
      data: user,
    };
  }

  @Post()
  @RequirePermissions('users:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Criar novo usuário' })
  async create(
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateUserDto,
  ) {
    const user = await this.usersService.create(tenantId, dto);

    return {
      success: true,
      data: user,
    };
  }

  @Post('invite')
  @RequirePermissions('users:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Enviar convite para novo usuário' })
  async invite(
    @CurrentTenant() tenantId: string,
    @Body() dto: InviteUserDto,
  ) {
    const result = await this.usersService.invite(tenantId, dto);

    return {
      success: true,
      data: result,
    };
  }

  @Patch(':id')
  @RequirePermissions('users:update')
  @ApiOperation({ summary: 'Atualizar usuário' })
  async update(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ) {
    const user = await this.usersService.update(tenantId, id, dto);

    return {
      success: true,
      data: user,
    };
  }

  @Delete(':id')
  @RequirePermissions('users:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remover usuário (soft delete)' })
  async delete(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    await this.usersService.delete(tenantId, id);
  }
}
