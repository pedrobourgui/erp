-- AE-15 (lote 6): documento de cliente passa a ser armazenado só com dígitos.
--
-- Antes disto `12345678909` e `123.456.789-09` conviviam como clientes
-- diferentes: a checagem de duplicidade comparava a string com a máscara, então
-- bastava mudar a formatação para burlá-la.
--
-- 1. Normaliza os registros existentes.
UPDATE "customers"
SET "document" = regexp_replace("document", '[^0-9]', '', 'g')
WHERE "document" IS NOT NULL
  AND "document" <> regexp_replace("document", '[^0-9]', '', 'g');

-- 2. Unicidade garantida pelo banco, não só pela consulta prévia — que perde em
--    concorrência. Parcial: um cliente excluído não bloqueia o documento.
CREATE UNIQUE INDEX IF NOT EXISTS "customers_tenantId_document_key"
  ON "customers"("tenantId", "document")
  WHERE "document" IS NOT NULL AND "deletedAt" IS NULL;
