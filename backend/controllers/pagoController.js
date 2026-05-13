const pagoModel =
  require('../models/pagoModel');

// =========================
// CREAR PAGO
// =========================

exports.crear = (req, res) => {

  pagoModel.crearPago(

    req.body,

    (err, result) => {

      if (err) {

        return res.status(500).json(err);

      }

      res.json({
        mensaje: 'Pago registrado'
      });

    }

  );

};

// =========================
// OBTENER PAGOS
// =========================

exports.obtener = (req, res) => {

  pagoModel.obtenerPagos(

    (err, results) => {

      if (err) {

        return res.status(500).json(err);

      }

      res.json(results);

    }

  );

};