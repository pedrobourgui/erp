import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { CashRegistersService } from './cash-registers.service';
import { PrismaService } from '../../database/prisma/prisma.service';

// ─── Constants ────────────────────────────────────────────────────────────

const TENANT_ID = 'tenant-uuid-001';
const USER_ID = 'user-uuid-001';
const REGISTER_ID = 'reg-uuid-001';
const SESSION_ID = 'session-uuid-001';

function createMockPrisma() {
  return {
    cashRegister: {
      findFirst: jest.fn(),
    },
    cashRegisterSession: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    orderPayment: {
      aggregate: jest.fn(),
    },
  };
}

describe('CashRegistersService', () => {
  let service: CashRegistersService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prisma = createMockPrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CashRegistersService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<CashRegistersService>(CashRegistersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── closeSession — expectedBalance including cash sales (SCRUM-29) ────────

  describe('closeSession', () => {
    beforeEach(() => {
      prisma.cashRegister.findFirst.mockResolvedValue({ id: REGISTER_ID, name: 'Caixa 01' });
      prisma.cashRegisterSession.findFirst.mockResolvedValue({
        id: SESSION_ID,
        openingBalance: 100,
        movements: [
          { type: 'SUPPLY', amount: 50 },
          { type: 'WITHDRAW', amount: 20 },
        ],
      });
      // Echo the update data so we can assert on expectedBalance/difference
      prisma.cashRegisterSession.update.mockImplementation(
        async ({ data }: { data: Record<string, unknown> }) => ({ id: SESSION_ID, ...data }),
      );
    });

    it('should add cash sales of the session to the expected balance', async () => {
      prisma.orderPayment.aggregate.mockResolvedValue({ _sum: { amount: 200 } });

      await service.closeSession(TENANT_ID, REGISTER_ID, USER_ID, {
        closingBalance: 335,
      } as never);

      const data = prisma.cashRegisterSession.update.mock.calls[0][0].data;
      // 100 (opening) + 50 (supply) - 20 (withdraw) + 200 (cash sales) = 330
      expect(data.expectedBalance).toBe(330);
      // Counted 335 => positive difference (surplus) of 5
      expect(data.difference).toBe(5);
    });

    it('should sum only CASH payments of orders linked to this session, scoped by tenant', async () => {
      prisma.orderPayment.aggregate.mockResolvedValue({ _sum: { amount: 0 } });

      await service.closeSession(TENANT_ID, REGISTER_ID, USER_ID, {
        closingBalance: 130,
      } as never);

      const where = prisma.orderPayment.aggregate.mock.calls[0][0].where;
      expect(where.tenantId).toBe(TENANT_ID);
      expect(where.paymentMethod).toEqual({ type: 'CASH' });
      expect(where.order).toEqual({ cashRegisterSessionId: SESSION_ID });
    });

    it('should fall back to opening + supplies - withdrawals when there are no cash sales', async () => {
      prisma.orderPayment.aggregate.mockResolvedValue({ _sum: { amount: null } });

      await service.closeSession(TENANT_ID, REGISTER_ID, USER_ID, {
        closingBalance: 130,
      } as never);

      const data = prisma.cashRegisterSession.update.mock.calls[0][0].data;
      // 100 + 50 - 20 + 0 = 130 => difference 0
      expect(data.expectedBalance).toBe(130);
      expect(data.difference).toBe(0);
    });

    it('should throw when there is no open session for the register', async () => {
      prisma.cashRegisterSession.findFirst.mockResolvedValue(null);

      await expect(
        service.closeSession(TENANT_ID, REGISTER_ID, USER_ID, { closingBalance: 100 } as never),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
