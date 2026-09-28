// Controlador de autenticación: verifica credenciales, emite el JWT usado por las rutas protegidas
// y gestiona el cambio de clave (obligatorio en el primer ingreso, ver debe_cambiar_password).
const usuarioModel = require('../models/usuarioModel');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const BCRYPT_ROUNDS = 10;
const PASSWORD_MIN_LARGO = 8;
// Clave genérica con la que la directiva crea usuarios nuevos: nunca puede quedar como definitiva.
const PASSWORD_GENERICA = 'gdc123';

// Mientras `cambiarPassword` venga en el token, authMiddleware solo deja pasar
// a la ruta de cambio de clave (ver authMiddleware.permitirCambioPendiente).
function firmarToken(user, debeCambiarPassword) {
  const payload = {
    id: user.id,
    usuario: user.usuario,
    rol: user.rol
  };
  if (debeCambiarPassword) payload.cambiarPassword = true;

  return jwt.sign(payload, process.env.JWT_SECRET, {
    // 20 días: cubre el viaje anual (nunca más de 15 días) con margen,
    // para no forzar un re-login en plena zona de mala cobertura.
    expiresIn: '20d'
  });
}

function datosUsuario(user, debeCambiarPassword) {
  return {
    id: user.id,
    usuario: user.usuario,
    rol: user.rol,
    debeCambiarPassword
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

      if (!process.env.JWT_SECRET) {
        console.error('JWT_SECRET no configurado');
        return res.status(500).json({ mensaje: 'JWT no configurado' });
      }

      const debeCambiarPassword = !!user.debe_cambiar_password;

      res.json({
        mensaje: 'Login exitoso',
        token: firmarToken(user, debeCambiarPassword),
        usuario: datosUsuario(user, debeCambiarPassword)
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

          // Token nuevo sin la marca de cambio pendiente: el anterior queda
          // restringido a esta ruta hasta que expire.
          res.json({
            mensaje: 'Clave actualizada correctamente',
            token: firmarToken(user, false),
            usuario: datosUsuario(user, false)
          });
        });
      });
    });
  });
};
