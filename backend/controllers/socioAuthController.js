// Controlador de autenticación del Portal del Socio: login por RUT+PIN, cambio de PIN
// obligatorio en el primer ingreso, y herramientas admin de enrolamiento (individual y masivo).
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const socioAuthModel = require('../models/socioAuthModel');
const emailService = require('../services/emailService');

const BCRYPT_ROUNDS = 10;
const PIN_MIN = 100000;
const PIN_MAX = 999999;

function limpiarRut(rut) {
  return String(rut || '').replace(/\./g, '').replace(/-/g, '').trim().toUpperCase();
}

// crypto.randomInt es CSPRNG (a diferencia de Math.random) — obligatorio para un secreto.
function generarPin() {
  return String(crypto.randomInt(PIN_MIN, PIN_MAX + 1));
}

function estaBloqueado(bloqueadoHasta) {
  if (!bloqueadoHasta) return false;
  return new Date(String(bloqueadoHasta).replace(' ', 'T')) > new Date();
}

function datosPublicosPersona(persona) {
  return {
    persona_id: persona.persona_id,
    rut: persona.rut,
    nombres: persona.nombres,
    apellido_paterno: persona.apellido_paterno,
    apellido_materno: persona.apellido_materno || null,
    email: persona.email || null,
    telefono: persona.telefono || null
  };
}

