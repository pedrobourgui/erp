# ERP Backend — Clean Code & Coding Standards

This document defines the rules and conventions for all code written in the NestJS API backend (`apps/api`). Every contributor — human or AI — must follow these standards without exception.

---

## Architecture & DDD

- Each module follows this structure: `module.ts`, `controller.ts`, `service.ts`, `dto/`, `entities/` (if needed).
- **Controller**: thin, only HTTP concerns. Parse the request, validate input, delegate to the service, format the response. No business logic.
- **Service**: business logic lives here. One public method per use case. Max 80 lines per method.
- **Repository pattern**: services talk to Prisma. Controllers never access Prisma directly.
- **Use Cases**: for complex operations (involving multiple aggregates, external calls, or transactions), create dedicated use-case classes in a `use-cases/` directory inside the module.
- **Events**: use domain events for cross-module communication. Never import one domain module into another directly. Emit events via NestJS `EventEmitter2` and subscribe in the target module.

### Module Directory Example

```
src/modules/products/
├── products.module.ts
├── products.controller.ts
├── products.service.ts
├── dto/
│   ├── create-product.dto.ts
│   ├── update-product.dto.ts
│   └── product-response.dto.ts
├── entities/
│   └── product.entity.ts
├── use-cases/
│   └── bulk-import-products.use-case.ts
├── events/
│   └── product-created.event.ts
└── products.service.spec.ts
```

---

## Multi-tenancy Rules (CRITICAL)

These rules are non-negotiable. Violating them causes data leaks between tenants.

- **EVERY** database query MUST be scoped by `tenantId`. No exceptions.
- Use the `@CurrentTenant()` decorator in controllers to extract the tenant from the request context.
- Pass `tenantId` as the **first parameter** in every public service method.
- **NEVER** use `PrismaService` directly without tenant scoping. Either use `prisma.forTenant(tenantId)` or explicitly add a `where` clause with `tenantId`.
- Write dedicated tests for tenant isolation: query with tenant A must never return tenant B data.

### Example

```typescript
// Controller
@Get()
async findAll(@CurrentTenant() tenantId: string, @Query() query: PaginationDto) {
  return this.productsService.findAll(tenantId, query);
}

// Service
async findAll(tenantId: string, query: PaginationDto) {
  return this.prisma.product.findMany({
    where: { tenantId },
    skip: (query.page - 1) * query.limit,
    take: query.limit,
  });
}
```

---

## Naming Conventions

| Element       | Convention   | Example                        |
|---------------|-------------|--------------------------------|
| Controllers   | PascalCase + `Controller` | `ProductsController`     |
| Services      | PascalCase + `Service`    | `ProductsService`        |
| DTOs          | PascalCase + `Dto`        | `CreateProductDto`       |
| Events        | PascalCase + `Event`      | `OrderCreatedEvent`      |
| Guards        | PascalCase + `Guard`      | `TenantGuard`            |
| Interceptors  | PascalCase + `Interceptor`| `LoggingInterceptor`     |
| Files         | kebab-case                | `products.controller.ts`, `create-product.dto.ts` |
| DB tables     | snake_case (via Prisma `@@map`) | `order_items`     |
| DB columns    | snake_case (via Prisma `@map`)  | `created_at`      |

---

## API Design

- Follow RESTful conventions: proper HTTP methods (`GET`, `POST`, `PATCH`, `DELETE`) and status codes (`200`, `201`, `204`, `400`, `401`, `403`, `404`, `409`, `422`, `500`).
- All routes are prefixed with `/api/v1/`.
- **Pagination**: accept `page` and `limit` query params. Return:
  ```json
  {
    "data": [],
    "meta": {
      "total": 100,
      "page": 1,
      "limit": 20,
      "totalPages": 5,
      "hasMore": true
    }
  }
  ```
- **Error responses**: return a consistent shape:
  ```json
  {
    "success": false,
    "statusCode": 400,
    "message": "Validation failed",
    "errors": [{ "field": "email", "message": "must be a valid email" }],
    "timestamp": "2026-03-21T10:00:00.000Z",
    "path": "/api/v1/products"
  }
  ```
- Use `class-validator` decorators on all DTOs.
- Use Zod for complex validations (shared schemas live in `packages/validators`).

