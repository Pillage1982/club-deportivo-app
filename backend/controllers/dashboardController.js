const dashboardModel = require('../models/dashboardModel');

exports.resumen = (req, res) => {

  dashboardModel.obtenerResumen((err, results) => {

    if (err) {
      return res.status(500).send(err);
    }

    res.json(results[0]);

  });

};