import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { TaxRegime } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { UpdateTenantDto } from './dto/update-tenant.dto';

@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name);

  private readonly BCRYPT_SALT_ROUNDS = 12;

  /**
   * Default role definitions with permission filters.
   * Used when creating a new tenant to seed system roles.
   */
  private readonly DEFAULT_ROLE_DEFINITIONS = [
    {
      name: 'admin',
      description: 'Administrador - acesso total ao sistema',
      filter: () => true,
    },
    {
      name: 'manager',
      description: 'Gerente - acesso à maioria dos módulos',
      filter: (p: { resource: string; action: string }) =>
        !['users', 'settings'].includes(p.resource) || p.action === 'read',
    },
    {
      name: 'operator',
      description: 'Operador - operações do dia a dia',
      filter: (p: { resource: string; action: string }) => {
        if (['orders', 'customers'].includes(p.resource))
          return ['create', 'read', 'update'].includes(p.action);
        if (p.resource === 'products') return p.action === 'read';
        if (p.resource === 'inventory') return ['read', 'update'].includes(p.action);
        if (p.resource === 'reports') return p.action === 'read';
        return false;
      },
    },
    {
      name: 'viewer',
      description: 'Visualizador - somente leitura',
      filter: (p: { resource: string; action: string }) => p.action === 'read',
    },
  ];

  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        document: true,
        email: true,
        phone: true,
        plan: true,
        status: true,
        taxRegime: true,
        maxUsers: true,
        maxProducts: true,
        maxOrders: true,
        maxWarehouses: true,
        settings: true,
        addressStreet: true,
        addressNumber: true,
        addressComplement: true,
        addressNeighborhood: true,
        addressCity: true,
        addressState: true,
        addressZipCode: true,
        trialEndsAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant com id ${id} não encontrado`);
    }

    return tenant;
  }

  async update(tenantId: string, dto: UpdateTenantDto) {
    // Verify tenant exists
    await this.findById(tenantId);

    // If document is being updated, check for duplicates
    if (dto.document) {
      const existing = await this.prisma.tenant.findFirst({
        where: {
          document: dto.document,
          deletedAt: null,
          id: { not: tenantId },
        },
      });

      if (existing) {
        throw new ConflictException(`Já existe um tenant com o CNPJ ${dto.document}`);
      }
    }

    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.document !== undefined && { document: dto.document }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.addressStreet !== undefined && { addressStreet: dto.addressStreet }),
        ...(dto.addressNumber !== undefined && { addressNumber: dto.addressNumber }),
        ...(dto.addressComplement !== undefined && { addressComplement: dto.addressComplement }),
        ...(dto.addressNeighborhood !== undefined && { addressNeighborhood: dto.addressNeighborhood }),
        ...(dto.addressCity !== undefined && { addressCity: dto.addressCity }),
        ...(dto.addressState !== undefined && { addressState: dto.addressState }),
        ...(dto.addressZipCode !== undefined && { addressZipCode: dto.addressZipCode }),
        ...(dto.taxRegime !== undefined && { taxRegime: dto.taxRegime as TaxRegime }),
      },
      select: {
        id: true,
        name: true,
        document: true,
        email: true,
        phone: true,
        plan: true,
        status: true,
        taxRegime: true,
        addressStreet: true,
        addressNumber: true,
        addressComplement: true,
        addressNeighborhood: true,
        addressCity: true,
        addressState: true,
        addressZipCode: true,
        updatedAt: true,
      },
    });

    this.logger.log(`Tenant updated: ${tenantId}`);

    return updated;
  }

  async findByDocument(document: string) {
    const tenant = await this.prisma.tenant.findFirst({
      where: { document, deletedAt: null },
      select: {
        id: true,
        name: true,
        document: true,
        email: true,
        phone: true,
        plan: true,
        status: true,
        taxRegime: true,
        createdAt: true,
      },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant com CNPJ ${document} não encontrado`);
    }

    return tenant;
  }

  /**
   * Create a new tenant with default roles and the first admin user.
   */
  async create(data: {
    name: string;
    document: string;
    email: string;
    phone?: string;
    adminName: string;
    adminEmail: string;
    adminPassword: string;
  }) {
    // Check for duplicate document
    const existing = await this.prisma.tenant.findFirst({
      where: { document: data.document, deletedAt: null },
    });

    if (existing) {
      throw new ConflictException(`Já existe um tenant com o CNPJ ${data.document}`);
    }

    const hashedPassword = await bcrypt.hash(data.adminPassword, this.BCRYPT_SALT_ROUNDS);

    return this.prisma.$transaction(async (tx) => {
      // 1. Create the tenant
      const tenant = await tx.tenant.create({
        data: {
          name: data.name,
          document: data.document,
          email: data.email,
          phone: data.phone,
          plan: 'TRIAL',
          status: 'ACTIVE',
          trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
          settings: {
            currency: 'BRL',
            timezone: 'America/Sao_Paulo',
            language: 'pt-BR',
          },
        },
      });

      // 2. Get all permissions
      const allPermissions = await tx.permission.findMany({
        select: { id: true, resource: true, action: true },
      });

      // 3. Create default roles with permissions
      let adminRoleId: string | undefined;

      for (const roleDef of this.DEFAULT_ROLE_DEFINITIONS) {
        const role = await tx.role.create({
          data: {
            tenantId: tenant.id,
            name: roleDef.name,
            description: roleDef.description,
            isSystem: true,
          },
        });

        if (roleDef.name === 'admin') {
          adminRoleId = role.id;
        }

        // Assign matching permissions
        const matchedPermissions = allPermissions.filter((p) =>
          roleDef.filter({ resource: p.resource, action: p.action }),
        );

        if (matchedPermissions.length > 0) {
          await tx.rolePermission.createMany({
            data: matchedPermissions.map((p) => ({
              roleId: role.id,
              permissionId: p.id,
            })),
          });
        }
      }

      // 4. Create the first user (admin)
      const adminUser = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: data.adminEmail,
          password: hashedPassword,
          name: data.adminName,
          status: 'ACTIVE',
          roleId: adminRoleId,
        },
        select: {
          id: true,
          email: true,
          name: true,
          roleId: true,
        },
      });

      this.logger.log(
        `Tenant created: ${tenant.id} (${tenant.name}) with admin user ${adminUser.id}`,
      );

      return {
        tenant: {
          id: tenant.id,
          name: tenant.name,
          document: tenant.document,
          plan: tenant.plan,
          status: tenant.status,
        },
        user: adminUser,
      };
    });
  }
}
