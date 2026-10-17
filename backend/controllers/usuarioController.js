// Controlador de autenticación: verifica credenciales, emite el JWT usado por las rutas protegidas
// y gestiona el primer ingreso: cambio de clave (debe_cambiar_password) y registro del
// email (usuarios.email vacío), ambos obligatorios antes de usar el panel.
const usuarioModel = require('../models/usuarioModel');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { limpiarTexto, validarEmail } = require('../utils/validacionesPersona');
const { ROLES, rolBase, puedeEliminar, esSoporte } = require('../config/roles');
const { olvidarSesion } = require('../middleware/authMiddleware');

const BCRYPT_ROUNDS = 10;
const PASSWORD_MIN_LARGO = 8;
// Clave genérica con la que la directiva crea usuarios nuevos: nunca puede quedar como definitiva.
const PASSWORD_GENERICA = 'gdc123';

// Pendientes del primer ingreso. El email se pide para "¿Olvidaste tu contraseña?"
// y se registra en el primer ingreso (no por SQL) porque la directiva está en
// transición: cada directivo nuevo deja el suyo al entrar.
function pendientesPrimerIngreso(user) {
  return {
    debeCambiarPassword: !!user.debe_cambiar_password,
    debeRegistrarEmail: !String(user.email || '').trim()
  };
}

// Mientras `cambiarPassword` o `registrarEmail` vengan en el token, authMiddleware
// solo deja pasar a las rutas del primer ingreso (authMiddleware.permitirCambioPendiente).
function firmarToken(user, { debeCambiarPassword, debeRegistrarEmail }) {
  const payload = {
    id: user.id,
    usuario: user.usuario,
    rol: user.rol,
    sv: Number(user.sesion_version) || 0
  };
  if (debeCambiarPassword) payload.cambiarPassword = true;
  if (debeRegistrarEmail) payload.registrarEmail = true;

  return jwt.sign(payload, process.env.JWT_SECRET, {
    // 20 días: cubre el viaje anual (nunca más de 15 días) con margen,
    // para no forzar un re-login en plena zona de mala cobertura.
    expiresIn: '20d'
  });
}

// rol_base y puede_eliminar: el panel decide qué pestañas y botones mostrar con el
// rol base (admin/tesorero/entrenador); rol_nombre es el que se muestra arriba.
function datosUsuario(user, { debeCambiarPassword, debeRegistrarEmail }) {
  return {
    id: user.id,
    usuario: user.usuario,
    rol: user.rol,
    rol_base: rolBase(user.rol),
    rol_nombre: ROLES[user.rol] ? ROLES[user.rol].nombre : user.rol,
    puede_eliminar: puedeEliminar(user.rol),
    es_soporte: esSoporte(user.usuario),
    debeCambiarPassword,
    debeRegistrarEmail
  };
}

exports.login = (req, res) => {
  const { usuario, password } = req.body;

  usuarioModel.buscarUsuario(usuario, (err, results) => {
    if (err) {
      console.error('Error buscando usuario:', err);
      return res.status(500).json({ mensaje: 'Error buscando usuario' });
    }

    if (!results || results.length === 0) {
      console.warn('Usuario no encontrado:', usuario);
      return res.status(401).json({
        mensaje: 'Usuario no encontrado'
      });
    }

    const user = results[0];

    bcrypt.compare(password, user.password, (err, result) => {
      if (err) {
        console.error('Error bcrypt:', err);
        return res.status(500).json({ mensaje: 'Error validando password' });
      }

      if (!result) {
        console.warn('Password incorrecto para:', usuario);
        return res.status(401).json({
          mensaje: 'Contraseña incorrecta'
        });
      }

      // Un rol que no está en config/roles.js (ej. vacío porque se creó el usuario
      // antes de que la BD tuviera ese rol) no tiene permisos: se avisa en vez de
      // dejarlo entrar a un panel que no carga nada.
      if (!ROLES[user.rol]) {
        console.warn('Usuario con rol no válido:', usuario, JSON.stringify(user.rol));
        return res.status(403).json({
          mensaje: 'Tu usuario no tiene un rol válido. Pide al administrador que lo revise.'
        });
      }

      if (!process.env.JWT_SECRET) {
        console.error('JWT_SECRET no configurado');
        return res.status(500).json({ mensaje: 'JWT no configurado' });
      }

      const pendientes = pendientesPrimerIngreso(user);

      res.json({
        mensaje: 'Login exitoso',
        token: firmarToken(user, pendientes),
        usuario: datosUsuario(user, pendientes)
      });
    });
  });
};