---

## Error Handling

- Use NestJS built-in exceptions: `NotFoundException`, `BadRequestException`, `ConflictException`, `ForbiddenException`, `UnauthorizedException`, etc.
- **Never** throw a generic `Error`. Always use typed `HttpException` subclasses.
- The service layer throws business exceptions. Controllers do not catch them — the global exception filter handles all uncaught errors.
- Log every error with context: entity name, entity ID, `tenantId`, `userId`.

### Example

```typescript
// Correct
throw new NotFoundException(`Product with id ${id} not found for tenant ${tenantId}`);

// Wrong — never do this
throw new Error('Product not found');
```

---

## Security

- Apply `@RequirePermissions()` on **every** mutation endpoint (`POST`, `PATCH`, `DELETE`).
- Use `@Public()` only on authentication endpoints and webhook receivers.
- Validate **all** input through DTOs and Zod schemas. Trust nothing from the client.
- Sanitize output: never expose passwords, tokens, internal IDs, or fields that the caller does not need. Map Prisma models to response DTOs.
- Rate-limit sensitive endpoints (login, password reset, OTP verification).

---

## Testing (TDD — Test-Driven Development)

### TDD Workflow (MANDATORY for all new features)

Every new feature, bug fix, or refactor MUST follow the Red-Green-Refactor cycle:

1. **RED**: Write a failing test FIRST that describes the expected behavior.
2. **GREEN**: Write the minimum code to make the test pass.
3. **REFACTOR**: Clean up the code while keeping tests green.

Do NOT write implementation code before its corresponding test exists. The test defines the contract.

### Test Rules

- **Unit tests** for services: mock Prisma, Redis, and external dependencies.
- **Unit tests** for guards, pipes, interceptors, and filters.
- **Unit tests** for event handlers: verify side effects (stock reservation, receivable creation, notifications).
- **Integration tests** for controllers: use Supertest against the NestJS app.
- Test files live next to their source: `products.service.spec.ts` beside `products.service.ts`.
- Naming convention:
  ```typescript
  describe('ProductsService', () => {
    describe('create', () => {
      it('should create a product with valid data', () => { /* ... */ });
      it('should throw BadRequestException when name is empty', () => { /* ... */ });
    });
  });
  ```
- **ALWAYS** test tenant isolation: confirm that querying with tenant A never returns tenant B data.
- **ALWAYS** test permission checks: confirm that users without the required permission receive `403`.
- **ALWAYS** test error paths: invalid input, not found, duplicate, insufficient stock, etc.
- **ALWAYS** test event emissions: verify the correct event is emitted with the correct payload.
- Use test factories (`test/factories/`) for generating test data — never hardcode entity data inline.
- Use `it.each` for parameterized tests (e.g., state machine transitions).
- Aim for >80% coverage on services and guards. 100% on security-critical paths (auth, permissions, tenant isolation).

---

## Performance

- Use Prisma `select` to fetch only the fields you need. Never fetch full rows when you only need a few columns.
- Use Prisma `include` sparingly. Never nest deeper than 2 levels.
- Cache frequently read, rarely changed data in Redis with a TTL of 5-15 minutes.
- Use BullMQ for any operation that takes longer than 500ms (report generation, bulk imports, email sending, PDF creation).
- Add database indexes on all foreign keys and columns used in frequent `WHERE` / `ORDER BY` clauses.

---

## Do NOT

- Use the `any` type. Ever. Use `unknown` and narrow with type guards if the type is truly dynamic.
- Use `console.log`. Use the NestJS `Logger` service instead (`this.logger.log()`, `this.logger.warn()`, `this.logger.error()`).
- Put business logic in controllers. Controllers are thin wrappers.
- Import between domain modules directly. Use events for cross-module communication.
- Skip validation on any input. All data from the outside world is untrusted.
- Return Prisma models directly from controllers. Map them to response DTOs.
- Use synchronous file I/O (`fs.readFileSync`, etc.). Use async alternatives.
- Hardcode configuration values (URLs, secrets, feature flags). Use `ConfigService` and environment variables.
- Skip error handling on external API calls. Wrap them in try/catch, log failures, and throw meaningful exceptions.
- Create god services exceeding 500 lines. Split into focused use-case classes.
