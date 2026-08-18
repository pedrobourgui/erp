-- FN-04 (lote 5): soft delete de títulos.
--
-- Um título só pode ser excluído quando não tem baixa e não nasceu de um pedido;
-- mesmo assim ele não some do banco, para não quebrar conciliação já feita.
-- Colunas nulas e sem default: nada nos dados existentes muda.

ALTER TABLE "accounts_receivable" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "accounts_payable" ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE INDEX "accounts_receivable_tenantId_deletedAt_idx" ON "accounts_receivable"("tenantId", "deletedAt");
CREATE INDEX "accounts_payable_tenantId_deletedAt_idx" ON "accounts_payable"("tenantId", "deletedAt");
