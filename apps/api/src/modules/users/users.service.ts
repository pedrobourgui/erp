import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { getRoleLabel } from '@erp/constants';
import { PrismaService } from '../../database/prisma/prisma.service';
import { RedisService } from '../../database/redis/redis.service';
import {
  StorageService,
  UploadedFileLike,
} from '../storage/storage.service';
import { CreateUserDto, UpdateUserDto, InviteUserDto } from './dto/user.dto';
import { UpdateProfileDto, ChangePasswordDto } from './dto/profile.dto';

const BCRYPT_SALT_ROUNDS = 12;
const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5 MB

const PROFILE_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  status: true,
  avatar: true,
  roleId: true,
  role: { select: { id: true, name: true } },
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  private readonly INVITE_TOKEN_TTL_SECONDS = 48 * 60 * 60; // 48 hours

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly storage: StorageService,
  ) {}

  async findAll(tenantId: string, pagination: { page: number; limit: number }) {
    const { page, limit } = pagination;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where: { tenantId, deletedAt: null },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          status: true,
          avatar: true,
          lastLoginAt: true,
          roleId: true,
          role: { select: { id: true, name: true } },
          createdAt: true,
          updatedAt: true,
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where: { tenantId, deletedAt: null } }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasMore: page < totalPages,
      },
    };
  }

  /**
   * Roles available in the tenant, for the invite dialog (FN-08).
   *
   * `POST /users/invite` requires a real `roleId`; the settings screen offered
   * four invented slugs, so every invite would have been rejected. The
   * permission rows are deliberately left out — the caller only needs to pick.
   */
  async findRoles(tenantId: string) {
    const roles = await this.prisma.role.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        description: true,
        _count: { select: { users: true } },
      },
      orderBy: { name: 'asc' },
    });

    return roles.map((role) => ({
      id: role.id,
      name: role.name,
      label: getRoleLabel(role.name),
      description: role.description,
      userCount: role._count.users,
    }));
  }

  async findById(tenantId: string, id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId, deletedAt: null },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        status: true,
        avatar: true,
        lastLoginAt: true,
        roleId: true,
        role: {
          select: {
            id: true,
            name: true,
            permissions: {
              select: {
                permission: { select: { resource: true, action: true } },
              },
            },
          },
        },
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`Usuário com id ${id} não encontrado`);
    }

    return user;
  }

  async create(tenantId: string, dto: CreateUserDto) {
    const existing = await this.prisma.user.findFirst({
      where: { tenantId, email: dto.email, deletedAt: null },
    });

    if (existing) {
      throw new ConflictException(`Já existe um usuário com o email ${dto.email}`);
    }

    const hashedPassword = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        tenantId,
        name: dto.name,
        email: dto.email,
        password: hashedPassword,
        phone: dto.phone,
        roleId: dto.roleId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        status: true,
        roleId: true,
        role: { select: { id: true, name: true } },
        createdAt: true,
      },
    });

    this.logger.log(`Usuário criado: ${user.id} no tenant ${tenantId}`);

    return user;
  }

  async update(tenantId: string, id: string, dto: UpdateUserDto) {
    const existing = await this.prisma.user.findFirst({
      where: { id, tenantId, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException(`Usuário com id ${id} não encontrado`);
    }

    if (dto.email && dto.email !== existing.email) {
      const emailTaken = await this.prisma.user.findFirst({
        where: { tenantId, email: dto.email, deletedAt: null, id: { not: id } },
      });

      if (emailTaken) {
        throw new ConflictException(`Já existe um usuário com o email ${dto.email}`);
      }
    }

    const updateData: Record<string, unknown> = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.email !== undefined) updateData.email = dto.email;
    if (dto.phone !== undefined) updateData.phone = dto.phone;
    if (dto.roleId !== undefined) updateData.roleId = dto.roleId;
    if (dto.status !== undefined) updateData.status = dto.status;

    if (dto.password) {
      updateData.password = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        status: true,
        roleId: true,
        role: { select: { id: true, name: true } },
        updatedAt: true,
      },
    });

    this.logger.log(`Usuário atualizado: ${id} no tenant ${tenantId}`);

    return user;
  }

  async invite(tenantId: string, dto: InviteUserDto) {
    // Check plan limit for max users
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { maxUsers: true },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantId} não encontrado`);
    }

    const currentUserCount = await this.prisma.user.count({
      where: { tenantId, deletedAt: null },
    });

    if (currentUserCount >= tenant.maxUsers) {
      throw new ForbiddenException(
        `Limite de usuários do plano atingido (${tenant.maxUsers}). Faça upgrade para convidar mais usuários.`,
      );
    }

    // Check if user already exists in this tenant
    const existing = await this.prisma.user.findFirst({
      where: { tenantId, email: dto.email, deletedAt: null },
    });

    if (existing) {
      throw new ConflictException(`Já existe um usuário com o email ${dto.email}`);
    }

    // Validate role exists for this tenant
    const role = await this.prisma.role.findFirst({
      where: { id: dto.roleId, tenantId },
      select: { id: true, name: true },
    });

    if (!role) {
      throw new BadRequestException(`Role com id ${dto.roleId} não encontrado neste tenant`);
    }

    // Generate invite token and store in Redis
    const token = randomBytes(32).toString('hex');
    const redisKey = `invite:${token}`;

    await this.redis.set(
      redisKey,
      JSON.stringify({
        email: dto.email,
        tenantId,
        roleId: dto.roleId,
      }),
      this.INVITE_TOKEN_TTL_SECONDS,
    );

    // TODO: Send invite email via notification/email service
    this.logger.log(
      `Invite sent to ${dto.email} for tenant ${tenantId} with role ${role.name}`,
    );

    return {
      email: dto.email,
      roleId: dto.roleId,
      roleName: role.name,
      token,
      expiresIn: this.INVITE_TOKEN_TTL_SECONDS,
    };
  }

  async delete(tenantId: string, id: string) {
    const existing = await this.prisma.user.findFirst({
      where: { id, tenantId, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException(`Usuário com id ${id} não encontrado`);
    }

    await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'INACTIVE' },
    });

    this.logger.log(`Usuário removido (soft delete): ${id} no tenant ${tenantId}`);
  }

  // ─── Self-service profile (SCRUM-23) ────────────────────────────────────

  /** Loads the authenticated user's own profile. */
  async getOwnProfile(tenantId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId, deletedAt: null },
      select: PROFILE_SELECT,
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    return user;
  }

  /** Updates the authenticated user's own cadastral data. */
  async updateOwnProfile(tenantId: string, userId: string, dto: UpdateProfileDto) {
    const existing = await this.prisma.user.findFirst({
      where: { id: userId, tenantId, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException('Usuário não encontrado');
    }

    if (dto.email && dto.email !== existing.email) {
      const emailTaken = await this.prisma.user.findFirst({
        where: { tenantId, email: dto.email, deletedAt: null, id: { not: userId } },
      });

      if (emailTaken) {
        throw new ConflictException(`Já existe um usuário com o email ${dto.email}`);
      }
    }

    const updateData: Record<string, unknown> = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.email !== undefined) updateData.email = dto.email;
    if (dto.phone !== undefined) updateData.phone = dto.phone;

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: PROFILE_SELECT,
    });

    this.logger.log(`Perfil atualizado pelo próprio usuário: ${userId}`);

    return user;
  }

  /** Changes the authenticated user's password, validating the current one. */
  async changeOwnPassword(tenantId: string, userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId, deletedAt: null },
      select: { id: true, password: true },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    const matches = await bcrypt.compare(dto.currentPassword, user.password);
    if (!matches) {
      throw new BadRequestException('A senha atual está incorreta');
    }

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('A nova senha deve ser diferente da atual');
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, BCRYPT_SALT_ROUNDS);

    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    this.logger.log(`Senha alterada pelo próprio usuário: ${userId}`);

    return { success: true };
  }

  /** Uploads and sets the authenticated user's avatar. */
  async updateOwnAvatar(tenantId: string, userId: string, file?: UploadedFileLike) {
    if (!file) {
      throw new BadRequestException('Nenhum arquivo enviado');
    }
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('O avatar deve ser uma imagem');
    }
    if (file.size > MAX_AVATAR_BYTES) {
      throw new BadRequestException('A imagem deve ter no máximo 5 MB');
    }

    const existing = await this.prisma.user.findFirst({
      where: { id: userId, tenantId, deletedAt: null },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('Usuário não encontrado');
    }

    const ext = file.originalname.includes('.')
      ? file.originalname.split('.').pop()
      : 'png';
    const objectName = `avatars/${tenantId}/${userId}-${Date.now()}.${ext}`;

    const stored = await this.storage.uploadBuffer(
      objectName,
      file.buffer,
      file.mimetype,
    );

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { avatar: stored.url },
      select: PROFILE_SELECT,
    });

    this.logger.log(`Avatar atualizado pelo próprio usuário: ${userId}`);

    return user;
  }
}
