// Solicitudes "Súmate a la promesa": el sitio web de la agrupación envía los datos
// de la "Ficha de actualización de datos" con la firma dibujada (POST público
// /publico/solicitud-ingreso). Se arma el PDF de la ficha y va adjunto a la
// directiva y al postulante. En el panel (Tablas → Solicitudes) se ve la ficha y
// se aceptan o rechazan; aceptar crea el integrante y el postulante completa el
// resto en su primer ingreso al Portal.
const solicitudIngresoModel = require('../models/solicitudIngresoModel');
const emailService = require('../services/emailService');
const { generarPdfFichaIngreso, nombreArchivoFicha, ETIQUETA_ESTADO_CIVIL } = require('../services/fichaIngresoPdf');
const {
  limpiarTexto,
  limpiarRut,
  validarRut,
  formatearRut,
  validarEmail,
  validarNombre,
  normalizarCelular,
  validarFechaNacimientoISO,
  edadDesde
} = require('../utils/validacionesPersona');

const EDAD_MAYORIA = 18;
const ESTADOS_FILTRO = ['pendiente', 'aprobada', 'rechazada'];
const CONDICIONES = ['bailarin', 'socio'];
const ENTIDADES_BAILE = ['asociacion', 'federacion', 'central_caporales'];
const FIRMA_MAX_BYTES = 120 * 1024;
const FIRMA_MIN_BYTES = 200;
const PNG_FIRMA = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// 'data:image/png;base64,...' → Buffer PNG, o null si no es un PNG razonable.
function decodificarFirma(dataUrl) {
  const m = String(dataUrl || '').match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/);
  if (!m) return null;
  const buffer = Buffer.from(m[1], 'base64');
  if (buffer.length < FIRMA_MIN_BYTES || buffer.length > FIRMA_MAX_BYTES) return null;
  if (!buffer.subarray(0, PNG_FIRMA.length).equals(PNG_FIRMA)) return null;
  return buffer;
}

function validarYNormalizar(body) {
  const datos = {
    rut: body.rut,
    nombres: limpiarTexto(body.nombres),
    apellido_paterno: limpiarTexto(body.apellido_paterno),
    apellido_materno: limpiarTexto(body.apellido_materno),
    fecha_nacimiento: String(body.fecha_nacimiento || '').substring(0, 10),
    telefono: normalizarCelular(body.telefono),
    email: limpiarTexto(body.email).toLowerCase(),
    comparsa_interes: limpiarTexto(body.comparsa_interes).substring(0, 150),
    mensaje: String(body.mensaje || '').trim().substring(0, 500),
    direccion: limpiarTexto(body.direccion).substring(0, 255),
    ciudad: limpiarTexto(body.ciudad).substring(0, 100),
    estado_civil: limpiarTexto(body.estado_civil),
    bautizo: body.bautizo === true,
    comunion: body.comunion === true,
    confirmacion: body.confirmacion === true,
    condicion: limpiarTexto(body.condicion),
    baile_anterior: limpiarTexto(body.baile_anterior).substring(0, 150),
    baile_anterior_entidad: limpiarTexto(body.baile_anterior_entidad),
    firma_png: decodificarFirma(body.firma)
  };

  if (!validarRut(datos.rut)) return { error: 'Ingresa un RUT válido' };
  if (!validarNombre(datos.nombres)) return { error: 'Ingresa tus nombres' };
  if (!validarNombre(datos.apellido_paterno)) return { error: 'Ingresa tu apellido paterno' };
  if (datos.apellido_materno && !validarNombre(datos.apellido_materno)) return { error: 'Ingresa un apellido materno válido' };
  if (!validarFechaNacimientoISO(datos.fecha_nacimiento)) return { error: 'Ingresa una fecha de nacimiento válida' };
  if (!datos.telefono) return { error: 'Ingresa un celular válido (ej. +56912345678)' };
  if (!datos.email || !validarEmail(datos.email)) return { error: 'Ingresa un email válido' };
  if (datos.direccion.length < 5) return { error: 'Ingresa tu domicilio' };
  if (datos.ciudad.length < 2) return { error: 'Ingresa tu ciudad' };
  if (!ETIQUETA_ESTADO_CIVIL[datos.estado_civil]) return { error: 'Selecciona tu estado civil' };
  if (!CONDICIONES.includes(datos.condicion)) return { error: 'Indica si ingresas como bailarín o socio' };
  // El bloque/fila (comparsa) solo aplica a bailarines.
  if (datos.condicion !== 'bailarin') datos.comparsa_interes = '';
  if (datos.baile_anterior) {
    if (!ENTIDADES_BAILE.includes(datos.baile_anterior_entidad)) {
      return { error: 'Indica si tu baile anterior pertenece a la Asociación, Federación o Central de Caporales' };
    }
  } else {
    datos.baile_anterior_entidad = null;
  }
  if (!datos.firma_png) return { error: 'Falta la firma' };
  if (body.acepta_datos !== true) return { error: 'Debes autorizar el uso de tus datos para revisar la solicitud' };

  datos.rut = formatearRut(datos.rut);

  // Menor de edad: los datos del apoderado son obligatorios.
  if (edadDesde(datos.fecha_nacimiento) < EDAD_MAYORIA) {
    datos.nombre_apoderado = limpiarTexto(body.nombre_apoderado);
    datos.telefono_apoderado = normalizarCelular(body.telefono_apoderado);
    if (!validarNombre(datos.nombre_apoderado)) return { error: 'Ingresa el nombre completo del apoderado' };
    if (!validarRut(body.rut_apoderado)) return { error: 'Ingresa un RUT de apoderado válido' };
    if (!datos.telefono_apoderado) return { error: 'Ingresa un celular de apoderado válido (ej. +56912345678)' };
    datos.rut_apoderado = formatearRut(body.rut_apoderado);
  }

  return { datos };
}

