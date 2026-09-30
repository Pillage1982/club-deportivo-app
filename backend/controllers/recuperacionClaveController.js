// "¿Olvidaste tu contraseña?" (directiva) y "¿Olvidaste tu PIN?" (socios): envía
// por email un enlace de un solo uso (vence en 30 min) para crear una clave nueva.
//
// Seguridad:
// - Respuesta genérica al solicitar: no revela si el usuario/RUT existe ni si
//   tiene email registrado.
// - En la BD solo va el SHA-256 del token (ver recuperacionClaveModel).
// - La URL del enlace sale de FRONTEND_URL, nunca del Host de la petición: un
//   Host falsificado haría que el correo apunte a otro sitio y filtre el token.
const crypto = require('crypto');
const bcrypt = require('bcrypt');

const recuperacionModel = require('../models/recuperacionClaveModel');
const usuarioModel = require('../models/usuarioModel');
const socioAuthModel = require('../models/socioAuthModel');
const emailService = require('../services/emailService');
const { limpiarRut } = require('../utils/validacionesPersona');

const BCRYPT_ROUNDS = 10;
const PASSWORD_MIN_LARGO = 8;
const PASSWORD_GENERICA = 'gdc123';

const MENSAJE_SOLICITUD =
  'Si los datos corresponden a una cuenta con email registrado, te enviamos un enlace para ' +
  'restablecer tu clave. Revisa tu correo (también la carpeta de spam).';
const MENSAJE_ENLACE_INVALIDO = 'El enlace no es válido o ya venció. Solicita uno nuevo.';

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function urlBase() {
  return String(process.env.FRONTEND_URL || '').replace(/\/+$/, '');
}

// Crea el token y envía el correo sin hacer esperar la respuesta HTTP (que
// además es la misma exista o no la cuenta).
function generarYEnviar({ tipo, referenciaId, email, nombre, ruta }) {
  const base = urlBase();
  if (!base) {
    console.error('[Recuperación] FRONTEND_URL no configurado: no se puede armar el enlace.');
    return;
  }

  const token = crypto.randomBytes(32).toString('hex');
  recuperacionModel.crear(tipo, referenciaId, hashToken(token), err => {
    if (err) {
      console.error('[Recuperación] Error guardando token:', err);
      return;
    }
    emailService.enviarEnlaceRecuperacion({
      destinatario: email,
      nombre,
      enlace: `${base}/${ruta}?token=${token}`,
      esSocio: tipo === 'socio',
      minutosVigencia: recuperacionModel.MINUTOS_VIGENCIA
    }).catch(errEmail => console.error('[Recuperación] Error enviando correo:', errEmail));
  });
}

// Valida el token, lo consume y entrega referencia_id a `guardar`. Se valida la
// clave nueva antes de tocar el token, para no quemar el enlace por un error de tipeo.
function restablecer(tipo, token, guardarClave, res) {
  if (!token || !/^[0-9a-f]{64}$/.test(String(token))) {
    return res.status(400).json({ mensaje: MENSAJE_ENLACE_INVALIDO });
  }

  recuperacionModel.buscarVigente(tipo, hashToken(token), (err, registro) => {
    if (err) {
      console.error('[Recuperación] Error buscando token:', err);
      return res.status(500).json({ mensaje: 'Error al restablecer la clave' });
    }
    if (!registro) {
      return res.status(400).json({ mensaje: MENSAJE_ENLACE_INVALIDO });
    }

    recuperacionModel.consumir(registro.id, (errConsumir, consumido) => {
      if (errConsumir) {
        console.error('[Recuperación] Error consumiendo token:', errConsumir);
        return res.status(500).json({ mensaje: 'Error al restablecer la clave' });
      }
      if (!consumido) {
        return res.status(400).json({ mensaje: MENSAJE_ENLACE_INVALIDO });
      }
      guardarClave(registro.referencia_id);
    });
  });
}

