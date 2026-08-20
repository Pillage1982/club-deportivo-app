// Controlador HTTP de gastos: valida datos, administra comprobantes y coordina el CRUD con gastoModel.
const path = require('path');
const fs = require('fs');
const gastoModel = require('../models/gastoModel');
const uploadComprobante = require('../middleware/uploadComprobante');

const MIME_POR_EXTENSION = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf'
};

function textoValido(valor, minimo = 3) {
  if (typeof valor !== 'string') return false;
  const texto = valor.trim();
  if (texto.length < minimo) return false;
  const tieneLetrasONumeros = /[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]/.test(texto);
  const caracteresPermitidos = /^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s.,#°-]+$/.test(texto);
  return tieneLetrasONumeros && caracteresPermitidos;
}

function validarGasto(body) {
  const descripcion = body.descripcion ? body.descripcion.trim() : '';
  const categoria   = body.categoria   ? body.categoria.trim()   : '';
  const responsable = body.responsable ? body.responsable.trim() : '';
  const monto       = Number(body.monto);
  const fecha       = body.fecha ? body.fecha.trim() : '';

  if (!textoValido(descripcion)) {
    return 'Ingrese una descripción válida';
  }

  if (!textoValido(categoria, 2)) {
    return 'Ingrese una categoría válida';
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
  gastoModel.obtenerGastos((err, results) => {
    if (err) {
      return res.status(500).send(err);
    }
    res.json(results);
  });
};

exports.crear = async (req, res) => {
  const errorValidacion = validarGasto(req.body);

  if (errorValidacion) {
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(400).json({ mensaje: errorValidacion });
  }

  if (req.file) {
    let firmaValida = false;
    try {
      firmaValida = await uploadComprobante.verificarFirmaArchivo(req.file.path, req.file.mimetype);
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
    monto: Number(req.body.monto),
    fecha: req.body.fecha,
    responsable: req.body.responsable ? req.body.responsable.trim() : null,
    comprobante_path: req.file ? `comprobantes/${req.file.filename}` : null
  };

  gastoModel.crearGasto(data, (err) => {
    if (err) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(500).json(err);
    }
    res.json({ mensaje: 'Gasto registrado' });
  });
};

exports.eliminar = (req, res) => {
  const id = req.params.id;

  gastoModel.obtenerGastoPorId(id, (err, gasto) => {
    if (err) {
      return res.status(500).json({ mensaje: 'Error al buscar el gasto' });
    }

    if (!gasto) {
      return res.status(404).json({ mensaje: 'Gasto no encontrado' });
    }

    gastoModel.eliminarGasto(id, (delErr) => {
      if (delErr) {
        return res.status(500).json({ mensaje: 'Error al eliminar el gasto' });
      }

      if (gasto.comprobante_path) {
        const rutaArchivo = path.join(__dirname, '..', 'uploads', gasto.comprobante_path);
        fs.unlink(rutaArchivo, () => {});
      }

      res.json({ mensaje: 'Gasto eliminado' });
    });
  });
};

exports.descargarComprobante = (req, res) => {
  const id = req.params.id;

  gastoModel.obtenerGastoPorId(id, (err, gasto) => {
    if (err) {
      return res.status(500).json({ mensaje: 'Error al buscar el gasto' });
    }

    if (!gasto || !gasto.comprobante_path) {
      return res.status(404).json({ mensaje: 'Este gasto no tiene comprobante adjunto' });
    }

    const rutaArchivo = path.join(__dirname, '..', 'uploads', gasto.comprobante_path);
    const extension = path.extname(rutaArchivo).toLowerCase();
    const mimeSeguro = MIME_POR_EXTENSION[extension] || 'application/octet-stream';

    // Content-Type explícito (nunca inferido de una extensión no controlada) y
    // Content-Disposition: attachment como defensa adicional si el archivo se
    // abre por navegación directa en vez de vía fetch()+blob() del frontend.
    res.set('Content-Disposition', `attachment; filename="comprobante${extension}"`);
    res.type(mimeSeguro);
    res.sendFile(rutaArchivo, (sendErr) => {
      if (sendErr && !res.headersSent) {
        res.status(404).json({ mensaje: 'Comprobante no encontrado' });
      }
    });
  });
};
