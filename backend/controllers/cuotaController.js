// Controlador HTTP de cuotas: lista, genera y administra cuotas delegando las consultas al modelo.
const cuotaModel = require('../models/cuotaModel');
const { PERIODOS_CUOTAS_2025_2026 } = require('../utils/estatutoGdcRules');

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
  const fechaActual = new Date();
  // mes/anio opcionales en el body: permiten adelantar la generacion de cuotas
  // futuras (necesario para el pago anual completo, art. 9.3). Sin body, se
  // comporta igual que antes: genera el mes calendario actual.
  const mesBody  = Number(req.body?.mes);
  const anioBody = Number(req.body?.anio);
  const mes  = Number.isInteger(mesBody)  && mesBody  >= 1 && mesBody <= 12 ? mesBody  : fechaActual.getMonth() + 1;
  const anio = Number.isInteger(anioBody) && anioBody > 2000                ? anioBody : fechaActual.getFullYear();
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
// GENERAR TODAS LAS CUOTAS DE LA TEMPORADA
// =====================================
// Necesario para que un integrante pueda pagar el año completo por adelantado
// (art. 9.3, escenario "pago anual al inicio del ciclo"): sin esto, las cuotas de
// meses futuros no existen todavía y no hay a qué vincular ese pago.

exports.generarTemporadaCompleta = (req, res) => {
  cuotaModel.obtenerTipoMensualidad((err, tipos) => {
    if (err) return res.status(500).json(err);
    if (!tipos.length) return res.status(404).json({ mensaje: 'No existe el tipo de cuota Mensualidad' });

    const tipoMensualidad = tipos[0];
    const periodos = PERIODOS_CUOTAS_2025_2026;
    let pendientes  = periodos.length;
    let totalCreadas = 0;
    let respondido   = false;

    periodos.forEach(periodo => {
      const fechaVencimiento = `${periodo.anio}-${String(periodo.mes).padStart(2, '0')}-10`;
      cuotaModel.generarMensualidadMasiva(
        {
          tipo_cuota_id:     tipoMensualidad.id,
          monto:             tipoMensualidad.monto_base,
          mes:               periodo.mes,
          anio:              periodo.anio,
          fecha_vencimiento: fechaVencimiento
        },
        (errPeriodo, result) => {
          pendientes--;
          if (respondido) return;
          if (errPeriodo) {
            respondido = true;
            return res.status(500).json(errPeriodo);
          }
          totalCreadas += result.affectedRows || 0;
          if (pendientes === 0) {
            respondido = true;
            res.json({ mensaje: 'Cuotas de toda la temporada generadas', cuotas_creadas: totalCreadas });
          }
        }
      );
    });
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