// =====================================
// LOGIN SOCIO (público, rate-limited en la ruta)
// =====================================
exports.login = (req, res) => {
  const { rut, pin } = req.body;

  if (!rut || !pin) {
    return res.status(400).json({ mensaje: 'RUT y PIN son requeridos' });
  }

  const rutLimpio = limpiarRut(rut);

  socioAuthModel.obtenerParaLogin(rutLimpio, (err, socio) => {
    if (err) {
      console.error('Error buscando socio para login:', err);
      return res.status(500).json({ mensaje: 'Error al iniciar sesión' });
    }

    // Mensaje genérico en todos los casos de rechazo: no revelar si el RUT
    // existe, si tiene acceso creado, o si el PIN es el que falló — evita
    // que alguien vaya "afinando" el ataque según la respuesta.
    if (!socio || socio.estado === 'inactivo') {
      return res.status(401).json({ mensaje: 'RUT o PIN incorrecto' });
    }

    if (estaBloqueado(socio.bloqueado_hasta)) {
      return res.status(429).json({
        mensaje: 'Cuenta bloqueada temporalmente por intentos fallidos. Intenta nuevamente en unos minutos.'
      });
    }

    bcrypt.compare(String(pin), socio.pin_hash, (errCompare, coincide) => {
      if (errCompare) {
        console.error('Error bcrypt (login socio):', errCompare);
        return res.status(500).json({ mensaje: 'Error al iniciar sesión' });
      }

      if (!coincide) {
        socioAuthModel.registrarIntentoFallido(socio.persona_id, errIntento => {
          if (errIntento) console.error('Error registrando intento fallido:', errIntento);
        });
        return res.status(401).json({ mensaje: 'RUT o PIN incorrecto' });
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
        pinCambiado: !!socio.pin_cambiado,
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
// CAMBIO DE PIN (socio autenticado; obligatorio si pin_cambiado=false)
// =====================================
exports.cambiarPin = (req, res) => {
  const personaId = req.socio.persona_id;
  const { pinActual, pinNuevo } = req.body;

  if (!pinActual || !pinNuevo) {
    return res.status(400).json({ mensaje: 'PIN actual y nuevo PIN son requeridos' });
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

    bcrypt.compare(String(pinActual), socio.pin_hash, (errCompare, coincide) => {
      if (errCompare) {
        console.error('Error bcrypt (cambio PIN):', errCompare);
        return res.status(500).json({ mensaje: 'Error al cambiar PIN' });
      }
      if (!coincide) {
        return res.status(401).json({ mensaje: 'El PIN actual no es correcto' });
      }

      bcrypt.hash(String(pinNuevo), BCRYPT_ROUNDS, (errHash, hash) => {
        if (errHash) {
          console.error('Error hasheando nuevo PIN:', errHash);
          return res.status(500).json({ mensaje: 'Error al cambiar PIN' });
        }

        socioAuthModel.actualizarPinPropio(personaId, hash, errUpdate => {
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
// ADMIN: generar/regenerar el PIN de un socio (se devuelve en texto plano
// una sola vez en esta respuesta; nunca se guarda ni se loguea así)
// =====================================
exports.generarPinAdmin = (req, res) => {
  const personaId = Number(req.params.personaId);

  if (!personaId) {
    return res.status(400).json({ mensaje: 'Integrante inválido' });
  }

  socioAuthModel.obtenerDatosPersonaBasico(personaId, (err, persona) => {
    if (err) {
      console.error('Error buscando integrante para generar PIN:', err);
      return res.status(500).json({ mensaje: 'Error al generar PIN' });
    }
    if (!persona) {
      return res.status(404).json({ mensaje: 'Integrante no encontrado' });
    }

    const pin = generarPin();

    bcrypt.hash(pin, BCRYPT_ROUNDS, (errHash, hash) => {
      if (errHash) {
        console.error('Error hasheando PIN:', errHash);
        return res.status(500).json({ mensaje: 'Error al generar PIN' });
      }

      socioAuthModel.asignarPin(persona.persona_id, hash, errAsignar => {
        if (errAsignar) {
          console.error('Error guardando PIN:', errAsignar);
          return res.status(500).json({ mensaje: 'Error al generar PIN' });
        }

        // Fire-and-forget: si el email falla o no está configurado, no bloquea
        // la respuesta — el admin igual recibe el PIN para entregarlo a mano.
        emailService.enviarPinAcceso(persona, pin).catch(errEmail => {
          console.error('Error enviando PIN por email:', errEmail);
        });

        res.json({
          mensaje: 'PIN generado correctamente',
          persona: datosPublicosPersona(persona),
          pin
        });
      });
    });
  });
};

// =====================================
// ADMIN: enrolamiento masivo — genera acceso a todos los activos que aún no lo tienen
// =====================================
exports.enrolamientoMasivo = (req, res) => {
  socioAuthModel.listarPersonasActivasSinAuth((err, personas) => {
    if (err) {
      console.error('Error listando integrantes sin acceso:', err);
      return res.status(500).json({ mensaje: 'Error al generar accesos' });
    }

    if (!personas || personas.length === 0) {
      return res.json({ mensaje: 'No hay integrantes pendientes de acceso', generados: [] });
    }

    procesarEnrolamiento(personas, 0, [], (errProceso, generados) => {
      if (errProceso) {
        console.error('Error en enrolamiento masivo:', errProceso);
        // Se devuelve lo ya generado (parcial) para no perderlo ni duplicar
        // trabajo: el admin ve cuáles sí quedaron y cuáles faltan reintentar.
        return res.status(500).json({
          mensaje: 'Ocurrió un error a mitad del proceso. Los accesos ya generados quedaron guardados.',
          generados
        });
      }

      res.json({
        mensaje: `Se generaron accesos para ${generados.length} integrante(s)`,
        generados
      });
    });
  });
};

// Uno por uno (no Promise.all): para un club chico (decenas de personas) no
// hay problema de rendimiento, y así se puede cortar limpio y devolver lo
// ya generado si algo falla a mitad de camino, sin dejar el pool saturado.
function procesarEnrolamiento(personas, index, acumulado, callback) {
  if (index >= personas.length) {
    return callback(null, acumulado);
  }

  const persona = personas[index];
  const pin = generarPin();

  bcrypt.hash(pin, BCRYPT_ROUNDS, (errHash, hash) => {
    if (errHash) return callback(errHash, acumulado);

    socioAuthModel.asignarPin(persona.persona_id, hash, errAsignar => {
      if (errAsignar) return callback(errAsignar, acumulado);

      emailService.enviarPinAcceso(persona, pin).catch(errEmail => {
        console.error('Error enviando PIN por email a', persona.rut, errEmail);
      });

      acumulado.push({ ...datosPublicosPersona(persona), pin });

      procesarEnrolamiento(personas, index + 1, acumulado, callback);
    });
  });
}

// =====================================
// ADMIN: seguimiento de accesos (quién tiene, quién ya entró, último ingreso)
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
