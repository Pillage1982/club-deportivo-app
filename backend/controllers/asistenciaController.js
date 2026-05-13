const asistenciaModel = require('../models/asistenciaModel');

exports.registrar = (req, res) => {

  asistenciaModel.crearAsistencia(req.body, (err, result) => {

    if (err) {
      console.error(err);
      return res.status(500).send(err);
    }

    res.send('Asistencia registrada');

  });

};

exports.listar = (req, res) => {

  asistenciaModel.obtenerAsistencias((err, results) => {

    if (err) {
      return res.status(500).send(err);
    }

    res.json(results);

  });

};