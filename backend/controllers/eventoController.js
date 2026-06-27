const eventoModel = require('../models/eventoModel');

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

  eventoModel.obtenerEventoPorId(req.params.id, (err, evento) => {

    if (err) {
      return res.status(500).json({ mensaje: 'Error al verificar actividad' });
    }

    if (!evento) {
      return res.status(404).json({ mensaje: 'Actividad no encontrada' });
    }

    if (evento.finalizado) {
      return res.status(400).json({ mensaje: 'La actividad ya está finalizada' });
    }

    eventoModel.cerrarEvento(req.params.id, (cerrarErr) => {

      if (cerrarErr) {
        return res.status(500).json({ mensaje: 'Error al finalizar actividad' });
      }

      res.json({ mensaje: 'Actividad finalizada. No se podrá registrar más asistencia.' });

    });

  });

};