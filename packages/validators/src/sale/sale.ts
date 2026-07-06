import { z } from "zod";

// ─── Sale schema ──────────────────────────────────────────────────────

const coerceNumber = (value: unknown) => {
  if (value === "" || value === null || value === undefined) return 0;
  const n = Number(value);
  return Number.isNaN(n) ? 0 : n;
};

// Schema do produto na venda
const productSchema = z.object({
  productId: z.string().min(1, "Selecione um produto"),

  productName: z.string(),

  sku: z.string(),

  availableStock: z.number(),
  
  quantity: z.preprocess(
    coerceNumber,
    z.number().min(1, "A Quantidade mínima é 1 unidade").max(1000000, "A quantidade máxima é de 1 unidade")
  ),

  unitPrice: z.preprocess(
    coerceNumber,
    z.number().min(0.01, "Preço unitário e obrigatório").max(10000000, "Valor muito alto")
  ),

  discount: z.preprocess(
      coerceNumber, 
      z.number().min(0).default(0))
})

.superRefine((data, ctx) => {
    const subtotal = data.quantity * data.unitPrice;

    if (data.discount > subtotal) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["discount"],
        message: "Desconto excede o valor total do item",
      });
    }
  })

// Schema de pagamento na venda
const PaymentSchema = z.object({
  paymentMethodId: z.string().min(1, "Selecione a forma de pagamento"),

  paymentConditionId: z.string(),

  financialAccountId: z.string().optional(),

  amount: z.preprocess(
    coerceNumber,
     z
      .number()
      .min(0.01, "Valor obrigatório")),

  installments: z.number().optional(),

  authorizationCode: z
    .string()
    .regex(/^[a-zA-Z0-9]*$/, "Apenas letras e números são permitidos")
    .max(30,"O código deve conter no máximo 30 caracteres")
    .optional(),
});

// Schema base de venda
export const baseSaleSchema = z.object({
    customerId: z.string().trim().min(1, "Selecione um cliente"),

    items: z.array(productSchema).min(1, "Adicione pelo menos um item"),

    payments: z.array(PaymentSchema).min(1, "Adicione pelo menos uma forma de pagamento"),

    generalDiscount: z.preprocess(
      coerceNumber, z
      .number()
      .min(0)
      .default(0)),

    notes: z
      .string()
      .trim()
      .max(2000, "A observação deve conter no máximo 2000 caracteres")
      .transform(value => value.replace(/\s+/g, ' '))
      .optional(),
  })

// Schema de venda balcão   
export const counterSaleSchema = baseSaleSchema.refine(
    (data) => {
      const paymentTotal = data.payments.reduce(
        (sum, p) => sum + (Number(p.amount) || 0),
        0
      );
      const orderTotal =
        data.items.reduce((sum, item) => {
          const qty = Number(item.quantity) || 0;
          const price = Number(item.unitPrice) || 0;
          const disc = Number(item.discount) || 0;
          return sum + (qty * price - disc);
        }, 0) - (Number(data.generalDiscount) || 0);
      return Math.abs(paymentTotal - orderTotal) < 0.01;
    },
    {
      message: "A soma dos pagamentos deve ser igual ao total do pedido",
      path: ["payments"],
    }
  )

  .superRefine((data, ctx) => {
  const hasInvalidItemDiscount = data.items.some(item => {
    const subtotal = item.quantity * item.unitPrice;
    return item.discount > subtotal;
  });

  if (hasInvalidItemDiscount) return;

  const total = data.items.reduce(
    (sum, item) =>
      sum + item.quantity * item.unitPrice - item.discount,
    0
  );

  if (data.generalDiscount > total) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["generalDiscount"],
      message: "O desconto não pode ser maior que o valor da venda",
    });
  }
})

export type CounterSaleFormValues = z.infer<typeof counterSaleSchema>;

// Schema de venda por pedido 
export const orderSaleSchema = baseSaleSchema.extend({
  shippingMethod: z
    .string()
    .max(50, "O método de envio deve conter no máximo 50 caracteres")
    .optional(),

  shippingCost: z.preprocess(
    coerceNumber, z
      .number()
      .min(0)
      .max(10000,"Frete muito alto")
      .default(0)
)
})
  
.refine(
    (data) => {
      const paymentTotal = data.payments.reduce(
        (sum, p) => sum + (Number(p.amount) || 0),
        0
      );
      const orderTotal =
        data.items.reduce((sum, item) => {
          const qty = Number(item.quantity) || 0;
          const price = Number(item.unitPrice) || 0;
          const disc = Number(item.discount) || 0;
          return sum + (qty * price - disc);
        }, 0) - (Number(data.generalDiscount) || 0);
      return Math.abs(paymentTotal - orderTotal) < 0.01;
    },
    {
      message: "A soma dos pagamentos deve ser igual ao total do pedido",
      path: ["payments"],
    }
  )

  .superRefine((data, ctx) => {
  const hasInvalidItemDiscount = data.items.some(item => {
    const subtotal = item.quantity * item.unitPrice;
    return item.discount > subtotal;
  });

  if (hasInvalidItemDiscount) return;

  const total = data.items.reduce(
    (sum, item) =>
      sum + item.quantity * item.unitPrice - item.discount,
    0
  );

  if (data.generalDiscount > total) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["generalDiscount"],
      message: "O desconto não pode ser maior que o valor da venda",
    });
  }
})

export type OrderSaleFormValues = z.infer<typeof orderSaleSchema>;