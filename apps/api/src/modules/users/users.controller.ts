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
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto, InviteUserDto, PaginationDto } from './dto/user.dto';
import { UpdateProfileDto, ChangePasswordDto } from './dto/profile.dto';
import { UploadedFileLike } from '../storage/storage.service';
import { CurrentTenant, CurrentUser } from '../../common/decorators/tenant.decorator';
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

  // ─── Self-service profile (SCRUM-23) ────────────────────────────────────
  // Declared before the ':id' routes so "me" is not captured as an id param.

  @Get('me')
  @ApiOperation({ summary: 'Obter o perfil do usuário autenticado' })
  async getOwnProfile(
    @CurrentTenant() tenantId: string,
    @CurrentUser() userId: string,
  ) {
    const user = await this.usersService.getOwnProfile(tenantId, userId);
    return { success: true, data: user };
  }

  @Patch('me')
  @ApiOperation({ summary: 'Atualizar o próprio cadastro' })
  async updateOwnProfile(
    @CurrentTenant() tenantId: string,
    @CurrentUser() userId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    const user = await this.usersService.updateOwnProfile(tenantId, userId, dto);
    return { success: true, data: user };
  }

  @Post('me/password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Trocar a própria senha' })
  async changeOwnPassword(
    @CurrentTenant() tenantId: string,
    @CurrentUser() userId: string,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.usersService.changeOwnPassword(tenantId, userId, dto);
    return { success: true };
  }

  @Post('me/avatar')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Enviar/atualizar o próprio avatar' })
  async updateOwnAvatar(
    @CurrentTenant() tenantId: string,
    @CurrentUser() userId: string,
    @UploadedFile() file: UploadedFileLike,
  ) {
    const user = await this.usersService.updateOwnAvatar(tenantId, userId, file);
    return { success: true, data: user };
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
