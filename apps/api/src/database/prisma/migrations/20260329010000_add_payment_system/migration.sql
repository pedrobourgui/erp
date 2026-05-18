-- CreateEnum
CREATE TYPE "PaymentMethodType" AS ENUM ('CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'PIX', 'BOLETO', 'BANK_TRANSFER', 'CHECK', 'STORE_CREDIT', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentConditionType" AS ENUM ('CASH', 'INSTALLMENT', 'ENTRY_PLUS_INSTALLMENT');

-- CreateEnum
CREATE TYPE "CashMovementType" AS ENUM ('SUPPLY', 'WITHDRAW');

-- CreateEnum
CREATE TYPE "CashSessionStatus" AS ENUM ('OPEN', 'CLOSED');

-- AlterTable: PaymentMethod - add new columns
ALTER TABLE "payment_methods" ADD COLUMN "type" "PaymentMethodType" NOT NULL DEFAULT 'OTHER';
ALTER TABLE "payment_methods" ADD COLUMN "defaultAccountId" TEXT;
ALTER TABLE "payment_methods" ADD COLUMN "feePercentage" DECIMAL(5,2);
ALTER TABLE "payment_methods" ADD COLUMN "settlementDays" INTEGER;
ALTER TABLE "payment_methods" ADD COLUMN "requiresAuthorization" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "payment_methods" ADD COLUMN "fiscalCode" VARCHAR(5);

-- AlterTable: FinancialAccount - add new columns
ALTER TABLE "financial_accounts" ADD COLUMN "code" VARCHAR(20);
ALTER TABLE "financial_accounts" ADD COLUMN "acceptsDirectSales" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: AccountsReceivable - add orderPaymentId
ALTER TABLE "accounts_receivable" ADD COLUMN "orderPaymentId" TEXT;

-- CreateTable: payment_conditions
CREATE TABLE "payment_conditions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "type" "PaymentConditionType" NOT NULL,
    "installments" INTEGER NOT NULL DEFAULT 1,
    "daysBetweenInstallments" INTEGER NOT NULL DEFAULT 0,
    "entryPercentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_conditions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: order_payments
CREATE TABLE "order_payments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "paymentMethodId" TEXT NOT NULL,
    "paymentConditionId" TEXT,
    "financialAccountId" TEXT,
    "amount" DECIMAL(15,2) NOT NULL,
    "installments" INTEGER NOT NULL DEFAULT 1,
    "authorizationCode" VARCHAR(50),
    "notes" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable: cash_registers
CREATE TABLE "cash_registers" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "financialAccountId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cash_registers_pkey" PRIMARY KEY ("id")
);

-- CreateTable: cash_register_sessions
CREATE TABLE "cash_register_sessions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "cashRegisterId" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "closedById" TEXT,
    "status" "CashSessionStatus" NOT NULL DEFAULT 'OPEN',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "openingBalance" DECIMAL(15,2) NOT NULL,
    "closingBalance" DECIMAL(15,2),
    "expectedBalance" DECIMAL(15,2),
    "difference" DECIMAL(15,2),
    "notes" VARCHAR(500),

    CONSTRAINT "cash_register_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: cash_register_movements
CREATE TABLE "cash_register_movements" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "type" "CashMovementType" NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "reason" VARCHAR(255) NOT NULL,
    "performedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_register_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payment_conditions_tenantId_idx" ON "payment_conditions"("tenantId");
CREATE UNIQUE INDEX "payment_conditions_tenantId_code_key" ON "payment_conditions"("tenantId", "code");

CREATE INDEX "order_payments_orderId_idx" ON "order_payments"("orderId");
CREATE INDEX "order_payments_tenantId_idx" ON "order_payments"("tenantId");

CREATE UNIQUE INDEX "cash_registers_tenantId_name_key" ON "cash_registers"("tenantId", "name");

CREATE INDEX "cash_register_sessions_tenantId_idx" ON "cash_register_sessions"("tenantId");
CREATE INDEX "cash_register_sessions_cashRegisterId_idx" ON "cash_register_sessions"("cashRegisterId");

CREATE INDEX "cash_register_movements_sessionId_idx" ON "cash_register_movements"("sessionId");

-- AddForeignKey: PaymentMethod -> FinancialAccount
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_defaultAccountId_fkey" FOREIGN KEY ("defaultAccountId") REFERENCES "financial_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: AccountsReceivable -> OrderPayment
ALTER TABLE "accounts_receivable" ADD CONSTRAINT "accounts_receivable_orderPaymentId_fkey" FOREIGN KEY ("orderPaymentId") REFERENCES "order_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: PaymentCondition -> Tenant
ALTER TABLE "payment_conditions" ADD CONSTRAINT "payment_conditions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: OrderPayment -> Tenant
ALTER TABLE "order_payments" ADD CONSTRAINT "order_payments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: OrderPayment -> Order
ALTER TABLE "order_payments" ADD CONSTRAINT "order_payments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: OrderPayment -> PaymentMethod
ALTER TABLE "order_payments" ADD CONSTRAINT "order_payments_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "payment_methods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: OrderPayment -> PaymentCondition
ALTER TABLE "order_payments" ADD CONSTRAINT "order_payments_paymentConditionId_fkey" FOREIGN KEY ("paymentConditionId") REFERENCES "payment_conditions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: OrderPayment -> FinancialAccount
ALTER TABLE "order_payments" ADD CONSTRAINT "order_payments_financialAccountId_fkey" FOREIGN KEY ("financialAccountId") REFERENCES "financial_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: CashRegister -> Tenant
ALTER TABLE "cash_registers" ADD CONSTRAINT "cash_registers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: CashRegister -> FinancialAccount
ALTER TABLE "cash_registers" ADD CONSTRAINT "cash_registers_financialAccountId_fkey" FOREIGN KEY ("financialAccountId") REFERENCES "financial_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: CashRegisterSession -> Tenant
ALTER TABLE "cash_register_sessions" ADD CONSTRAINT "cash_register_sessions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: CashRegisterSession -> CashRegister
ALTER TABLE "cash_register_sessions" ADD CONSTRAINT "cash_register_sessions_cashRegisterId_fkey" FOREIGN KEY ("cashRegisterId") REFERENCES "cash_registers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: CashRegisterSession -> User (operator)
ALTER TABLE "cash_register_sessions" ADD CONSTRAINT "cash_register_sessions_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: CashRegisterSession -> User (closedBy)
ALTER TABLE "cash_register_sessions" ADD CONSTRAINT "cash_register_sessions_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: CashRegisterMovement -> Tenant
ALTER TABLE "cash_register_movements" ADD CONSTRAINT "cash_register_movements_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: CashRegisterMovement -> CashRegisterSession
ALTER TABLE "cash_register_movements" ADD CONSTRAINT "cash_register_movements_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "cash_register_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: CashRegisterMovement -> User (performedBy)
ALTER TABLE "cash_register_movements" ADD CONSTRAINT "cash_register_movements_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
