import z from "zod";

// ─── Schema da conta ────────────────────────────────────────────────────

export const accountSchema = z.object({
    name: z.string()
        .trim()
        .nonempty('Este campo é obrigatório')
        .max(150, 'O nome da conta deve conter no máximo 150 caracteres')
        .regex(
            /^[a-zA-ZÀ-ÿ0-9\s.,&'\/()#_-]+$/,
            'O nome da conta não pode conter caracteres especiais')
        .refine(
            value => !/^[-_]|[-_]$/.test(value),
             'O nome da conta não pode iniciar ou terminar com hífen ou underline')
        .refine(
            value => /[a-zA-ZÀ-ÿ]/.test(value),
            'O nome da conta deve conter pelo menos uma letra')
        .transform(value => value.replace(/\s+/g, ' ')),

    type: z.preprocess(
        (value) => (value === "" ? undefined : value),
        z.enum(["CASH", "CHECKING", "SAVINGS", "DIGITAL"], {
            required_error: "Este campo é obrigatório",
            invalid_type_error: "Selecione um tipo válido",
        })    
        ),

    code: z
        .string()
        .trim()
        .max(20)
        .regex(
            /^[a-zA-Z0-9_-]+$/,
            "Use apenas letras, números, underline e hífen"
        )
        .transform((value) => value.toUpperCase())
        .optional(),

    bankName: z.preprocess(
        (value) => value === "" ? undefined : value,
        z
            .string()
            .trim()
            .max(100, "O nome do banco deve ter no máximo 100 caracteres")
            .regex(
                /^[a-zA-ZÀ-ÿ0-9\s&.,()-]+$/,
                "Nome do banco contém caracteres inválidos"
            )
            .transform((value) => value.replace(/\s+/g, " "))
            .optional(),
        ),
    bankBranch: z.preprocess(
        (value) => value === "" ? undefined : value,
        z
            .string()
            .trim()
            .max(20, "A agência deve conter no máximo 20 caracteres")
            .regex(
                /^[a-zA-Z0-9-]+$/,
             "Use apenas letras, números e hífen"
            )
            .optional(),
    ),
    bankAccount: z.preprocess(
        (value) => value === "" ? undefined : value,
        z
            .string()
            .trim()
            .max(30, "A conta deve conter no máximo 30 caracteres")
            .regex(
                /^[a-zA-Z0-9-]+$/,
                "Use apenas letras, números e hífen"
            )
            .transform(value => value.replace(/\s+/g, ' '))
            .optional(),
    ),

    acceptsDirectSales: z.boolean().default(false),

    isActive: z.boolean().default(true),
})

export type AccountFormValues = z.infer<typeof accountSchema>