import { z } from 'zod';

// ─── Schema da marca ───────────────────────────────────────────────────

export const brandSchema = z.object({
    name: z
        .string()
        .trim()
        .nonempty("Este campo é obrigatório")
        .min(2, "O nome da marca deve conter no mínimo 2 caracteres")
        .max(80, "O nome da marca deve conter no máximo 80 caracteres")
        .regex(/^[\p{L}\p{N}\s&.'-]+$/u, "O nome da marca possui caracteres especiais não permitidos")
        .transform(value => value.replace(/\s+/g, ' ')),
    
    logoUrl: z.preprocess(
        (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
        z
            .string()
            .trim()
            .max(255, "A url deve conter no máximo 255 caracteres")
            .url("Url inválida")
            .optional()
    ),
})

export type BrandFormValues = z.infer<typeof brandSchema>