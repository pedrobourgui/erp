-- FN-16 (lote 5): ciclo de vida da conta financeira.
--
-- Conta com movimento nunca é excluída — vira inativa, para não quebrar o
-- extrato. Conta que nunca moveu dinheiro pode sair das telas via soft delete.
-- Coluna nula e sem default: nada nos dados existentes muda.

ALTER TABLE "financial_accounts" ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE INDEX "financial_accounts_tenantId_deletedAt_idx" ON "financial_accounts"("tenantId", "deletedAt");
