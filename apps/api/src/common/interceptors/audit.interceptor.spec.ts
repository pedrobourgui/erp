import { CallHandler, ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';
import { AuditInterceptor } from './audit.interceptor';
import { PrismaService } from '../../database/prisma/prisma.service';

// ─── Mock Factories ──────────────────────────────────────────────────────────

function createMockPrisma() {
  return {
    auditLog: {
      create: jest.fn().mockResolvedValue({}),
    },
  };
}

function createMockExecutionContext(
  method: string,
  url: string,
  user?: { sub?: string; tenantId?: string },
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        method,
        url,
        user,
        ip: '127.0.0.1',
        socket: { remoteAddress: '127.0.0.1' },
        headers: { 'user-agent': 'jest-test' },
      }),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

function createMockCallHandler(responseData: unknown = {}): CallHandler {
  return {
    handle: () => of(responseData),
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('AuditInterceptor', () => {
  let interceptor: AuditInterceptor;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    interceptor = new AuditInterceptor(prisma as unknown as PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should skip audit for GET requests', (done) => {
    const context = createMockExecutionContext('GET', '/api/v1/products', { sub: 'user-001', tenantId: 'tenant-001' });
    const handler = createMockCallHandler({ id: 'prod-001' });

    interceptor.intercept(context, handler).subscribe({
      next: () => {
        // Wait for the tap to execute
        setTimeout(() => {
          expect(prisma.auditLog.create).not.toHaveBeenCalled();
          done();
        }, 10);
      },
    });
  });

  it('should skip audit when user has no tenantId', (done) => {
    const context = createMockExecutionContext('POST', '/api/v1/auth/login', undefined);
    const handler = createMockCallHandler({ token: 'abc' });

    interceptor.intercept(context, handler).subscribe({
      next: () => {
        setTimeout(() => {
          expect(prisma.auditLog.create).not.toHaveBeenCalled();
          done();
        }, 10);
      },
    });
  });

  it('should create audit log for POST requests with entity and entityId', (done) => {
    const context = createMockExecutionContext('POST', '/api/v1/products', { sub: 'user-001', tenantId: 'tenant-001' });
    const handler = createMockCallHandler({ id: 'prod-new', name: 'Widget' });

    interceptor.intercept(context, handler).subscribe({
      next: () => {
        setTimeout(() => {
          expect(prisma.auditLog.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
              tenantId: 'tenant-001',
              userId: 'user-001',
              entity: 'products',
              entityId: 'prod-new',
              action: 'CREATE',
              ip: '127.0.0.1',
              userAgent: 'jest-test',
            }),
          });
          done();
        }, 10);
      },
    });
  });

  it('should create audit log for PATCH requests with UPDATE action', (done) => {
    const context = createMockExecutionContext('PATCH', '/api/v1/orders/order-001/status', { sub: 'user-001', tenantId: 'tenant-001' });
    const handler = createMockCallHandler({ id: 'order-001', status: 'CONFIRMED' });

    interceptor.intercept(context, handler).subscribe({
      next: () => {
        setTimeout(() => {
          expect(prisma.auditLog.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
              action: 'UPDATE',
              entity: 'orders',
            }),
          });
          done();
        }, 10);
      },
    });
  });

  it('should create audit log for DELETE requests with DELETE action', (done) => {
    const context = createMockExecutionContext('DELETE', '/api/v1/customers/cust-001', { sub: 'user-001', tenantId: 'tenant-001' });
    const handler = createMockCallHandler({ id: 'cust-001' });

    interceptor.intercept(context, handler).subscribe({
      next: () => {
        setTimeout(() => {
          expect(prisma.auditLog.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
              action: 'DELETE',
              entity: 'customers',
            }),
          });
          done();
        }, 10);
      },
    });
  });

  it('should not break request when audit log creation fails', (done) => {
    prisma.auditLog.create.mockRejectedValue(new Error('DB error'));

    const context = createMockExecutionContext('POST', '/api/v1/products', { sub: 'user-001', tenantId: 'tenant-001' });
    const handler = createMockCallHandler({ id: 'prod-001' });

    interceptor.intercept(context, handler).subscribe({
      next: (result) => {
        expect(result).toEqual({ id: 'prod-001' });
        done();
      },
    });
  });

  it('should not create audit log when response has no id', (done) => {
    const context = createMockExecutionContext('POST', '/api/v1/auth/logout', { sub: 'user-001', tenantId: 'tenant-001' });
    const handler = createMockCallHandler({ success: true });

    interceptor.intercept(context, handler).subscribe({
      next: () => {
        setTimeout(() => {
          expect(prisma.auditLog.create).not.toHaveBeenCalled();
          done();
        }, 10);
      },
    });
  });
});
