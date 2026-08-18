-- FN-21 (lote 7): descrições de títulos em português.
--
-- Recebíveis antigos nasceram como "Receivable for order PED-000003" e
-- apareciam na listagem ao lado de "Venda balcão PED-000004". O código atual já
-- gera em pt-BR; isto acerta os registros que ficaram para trás.

UPDATE "accounts_receivable"
SET "description" = replace("description", 'Receivable for order ', 'Pedido ')
WHERE "description" LIKE 'Receivable for order %';

UPDATE "accounts_payable"
SET "description" = replace("description", 'Payable for order ', 'Pedido ')
WHERE "description" LIKE 'Payable for order %';

UPDATE "accounts_payable"
SET "description" = replace("description", 'Payable for purchase ', 'Compra ')
WHERE "description" LIKE 'Payable for purchase %';
