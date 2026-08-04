-- Fecha de inscripción del cliente en el ICA de un municipio. Acota la
-- generación de vencimientos de ICA "de aquí en adelante" sin afectar lo ya
-- cargado. Columna aditiva y opcional (NULL = sin acotar).
ALTER TABLE "empresa_municipio_ica" ADD COLUMN "fechaInscripcion" TIMESTAMP(3);
