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

  console.log(req.body);

  personaModel.crearPersona(

    req.body,

    (err, result) => {

      console.log('CALLBACK MYSQL');

      console.log(err);

      console.log(result);

      if (err) {

        return res.status(500).json(err);

      }

      res.json({
        mensaje: 'Persona creada'
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