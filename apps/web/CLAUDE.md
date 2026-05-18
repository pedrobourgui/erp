# Frontend Clean Code Rules

## Architecture
- Use App Router (app/) exclusively. No pages/ directory.
- Components follow: components/ui/ (primitives), components/forms/ (form inputs), components/tables/ (data display), components/charts/ (visualizations), components/layouts/ (shell)
- Hooks in hooks/ — prefix with `use`. One hook per file.
- Stores in stores/ — Zustand only. One store per domain. Suffix with `.store.ts`.
- Types in types/ — shared frontend types. Use `type` over `interface` unless extending.

## Component Rules
- Max 150 lines per component. Extract sub-components if larger.
- Always use named exports (no default exports except pages).
- Props interface defined above component, named `{ComponentName}Props`.
- Use `"use client"` only when truly needed (hooks, events, browser APIs).
- Server Components by default. Client Components are the exception.
- Colocate loading.tsx, error.tsx, not-found.tsx with page.tsx.

## Naming
- Components: PascalCase (e.g., `DataTable`, `KPICard`)
- Files: kebab-case (e.g., `data-table.tsx`, `kpi-card.tsx`)
- Hooks: camelCase with `use` prefix (e.g., `useProducts`)
- Stores: camelCase with `.store.ts` suffix (e.g., `auth.store.ts`)
- Types: PascalCase (e.g., `Product`, `OrderStatus`)
- Constants: UPPER_SNAKE_CASE
- Event handlers: `handle` + action (e.g., `handleSubmit`, `handleDelete`)

## State Management
- Server state: React Query (TanStack Query) exclusively
- Client state: Zustand for global, useState for local
- Never mix: no Redux, no Context for state (Context OK for providers)
- React Query keys: `[entity, action, params]` (e.g., `['products', 'list', { page: 1 }]`)

## Forms
- react-hook-form + zod for ALL forms
- Schemas in packages/validators for shared, local for page-specific
- Never use uncontrolled inputs without react-hook-form

### Input Masks (MANDATORY for Brazilian fields)
- **CPF**: `000.000.000-00` — use `maskCPF` from `@/lib/masks`
- **CNPJ**: `00.000.000/0000-00` — use `maskCNPJ` from `@/lib/masks`
- **Phone**: `(00) 00000-0000` or `(00) 0000-0000` — use `maskPhone` from `@/lib/masks`
- **CEP**: `00000-000` — use `maskCEP` from `@/lib/masks`
- Apply masks via `onChange` + `setValue` pattern with `{ shouldValidate: true }`
- Validate masked fields using `.refine()` on unmasked digit count, not `.min()` on string length
- Display stored values with masks in tables and detail pages (never show raw digits to users)
- Always set `maxLength` on masked inputs to prevent overshoot

### Field Character Limits
- All text inputs MUST have a `maxLength` prop matching the database column limit
- All zod schemas MUST have `.max()` matching the same database limit
- Common limits (from Prisma schema): name=255, description=2000, SKU=50, NCM=10, CEST=9, EAN=14, email=255, phone=20, document=18, address=500, city=100, state=2, zipCode=10

## Styling
- Tailwind CSS only. No CSS modules, styled-components, or inline styles.
- Use `cn()` utility for conditional classes
- Follow shadcn/ui patterns for all UI primitives
- Responsive: mobile-first (sm: md: lg:)
- Dark mode: always support via `dark:` variants

## Performance
- Use `next/image` for all images
- Use `next/link` for all internal links
- Lazy load below-fold components with `dynamic()`
- Memoize expensive computations with `useMemo`
- Debounce search inputs (300ms)

## Error Handling
- **EVERY** mutation call (`mutateAsync`) MUST be wrapped in try/catch
- On success: show a toast with a clear message describing what was done (e.g., "Produto criado com sucesso!")
- On error: show a toast with a clear, user-friendly error message (e.g., "Erro ao criar produto. Tente novamente.")
- Use `useToast()` from `@/components/ui/toast` — the `Toaster` is already mounted in `providers.tsx`
- Never let a mutation's Promise rejection go unhandled — silent failures are forbidden
- Use error.tsx boundaries for page-level errors
- Never swallow errors silently

## Imports
- Absolute imports with @/ alias
- Group: external → internal → components → hooks → utils → types
- Use type imports: `import type { X } from 'y'`

## Testing (TDD — Test-Driven Development)

### TDD Workflow (MANDATORY for all new features)

Every new feature, bug fix, or refactor MUST follow the Red-Green-Refactor cycle:

1. **RED**: Write a failing test FIRST that describes the expected behavior.
2. **GREEN**: Write the minimum code to make the test pass.
3. **REFACTOR**: Clean up the code while keeping tests green.

Do NOT write implementation code before its corresponding test exists.

### Test Stack
- **Vitest** as test runner (configured in `vitest.config.ts`)
- **@testing-library/react** + **@testing-library/jest-dom** for component testing
- **@testing-library/user-event** for simulating user interactions
- **msw** (Mock Service Worker) for API mocking in tests

### What to Test
- **Hooks**: Every custom hook must have a `.test.ts` file. Test data fetching, mutations, error states, cache invalidation.
- **Stores**: Test state transitions, persistence (localStorage), and hydration.
- **Utils/Lib**: Test every exported function with happy path + edge cases.
- **Components**: Test rendering, user interactions, loading/error/empty states, form validation.
- **Pages (E2E-style)**: Test full user flows with mocked API responses.

### Test File Location
- Test files live next to their source: `use-products.test.ts` beside `use-products.ts`.
- Component tests: `data-table.test.tsx` beside `data-table.tsx`.

### Naming Convention
```typescript
describe('useProducts', () => {
  it('should fetch products with default pagination', () => { /* ... */ });
  it('should handle API error gracefully', () => { /* ... */ });
});
```

## Do NOT
- Use `any` type — ever
- Use `console.log` in committed code (use `console.warn`/`console.error` only)
- Create files > 300 lines
- Put business logic in components (extract to hooks/services)
- Use index.ts barrel exports (causes bundle bloat)
- Hardcode strings that should be constants
- Skip loading/error states in data fetching
- Write implementation code without a corresponding test (TDD is mandatory)
