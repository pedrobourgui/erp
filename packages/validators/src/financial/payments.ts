import z from "zod";

// ─── Schema da condição ────────────────────────────────────────────────────────────

export const conditionSchema = z.object({
  name: z
    .string()
    .trim()
    .nonempty("Este campo é obrigatório")
    .max(40, "O nome da condição deve conter no máximo 40 caracteres")
    .transform(value => value.replace(/\s+/g, ' ')),

  code: z
    .string()
    .nonempty("Este campo é obrigatório")
    .max(20, "O código da condição deve conter no máximo 20 caracteres")
    .regex(/^[a-zA-Z0-9_-]+$/, "O código contém caracteres não permitidos")
    .regex(
    /^(?![-_])(?!.*[-_]$)[a-zA-Z0-9_-]+$/,
    "O código não pode começar ou terminar com caracteres especiais"
    )
    .refine(value => /[a-zA-Z0-9]/.test(value), {
    message: "Deve conter pelo menos uma letra ou número",
    }),

  type: z.enum(["CASH", "INSTALLMENT", "ENTRY_PLUS_INSTALLMENT"], {
  required_error: "Este campo é obrigatório",
}),

  installments: z
    .number({
      invalid_type_error: "Mínimo de 1 parcela"
    })
    .min(1, "Mínimo de 1 parcela")
    .max(48, "Permitido até 48 parcelas")
    .default(1),

  daysBetweenInstallments: z
    .number({
      invalid_type_error: "Deve ser pelo menos 1 dia"
    })
    .min(1, "Deve ser pelo menos 1 dia")
    .max(730, "O máximo é de 730 dias")
    .default(30),

  entryPercentage: z
    .number({
      invalid_type_error: "A entrada deve ser de no mínimo 1%"
    })
    .min(1, "A entrada deve ser de no mínimo 1%") 
    .max(100, "A entrada deve ser de no máximo 100%")
    .default(0),
});

export type ConditionFormValues = z.infer<typeof conditionSchema>;

// ─── Schema do método ───────────────────────────────────────────────────────────

export const methodSchema = z.object({
  name: z
    .string()
    .trim()
    .nonempty("Este campo é obrigatório")
    .max(100, "O nome do método deve conter no máximo 100 caracteres")
    .regex(
        /^[A-Za-zÀ-ÿ0-9\s\-\/&().]+$/,
        "O nome do método contém caracteres inválidos"
    )
    .regex(
      /^(?![-_])(?!.*[-_]$)[a-zA-Z0-9_-]+$/,
      "O método não pode começar ou terminar com caracteres especiais"
    )
    .transform(value => value.replace(/\s+/g, ' ')),
    
  type: z.enum([
    "CASH",
    "CREDIT_CARD",
    "DEBIT_CARD",
    "PIX",
    "BOLETO",
    "BANK_TRANSFER",
    "CHECK",
    "OTHER",
  ],{
  required_error: "Este campo é obrigatório",
}),

  feePercentage: z.preprocess(
    (value) => {
      if (value === "" || value === null || value === undefined || Number.isNaN(value)) {
        return 0;
      }
      return value;
    },
    z
      .number()
      .min(0, "A taxa deve ser maior que 0")
      .max(100, "A taxa não pode ultrapassar 100%")
      .default(0),    
    ),

  settlementDays: z
    .number({
      invalid_type_error: "Deve ser no mínimo 1 dia"
    })
    .min(1,"Deve ser no mín imo 365 dias")
    .max(365, "Deve ser no máximo 365 dias")
    .default(0),

  fiscalCode: z
    .string()
    .min(2, "O código fiscal deve conter pelo menos 2 caracteres")
    .max(5)
    .optional(),

  requiresAuthorization: z.boolean().default(false),

  isActive: z.boolean().default(true),
});

export type MethodFormValues = z.infer<typeof methodSchema>;