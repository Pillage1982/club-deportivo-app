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

// =========================
// ACTUALIZAR PAGO
// =========================

exports.actualizar = (req, res) => {

  pagoModel.actualizarPago(

    req.params.id,

    req.body,

    (err, result) => {

      if (err) {

        return res.status(500).json(err);

      }

      res.json({
        mensaje: 'Pago actualizado'
      });

    }

  );

};

// =========================
// ELIMINAR PAGO
// =========================

exports.eliminar = (req, res) => {

  pagoModel.eliminarPago(

    req.params.id,

    (err, result) => {

      if (err) {

        return res.status(500).json(err);

      }

      res.json({
        mensaje: 'Pago eliminado'
      });

    }

  );

};