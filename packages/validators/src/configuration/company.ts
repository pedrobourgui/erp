import z from "zod";

// ─── Schema da empresa ────────────────────────────────────────────────────

export const companySchema = z.object({
    name: z
        .string()
        .trim()
        .nonempty('Este campo é obrigatório')
        .max(150, 'A razão social deve conter no máximo 150 caracteres')
        .regex(
            /^[a-zA-ZÀ-ÿ0-9\s.,&'\/_-]+$/,
            'A razão social não pode conter caracteres especiais')
        .refine(
            value => !/^[-_]|[-_]$/.test(value),
             'A razão social não pode iniciar ou terminar com hífen ou underline')
        .refine(
            value => /[a-zA-ZÀ-ÿ]/.test(value),
            'A razão social deve conter pelo menos uma letra')
        .transform(value => value.replace(/\s+/g, ' '))
        .transform((value) =>
            value
                .toLocaleLowerCase()
                .trim()
                .split(/\s+/)
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(" ")
        ),

    cnpj: z
        .string()
        .nonempty("Este campo é obrigatório")
        .regex(
            /^[A-Za-z0-9./-]+$/,
            "O CNPJ não pode conter caracteres especiais"
        )
        .transform(value => 
            value
                .toUpperCase()
                .replace(/[./-]/g, ""))
        .refine(v => !v || v.length === 14, {
            message: 'O CNPJ deve conter exatamente 14 caracteres',
        }),

    address: z
        .string()
        .nonempty("Este campo é obrigatório")
        .min(5, "O endereço deve conter no mínimo 5 caracteres")
        .max(80, "O endereço deve conter no máximo 80 caracteres")
        .regex(
            /^[A-Za-zÀ-ÿ0-9\s,.\-/ºª]+$/,"O endereço não pode conter caracteres especiais"
        )
        .refine(
            value => /[A-Za-zÀ-ÿ]/.test(value),"O endereço deve conter letras"
        )
        .refine(
            value => /\d/.test(value),"O endereço deve conter um número"
        )
        .transform((value) =>
            value
                .toLocaleLowerCase()
                .trim()
                .split(/\s+/)
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(" ")
        )
        .transform(value => value.replace(/\s+/g, ' ')),

    city: z
        .string()
        .nonempty("Este campo é obrigatório")
        .min(2, "O nome da cidade deve conter no mínimo 2 caracteres")
        .max(60, "O nome da cidade deve conter no máximo 60 caracteres")
       .refine(
            (value) => !/\d/.test(value), "O nome da cidade não pode conter números"
        )
        .refine(
            (value) => /^[A-Za-zÀ-ÿ\s]+$/.test(value), "O nome da cidade não pode conter caracteres especiais"
        )
        .transform((value) =>
            value
                .toLocaleLowerCase()
                .trim()
                .split(/\s+/)
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(" ")
        )
        .transform(value => value.replace(/\s+/g, ' ')),

    state: z
        .string()
        .nonempty("Este campo é obrigatório")
        .length(2, "Informe a UF com 2 letras")
        .regex(/^[A-Za-zÀ-ÿ\s]+$/, "Apenas letras são permitidas")
        .transform(value => value.toUpperCase()),

  zipCode: z
        .string()
        .nonempty("Este campo é obrigatório")
        .regex(/^[\d-]+$/, "Apenas números são permitidos")
        .length(8, "O CEP deve conter exatamente 8 dígitos"),

  taxRegime: z.string().min(1,"Este campo é obrigatório"),
})

export type CompanyFormValues = z.infer<typeof companySchema>