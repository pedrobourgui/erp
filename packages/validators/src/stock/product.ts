import { z } from 'zod';

// ─── Schema do produto ────────────────────────────────────────────────────

// Converter NaN para indefinido para números opcionais.
const optionalNumber = z.preprocess(
  (val) => (val === "" || val === null || val === undefined || Number.isNaN(val) ? undefined : Number(val)),
  z.number({ invalid_type_error: "Deve ser um número" }).min(0).optional()
)

export const createProductSchema = z.object({
  // Dados gerais
  name: z
    .string()
    .trim()
    .min(1, 'Este campo é obrigatório')
    .min(2, 'O nome deve conter pelo menos 2 caracteres')
    .max(255, 'O nome deve conter no máximo 255 caracteres')
    .regex(/^[a-zA-ZÀ-ÿ0-9\s_,-]+$/,'O nome não pode conter caracteres especiais')
    .refine(value => !/^[-_]|[-_]$/.test(value), 'O nome não pode iniciar ou terminar com hífen ou underline')
    .refine(value => /[a-zA-ZÀ-ÿ]/.test(value),'O nome deve conter pelo menos uma letra')
    .transform(value => value.replace(/\s+/g, ' ')),

  sku: z
    .string()
    .trim()
    .min(1, 'Este campo é obrigatório')
    .min(3, 'O SKU deve ter pelo menos 3 caracteres')
    .max(20, 'O SKU deve conter no máximo 20 caracteres')
    .regex(/^[a-zA-ZÀ-ÿ0-9\s_-]+$/,'O SKU não pode conter caracteres especiais')
    .regex(/^\S+$/, 'O SKU não pode conter espaços')
    .refine(value => !/^[-_]|[-_]$/.test(value), 'O SKU não pode iniciar ou terminar com hífen ou underline')
    .transform(value => value.toUpperCase()),
    
  description: z.preprocess(
  (value) => {
    if(typeof value === "string" && value.trim() === ""){
      return undefined
    }
    return value
  },
    z
    .string()
    .trim()
    .min(10, 'A descrição deve ter pelo menos 10 caracteres.')
    .max(2000, 'A descrição deve conter no máximo 2000 caracteres')
    .transform(value => value.replace(/\s+/g, ' '))
    .optional()
  ),

  category: z
    .string()
    .nonempty({ message: 'Este campo é obrigatório'}),

  brand: z
    .string()
    .nonempty({ message: 'Este campo é obrigatório'}),

  // Preços
  costPrice: z.preprocess(
    (value) => (value === "" || Number.isNaN(value) ? undefined : Number(value)),
    z.number({
       required_error: "Preço de custo é obrigatório", 
       invalid_type_error: "Preço de custo deve ser um número" 
      })
      .min(0, "Preço de custo não pode ser negativo"),
  ),

  salePrice: z.preprocess(
    (value) => (value === "" || Number.isNaN(value) ? undefined : Number(value)),
    z.number({
       required_error: "Preço de venda é obrigatório",
        invalid_type_error: "Preço de venda deve ser um número" 
      })
      .min(0.01, "Preço de venda é obrigatório"),
  ),

  markup: optionalNumber,

  promoPrice: optionalNumber,

   // Fiscal
  ncm: z.preprocess(
    (value) => {
      if(typeof value === "string" && value === ""){
        return undefined
      }
      return value
    },
    z
    .string()
    .trim()
    .refine(value => /^\d+$/.test(value), {
      message: 'O NCM deve conter apenas números',
    })
    .refine(value => !value || value.length === 8, {
      message: 'O NCM deve conter exatamente 8 dígitos',
    })
    .optional(),
  ),
    
  cest: z.preprocess(
    (value) => {
      if(typeof value === "string" && value === ""){
        return undefined
      }
      return value
    },
    z
    .string()
    .trim()
    .refine(value => /^\d+$/.test(value), {
      message: 'O CEST deve conter apenas números',
    })
    .refine(value => !value || value.length === 7, {
      message: 'O CEST deve conter exatamente 7 dígitos',
    })
    .optional(),
  ),

  ean: z.preprocess(
    (value) => {
      if(typeof value === "string" && value === ""){
        return undefined
      }
      return value
    },
    z
      .string()
      .trim()
      .refine(value => /^\d+$/.test(value), {
        message: 'O EAN deve conter apenas números',
      })
      .refine(value => !value || value.length === 10, {
        message: 'O EAN / GTIN deve conter exatamente 10 dígitos',
      })
      .optional(),
  ),

  // Dimensões

 weight: z.preprocess(
  (value) => {
    if (value === "" || value === null || value === undefined) {
      return undefined
    }
     // transforma vírgula em ponto
    const normalized =
      typeof value === "string"
        ? value.replace(",", ".")
        : value

    const num = Number(normalized)

    return Number.isNaN(num) ? undefined : num
  },

  z
    .number({
      invalid_type_error: "Peso deve ser um número",
    })
    .positive("O peso deve ser maior do que zero")
    .nonnegative('O peso não pode ser negativo')
    .max(99999, 'Peso acima do limite permitido')
    .min(0.001, "O peso deve ter no mínimo 1 grama")
    .refine(
      (value) => {
        const decimal = value.toString().split(".")[1]
        return !decimal || decimal.length <= 3
      },
      {
        message: "A altura pode ter no máximo 3 casas decimais",
      }
    )
    .optional()
),
    
  height: z.preprocess(
  (value) => {
    if (value === "" || value === null || value === undefined) {
      return undefined
    }
     // transforma vírgula em ponto
    const normalized =
      typeof value === "string"
        ? value.replace(",", ".")
        : value

    const num = Number(normalized)

    return Number.isNaN(num) ? undefined : num
  },

  z
    .number({
      invalid_type_error: "Altura deve ser um número",
    })
    .positive("A altura deve ser maior do que zero")
    .nonnegative('A altura não pode ser negativa')
    .max(1000, 'A altura deve ter no máximo 1000 centímetros')
    .min(0.1, "A altura deve ter no mínimo 1 milímetro")
    .refine(
      (value) => {
        const decimal = value.toString().split(".")[1]
        return !decimal || decimal.length <= 3
      },
      {
        message: "A altura pode ter no máximo 3 casas decimais",
      }
    )
    .optional()
),

  width: z.preprocess(
  (value) => {
    if (value === "" || value === null || value === undefined) {
      return undefined
    }
     // transforma vírgula em ponto
    const normalized =
      typeof value === "string"
        ? value.replace(",", ".")
        : value

    const num = Number(normalized)

    return Number.isNaN(num) ? undefined : num
  },

  z
    .number({
      invalid_type_error: "Largura deve ser um número",
    })
    .positive("A largura deve ser maior do que zero")
    .nonnegative('A largura não pode ser negativa')
    .max(1000, 'A largura deve ter no máximo 1000 centímetros')
    .min(0.1, "A largura deve ter no mínimo 1 milímetro")
    .refine(
      (value) => {
        const decimal = value.toString().split(".")[1]
        return !decimal || decimal.length <= 3
      },
      {
        message: "A largura pode ter no máximo 3 casas decimais",
      }
    )
    .optional()
),

  length: z.preprocess(
  (value) => {
    if (value === "" || value === null || value === undefined) {
      return undefined
    }
     // transforma vírgula em ponto
    const normalized =
      typeof value === "string"
        ? value.replace(",", ".")
        : value

    const num = Number(normalized)

    return Number.isNaN(num) ? undefined : num
  },

  z
    .number({
      invalid_type_error: "Comprimento deve ser um número",
    })
    .positive("O comprimento deve ser maior do que zero")
    .nonnegative('O comprimento não pode ser negativo')
    .max(1000, 'Comprimento deve ter no máximo 1000 centímetros')
    .min(0.1, "O comprimento deve ter no mínimo 1 milímetro")
    .refine(
      (value) => {
        const decimal = value.toString().split(".")[1]
        return !decimal || decimal.length <= 3
      },
      {
        message: "O comprimento pode ter no máximo 3 casas decimais",
      }
    )
    .optional()
),

  //Status
  status: z
    .enum(['ACTIVE', 'INACTIVE', 'DRAFT'])
    .default('DRAFT'),
})
  .refine(
    data => data.salePrice > data.costPrice,
    {
      message: 'O preço de venda deve ser maior que o preço de custo',
      path: ['salePrice'],
    }
  );

export type CreateProductInput = z.infer<typeof createProductSchema>