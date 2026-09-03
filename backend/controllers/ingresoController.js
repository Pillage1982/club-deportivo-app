// Controlador HTTP de ingresos: valida datos, administra el comprobante y coordina el CRUD con ingresoModel.
const path = require('path');
const fs = require('fs');
const ingresoModel = require('../models/ingresoModel');
const uploadIngreso = require('../middleware/uploadIngreso');

// Inverso de extensionPorMime (uploadIngreso.js): misma fuente de verdad
// para no desincronizar los tipos permitidos si se agrega uno nuevo ahi.
const MIME_POR_EXTENSION = Object.fromEntries(
  Object.entries(uploadIngreso.extensionPorMime).map(([mime, ext]) => [ext, mime])
);

function textoValido(valor, minimo = 3) {
  if (typeof valor !== 'string') return false;
  const texto = valor.trim();
  if (texto.length < minimo) return false;
  const tieneLetrasONumeros = /[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]/.test(texto);
  const caracteresPermitidos = /^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s.,#°-]+$/.test(texto);
  return tieneLetrasONumeros && caracteresPermitidos;
}

function validarIngreso(body) {
  const descripcion = body.descripcion ? body.descripcion.trim() : '';
  const categoria   = body.categoria   ? body.categoria.trim()   : '';
  const entidad     = body.entidad     ? body.entidad.trim()     : '';
  const responsable = body.responsable ? body.responsable.trim() : '';
  const monto       = Number(body.monto);
  const fecha       = body.fecha ? body.fecha.trim() : '';

  if (!textoValido(descripcion)) {
    return 'Ingrese una descripción válida';
  }

  if (!textoValido(categoria, 2)) {
    return 'Ingrese una categoría válida';
  }

  if (entidad && !textoValido(entidad, 2)) {
    return 'Ingrese una entidad/organismo válido';
  }

  if (responsable && !textoValido(responsable, 2)) {
    return 'Ingrese un responsable válido';
  }

  if (!Number.isFinite(monto) || monto <= 0) {
    return 'El monto debe ser mayor a 0';
  }

  if (!fecha || Number.isNaN(Date.parse(fecha))) {
    return 'Seleccione una fecha válida';
  }

  return null;
}

exports.listar = (req, res) => {
  ingresoModel.obtenerIngresos((err, results) => {
    if (err) {
      return res.status(500).send(err);
    }
    res.json(results);
  });
};

exports.crear = async (req, res) => {
  const errorValidacion = validarIngreso(req.body);

  if (errorValidacion) {
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(400).json({ mensaje: errorValidacion });
  }

  if (req.file) {
    let firmaValida = false;
    try {
      firmaValida = await uploadIngreso.verificarFirmaArchivo(req.file.path, req.file.mimetype);
    } catch (e) {
      firmaValida = false;
    }
    if (!firmaValida) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ mensaje: 'El archivo no corresponde a una imagen o PDF válido' });
    }
  }

  const data = {
    descripcion: req.body.descripcion.trim(),
    categoria: req.body.categoria.trim(),
    entidad: req.body.entidad ? req.body.entidad.trim() : null,
    monto: Number(req.body.monto),
    fecha: req.body.fecha,
    responsable: req.body.responsable ? req.body.responsable.trim() : null,
    comprobante_path: req.file ? `ingresos/${req.file.filename}` : null
  };

  ingresoModel.crearIngreso(data, (err) => {
    if (err) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(500).json(err);
    }
    res.json({ mensaje: 'Ingreso registrado' });
  });
};

exports.eliminar = (req, res) => {
  const id = req.params.id;

  ingresoModel.obtenerIngresoPorId(id, (err, ingreso) => {
    if (err) {
      return res.status(500).json({ mensaje: 'Error al buscar el ingreso' });
    }

    if (!ingreso) {
      return res.status(404).json({ mensaje: 'Ingreso no encontrado' });
    }

    ingresoModel.eliminarIngreso(id, (delErr) => {
      if (delErr) {
        return res.status(500).json({ mensaje: 'Error al eliminar el ingreso' });
      }

      if (ingreso.comprobante_path) {
        const rutaArchivo = path.join(__dirname, '..', 'uploads', ingreso.comprobante_path);
        fs.unlink(rutaArchivo, () => {});
      }

      res.json({ mensaje: 'Ingreso eliminado' });
    });
  });
};

exports.descargarComprobante = (req, res) => {
  const id = req.params.id;

  ingresoModel.obtenerIngresoPorId(id, (err, ingreso) => {
    if (err) {
      return res.status(500).json({ mensaje: 'Error al buscar el ingreso' });
    }

    if (!ingreso || !ingreso.comprobante_path) {
      return res.status(404).json({ mensaje: 'Este ingreso no tiene comprobante adjunto' });
    }

    const rutaArchivo = path.join(__dirname, '..', 'uploads', ingreso.comprobante_path);
    const extension = path.extname(rutaArchivo).toLowerCase();
    const mimeSeguro = MIME_POR_EXTENSION[extension] || 'application/octet-stream';

    res.set('Content-Disposition', `attachment; filename="comprobante${extension}"`);
    res.type(mimeSeguro);
    res.sendFile(rutaArchivo, (sendErr) => {
      if (sendErr && !res.headersSent) {
        res.status(404).json({ mensaje: 'Comprobante no encontrado' });
      }
    });
  });
};
