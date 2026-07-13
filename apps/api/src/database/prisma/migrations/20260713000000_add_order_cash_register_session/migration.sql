-- AlterTable: Order - link a sale to the cash register session open at creation
ALTER TABLE "orders" ADD COLUMN "cashRegisterSessionId" TEXT;

-- CreateIndex
CREATE INDEX "orders_cashRegisterSessionId_idx" ON "orders"("cashRegisterSessionId");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_cashRegisterSessionId_fkey" FOREIGN KEY ("cashRegisterSessionId") REFERENCES "cash_register_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