// =====================================
// PÚBLICO: formulario del sitio (rate-limited en la ruta)
// =====================================
exports.crearPublica = async (req, res) => {
  const body = req.body || {};

  // Campo trampa: invisible para personas, los bots lo llenan. Se responde
  // como si todo saliera bien para no darles pistas.
  if (body.sitio_web) {
    return res.json({ mensaje: 'Solicitud recibida' });
  }

  const { error, datos } = validarYNormalizar(body);
  if (error) {
    return res.status(400).json({ mensaje: error });
  }

  try {
    const existente = await solicitudIngresoModel.existeRegistroActivo(limpiarRut(datos.rut));
    if (Number(existente.solicitud_pendiente)) {
      return res.status(409).json({
        mensaje: 'Ya tenemos una solicitud con este RUT y está en revisión. Te contactaremos pronto.'
      });
    }
    if (Number(existente.integrante_activo)) {
      return res.status(409).json({
        mensaje: 'Este RUT ya figura como integrante. Ingresa a la App con tu RUT, o escríbenos si tienes problemas para entrar.'
      });
    }

    const id = await solicitudIngresoModel.crearSolicitud(datos);
    res.json({ mensaje: 'Solicitud recibida', folio: emailService.formatearFolio(id) });

    // Después de responder: el correo no debe hacer esperar ni fallar al postulante.
    // La ficha en PDF va a la directiva y una copia al postulante.
    const solicitud = await solicitudIngresoModel.obtenerParaFicha(id);
    let ficha = null;
    try {
      ficha = { filename: nombreArchivoFicha(solicitud), content: await generarPdfFichaIngreso(solicitud), contentType: 'application/pdf' };
    } catch (err) {
      console.error('[Ficha ingreso] No se pudo generar el PDF, folio', id, err);
    }
    const enviado = await emailService.enviarSolicitudIngreso(solicitud, ficha);
    if (enviado) await solicitudIngresoModel.marcarEmailEnviado(id);
    await emailService.enviarCopiaSolicitudIngreso(solicitud, ficha)
      .catch(err => console.error('[Email] Error enviando copia de la ficha al postulante:', err));
  } catch (err) {
    console.error('Error registrando solicitud de ingreso:', err);
    if (!res.headersSent) {
      res.status(500).json({ mensaje: 'No pudimos enviar tu solicitud. Intenta nuevamente más tarde.' });
    }
  }
};

