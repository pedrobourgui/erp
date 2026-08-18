-- AE-12c (lote 6): um depósito padrão por tenant.
--
-- `createWarehouse` gravava `isDefault` sem rebaixar o anterior, e a tela
-- chegou a exibir três depósitos "Padrão" — deixando ambíguo qual deles a
-- venda e o balcão usam.
--
-- 1. Mantém como padrão apenas o mais antigo de cada tenant (o original).
UPDATE "warehouses" w
SET "isDefault" = false
WHERE w."isDefault" = true
  AND w."id" <> (
    SELECT w2."id"
    FROM "warehouses" w2
    WHERE w2."tenantId" = w."tenantId"
      AND w2."isDefault" = true
    ORDER BY w2."createdAt" ASC
    LIMIT 1
  );

-- 2. O banco garante a regra, não só o serviço — que perde em concorrência.
CREATE UNIQUE INDEX IF NOT EXISTS "warehouses_tenantId_isDefault_key"
  ON "warehouses"("tenantId")
  WHERE "isDefault" = true;
