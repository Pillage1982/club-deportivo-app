// Registro de actividad (auditoría interna): anota quién hizo cada movimiento que
// modifica datos (POST/PUT/PATCH/DELETE con respuesta exitosa), separado por módulo.
// Se monta una sola vez en server.js antes de las rutas; como se escribe al
// terminar la respuesta, ya conoce al usuario que dejó authMiddleware (req.usuario)
// o authSocioMiddleware (req.socio). Las peticiones sin sesión (login, recuperar
// clave, rutas públicas) no se registran. Nunca bloquea ni demora la respuesta.
const auditoriaModel = require('../models/auditoriaModel');
const { rolBase } = require('../config/roles');

const METODOS_REGISTRADOS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// Primer segmento de la URL → módulo. En /socio-auth se separa lo que hace el
// integrante desde el Portal.
const MODULOS = {
  asistencia: 'asistencia',
  personas: 'integrantes',
  eventos: 'actividades',
  multas: 'multas',
  usuarios: 'usuarios',
  finanzas: 'finanzas',
  dashboard: 'finanzas',
  pagos: 'pagos',
  cuotas: 'cuotas',
  puntaje: 'puntaje',
  formaciones: 'formaciones',
  gastos: 'gastos',
  ingresos: 'ingresos',
  justificaciones: 'justificaciones',
  'solicitudes-ingreso': 'solicitudes',
  'socio-auth': 'portal'
};

const ACCION_POR_METODO = { POST: 'crear', PUT: 'editar', PATCH: 'editar', DELETE: 'eliminar' };

// Campos que jamás se guardan en el detalle.
const CAMPO_SENSIBLE = /pass|clave|pin|token|secret|contrase/i;
const MAX_DETALLE = 2000;

function limpiarDetalle(body) {
  if (!body || typeof body !== 'object') return null;
  const limpio = {};
  for (const [clave, valor] of Object.entries(body)) {
    if (CAMPO_SENSIBLE.test(clave)) continue;
    limpio[clave] = valor;
  }
  if (!Object.keys(limpio).length) return null;
  const texto = JSON.stringify(limpio);
  return texto.length > MAX_DETALLE ? `${texto.slice(0, MAX_DETALLE)}…` : texto;
}

function idONull(valor) {
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 ? n : null;
}

module.exports = (req, res, next) => {
  if (!METODOS_REGISTRADOS.has(req.method)) return next();

  // Guarda el mensaje de la respuesta ("Asistencia registrada", etc.) para el detalle.
  let mensajeRespuesta = null;
  const jsonOriginal = res.json.bind(res);
  res.json = cuerpo => {
    if (cuerpo && typeof cuerpo.mensaje === 'string') mensajeRespuesta = cuerpo.mensaje;
    return jsonOriginal(cuerpo);
  };

  res.on('finish', () => {
    if (res.statusCode >= 400) return;

    const usuario = req.usuario;
    const socio = req.socio;
    if (!usuario && !socio) return;

    const ruta = String(req.originalUrl || '').split('?')[0];
    const segmentos = ruta.split('/').filter(Boolean);
    const modulo = MODULOS[segmentos[0]];
    if (!modulo) return;

    // Acción: la palabra final de la ruta si la hay (vestimenta, finalizar,
    // aprobar...), si no la que corresponde al método.
    const resto = segmentos.slice(1).filter(s => !/^\d+$/.test(s));
    const accion = resto.length ? resto[resto.length - 1] : ACCION_POR_METODO[req.method];

    const registroId = segmentos.slice(1).find(s => /^\d+$/.test(s)) || null;
    const body = req.body || {};

    auditoriaModel.registrar({
      actor_tipo: usuario ? 'usuario' : 'integrante',
      actor_id: usuario ? usuario.id : socio.persona_id,
      actor_nombre: usuario ? usuario.usuario : (socio.rut || null),
      rol: usuario ? usuario.rol : null,
      rol_base: usuario ? rolBase(usuario.rol) : null,
      modulo,
      accion: String(accion || '').slice(0, 40),
      metodo: req.method,
      ruta: ruta.slice(0, 255),
      registro_id: registroId,
      persona_id: idONull(body.persona_id) || (socio ? idONull(socio.persona_id) : null),
      evento_id: idONull(body.evento_id),
      detalle: limpiarDetalle(body),
      resultado: mensajeRespuesta ? mensajeRespuesta.slice(0, 255) : null,
      ip: String(req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim().slice(0, 45) || null
    }).catch(err => console.error('Error guardando registro de actividad:', err.message));
  });

  next();
};
