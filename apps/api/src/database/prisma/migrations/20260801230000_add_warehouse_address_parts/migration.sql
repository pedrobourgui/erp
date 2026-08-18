-- AE-12b (lote 7): cidade, UF e CEP do depósito viram colunas próprias.
--
-- O DTO já recebia os três campos e o serviço os concatenava dentro de
-- `address` — a estrutura era destruída na gravação, e o card do depósito
-- exibia ", -" porque lia `city` e `state`, que nunca existiram.
-- Colunas nulas: nada nos dados existentes muda.

ALTER TABLE "warehouses" ADD COLUMN "city" VARCHAR(100);
ALTER TABLE "warehouses" ADD COLUMN "state" VARCHAR(2);
ALTER TABLE "warehouses" ADD COLUMN "zipCode" VARCHAR(10);