// =====================================
// ADMIN: revisión en el panel
// =====================================
exports.listar = (req, res) => {
  const estado = ESTADOS_FILTRO.includes(req.query.estado) ? req.query.estado : null;

  solicitudIngresoModel.listarSolicitudes(estado)
    .then(rows => res.json(rows))
    .catch(err => {
      console.error('Error listando solicitudes de ingreso:', err);
      res.status(500).json({ mensaje: 'Error al listar solicitudes' });
    });
};

// PDF de la ficha (se regenera: muestra fecha de ingreso y pago de inscripción al día).
exports.descargarFicha = async (req, res) => {
  try {
    const solicitud = await solicitudIngresoModel.obtenerParaFicha(Number(req.params.id));
    if (!solicitud) return res.status(404).json({ mensaje: 'Solicitud no encontrada' });
    const pdf = await generarPdfFichaIngreso(solicitud);
    res.set('Content-Disposition', `inline; filename="${nombreArchivoFicha(solicitud)}"`);
    res.set('Cache-Control', 'no-store, private');
    res.type('application/pdf').send(pdf);
  } catch (err) {
    console.error('Error generando la ficha de la solicitud de ingreso:', err);
    res.status(500).json({ mensaje: 'No se pudo generar la ficha' });
  }
};

function avisarPostulante(id, extra) {
  solicitudIngresoModel.obtenerSolicitud(id)
    .then(solicitud => solicitud && emailService.notificarResolucionSolicitudIngreso({ solicitud, ...extra }))
    .catch(err => console.error('[Email] Error avisando resolución de solicitud de ingreso:', err));
}

exports.aprobar = async (req, res) => {
  const id = Number(req.params.id);
  const bloque = limpiarTexto(req.body?.bloque).substring(0, 100) || null;
  const observacion = String(req.body?.observacion || '').trim().substring(0, 300) || null;

  try {
    const r = await solicitudIngresoModel.aprobarSolicitud({
      id, bloque, observacion, usuarioId: req.usuario.id
    });

    if (r.resultado === 'no_encontrada') {
      return res.status(404).json({ mensaje: 'Solicitud no encontrada' });
    }
    if (r.resultado === 'ya_revisada') {
      return res.status(409).json({ mensaje: 'Esta solicitud ya fue revisada' });
    }
    if (r.resultado === 'ya_integrante') {
      return res.status(409).json({
        mensaje: 'Ya existe un integrante activo con este RUT. Rechaza la solicitud indicando que ya está registrado.'
      });
    }

    avisarPostulante(id, { aprobada: true, observacion });

    res.json({
      mensaje: r.reactivado
        ? 'Solicitud aceptada. El RUT estaba dado de baja: se reactivó el integrante con los datos nuevos.'
        : 'Solicitud aceptada. El postulante quedó registrado como integrante.'
    });
  } catch (err) {
    console.error('Error aprobando solicitud de ingreso:', err);
    res.status(500).json({ mensaje: 'No se pudo aceptar la solicitud' });
  }
};

exports.rechazar = async (req, res) => {
  const id = Number(req.params.id);
  const observacion = String(req.body?.observacion || '').trim().substring(0, 300) || null;
  const avisar = req.body?.avisar !== false;

  try {
    const result = await solicitudIngresoModel.rechazarSolicitud({
      id, observacion, usuarioId: req.usuario.id
    });

    if (!result.affectedRows) {
      return res.status(409).json({ mensaje: 'La solicitud no existe o ya fue revisada' });
    }

    if (avisar) avisarPostulante(id, { aprobada: false, observacion });

    res.json({ mensaje: 'Solicitud rechazada' });
  } catch (err) {
    console.error('Error rechazando solicitud de ingreso:', err);
    res.status(500).json({ mensaje: 'No se pudo rechazar la solicitud' });
  }
};
