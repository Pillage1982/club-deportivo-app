// Controlador de autenticación del Portal del Socio: login por RUT + clave, creación
// obligatoria del PIN propio en el primer ingreso, y herramientas admin de seguimiento.
//
// Primer ingreso (pedido del cliente GDC, sep-2026): la clave inicial es el propio
// RUT sin puntos ni guion (ej. 12345678K). No hay enrolamiento: todo integrante
// activo puede entrar así mientras no tenga PIN propio. Estado en socios_auth:
//   - sin fila (o pin_cambiado=0) -> clave = RUT, se exige crear PIN al entrar
//   - fila con pin_cambiado=1     -> clave = PIN propio de 6 dígitos
// "Restablecer acceso" (admin) borra la fila y la clave vuelve a ser el RUT.
// Después del PIN, el socio debe completar "Actualizar datos" (datos_actualizados)
// antes de ver su página personal; ver socioPerfilController/perfilSocioMiddleware.
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const socioAuthModel = require('../models/socioAuthModel');

const BCRYPT_ROUNDS = 10;

function limpiarRut(rut) {
  return String(rut || '').replace(/\./g, '').replace(/-/g, '').trim().toUpperCase();
}

function tienePinPropio(socio) {
  return !!(socio && socio.pin_hash && Number(socio.pin_cambiado) === 1);
}

function estaBloqueado(bloqueadoHasta) {
  if (!bloqueadoHasta) return false;
  return new Date(String(bloqueadoHasta).replace(' ', 'T')) > new Date();
}

// Valida la clave según el estado del socio: RUT limpio si aún no crea su PIN,
// o bcrypt contra el PIN propio si ya lo creó.
function verificarClave(socio, clave, callback) {
  if (!tienePinPropio(socio)) {
    return callback(null, limpiarRut(clave) === limpiarRut(socio.rut));
  }
  bcrypt.compare(String(clave), socio.pin_hash, callback);
}

// =====================================
// LOGIN SOCIO (público, rate-limited en la ruta)
// =====================================
exports.login = (req, res) => {
  const { rut, pin } = req.body;

  if (!rut || !pin) {
    return res.status(400).json({ mensaje: 'RUT y clave son requeridos' });
  }

  const rutLimpio = limpiarRut(rut);

  socioAuthModel.obtenerParaLogin(rutLimpio, (err, socio) => {
    if (err) {
      console.error('Error buscando socio para login:', err);
      return res.status(500).json({ mensaje: 'Error al iniciar sesión' });
    }

    // Mensaje genérico en todos los casos de rechazo: no revelar si el RUT
    // existe, si ya creó su PIN, o si fue la clave la que falló.
    if (!socio || socio.estado === 'inactivo') {
      return res.status(401).json({ mensaje: 'RUT o clave incorrecta' });
    }

    if (estaBloqueado(socio.bloqueado_hasta)) {
      return res.status(429).json({
        mensaje: 'Cuenta bloqueada temporalmente por intentos fallidos. Intenta nuevamente en unos minutos.'
      });
    }

    verificarClave(socio, pin, (errCompare, coincide) => {
      if (errCompare) {
        console.error('Error bcrypt (login socio):', errCompare);
        return res.status(500).json({ mensaje: 'Error al iniciar sesión' });
      }

      if (!coincide) {
        // Solo cuenta intentos (y bloquea) a quien ya tiene fila en socios_auth;
        // el primer ingreso con RUT queda cubierto por el rate limiter de la ruta.
        socioAuthModel.registrarIntentoFallido(socio.persona_id, errIntento => {
          if (errIntento) console.error('Error registrando intento fallido:', errIntento);
        });
        return res.status(401).json({ mensaje: 'RUT o clave incorrecta' });
      }

      socioAuthModel.registrarLoginExitoso(socio.persona_id, errLogin => {
        if (errLogin) console.error('Error registrando login exitoso:', errLogin);
      });

      if (!process.env.JWT_SECRET) {
        console.error('JWT_SECRET no configurado');
        return res.status(500).json({ mensaje: 'JWT no configurado' });
      }

      // Claim `tipo: 'socio'` distintivo: nunca la forma { id, usuario, rol } del
      // token admin. authSocioMiddleware exige este claim y authMiddleware lo rechaza.
      const token = jwt.sign(
        {
          tipo: 'socio',
          persona_id: socio.persona_id,
          rut: socio.rut
        },
        process.env.JWT_SECRET,
        { expiresIn: '10d' }
      );

      res.json({
        mensaje: 'Login exitoso',
        token,
        pinCambiado: tienePinPropio(socio),
        datosActualizados: tienePinPropio(socio) && Number(socio.datos_actualizados) === 1,
        socio: {
          persona_id: socio.persona_id,
          nombres: socio.nombres,
          apellido_paterno: socio.apellido_paterno
        }
      });
    });
  });
};

