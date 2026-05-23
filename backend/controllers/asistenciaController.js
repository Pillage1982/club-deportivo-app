// =====================================
// MODELO ASISTENCIAS
// =====================================

const asistenciaModel = require('../models/asistenciaModel');


// =====================================
// REGISTRAR ASISTENCIA
// =====================================
exports.registrar = (req, res) => {

  asistenciaModel.crearAsistencia(req.body, (err, result) => {

    // Manejo errores backend
    if (err) {
      console.error(err);
      return res.status(500).send(err);
    }

    // Respuesta exitosa frontend
    res.send('Asistencia registrada');

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