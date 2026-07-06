import { z } from "zod";

// ─── Schema do depósito ───────────────────────────────────────────────────

export const warehouseSchema = z.object({
    name: z
        .string()
        .trim()
        .nonempty("Este campo é obrigatório")
        .min(2, "O nome deve conter pelo menos 2 caracteres")
        .max(80, "O nome deve conter no máximo 80 caracteres")
        .regex(/^[a-zA-ZÀ-ÿ0-9\s_,-]+$/,"O nome não pode conter caracteres especiais")
        .transform(value => value.replace(/\s+/g, " "))
        .refine(  
            value => !/[^A-Za-zÀ-ÿ0-9\s]/.test(value), "O nome não pode conter caracteres especiais"
        ),

    address: z
        .string()
        .trim()
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
        ),

    city: z
        .string()
        .trim()
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
        ),

    state: z
        .string()
        .nonempty("Este campo é obrigatório")
        .length(2, "Informe a UF com 2 letras")
        .regex(/^[A-Za-zÀ-ÿ\s]+$/, "Apenas letras são permitidas")
        .transform(value => value.toUpperCase()),

    zipCode: z
        .string()
        .nonempty("Este campo é obrigatório")
        .max(10, "CEP muito longo")
        .refine((value) => value.replace(/\D/g, '').length === 8,
            { message: "CEP inválido" }
        ),
        
    isDefault: z.boolean().optional(),
    });

export type WarehouseFormValues = z.infer<typeof warehouseSchema>;