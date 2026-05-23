// =====================================
// MODELO PAGOS
// =====================================

const pagoModel =
  require('../models/pagoModel');

  // =====================================
  // REGISTRAR PAGO
  // =====================================

  exports.crear = (req, res) => {

    // Inserta pago en base datos
    pagoModel.crearPago(

    req.body,

    // Manejo errores backend pagos
    (err, result) => {

      if (err) {

        return res.status(500).json(err);

      }

      // Respuesta exitosa frontend
      res.json({
        mensaje: 'Pago registrado'
      });

    }

  );

};

// =====================================
// LISTAR PAGOS
// =====================================

exports.obtener = (req, res) => {

  pagoModel.obtenerPagos(

    (err, results) => {

      if (err) {

        return res.status(500).json(err);

      }

      // Devuelve historial pagos
      res.json(results);

    }

  );

};

// =====================================
// ACTUALIZAR PAGO
// =====================================

exports.actualizar = (req, res) => {

  // Actualiza registro pago existente
  pagoModel.actualizarPago(

    req.params.id,

    req.body,

    (err, result) => {

      if (err) {

        return res.status(500).json(err);

      }

      // Confirma actualización frontend
      res.json({
        mensaje: 'Pago actualizado'
      });

    }

  );

};

// =====================================
// ELIMINAR PAGO
// =====================================

exports.eliminar = (req, res) => {

  // Elimina pago desde base datos
  pagoModel.eliminarPago(

    req.params.id,

    (err, result) => {

      if (err) {

        return res.status(500).json(err);

      }

      // Confirma eliminación frontend
      res.json({
        mensaje: 'Pago eliminado'
      });

    }

  );

};