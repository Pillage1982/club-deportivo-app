const personaModel = require('../models/personaModel');

exports.listar = (req, res) => {
  personaModel.obtenerPersonas((err, results) => {
    if (err) {
      return res.status(500).send(err);
    }

    res.json(results);
  });
};

exports.crear = (req, res) => {

  personaModel.crearPersona(
    req.body,
    (err, result) => {

      if (err) {

        return res.status(500).json(err);

      }

      res.json({
        mensaje: 'Persona creada'
      });

    }
  );

};

exports.actualizar = (req, res) => {

  personaModel.actualizarPersona(

    req.params.id,

    req.body,

    (err, result) => {

      if (err) {

        return res.status(500).json(err);

      }

      res.json({
        mensaje: 'Persona actualizada'
      });

    }

  );

};

exports.eliminar = (req, res) => {

  personaModel.eliminarPersona(

    req.params.id,

    (err, result) => {

      if (err) {

        return res.status(500).json(err);

      }

      res.json({
        mensaje: 'Persona eliminada'
      });

    }

  );

};