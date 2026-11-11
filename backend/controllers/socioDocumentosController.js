// Pestaña "Documentos" del Portal del Integrante: carta de justificación de inasistencia
// (formato de Carta_Justificacion.doc) y postulación a bloques (formato de
// Carta_Postulacion_Bloques.doc), autocompletadas con los datos del socio y
// enviadas por correo. Nombre y RUT salen siempre de la BD (req.socio.persona_id),
// nunca del formulario. Las cartas quedan guardadas aunque el correo falle.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const justificacionModel = require('../models/justificacionModel');
const comprobanteDepositoModel = require('../models/comprobanteDepositoModel');
const comprobanteAsignacionModel = require('../models/comprobanteAsignacionModel');
const puntajeModel = require('../models/puntajeModel');
const solicitudIngresoModel = require('../models/solicitudIngresoModel');
const cartaPermisoModel = require('../models/cartaPermisoModel');
const { aniosDesdeFundacion } = require('../services/cartaPermisoPdf');
const cuentaDeposito = require('../config/cuentaDeposito');
const cuotaIntegracion = require('../config/cuotaIntegracion');
const uploadJustificativo = require('../middleware/uploadJustificativo');
const emailService = require('../services/emailService');

// Categorías de actividad de la agrupación: Ensayo, Misa, Reunión, Presentación y
// Otros. 'salida' es el valor histórico de Presentación (se muestra así).
const REFERENCIA_POR_TIPO_EVENTO = {
  entrenamiento: 'ensayo',
  misa: 'misa',
  reunion: 'reunion',
  partido: 'salida'
};

const REFERENCIAS = ['ensayo', 'misa', 'reunion', 'salida', 'otro'];
// Motivo de la inasistencia. Solo la licencia médica propone ese estado; el resto
// se propone como justificado (la directiva decide al aprobar).
const MOTIVOS = ['trabajo', 'licencia_medica', 'estudio', 'otro'];
const CONDICIONES = ['bailarin', 'socio'];

const RUTA_ESTATUTOS = path.join(__dirname, '..', 'documentos', 'Estatutos_BaileGDC.pdf');

function textoLimpio(valor, max) {
  const texto = String(valor ?? '').trim();
  return texto ? texto.substring(0, max) : '';
}

function hoyChile() {
  // en-CA formatea como YYYY-MM-DD
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });
}

function descartarArchivo(req) {
  if (req.file) fs.unlink(req.file.path, () => {});
}

// SHA-256 del archivo subido (anti-duplicados determinista, sin IA).
function hashArchivo(ruta) {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash('sha256');
    const stream = fs.createReadStream(ruta);
    stream.on('error', reject);
    stream.on('data', d => h.update(d));
    stream.on('end', () => resolve(h.digest('hex')));
  });
}

// Edad en años cumplidos a la fecha 'hoy' (ambas 'YYYY-MM-DD').
function esMenorDeEdad(fechaNac, hoy) {
  if (!fechaNac) return false;
  const [ay, am, ad] = fechaNac.split('-').map(Number);
  const [hy, hm, hd] = hoy.split('-').map(Number);
  let edad = hy - ay;
  if (hm < am || (hm === am && hd < ad)) edad--;
  return edad < 18;
}

// Estado de permiso de una asignación (sección 4.3 del diseño):
//   - el propio socio                              -> automatica
//   - un menor cuyo apoderado_id es el socio       -> automatica
//   - un par (pagador, beneficiario) ya autorizado -> automatica
//   - cualquier otro integrante                    -> pendiente_revision
async function calcularPermiso(pagadorId, beneficiario, hoy) {
  if (Number(beneficiario.id) === Number(pagadorId)) return 'automatica';
  if (beneficiario.apoderado_id && Number(beneficiario.apoderado_id) === Number(pagadorId)
      && esMenorDeEdad(beneficiario.fecha_nacimiento, hoy)) {
    return 'automatica';
  }
  if (await comprobanteAsignacionModel.pagadorAutorizado(pagadorId, beneficiario.id)) {
    return 'automatica';
  }
  return 'pendiente_revision';
}

