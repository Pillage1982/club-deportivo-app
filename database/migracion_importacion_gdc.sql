-- Ejecutar sólo después de revisar el dry-run y respaldar la BD objetivo.
CREATE TABLE IF NOT EXISTS importacion_lotes (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  identificador VARCHAR(100) NOT NULL UNIQUE,
  organizacion VARCHAR(100) NOT NULL,
  estado ENUM('preparado','aplicado','revertido','fallido') NOT NULL DEFAULT 'preparado',
  proceso_usuario VARCHAR(150) NOT NULL,
  fecha_importacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS importacion_auditoria (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  lote_id BIGINT NOT NULL,
  entidad VARCHAR(50) NOT NULL,
  entidad_id BIGINT NULL,
  accion VARCHAR(30) NOT NULL,
  referencia_externa CHAR(64) NOT NULL,
  archivo_origen VARCHAR(255) NOT NULL,
  hoja_origen VARCHAR(100) NOT NULL,
  fila_origen INT NOT NULL,
  valor_original TEXT NULL,
  datos_anteriores JSON NULL,
  datos_nuevos JSON NULL,
  fecha_importacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  proceso_usuario VARCHAR(150) NOT NULL,
  UNIQUE KEY uq_importacion_referencia (entidad, referencia_externa),
  CONSTRAINT fk_importacion_lote FOREIGN KEY (lote_id) REFERENCES importacion_lotes(id)
) ENGINE=InnoDB;