// =====================================
// CAMBIO DE PIN (socio autenticado; obligatorio mientras la clave siga siendo el RUT)
// =====================================
exports.cambiarPin = (req, res) => {
  const personaId = req.socio.persona_id;
  const { pinActual, pinNuevo } = req.body;

  if (!pinActual || !pinNuevo) {
    return res.status(400).json({ mensaje: 'La clave actual y el nuevo PIN son requeridos' });
  }

  if (!/^[0-9]{6}$/.test(String(pinNuevo))) {
    return res.status(400).json({ mensaje: 'El nuevo PIN debe tener 6 dígitos' });
  }

  if (String(pinActual) === String(pinNuevo)) {
    return res.status(400).json({ mensaje: 'El nuevo PIN debe ser distinto al actual' });
  }

  socioAuthModel.obtenerPorPersonaId(personaId, (err, socio) => {
    if (err) {
      console.error('Error buscando socio para cambio de PIN:', err);
      return res.status(500).json({ mensaje: 'Error al cambiar PIN' });
    }
    if (!socio) {
      return res.status(404).json({ mensaje: 'Acceso no encontrado' });
    }

    verificarClave(socio, pinActual, (errCompare, coincide) => {
      if (errCompare) {
        console.error('Error bcrypt (cambio PIN):', errCompare);
        return res.status(500).json({ mensaje: 'Error al cambiar PIN' });
      }
      if (!coincide) {
        return res.status(401).json({
          mensaje: tienePinPropio(socio)
            ? 'El PIN actual no es correcto'
            : 'La clave actual no es correcta (es tu RUT sin puntos ni guion)'
        });
      }

      bcrypt.hash(String(pinNuevo), BCRYPT_ROUNDS, (errHash, hash) => {
        if (errHash) {
          console.error('Error hasheando nuevo PIN:', errHash);
          return res.status(500).json({ mensaje: 'Error al cambiar PIN' });
        }

        socioAuthModel.guardarPinPropio(personaId, hash, errUpdate => {
          if (errUpdate) {
            console.error('Error guardando nuevo PIN:', errUpdate);
            return res.status(500).json({ mensaje: 'Error al cambiar PIN' });
          }
          res.json({ mensaje: 'PIN actualizado correctamente' });
        });
      });
    });
  });
};

// =====================================
// ADMIN: restablecer acceso (olvidó su PIN o quedó bloqueado): la clave
// vuelve a ser el RUT y en el próximo ingreso deberá crear un PIN nuevo.
// =====================================
exports.restablecerAccesoAdmin = (req, res) => {
  const personaId = Number(req.params.personaId);

  if (!personaId) {
    return res.status(400).json({ mensaje: 'Integrante inválido' });
  }

  socioAuthModel.restablecerAcceso(personaId, err => {
    if (err) {
      console.error('Error restableciendo acceso de socio:', err);
      return res.status(500).json({ mensaje: 'Error al restablecer el acceso' });
    }
    res.json({ mensaje: 'Acceso restablecido: la clave vuelve a ser el RUT sin puntos ni guion' });
  });
};

// =====================================
// ADMIN: volver a exigir la actualización de datos (individual o a todos)
// =====================================
exports.solicitarActualizacionAdmin = (req, res) => {
  const personaId = req.params.personaId ? Number(req.params.personaId) : null;

  if (req.params.personaId && !personaId) {
    return res.status(400).json({ mensaje: 'Integrante inválido' });
  }

  socioAuthModel.solicitarActualizacionDatos(personaId, (err, result) => {
    if (err) {
      console.error('Error solicitando actualización de datos:', err);
      return res.status(500).json({ mensaje: 'Error al solicitar la actualización de datos' });
    }
    res.json({
      mensaje: personaId
        ? 'Listo: en su próximo ingreso deberá actualizar sus datos'
        : `Listo: ${result.affectedRows} socio(s) deberán actualizar sus datos en su próximo ingreso`
    });
  });
};

// =====================================
// ADMIN: seguimiento de accesos (quién ya creó su PIN, último ingreso, bloqueos)
// =====================================
exports.listarEstado = (req, res) => {
  socioAuthModel.listarEstadoAcceso((err, filas) => {
    if (err) {
      console.error('Error listando estado de acceso:', err);
      return res.status(500).json({ mensaje: 'Error al listar estado de acceso' });
    }
    res.json(filas);
  });
};
