import { z } from 'zod';

// ─── Schema de login ──────────────────────────────────────────────────

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .nonempty("Este campo é obrigatório")
    .email('Endereço de e-mail inválido'),

  password: z
    .string()
    .nonempty("Este campo é obrigatório")
    .min(6, 'A senha deve ter pelo menos 6 caracteres.'),
})

export type LoginFormData = z.infer<typeof loginSchema>;

/// ─── Schema de convite ─────────────────────────────────────────────────

export const inviteSchema = z.object({
  email: z
    .string()
    .nonempty("Este campo é obrigatório")
    .max(254, "O e-mail deve conter no máximo 254 caracteres")
    .email("E-mail inválido"),

  role: z.enum(["admin", "manager", "operator", "viewer"], {
    required_error: "Este campo é obrigatório"
  }),
});

export type InviteFormValues = z.infer<typeof inviteSchema>;

// ─── Inventory schemas ─────────────────────────────────────────────────

export const updateStockSchema = z.object({
  productId: z.string().uuid('Invalid product ID'),
  warehouseId: z.string().uuid('Invalid warehouse ID'),
  quantity: z.number().int('Quantity must be an integer'),
  reason: z.string().min(1, 'Reason is required').max(255),
  referenceType: z.enum(['purchase', 'sale', 'adjustment', 'return', 'transfer']).optional(),
  referenceId: z.string().uuid().optional(),
});

export type UpdateStockInput = z.infer<typeof updateStockSchema>;

// ─── Pagination schema ─────────────────────────────────────────────────

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.string().max(50).optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().max(255).optional(),
});

export type PaginationInput = z.infer<typeof paginationSchema>;


// ─── Schema exports ─────────────────────────────────────────────────────

export * from "./stock/brand";
export * from "./stock/product";
export * from "./stock/category";
export * from "./stock/warehouse";
export * from "./sale/sale";
export * from "./sale/customer";
export * from "./financial/account";
export * from "./financial/cashier";
export * from "./financial/payments";
export * from "./configuration/company";