// =====================================
// CAMBIO DE CLAVE (usuario autenticado; obligatorio si debe_cambiar_password=1)
// =====================================
exports.cambiarPassword = (req, res) => {
  const { passwordActual, passwordNueva } = req.body;

  if (!passwordActual || !passwordNueva) {
    return res.status(400).json({ mensaje: 'Clave actual y nueva clave son requeridas' });
  }

  if (String(passwordNueva).length < PASSWORD_MIN_LARGO) {
    return res.status(400).json({ mensaje: `La nueva clave debe tener al menos ${PASSWORD_MIN_LARGO} caracteres` });
  }

  if (passwordNueva === passwordActual) {
    return res.status(400).json({ mensaje: 'La nueva clave debe ser distinta a la actual' });
  }

  if (String(passwordNueva).toLowerCase() === PASSWORD_GENERICA) {
    return res.status(400).json({ mensaje: 'La nueva clave no puede ser la clave genérica' });
  }

  usuarioModel.buscarPorId(req.usuario.id, (err, results) => {
    if (err) {
      console.error('Error buscando usuario para cambio de clave:', err);
      return res.status(500).json({ mensaje: 'Error al cambiar la clave' });
    }

    const user = results && results[0];
    if (!user) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }

    bcrypt.compare(String(passwordActual), user.password, (errCompare, coincide) => {
      if (errCompare) {
        console.error('Error bcrypt (cambio de clave):', errCompare);
        return res.status(500).json({ mensaje: 'Error al cambiar la clave' });
      }
      if (!coincide) {
        return res.status(401).json({ mensaje: 'La clave actual no es correcta' });
      }

      bcrypt.hash(String(passwordNueva), BCRYPT_ROUNDS, (errHash, hash) => {
        if (errHash) {
          console.error('Error hasheando nueva clave:', errHash);
          return res.status(500).json({ mensaje: 'Error al cambiar la clave' });
        }

        usuarioModel.actualizarPasswordPropia(user.id, hash, errUpdate => {
          if (errUpdate) {
            console.error('Error guardando nueva clave:', errUpdate);
            return res.status(500).json({ mensaje: 'Error al cambiar la clave' });
          }

          // Token nuevo sin la marca de cambio pendiente (pero con la de email,
          // si aún no lo registra): el anterior queda restringido hasta que expire.
          const pendientes = { ...pendientesPrimerIngreso(user), debeCambiarPassword: false };
          res.json({
            mensaje: 'Clave actualizada correctamente',
            token: firmarToken(user, pendientes),
            usuario: datosUsuario(user, pendientes)
          });
        });
      });
    });
  });
};

// =====================================
// REGISTRO DEL EMAIL (primer ingreso; obligatorio si usuarios.email está vacío)
// =====================================
exports.registrarEmail = (req, res) => {
  if (req.usuario.cambiarPassword) {
    return res.status(403).json({
      mensaje: 'Debes cambiar tu clave antes de continuar',
      codigo: 'CAMBIO_PASSWORD_REQUERIDO'
    });
  }

  const email = limpiarTexto(req.body && req.body.email).toLowerCase();
  if (!email || email.length > 150 || !validarEmail(email)) {
    return res.status(400).json({ mensaje: 'Ingresa un email válido' });
  }

  usuarioModel.actualizarEmail(req.usuario.id, email, errUpdate => {
    if (errUpdate) {
      console.error('Error guardando email del usuario:', errUpdate);
      return res.status(500).json({ mensaje: 'Error al guardar el email' });
    }

    usuarioModel.buscarPorId(req.usuario.id, (err, results) => {
      const user = results && results[0];
      if (err || !user) {
        console.error('Error releyendo usuario tras registrar email:', err);
        return res.status(500).json({ mensaje: 'Error al guardar el email' });
      }
      const pendientes = pendientesPrimerIngreso(user);
      res.json({
        mensaje: 'Email registrado correctamente',
        token: firmarToken(user, pendientes),
        usuario: datosUsuario(user, pendientes)
      });
    });
  });
};

// =====================================
// SOPORTE: usuarios del panel y reinicio de acceso (solo cuentas de soporte)
// =====================================
// Clave temporal legible (sin 0/O ni 1/l/I) para dictarla o enviarla por WhatsApp.
const ALFABETO_TEMPORAL = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function claveTemporal(largo = 10) {
  return Array.from(crypto.randomBytes(largo), b => ALFABETO_TEMPORAL[b % ALFABETO_TEMPORAL.length]).join('');
}

exports.soloSoporte = (req, res, next) => {
  if (!esSoporte(req.usuario && req.usuario.usuario)) {
    return res.status(403).json({ mensaje: 'Solo la cuenta de soporte puede administrar usuarios' });
  }
  next();
};

exports.listarUsuarios = (req, res) => {
  usuarioModel.listarUsuarios()
    .then(rows => res.json(rows.map(u => ({
      id: u.id,
      usuario: u.usuario,
      rol: u.rol,
      rol_nombre: ROLES[u.rol] ? ROLES[u.rol].nombre : (u.rol || 'Sin rol'),
      email: u.email || null,
      debe_cambiar_password: !!u.debe_cambiar_password,
      es_propio: u.id === req.usuario.id
    }))))
    .catch(err => {
      console.error('Error listando usuarios del panel:', err);
      res.status(500).json({ mensaje: 'Error al listar usuarios' });
    });
};

// Para cuando una cuenta quedó en manos de quien no corresponde: nueva clave
// temporal (se muestra una sola vez), email borrado y sesiones cerradas.
exports.reiniciarAcceso = async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ mensaje: 'Usuario no válido' });
  }
  if (id === req.usuario.id) {
    return res.status(400).json({ mensaje: 'No puedes reiniciar tu propia cuenta' });
  }

  try {
    const clave = claveTemporal();
    const hash = await bcrypt.hash(clave, BCRYPT_ROUNDS);
    const ok = await usuarioModel.reiniciarAcceso(id, hash);
    if (!ok) return res.status(404).json({ mensaje: 'Usuario no encontrado' });

    olvidarSesion(id);
    console.warn(`[Soporte] ${req.usuario.usuario} reinició el acceso del usuario id ${id}`);
    res.json({
      mensaje: 'Acceso reiniciado: se cerraron sus sesiones abiertas',
      clave_temporal: clave
    });
  } catch (err) {
    console.error('Error reiniciando acceso de usuario:', err);
    res.status(500).json({ mensaje: 'Error al reiniciar el acceso' });
  }
};
