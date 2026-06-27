const eventoModel = require('../models/eventoModel');
const asistenciaModel = require('../models/asistenciaModel');
const multaModel = require('../models/multaModel');
const { notificarAusentesEvento } = require('../services/emailService');

const tiposPermitidos = [
  'entrenamiento',
  'partido',
  'reunion'
];

function textoValido(valor, minimo = 3) {
  if (typeof valor !== 'string') return false;

  const texto = valor.trim();

  if (texto.length < minimo) return false;

  const tieneLetrasONumeros = /[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]/.test(texto);
  const caracteresPermitidos = /^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s.,#°-]+$/.test(texto);

  return tieneLetrasONumeros && caracteresPermitidos;
}

function validarEvento(body) {
  const nombre = body.nombre ? body.nombre.trim() : '';
  const tipo = body.tipo ? body.tipo.trim() : '';
  const fecha = body.fecha ? body.fecha.trim() : '';
  const ubicacion = body.ubicacion ? body.ubicacion.trim() : '';
  const descripcion = body.descripcion ? body.descripcion.trim() : '';

  if (!textoValido(nombre)) {
    return 'Ingrese un nombre de actividad valida';
  }

  if (!tiposPermitidos.includes(tipo)) {
    return 'Seleccione un tipo de actividad valida';
  }

  if (!fecha || Number.isNaN(Date.parse(fecha))) {
    return 'Seleccione una fecha valida';
  }

  if (!textoValido(ubicacion)) {
    return 'Ingrese una ubicacion valida';
  }

  if (descripcion && !textoValido(descripcion)) {
    return 'Ingrese una descripcion valida';
  }

  return null;
}

exports.listar = (req, res) => {
  eventoModel.obtenerEventos((err, results) => {
    if (err) {
      return res.status(500).send(err);
    }

    res.json(results);
  });
};

exports.crear = (req, res) => {

    const errorValidacion = validarEvento(req.body);

  if (errorValidacion) {
    return res.status(400).json({
      mensaje: errorValidacion
    });
  }

  eventoModel.crearEvento(

    req.body,

    (err, result) => {

      if (err) {

        return res.status(500).json(err);

      }

      res.json({
        mensaje: 'Actividad creada'
      });

    }

  );

};

exports.actualizar = (req, res) => {

  const errorValidacion = validarEvento(req.body);

  if (errorValidacion) {
    return res.status(400).json({
      mensaje: errorValidacion
    });
  }

  eventoModel.actualizarEvento(

    req.params.id,

    req.body,

    (err, result) => {

      if (err) {

        return res.status(500).json(err);

      }

      res.json({
        mensaje: 'Actividad actualizada'
      });

    }

  );

};

exports.eliminar = (req, res) => {

  eventoModel.eliminarEvento(

    req.params.id,

    (err, result) => {

      if (err) {

        return res.status(500).json(err);

      }

      res.json({
        mensaje: 'Actividad eliminada'
      });

    }

  );

};

exports.cerrar = (req, res) => {

  const id = req.params.id;

  eventoModel.obtenerEventoPorId(id, (err, evento) => {

    if (err) {
      return res.status(500).json({ mensaje: 'Error al verificar actividad' });
    }

    if (!evento) {
      return res.status(404).json({ mensaje: 'Actividad no encontrada' });
    }

    if (evento.finalizado) {
      return res.status(400).json({ mensaje: 'La actividad ya está finalizada' });
    }

    asistenciaModel.registrarAusentesEvento(id, (ausErr, ausResult) => {

      if (ausErr) {
        return res.status(500).json({ mensaje: 'Error al registrar ausentes' });
      }

      const totalAusentes = ausResult ? ausResult.affectedRows : 0;

      multaModel.crearMultasAusentes(id, (multaErr) => {

        if (multaErr) {
          return res.status(500).json({ mensaje: 'Error al generar multas por inasistencia' });
        }

        eventoModel.cerrarEvento(id, (cerrarErr) => {

          if (cerrarErr) {
            return res.status(500).json({ mensaje: 'Error al finalizar actividad' });
          }

          const detalle = totalAusentes > 0
            ? ` Se registraron ${totalAusentes} ausente(s) con multa de $5.000.`
            : ' Todos los integrantes tenían asistencia registrada.';

          res.json({
            mensaje: `Actividad finalizada.${detalle}`
          });

          // Envía correos en segundo plano (no bloquea la respuesta)
          asistenciaModel.obtenerAusentesConContacto(id, (contactErr, ausentes) => {
            if (contactErr || !ausentes) return;
            notificarAusentesEvento(ausentes, evento).catch(err => {
              console.error('[Email] Error general en notificaciones:', err);
            });
          });

        });

      });

    });

  });

};