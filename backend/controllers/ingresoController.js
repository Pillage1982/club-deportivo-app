// Controlador HTTP de ingresos de terceros: valida datos, administra comprobantes
// y coordina el CRUD con ingresoModel (mismo patrón que gastoController).
const path = require('path');
const fs = require('fs');
const ingresoModel = require('../models/ingresoModel');
const uploadComprobante = require('../middleware/uploadComprobante');

const CATEGORIAS_INGRESO = ['Donación', 'Premio', 'Proyecto adjudicado', 'Otro'];

const MIME_POR_EXTENSION = Object.fromEntries(
  Object.entries(uploadComprobante.extensionPorMime).map(([mime, ext]) => [ext, mime])
);

function textoValido(valor, minimo = 3) {
  if (typeof valor !== 'string') return false;
  const texto = valor.trim();
  if (texto.length < minimo) return false;
  const tieneLetrasONumeros = /[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]/.test(texto);
  const caracteresPermitidos = /^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ\s.,#°&()/-]+$/.test(texto);
  return tieneLetrasONumeros && caracteresPermitidos;
}

// Adjuntos opcionales de un ingreso: comprobante de depósito y documento de respaldo
const CAMPOS_ARCHIVO = ['comprobante', 'documento'];

function archivosSubidos(req) {
  return CAMPOS_ARCHIVO
    .map(campo => (req.files && req.files[campo] && req.files[campo][0]) || null)
    .filter(Boolean);
}

function borrarArchivosSubidos(req) {
  archivosSubidos(req).forEach(archivo => fs.unlink(archivo.path, () => {}));
}

function rutaGuardada(req, campo) {
  const archivo = req.files && req.files[campo] && req.files[campo][0];
  return archivo ? `comprobantes/${archivo.filename}` : null;
}

function validarIngreso(body) {
  const descripcion = body.descripcion ? body.descripcion.trim() : '';
  const categoria   = body.categoria   ? body.categoria.trim()   : '';
  const origen      = body.origen      ? body.origen.trim()      : '';
  const responsable = body.responsable ? body.responsable.trim() : '';
  const monto       = Number(body.monto);
  const fecha       = body.fecha ? body.fecha.trim() : '';

  if (!textoValido(descripcion)) {
    return 'Ingrese una descripción válida';
  }

  if (!CATEGORIAS_INGRESO.includes(categoria)) {
    return 'Seleccione una categoría válida';
  }

  if (!textoValido(origen, 2)) {
    return 'Ingrese el origen o donante';
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
      return res.status(500).json({ mensaje: 'Error al obtener los ingresos' });
    }
    res.json(results);
  });
};

exports.crear = async (req, res) => {
  const errorValidacion = validarIngreso(req.body);

  if (errorValidacion) {
    borrarArchivosSubidos(req);
    return res.status(400).json({ mensaje: errorValidacion });
  }

  for (const archivo of archivosSubidos(req)) {
    let firmaValida = false;
    try {
      firmaValida = await uploadComprobante.verificarFirmaArchivo(archivo.path, archivo.mimetype);
    } catch (e) {
      firmaValida = false;
    }
    if (!firmaValida) {
      borrarArchivosSubidos(req);
      return res.status(400).json({ mensaje: 'El archivo no corresponde a una imagen o PDF válido' });
    }
  }

  const data = {
    descripcion: req.body.descripcion.trim(),
    categoria: req.body.categoria.trim(),
    origen: req.body.origen.trim(),
    monto: Number(req.body.monto),
    fecha: req.body.fecha,
    responsable: req.body.responsable ? req.body.responsable.trim() : null,
    comprobante_path: rutaGuardada(req, 'comprobante'),
    documento_path: rutaGuardada(req, 'documento'),
    registrado_por: req.usuario ? req.usuario.id : null
  };

  ingresoModel.crearIngreso(data, (err) => {
    if (err) {
      borrarArchivosSubidos(req);
      return res.status(500).json({ mensaje: 'Error al registrar el ingreso' });
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

      [ingreso.comprobante_path, ingreso.documento_path].filter(Boolean).forEach(ruta => {
        fs.unlink(path.join(__dirname, '..', 'uploads', ruta), () => {});
      });

      res.json({ mensaje: 'Ingreso eliminado' });
    });
  });
};

function descargarAdjunto(columna, nombreArchivo, mensajeSinArchivo) {
  return (req, res) => {
    const id = req.params.id;

    ingresoModel.obtenerIngresoPorId(id, (err, ingreso) => {
      if (err) {
        return res.status(500).json({ mensaje: 'Error al buscar el ingreso' });
      }

      if (!ingreso || !ingreso[columna]) {
        return res.status(404).json({ mensaje: mensajeSinArchivo });
      }

      const rutaArchivo = path.join(__dirname, '..', 'uploads', ingreso[columna]);
      const extension = path.extname(rutaArchivo).toLowerCase();
      const mimeSeguro = MIME_POR_EXTENSION[extension] || 'application/octet-stream';

      res.set('Content-Disposition', `attachment; filename="${nombreArchivo}${extension}"`);
      res.type(mimeSeguro);
      res.sendFile(rutaArchivo, (sendErr) => {
        if (sendErr && !res.headersSent) {
          res.status(404).json({ mensaje: 'Archivo no encontrado' });
        }
      });
    });
  };
}

exports.descargarComprobante = descargarAdjunto(
  'comprobante_path', 'comprobante_deposito', 'Este ingreso no tiene comprobante de depósito adjunto'
);

exports.descargarDocumento = descargarAdjunto(
  'documento_path', 'documento_respaldo', 'Este ingreso no tiene documento de respaldo adjunto'
);
