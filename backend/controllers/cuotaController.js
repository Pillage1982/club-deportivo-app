const cuotaModel =
  require('../models/cuotaModel');
const saldoFavorService = require('../services/saldoFavorService');

// Tras crear cuotas nuevas, los saldos a favor se aplican solos a ellas. Si falla,
// las cuotas igual quedan creadas (se puede aplicar luego con el botón).
function aplicarSaldosTrasGenerar(creadas) {
  if (!creadas) return Promise.resolve('');
  return saldoFavorService.aplicarSaldosAFavor()
    .then(({ aplicaciones }) => {
      if (!aplicaciones.length) return '';
      const r = saldoFavorService.resumir(aplicaciones);
      return `. Saldo a favor aplicado: $${r.monto} de ${r.integrantes} integrante(s) (${r.cuotas_pagadas} cuota(s) pagadas, ${r.cuotas_abonadas} con abono)`;
    })
    .catch(err => {
      console.error('Error aplicando saldos a favor:', err);
      return '. No se pudieron aplicar los saldos a favor; use "Aplicar saldos a favor"';
    });
}

// =====================================
// APLICAR SALDOS A FAVOR (manual, con vista previa)
// =====================================
// body.simular = true: solo calcula y devuelve el detalle, sin escribir.

exports.aplicarSaldosAFavor = (req, res) => {
  const simular = req.body?.simular === true || req.body?.simular === 'true';
  saldoFavorService.aplicarSaldosAFavor({ simular })
    .then(({ aplicaciones }) => res.json({
      simulado: simular,
      resumen: saldoFavorService.resumir(aplicaciones),
      aplicaciones
    }))
    .catch(err => {
      console.error('Error aplicando saldos a favor:', err);
      res.status(500).json({ mensaje: 'No se pudieron aplicar los saldos a favor' });
    });
};

// =====================================
// CUOTAS PENDIENTES POR PERSONA
// =====================================

exports.listarPendientesPorPersona = (req, res) => {
  cuotaModel.obtenerCuotasPendientesPorPersona(req.params.persona_id, (err, results) => {
    if (err) return res.status(500).json(err);
    res.json(results);
  });
};

// =====================================
// GENERAR CUOTAS MENSUALES
// =====================================

exports.generarMensualidad = (req, res) => {

  const fechaActual =
    new Date();

  const mes =
    fechaActual.getMonth() + 1;

  const anio =
    fechaActual.getFullYear();

  const fechaVencimiento =
    `${anio}-${String(mes).padStart(2, '0')}-10`;

  cuotaModel.obtenerTipoMensualidad(
    (err, tipos) => {

      if (err) {

        return res.status(500).json(err);

      }

      if (!tipos.length) {

        return res.status(404).json({
          mensaje: 'No existe el tipo de cuota Mensualidad'
        });

      }

      const tipoMensualidad =
        tipos[0];

      cuotaModel.obtenerSociosActivos(
        (err, socios) => {

          if (err) {

            return res.status(500).json(err);

          }

          if (!socios.length) {

            return res.json({
              mensaje: 'No existen socios activos para generar cuotas'
            });

          }

          let procesados = 0;

          let creadas = 0;

          socios.forEach(socio => {

            cuotaModel.crearCuotaMensual(
              {
                persona_id: socio.id,
                tipo_cuota_id: tipoMensualidad.id,
                monto: tipoMensualidad.monto_base,
                mes,
                anio,
                fecha_vencimiento: fechaVencimiento
              },
              (err, result) => {

                procesados++;

                if (!err && result.affectedRows > 0) {

                  creadas++;

                }

                if (procesados === socios.length) {

                  const mensajeBase =
                    creadas > 0
                    ? 'Proceso de cuotas finalizado'
                    : 'Las cuotas de este mes ya estaban generadas';

                  return aplicarSaldosTrasGenerar(creadas).then(textoSaldo => res.json({
                    mensaje: mensajeBase + textoSaldo,
                    mes,
                    anio,
                    socios_procesados: socios.length,
                    cuotas_creadas: creadas
                  }));

                }

              }
            );

          });

        }
      );

    }
  );

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