import { z } from 'zod';

// ─── Schema da categoria ───────────────────────────────────────────────────

export const categorySchema = z.object({
    name: z
        .string()
        .trim()
        .nonempty("Este campo é obrigatório")
        .max(80, "O nome da categoria deve conter no máximo 80 caracteres")
        .regex(/^[\p{L}\p{N}\s&.'-]+$/u, "O nome da categoria possui caracteres especiais não permitidos")
        .transform(value => value.replace(/\s+/g, ' ')),
    
    slug: z
        .string()
        .trim()
        .max(80, "O slug da categoria deve conter no máximo 80 caracteres")
        .refine((value) => !value.includes(" "), {
            message: "O slug da categoria não pode conter espaços",
        })
        .refine((value) => /^[a-z0-9 -]+$/.test(value), {
            message: "O slug da categoria possui caracteres especiais não permitidos",
        })
        .optional(),
    
    parentId: z
        .string()
        .nullable()
        .optional(),
})

export type CategoryFormValues = z.infer<typeof categorySchema>
