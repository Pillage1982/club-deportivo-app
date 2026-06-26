// =====================================
// MODELO ASISTENCIAS
// =====================================

const asistenciaModel = require('../models/asistenciaModel');


// =====================================
// REGISTRAR ASISTENCIA
// =====================================
exports.registrar = (req, res) => {

  asistenciaModel.crearAsistencia(req.body, (err, result) => {

    if (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({
          mensaje: 'La asistencia ya fue registrada para este integrante en esta actividad.'
        });
      }

      console.error('Error registrando asistencia:', err);
      return res.status(500).json({
        mensaje: 'Error al registrar asistencia'
      });
    }

    if (!result || result.affectedRows === 0) {
      return res.status(400).json({
        mensaje: 'El integrante no esta activo para registrar asistencia.'
      });
    }

    asistenciaModel.crearMultaSiCorresponde(
      req.body,
      result.insertId,
      (errMulta, resultadoMulta) => {
        if (errMulta) {
          console.error('Error generando multa:', errMulta);
          return res.status(500).json({
            mensaje: 'Asistencia registrada, pero no se pudo generar la multa'
          });
        }

        res.json({
          mensaje: resultadoMulta.multaGenerada
            ? `Asistencia registrada. Multa generada: ${resultadoMulta.motivo}`
            : 'Asistencia registrada'
        });
      }
    );

  });

};

// =====================================
// LISTAR ASISTENCIAS
// =====================================

exports.listar = (req, res) => {

  asistenciaModel.obtenerAsistencias((err, results) => {

    if (err) {
      return res.status(500).send(err);
    }

    // Devuelve historial asistencias
    res.json(results);

  });

};
