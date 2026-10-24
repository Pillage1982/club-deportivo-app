// Depósitos del Portal del Socio: datos de la cuenta para depositar y envío del
// comprobante a tesorería. Solo avisa: no registra el pago ni cambia cuotas;
// tesorería revisa la cartola y registra el pago en el panel (Tablas → Depósitos).
const fs = require('fs');
const path = require('path');
const db = require('../config/db');
const comprobanteDepositoModel = require('../models/comprobanteDepositoModel');
const cuentaDeposito = require('../config/cuentaDeposito');
const uploadDeposito = require('../middleware/uploadDeposito');
const emailService = require('../services/emailService');

function descartarArchivo(req) {
  if (req.file) fs.unlink(req.file.path, () => {});
}

// 'YYYY-MM-DD' de hoy en hora de Chile.
function hoyChile() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date());
}

function obtenerPersona(personaId) {
  return new Promise((resolve, reject) => {
    db.query(
      'SELECT rut, nombres, apellido_paterno, apellido_materno, email FROM personas WHERE id = ? LIMIT 1',
      [personaId],
      (err, rows) => (err ? reject(err) : resolve(rows ? rows[0] : null))
    );
  });
}

// GET: datos para depositar + comprobantes ya enviados por el socio.
exports.obtener = async (req, res) => {
  try {
    const comprobantes = await comprobanteDepositoModel.listarSocio(req.socio.persona_id);
    res.json({ cuenta_deposito: cuentaDeposito, comprobantes });
  } catch (err) {
    console.error('Error obteniendo depósitos del socio:', err);
    res.status(500).json({ mensaje: 'No se pudieron obtener tus comprobantes' });
  }
};

// POST (multipart, comprobante obligatorio): registra el comprobante y avisa a tesorería.
exports.enviar = async (req, res) => {
  const personaId = req.socio.persona_id;
  const body = req.body || {};

  const monto = Number(String(body.monto ?? '').replace(/\D/g, ''));
  const fechaDeposito = String(body.fecha_deposito || '');
  const concepto = String(body.concepto || '').trim().substring(0, 200) || null;

  if (!req.file) {
    return res.status(400).json({ mensaje: 'Adjunta la foto o el PDF del comprobante' });
  }
  if (!Number.isInteger(monto) || monto < 100 || monto > 10000000) {
    descartarArchivo(req);
    return res.status(400).json({ mensaje: 'Indica el monto depositado' });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaDeposito) || fechaDeposito > hoyChile() || fechaDeposito < '2020-01-01') {
    descartarArchivo(req);
    return res.status(400).json({ mensaje: 'Indica una fecha de depósito válida (no puede ser futura)' });
  }

  try {
    const firmaValida = await uploadDeposito.verificarFirmaArchivo(req.file.path, req.file.mimetype)
      .catch(() => false);
    if (!firmaValida) {
      descartarArchivo(req);
      return res.status(400).json({ mensaje: 'El archivo no corresponde a una imagen o PDF válido' });
    }

    const persona = await obtenerPersona(personaId);
    if (!persona) {
      descartarArchivo(req);
      return res.status(404).json({ mensaje: 'Integrante no encontrado' });
    }

    const folio = await comprobanteDepositoModel.crear({
      persona_id: personaId,
      monto,
      fecha_deposito: fechaDeposito,
      concepto,
      adjunto_path: `comprobantes_deposito/${req.file.filename}`
    });

    let correoEnviado = false;
    try {
      correoEnviado = await emailService.enviarComprobanteDeposito({
        folio,
        persona,
        monto,
        fechaDeposito,
        concepto,
        adjunto: {
          path: req.file.path,
          filename: `comprobante-${emailService.formatearFolio(folio)}${path.extname(req.file.filename)}`
        }
      });
      if (correoEnviado) await comprobanteDepositoModel.marcarEmail(folio);
    } catch (errCorreo) {
      console.error('[Email] Error enviando comprobante de depósito, folio', folio, errCorreo);
    }

    res.status(201).json({
      folio,
      correoEnviado,
      mensaje: correoEnviado
        ? `Comprobante enviado a tesorería. Folio Nº ${emailService.formatearFolio(folio)}.`
        : `Comprobante registrado con folio Nº ${emailService.formatearFolio(folio)}. Tesorería lo verá en el panel.`
    });
  } catch (err) {
    descartarArchivo(req);
    console.error('Error registrando comprobante de depósito:', err);
    res.status(500).json({ mensaje: 'No se pudo registrar el comprobante' });
  }
};
