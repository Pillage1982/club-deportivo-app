// Controlador HTTP financiero de solo lectura: expone el estado consolidado por integrante.
const finanzasModel = require('../models/finanzasModel');

exports.listar = (req, res) => {

  finanzasModel.obtenerEstadoFinanciero((err, results) => {

    if (err) {
      return res.status(500).send(err);
    }

    res.json(results);

  });

};
