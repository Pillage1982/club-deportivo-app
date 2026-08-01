// Controlador HTTP de multas: lista y actualiza el seguimiento administrativo de multas.
const multaModel = require('../models/multaModel');

exports.listar = (req, res) => {

  multaModel.obtenerMultas((err, results) => {

    if (err) {
      return res.status(500).send(err);
    }

    res.json(results);

  });

};