// =====================================
// DATOS PARA LOS FORMULARIOS
// =====================================
exports.datosFormularios = async (req, res) => {
  const personaId = req.socio.persona_id;

  try {
    // "Mis envíos" muestra solo la temporada vigente
    const desde = await puntajeModel.obtenerInicioTemporadaVigente();
    const [persona, eventos, bloques, justificaciones, postulaciones, comprobantes, debeIntegracion, cartasPermiso, integrantesActivos, menoresACargo] = await Promise.all([
      justificacionModel.obtenerDatosCarta(personaId),
      justificacionModel.listarEventosJustificables(personaId),
      justificacionModel.listarBloques(),
      justificacionModel.listarJustificacionesSocio(personaId, desde),
      justificacionModel.listarPostulacionesSocio(personaId, desde),
      comprobanteDepositoModel.listarSocio(personaId, desde),
      solicitudIngresoModel.debeCuotaIntegracion(personaId),
      cartaPermisoModel.listarSocio(personaId, desde),
      cartaPermisoModel.contarIntegrantesActivos(),
      comprobanteAsignacionModel.menoresACargo(personaId)
    ]);

    if (!persona) {
      return res.status(404).json({ mensaje: 'Integrante no encontrado' });
    }

    res.json({
      persona: {
        rut: persona.rut,
        nombres: persona.nombres,
        apellido_paterno: persona.apellido_paterno,
        apellido_materno: persona.apellido_materno,
        bloque: persona.bloque,
        email: persona.email,
        telefono: persona.telefono
      },
      minutos_cierre: justificacionModel.MINUTOS_CIERRE_ASISTENCIA,
      eventos: eventos.map(e => ({
        ...e,
        referencia: REFERENCIA_POR_TIPO_EVENTO[e.tipo] || 'otro'
      })),
      bloques,
      justificaciones,
      postulaciones,
      comprobantes,
      menores_a_cargo: menoresACargo,
      cuenta_deposito: cuentaDeposito,
      cuota_integracion: debeIntegracion ? { monto: cuotaIntegracion.monto } : null,
      cartas_permiso: cartasPermiso,
      // Para la vista previa: los valores definitivos se fijan al aprobar.
      carta_permiso: {
        anios: aniosDesdeFundacion(hoyChile()),
        integrantes: integrantesActivos,
        activo: persona.estado === 'activo'
      }
    });
  } catch (err) {
    console.error('Error cargando documentos del socio:', err);
    res.status(500).json({ mensaje: 'Error al cargar los documentos' });
  }
};

