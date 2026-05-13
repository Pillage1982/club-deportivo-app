const eventoModel = require('../models/eventoModel');

exports.listar = (req, res) => {
  eventoModel.obtenerEventos((err, results) => {
    if (err) {
      return res.status(500).send(err);
    }

    res.json(results);
  });
};

exports.crear = (req, res) => {

  eventoModel.crearEvento(

    req.body,

    (err, result) => {

      if (err) {

        return res.status(500).json(err);

      }

      res.json({
        mensaje: 'Evento creado'
      });

    }

  );

};

exports.actualizar = (req, res) => {

  eventoModel.actualizarEvento(

    req.params.id,

    req.body,

    (err, result) => {

      if (err) {

        return res.status(500).json(err);

      }

      res.json({
        mensaje: 'Evento actualizado'
      });

    }

  );

};

exports.eliminar = (req, res) => {

  eventoModel.eliminarEvento(

    req.params.id,

    (err, result) => {

      if (err) {

        return res.status(500).json(err);

      }

      res.json({
        mensaje: 'Evento eliminado'
      });

    }

  );

};