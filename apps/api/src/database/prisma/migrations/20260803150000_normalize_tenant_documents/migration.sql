-- AE-15 (lote 8): CNPJ do tenant guardado só com dígitos.
--
-- `customers.document` foi normalizado no lote 6, mas `tenants.document`
-- continuou com a máscara. A checagem de duplicidade em
-- `TenantsService.update` compara strings cruas: com uma linha gravada como
-- "12.345.678/0001-90" e outra como "12345678000190", o mesmo CNPJ passa duas
-- vezes. A gravação já foi corrigida; isto acerta o que ficou para trás.

UPDATE "tenants"
SET "document" = regexp_replace("document", '[^0-9]', '', 'g')
WHERE "document" ~ '[^0-9]';
