-- AE-08 (lote 6): CFOP no cadastro de produto.
--
-- O campo não existia em nenhuma aba do formulário, e sem ele não se emite
-- NF-e de venda. Coluna nula e sem default: nada nos dados existentes muda.

ALTER TABLE "products" ADD COLUMN "cfop" VARCHAR(4);
