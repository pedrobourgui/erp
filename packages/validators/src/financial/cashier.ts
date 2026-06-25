import z from "zod";

// ─── Schema do caixa ────────────────────────────────────────────────────

const coerceNumber = (value: unknown) => {
  if (value === "" || value === null || value === undefined) return 0;
  const n = Number(value);
  return Number.isNaN(n) ? 0 : n;
};

export const cashierSchema = z.object({
  name: z
    .string()
    .trim()
    .nonempty("Este campo é obrigatório")
    .max(50, "O nome do caixa deve conter no máximo 50 caracteres")
    .regex(
        /^[a-zA-ZÀ-ÿ0-9\s\-_.&/]+$/,
        "O nome do caixa contém caracteres inválidos"
    )
    .transform(value => value.replace(/\s+/g, ' ')),

  financialAccountId: z.string().nonempty("Este campo é obrigatório"),
});

export type CashierFormValues = z.infer<typeof cashierSchema>

// Schema da movimentação do caixa
export const movementSchema = z.object({
  amount: z.preprocess(
    coerceNumber, 
    z
        .number()
        .min(0.01, "Este campo é obrigatório")),

  reason: z
        .string()
        .trim()
        .nonempty("Este campo é obrigatório")
        .min(3, "O motivo deve conter no mínimo 3 caracteres")
        .max(50, "O motivo deve conter no máximo 50 caracteres")
        .regex(
            /^[a-zA-ZÀ-ÿ0-9\s.,\-_/()&%]+$/,
            "O motivo contém caracteres inválidos"
        )
        .transform(value => value.replace(/\s+/g, ' ')),
});

export type MovementFormValues = z.infer<typeof movementSchema>;

// Schema da abertura do caixa
export const openSchema = z.object({
  openingBalance: z.preprocess(coerceNumber, z.number().min(0, "Valor inválido")),
});

export type OpenFormValues = z.infer<typeof openSchema>;

// Schema do fechamento do caixa
export const closeSchema = z.object({
  closingBalance: z.preprocess(coerceNumber, z.number().min(0, "Valor inválido")),
  
  notes: z
    .string()
    .trim()
    .max(500, "A observação deve conter no máximo 500 caracteres")
    .transform(value => value.replace(/\s+/g, ' '))
    .optional(),
});

export type CloseFormValues = z.infer<typeof closeSchema>;