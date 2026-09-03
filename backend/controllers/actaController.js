// Controlador HTTP de actas de reunion: valida datos, administra el adjunto y coordina el CRUD con actaModel.
const path = require('path');
const fs = require('fs');
const actaModel = require('../models/actaModel');
const uploadActa = require('../middleware/uploadActa');

// Inverso de extensionPorMime (uploadActa.js): misma fuente de verdad para
// no desincronizar los tipos permitidos si se agrega uno nuevo ahi.
const MIME_POR_EXTENSION = Object.fromEntries(
  Object.entries(uploadActa.extensionPorMime).map(([mime, ext]) => [ext, mime])
);

// Mismo patron que eventoController.js/gastoController.js para campos cortos
// tipo titulo (no sirve para el contenido: una minuta necesita parentesis,
// dos puntos, comillas, signos de interrogacion, etc.)
function textoValido(valor, minimo = 3) {
  if (typeof valor !== 'string') return false;
  const texto = valor.trim();
  if (texto.length < minimo) return false;
  const tieneLetrasONumeros = /[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]/.test(texto);
  const caracteresPermitidos = /^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s.,#°-]+$/.test(texto);
  return tieneLetrasONumeros && caracteresPermitidos;
}

// El contenido de una acta es texto libre (redaccion de una minuta): solo se
// bloquean '<' y '>' para evitar inyeccion de HTML/XSS; se permite el resto
// de la puntuacion normal (parentesis, comillas, saltos de linea, etc.). El
// frontend ademas escapa el texto al renderizarlo (defensa en profundidad).
function contenidoValido(valor) {
  if (typeof valor !== 'string') return false;
  const texto = valor.trim();
  if (texto.length < 10 || texto.length > 20000) return false;
  return !/[<>]/.test(texto);
}

function validarActa(body) {
  const eventoId = Number(body.evento_id);
  const titulo = body.titulo ? body.titulo.trim() : '';
  const contenido = body.contenido ? body.contenido.trim() : '';
  const responsable = body.responsable ? body.responsable.trim() : '';

  if (!Number.isInteger(eventoId) || eventoId <= 0) {
    return 'Seleccione la reunion a la que corresponde esta acta';
  }

  if (!textoValido(titulo)) {
    return 'Ingrese un titulo valido';
  }

  if (!contenidoValido(contenido)) {
    return 'Ingrese el contenido del acta (minimo 10 caracteres, sin < ni >)';
  }

  if (responsable && !textoValido(responsable, 2)) {
    return 'Ingrese un responsable valido';
  }

  return null;
}

exports.listar = (req, res) => {
  actaModel.obtenerActas((err, results) => {
    if (err) {
      return res.status(500).send(err);
    }
    res.json(results);
  });
};

exports.eventosDisponibles = (req, res) => {
  actaModel.obtenerEventosReunionSinActa((err, results) => {
    if (err) {
      return res.status(500).send(err);
    }
    res.json(results);
  });
};

exports.crear = async (req, res) => {
  const errorValidacion = validarActa(req.body);

  if (errorValidacion) {
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(400).json({ mensaje: errorValidacion });
  }

  if (req.file) {
    let firmaValida = false;
    try {
      firmaValida = await uploadActa.verificarFirmaArchivo(req.file.path, req.file.mimetype);
    } catch (e) {
      firmaValida = false;
    }
    if (!firmaValida) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ mensaje: 'El archivo no corresponde a una imagen o PDF valido' });
    }
  }

  const eventoId = Number(req.body.evento_id);

  actaModel.obtenerEventoReunionPorId(eventoId, (errEvento, evento) => {
    if (errEvento) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(500).json({ mensaje: 'Error al validar la reunion' });
    }

    if (!evento) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(400).json({ mensaje: 'La reunion seleccionada no existe o no es de tipo reunion' });
    }

    const data = {
      evento_id: eventoId,
      titulo: req.body.titulo.trim(),
      contenido: req.body.contenido.trim(),
      responsable: req.body.responsable ? req.body.responsable.trim() : null,
      archivo_path: req.file ? `actas/${req.file.filename}` : null
    };

    actaModel.crearActa(data, (err) => {
      if (err) {
        if (req.file) fs.unlink(req.file.path, () => {});
        if (err.code === 'ER_DUP_ENTRY') {
          return res.status(409).json({ mensaje: 'Esta reunion ya tiene un acta registrada' });
        }
        return res.status(500).json(err);
      }
      res.json({ mensaje: 'Acta registrada' });
    });
  });
};

exports.eliminar = (req, res) => {
  const id = req.params.id;

  actaModel.obtenerActaPorId(id, (err, acta) => {
    if (err) {
      return res.status(500).json({ mensaje: 'Error al buscar el acta' });
    }

    if (!acta) {
      return res.status(404).json({ mensaje: 'Acta no encontrada' });
    }

    actaModel.eliminarActa(id, (delErr) => {
      if (delErr) {
        return res.status(500).json({ mensaje: 'Error al eliminar el acta' });
      }

      if (acta.archivo_path) {
        const rutaArchivo = path.join(__dirname, '..', 'uploads', acta.archivo_path);
        fs.unlink(rutaArchivo, () => {});
      }

      res.json({ mensaje: 'Acta eliminada' });
    });
  });
};

exports.descargarAdjunto = (req, res) => {
  const id = req.params.id;

  actaModel.obtenerActaPorId(id, (err, acta) => {
    if (err) {
      return res.status(500).json({ mensaje: 'Error al buscar el acta' });
    }

    if (!acta || !acta.archivo_path) {
      return res.status(404).json({ mensaje: 'Esta acta no tiene adjunto' });
    }

    const rutaArchivo = path.join(__dirname, '..', 'uploads', acta.archivo_path);
    const extension = path.extname(rutaArchivo).toLowerCase();
    const mimeSeguro = MIME_POR_EXTENSION[extension] || 'application/octet-stream';

    res.set('Content-Disposition', `attachment; filename="acta${extension}"`);
    res.type(mimeSeguro);
    res.sendFile(rutaArchivo, (sendErr) => {
      if (sendErr && !res.headersSent) {
        res.status(404).json({ mensaje: 'Adjunto no encontrado' });
      }
    });
  });
};