// =====================================
// ENVIAR CARTA DE JUSTIFICACIÓN (multipart: adjunto opcional)
// =====================================
exports.enviarJustificacion = async (req, res) => {
  const personaId = req.socio.persona_id;
  const body = req.body || {};

  const eventoId = body.evento_id ? Number(body.evento_id) : null;
  const motivoTipo = body.motivo_tipo;
  const tipoSolicitado = motivoTipo === 'licencia_medica' ? 'licencia_medica' : 'justificado';
  const condicion = body.condicion;
  const motivo = textoLimpio(body.motivo, 3000);
  const quienEntrega = textoLimpio(body.quien_entrega, 150) || null;

  if (!MOTIVOS.includes(motivoTipo)) {
    descartarArchivo(req);
    return res.status(400).json({ mensaje: 'Indica el motivo: trabajo, licencia médica, estudio u otros' });
  }
  if (!CONDICIONES.includes(condicion)) {
    descartarArchivo(req);
    return res.status(400).json({ mensaje: 'Indica tu condición (bailarín o socio)' });
  }
  if (motivo.length < 10) {
    descartarArchivo(req);
    return res.status(400).json({ mensaje: 'Explica el motivo de tu inasistencia (mínimo 10 caracteres)' });
  }

  try {
    if (req.file) {
      const firmaValida = await uploadJustificativo.verificarFirmaArchivo(req.file.path, req.file.mimetype)
        .catch(() => false);
      if (!firmaValida) {
        descartarArchivo(req);
        return res.status(400).json({ mensaje: 'El archivo no corresponde a una imagen o PDF válido' });
      }
    }

    let evento = null;
    let referencia;
    let referenciaOtro = null;
    let fechaActividad;

    if (eventoId) {
      // Art. 8.7: solo hasta el cierre de asistencia (10 min antes del inicio).
      evento = await justificacionModel.obtenerEventoJustificable(personaId, eventoId);
      if (!evento) {
        descartarArchivo(req);
        return res.status(409).json({
          mensaje: 'Esta actividad ya no se puede justificar: la asistencia cerró (Art. 8.7 de los Estatutos) o ya enviaste una carta para ella.'
        });
      }
      referencia = REFERENCIA_POR_TIPO_EVENTO[evento.tipo] || 'otro';
      fechaActividad = String(evento.fecha).substring(0, 10);
    } else {
      // Actividad que no está en la lista (no registrada en el sistema).
      referencia = body.referencia;
      referenciaOtro = textoLimpio(body.referencia_otro, 150) || null;
      fechaActividad = String(body.fecha_actividad || '');

      if (!REFERENCIAS.includes(referencia)) {
        descartarArchivo(req);
        return res.status(400).json({ mensaje: 'Indica el tipo de actividad (ensayo, misa, reunión, presentación u otros)' });
      }
      if (!referenciaOtro) {
        descartarArchivo(req);
        return res.status(400).json({ mensaje: 'Indica el nombre de la actividad' });
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaActividad) || fechaActividad < hoyChile()) {
        descartarArchivo(req);
        return res.status(400).json({
          mensaje: 'La fecha de la actividad debe ser hoy o posterior: las cartas se reciben solo hasta el cierre de asistencia (Art. 8.7).'
        });
      }
    }

    const persona = await justificacionModel.obtenerDatosCarta(personaId);
    if (!persona) {
      descartarArchivo(req);
      return res.status(404).json({ mensaje: 'Integrante no encontrado' });
    }

    const folio = await justificacionModel.crearJustificacion({
      persona_id: personaId,
      evento_id: evento ? evento.id : null,
      referencia,
      referencia_otro: referenciaOtro,
      fecha_actividad: fechaActividad,
      tipo_solicitado: tipoSolicitado,
      motivo_tipo: motivoTipo,
      condicion,
      motivo,
      quien_entrega: quienEntrega,
      adjunto_path: req.file ? `justificativos/${req.file.filename}` : null
    });

    const creadoEn = await justificacionModel.obtenerFechaCreacion(folio);

    let correoEnviado = false;
    try {
      correoEnviado = await emailService.enviarCartaJustificacion({
        folio,
        creadoEn,
        persona,
        referencia,
        referenciaOtro,
        evento,
        fechaActividad,
        tipoSolicitado,
        motivoTipo,
        condicion,
        motivo,
        quienEntrega,
        adjunto: req.file
          ? { path: req.file.path, filename: `respaldo-folio-${emailService.formatearFolio(folio)}${path.extname(req.file.filename)}` }
          : null
      });
      if (correoEnviado) await justificacionModel.marcarEmailJustificacion(folio);
    } catch (errCorreo) {
      console.error('[Email] Error enviando carta de justificación, folio', folio, errCorreo);
    }

    res.status(201).json({
      folio,
      correoEnviado,
      mensaje: correoEnviado
        ? `Carta enviada a la directiva. Folio Nº ${emailService.formatearFolio(folio)}.`
        : `Carta registrada con folio Nº ${emailService.formatearFolio(folio)}. La directiva la verá en su panel (el correo no pudo enviarse).`
    });
  } catch (err) {
    descartarArchivo(req);
    console.error('Error registrando justificación:', err);
    res.status(500).json({ mensaje: 'No se pudo registrar la carta' });
  }
};

// =====================================
// ENVIAR POSTULACIÓN A BLOQUES
// =====================================
exports.enviarPostulacion = async (req, res) => {
  const personaId = req.socio.persona_id;
  const body = req.body || {};

  const esNuevo = body.es_nuevo === true || body.es_nuevo === 'true' || body.es_nuevo === 1;
  const opcion1 = textoLimpio(body.opcion_1, 100);
  const opcion2 = textoLimpio(body.opcion_2, 100) || null;

  if (!opcion1) {
    return res.status(400).json({ mensaje: 'Indica tu primera opción de postulación' });
  }
  if (opcion2 && opcion2.toLowerCase() === opcion1.toLowerCase()) {
    return res.status(400).json({ mensaje: 'La segunda opción debe ser distinta de la primera' });
  }

  try {
    const persona = await justificacionModel.obtenerDatosCarta(personaId);
    if (!persona) {
      return res.status(404).json({ mensaje: 'Integrante no encontrado' });
    }

    // Celular y email: los registrados en "Actualizar datos" (no se editan aquí).
    const datos = {
      persona_id: personaId,
      bloque_actual: esNuevo ? null : (persona.bloque || null),
      es_nuevo: esNuevo,
      opcion_1: opcion1,
      opcion_2: opcion2,
      celular: persona.telefono || null,
      email: persona.email || null
    };

    const folio = await justificacionModel.crearPostulacion(datos);
    const creadoEn = await justificacionModel.obtenerFechaCreacionPostulacion(folio);

    let correoEnviado = false;
    try {
      correoEnviado = await emailService.enviarPostulacionBloque({
        folio,
        creadoEn,
        persona,
        bloqueActual: datos.bloque_actual,
        esNuevo,
        opcion1,
        opcion2,
        celular: datos.celular,
        email: datos.email
      });
      if (correoEnviado) await justificacionModel.marcarEmailPostulacion(folio);
    } catch (errCorreo) {
      console.error('[Email] Error enviando postulación a bloque, folio', folio, errCorreo);
    }

    res.status(201).json({
      folio,
      correoEnviado,
      mensaje: correoEnviado
        ? `Postulación enviada a los caporales. Folio Nº ${emailService.formatearFolio(folio)}.`
        : `Postulación registrada con folio Nº ${emailService.formatearFolio(folio)} (el correo no pudo enviarse).`
    });
  } catch (err) {
    console.error('Error registrando postulación a bloque:', err);
    res.status(500).json({ mensaje: 'No se pudo registrar la postulación' });
  }
};

