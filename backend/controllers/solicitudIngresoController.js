// Solicitudes "Súmate a la promesa": el sitio gdcayquina.cl envía los datos básicos
// (POST público /publico/solicitud-ingreso) y se avisa por correo a la directiva.
// En el panel (Tablas → Solicitudes) se aceptan o rechazan; aceptar crea el
// integrante y el postulante completa el resto en su primer ingreso al Portal.
const solicitudIngresoModel = require('../models/solicitudIngresoModel');
const emailService = require('../services/emailService');
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
    mensaje: String(body.mensaje || '').trim().substring(0, 500)
  };

  if (!validarRut(datos.rut)) return { error: 'Ingresa un RUT válido' };
  if (!validarNombre(datos.nombres)) return { error: 'Ingresa tus nombres' };
  if (!validarNombre(datos.apellido_paterno)) return { error: 'Ingresa tu apellido paterno' };
  if (datos.apellido_materno && !validarNombre(datos.apellido_materno)) return { error: 'Ingresa un apellido materno válido' };
  if (!validarFechaNacimientoISO(datos.fecha_nacimiento)) return { error: 'Ingresa una fecha de nacimiento válida' };
  if (!datos.telefono) return { error: 'Ingresa un celular válido (ej. +56912345678)' };
  if (!datos.email || !validarEmail(datos.email)) return { error: 'Ingresa un email válido' };
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
    const solicitud = await solicitudIngresoModel.obtenerSolicitud(id);
    const enviado = await emailService.enviarSolicitudIngreso(solicitud);
    if (enviado) await solicitudIngresoModel.marcarEmailEnviado(id);
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
