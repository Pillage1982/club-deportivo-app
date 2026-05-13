DELIMITER $$

CREATE TRIGGER trg_generar_multa_insert
AFTER INSERT ON asistencias
FOR EACH ROW
BEGIN

    DECLARE multa INT DEFAULT 0;
    DECLARE motivo_texto VARCHAR(100);

    -- Calcular multa según estado
    IF NEW.estado = 'ausente' THEN
        SET multa = 5000;
        SET motivo_texto = 'Inasistencia';

    ELSEIF NEW.estado = 'atrasado' THEN

        IF NEW.minutos_atraso <= 10 THEN
            SET multa = 1000;
            SET motivo_texto = 'Atraso leve';

        ELSEIF NEW.minutos_atraso <= 20 THEN
            SET multa = 2000;
            SET motivo_texto = 'Atraso medio';

        ELSE
            SET multa = 3000;
            SET motivo_texto = 'Atraso grave';
        END IF;

    END IF;

    -- Insertar multa solo si corresponde
    IF multa > 0 THEN
        INSERT INTO multas (persona_id, asistencia_id, monto, motivo)
        VALUES (NEW.persona_id, NEW.id, multa, motivo_texto);
    END IF;

END$$

DELIMITER ;

DELIMITER $$

CREATE TRIGGER trg_actualizar_multa_update
AFTER UPDATE ON asistencias
FOR EACH ROW
BEGIN

    DECLARE multa INT DEFAULT 0;
    DECLARE motivo_texto VARCHAR(100);

    -- Recalcular multa
    IF NEW.estado = 'ausente' THEN
        SET multa = 5000;
        SET motivo_texto = 'Inasistencia';

    ELSEIF NEW.estado = 'atrasado' THEN

        IF NEW.minutos_atraso <= 10 THEN
            SET multa = 1000;
            SET motivo_texto = 'Atraso leve';

        ELSEIF NEW.minutos_atraso <= 20 THEN
            SET multa = 2000;
            SET motivo_texto = 'Atraso medio';

        ELSE
            SET multa = 3000;
            SET motivo_texto = 'Atraso grave';
        END IF;

    END IF;

    -- Eliminar multa previa asociada
    DELETE FROM multas WHERE asistencia_id = NEW.id;

    -- Insertar nueva multa si aplica
    IF multa > 0 THEN
        INSERT INTO multas (persona_id, asistencia_id, monto, motivo)
        VALUES (NEW.persona_id, NEW.id, multa, motivo_texto);
    END IF;

END$$

DELIMITER ;

DELIMITER $$

CREATE TRIGGER trg_cuotas_vencidas
BEFORE UPDATE ON cuotas
FOR EACH ROW
BEGIN
    IF NEW.estado = 'pendiente' AND NEW.fecha_vencimiento < CURDATE() THEN
        SET NEW.estado = 'vencido';
    END IF;
END$$

DELIMITER ;