// =====================================
// COMPROBANTE DE DEPÓSITO → TESORERÍA (multipart: comprobante obligatorio)
// =====================================
// Solo avisa a tesorería: no registra el pago ni cambia cuotas. Tesorería revisa
// la cartola y registra el pago en el panel.
exports.enviarComprobante = async (req, res) => {
  const personaId = req.socio.persona_id;
  const body = req.body || {};

  const banco = textoLimpio(body.banco, 60);
  const numeroTransaccion = textoLimpio(body.numero_transaccion, 60);
  const montoTotal = Number(String(body.monto_total ?? '').replace(/\D/g, ''));
  const fechaDeposito = String(body.fecha_deposito || '');
  const concepto = textoLimpio(body.concepto, 200) || null;

  if (!req.file) {
    return res.status(400).json({ mensaje: 'Adjunta la foto o el PDF del comprobante' });
  }
  if (!banco) {
    descartarArchivo(req);
    return res.status(400).json({ mensaje: 'Indica el banco de la transferencia' });
  }
  if (!numeroTransaccion) {
    descartarArchivo(req);
    return res.status(400).json({ mensaje: 'Indica el número de transacción' });
  }
  if (!Number.isInteger(montoTotal) || montoTotal < 100 || montoTotal > 10000000) {
    descartarArchivo(req);
    return res.status(400).json({ mensaje: 'Indica el monto total transferido' });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaDeposito) || fechaDeposito > hoyChile() || fechaDeposito < '2025-01-01') {
    descartarArchivo(req);
    return res.status(400).json({ mensaje: 'Indica una fecha de depósito válida (no puede ser futura)' });
  }

  // Reparto: a quién cubre el pago. [{ integrante_id?, rut?, monto }].
  let reparto;
  try {
    reparto = typeof body.reparto === 'string' ? JSON.parse(body.reparto) : body.reparto;
  } catch (e) {
    reparto = null;
  }
  if (!Array.isArray(reparto) || reparto.length === 0) {
    descartarArchivo(req);
    return res.status(400).json({ mensaje: 'Indica a quién cubre este pago' });
  }
  const items = [];
  let sumaReparto = 0;
  for (const r of reparto) {
    const monto = Number(String(r.monto ?? '').replace(/\D/g, ''));
    const integranteId = r.integrante_id ? Number(r.integrante_id) : null;
    const rut = r.rut ? String(r.rut).trim() : null;
    if (!integranteId && !rut) {
      descartarArchivo(req);
      return res.status(400).json({ mensaje: 'Falta identificar a un beneficiario del reparto' });
    }
    if (!Number.isInteger(monto) || monto < 1) {
      descartarArchivo(req);
      return res.status(400).json({ mensaje: 'Cada beneficiario debe tener un monto válido' });
    }
    items.push({ integranteId, rut, monto });
    sumaReparto += monto;
  }
  if (sumaReparto > montoTotal) {
    descartarArchivo(req);
    return res.status(400).json({ mensaje: 'La suma del reparto supera el monto transferido' });
  }

  try {
    const firmaValida = await uploadJustificativo.verificarFirmaArchivo(req.file.path, req.file.mimetype)
      .catch(() => false);
    if (!firmaValida) {
      descartarArchivo(req);
      return res.status(400).json({ mensaje: 'El archivo no corresponde a una imagen o PDF válido' });
    }

    const persona = await justificacionModel.obtenerDatosCarta(personaId);
    if (!persona) {
      descartarArchivo(req);
      return res.status(404).json({ mensaje: 'Integrante no encontrado' });
    }

    // Resolver beneficiarios (sin repetir) y calcular el permiso de cada uno.
    const hoy = hoyChile();
    const vistos = new Set();
    const asignaciones = [];
    for (const it of items) {
      const beneficiario = await comprobanteAsignacionModel.obtenerIntegrante({ id: it.integranteId, rut: it.rut });
      if (!beneficiario) {
        descartarArchivo(req);
        return res.status(400).json({ mensaje: `No se encontró el integrante${it.rut ? ' con RUT ' + it.rut : ''}` });
      }
      if (vistos.has(beneficiario.id)) {
        descartarArchivo(req);
        return res.status(400).json({ mensaje: 'No repitas al mismo integrante en el reparto' });
      }
      vistos.add(beneficiario.id);
      const estado = await calcularPermiso(personaId, beneficiario, hoy);
      asignaciones.push({
        integrante_id: beneficiario.id,
        monto_asignado: it.monto,
        estado,
        nombre: `${beneficiario.nombres} ${beneficiario.apellido_paterno}`.trim()
      });
    }

    // Anti-duplicados: hash del archivo o banco + nº de transacción.
    const hash = await hashArchivo(req.file.path);
    const dup = await comprobanteDepositoModel.buscarDuplicado(hash, banco, numeroTransaccion);
    if (dup) {
      descartarArchivo(req);
      const fecha = String(dup.creado_en).substring(0, 10);
      return res.status(409).json({
        duplicado: true,
        mensaje: Number(dup.persona_id) === Number(personaId)
          ? `Ya registraste este comprobante el ${fecha}. No hace falta reenviarlo.`
          : `Este comprobante ya fue registrado por ${dup.nombres} ${dup.apellido_paterno} el ${fecha}.`
      });
    }

    let creado;
    try {
      creado = await comprobanteDepositoModel.crearConReparto({
        persona_id: personaId,
        banco,
        numero_transaccion: numeroTransaccion,
        monto_total: montoTotal,
        fecha_deposito: fechaDeposito,
        concepto,
        adjunto_path: `comprobantes_deposito/${req.file.filename}`,
        hash_archivo: hash
      }, asignaciones);
    } catch (errCrear) {
      if (errCrear && errCrear.code === 'ER_DUP_ENTRY') {
        descartarArchivo(req);
        return res.status(409).json({ duplicado: true, mensaje: 'Este comprobante ya fue registrado.' });
      }
      throw errCrear;
    }

    const folio = creado.comprobanteId;
    const creadoEn = await comprobanteDepositoModel.obtenerFechaCreacion(folio);

    let correoEnviado = false;
    try {
      correoEnviado = await emailService.enviarComprobanteDeposito({
        folio,
        creadoEn,
        persona,
        monto: montoTotal,
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

    const enRevision = asignaciones.filter(a => a.estado === 'pendiente_revision').length;
    res.status(201).json({
      folio,
      correoEnviado,
      saldo_restante: montoTotal - sumaReparto,
      asignaciones: asignaciones.map(a => ({ nombre: a.nombre, monto: a.monto_asignado, estado: a.estado })),
      mensaje: `Comprobante enviado a tesorería. Folio Nº ${emailService.formatearFolio(folio)}.`
        + (enRevision
          ? ` ${enRevision} ${enRevision === 1 ? 'asignación queda' : 'asignaciones quedan'} en revisión de tesorería.`
          : '')
    });
  } catch (err) {
    descartarArchivo(req);
    console.error('Error registrando comprobante de depósito:', err);
    res.status(500).json({ mensaje: 'No se pudo registrar el comprobante' });
  }
};

// =====================================
// ESTATUTOS (PDF, solo socios autenticados)
// =====================================
exports.descargarEstatutos = (req, res) => {
  res.set('Content-Disposition', 'inline; filename="Estatutos_GDC_2016.pdf"');
  res.type('application/pdf');
  res.sendFile(RUTA_ESTATUTOS, err => {
    if (err && !res.headersSent) {
      res.status(404).json({ mensaje: 'Estatutos no disponibles' });
    }
  });
};
