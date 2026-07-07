const cuotaModel =
  require('../models/cuotaModel');

// =====================================
// GENERAR CUOTAS MENSUALES
// =====================================

exports.generarMensualidad = (req, res) => {
  const fechaActual    = new Date();
  const mes            = fechaActual.getMonth() + 1;
  const anio           = fechaActual.getFullYear();
  const fechaVencimiento = `${anio}-${String(mes).padStart(2, '0')}-10`;

  cuotaModel.obtenerTipoMensualidad((err, tipos) => {
    if (err) return res.status(500).json(err);
    if (!tipos.length) return res.status(404).json({ mensaje: 'No existe el tipo de cuota Mensualidad' });

    const tipoMensualidad = tipos[0];

    // Un solo INSERT SELECT en lugar de N inserts individuales
    cuotaModel.generarMensualidadMasiva(
      {
        tipo_cuota_id:    tipoMensualidad.id,
        monto:            tipoMensualidad.monto_base,
        mes,
        anio,
        fecha_vencimiento: fechaVencimiento
      },
      (err, result) => {
        if (err) return res.status(500).json(err);
        const creadas = result.affectedRows || 0;
        return res.json({
          mensaje: creadas > 0
            ? 'Proceso de cuotas finalizado'
            : 'Las cuotas de este mes ya estaban generadas',
          mes,
          anio,
          cuotas_creadas: creadas
        });
      }
    );
  });
};

// =====================================
// LISTAR CUOTAS
// =====================================

exports.listar = (req, res) => {

  cuotaModel.obtenerCuotas(
    (err, results) => {

      if (err) {

        return res.status(500).json(err);

      }

      res.json(results);

    }
  );

};