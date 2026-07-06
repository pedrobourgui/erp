import { z } from "zod";

// ─── Schema do cliente ──────────────────────────────────────────────────

export const customerSchema = z.object({
  name: z
    .string()
    .trim()
    .nonempty('Este campo é obrigatório')
    .min(2,"O nome do cliente deve conter no mínimo 2 caracteres")
    .max(150, 'O nome do cliente deve conter no máximo 150 caracteres')
    .regex(
      /^[a-zA-ZÀ-ÿ0-9\s]+$/,
       "O nome do cliente não pode conter caracteres especiais"
    )
    .regex(
      /^[^0-9]*$/,
      "O nome do cliente não pode conter números"
    )
    .transform(value => value.replace(/\s+/g, ' '))
    .transform(value =>
      value
        .split(' ')
        .map(word =>
          word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        )
        .join(' ')
    ),

  document: z
    .string()
    .nonempty("Este campo é obrigatório"),
    
  documentType: z.enum(["CPF", "CNPJ"]),

  email: z
    .string()
    .trim()
    .nonempty("Este campo é obrigatório")
    .email('E-mail inválido')
    .max(254,"O e-mail do cliente deve conter no máximo 254 caracteres"),

  phone: z
    .string()
    .nonempty("Este campo é obrigatório")
    .refine(value => value.replace(/\D/g, '').length >= 11, {
    message: "Número de telefone inválido",
  })
});

export type CustomerFormValues = z.infer<typeof customerSchema>;