// =====================================
// DIRECTIVA
// =====================================
exports.solicitarUsuario = (req, res) => {
  const usuario = String((req.body && req.body.usuario) || '').trim();
  if (!usuario) {
    return res.status(400).json({ mensaje: 'Ingresa tu usuario' });
  }

  usuarioModel.buscarUsuario(usuario, (err, results) => {
    if (err) {
      console.error('[Recuperación] Error buscando usuario:', err);
      return res.status(500).json({ mensaje: 'Error al procesar la solicitud' });
    }
    const user = results && results[0];
    if (user && user.email) {
      generarYEnviar({ tipo: 'usuario', referenciaId: user.id, email: user.email, nombre: user.usuario, ruta: 'recuperar-clave.html' });
    } else {
      console.warn('[Recuperación] Usuario inexistente o sin email:', usuario);
    }
    res.json({ mensaje: MENSAJE_SOLICITUD });
  });
};

exports.restablecerUsuario = (req, res) => {
  const { token, passwordNueva } = req.body || {};

  if (!passwordNueva || String(passwordNueva).length < PASSWORD_MIN_LARGO) {
    return res.status(400).json({ mensaje: `La nueva clave debe tener al menos ${PASSWORD_MIN_LARGO} caracteres` });
  }
  if (String(passwordNueva).toLowerCase() === PASSWORD_GENERICA) {
    return res.status(400).json({ mensaje: 'La nueva clave no puede ser la clave genérica' });
  }

  restablecer('usuario', token, usuarioId => {
    bcrypt.hash(String(passwordNueva), BCRYPT_ROUNDS, (errHash, hash) => {
      if (errHash) {
        console.error('[Recuperación] Error hasheando clave:', errHash);
        return res.status(500).json({ mensaje: 'Error al restablecer la clave' });
      }
      usuarioModel.actualizarPasswordPropia(usuarioId, hash, errUpdate => {
        if (errUpdate) {
          console.error('[Recuperación] Error guardando clave:', errUpdate);
          return res.status(500).json({ mensaje: 'Error al restablecer la clave' });
        }
        res.json({ mensaje: 'Clave actualizada. Ya puedes iniciar sesión con tu nueva clave.' });
      });
    });
  }, res);
};

// =====================================
// SOCIOS
// =====================================
exports.solicitarSocio = (req, res) => {
  const rutLimpio = limpiarRut(req.body && req.body.rut);
  if (!rutLimpio) {
    return res.status(400).json({ mensaje: 'Ingresa tu RUT' });
  }

  socioAuthModel.buscarParaRecuperar(rutLimpio, (err, persona) => {
    if (err) {
      console.error('[Recuperación] Error buscando socio:', err);
      return res.status(500).json({ mensaje: 'Error al procesar la solicitud' });
    }
    if (persona && persona.email) {
      generarYEnviar({
        tipo: 'socio',
        referenciaId: persona.persona_id,
        email: persona.email,
        nombre: `${persona.nombres} ${persona.apellido_paterno}`.trim(),
        ruta: 'socio/recuperar-pin.html'
      });
    } else {
      console.warn('[Recuperación] Socio inexistente, inactivo o sin email:', rutLimpio);
    }
    res.json({ mensaje: MENSAJE_SOLICITUD });
  });
};

exports.restablecerSocio = (req, res) => {
  const { token, pinNuevo } = req.body || {};

  if (!/^[0-9]{6}$/.test(String(pinNuevo || ''))) {
    return res.status(400).json({ mensaje: 'El nuevo PIN debe tener 6 dígitos' });
  }

  restablecer('socio', token, personaId => {
    bcrypt.hash(String(pinNuevo), BCRYPT_ROUNDS, (errHash, hash) => {
      if (errHash) {
        console.error('[Recuperación] Error hasheando PIN:', errHash);
        return res.status(500).json({ mensaje: 'Error al restablecer el PIN' });
      }
      // Mismo guardado que el cambio de PIN normal: queda con PIN propio y sin
      // bloqueo. Si nunca había actualizado sus datos, se le pedirán al entrar.
      socioAuthModel.guardarPinPropio(personaId, hash, errUpdate => {
        if (errUpdate) {
          console.error('[Recuperación] Error guardando PIN:', errUpdate);
          return res.status(500).json({ mensaje: 'Error al restablecer el PIN' });
        }
        res.json({ mensaje: 'PIN actualizado. Ya puedes ingresar con tu nuevo PIN.' });
      });
    });
  }, res);
};
