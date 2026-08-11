-- Prefijo del consecutivo en la captura por lotes (FE, CE, FV-…).
--
-- Va en su propia columna y no dentro de "desde"/"hasta": así se escribe una
-- vez en lugar de dos, y el dato queda estructurado para poder agrupar por
-- prefijo más adelante.
--
-- Aditivo: columna opcional. Los lotes ya capturados quedan sin prefijo, que es
-- exactamente lo que eran.
ALTER TABLE "lotes_captura" ADD COLUMN "prefijo" TEXT;
