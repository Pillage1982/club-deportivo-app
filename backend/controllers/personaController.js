const personaModel = require('../models/personaModel');

function limpiarTexto(valor) {
  return String(valor || '').trim().replace(/\s+/g, ' ');
}

function limpiarRut(rut) {
  return String(rut || '').replace(/\./g, '').replace(/-/g, '').trim().toUpperCase();
}

function validarRut(rut) {
  const limpio = limpiarRut(rut);

  if (!/^[0-9]{7,8}[0-9K]$/.test(limpio)) {
    return false;
  }

  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1);
  let suma = 0;
  let multiplicador = 2;

  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * multiplicador;
    multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
  }

  const resto = 11 - (suma % 11);
  const dvEsperado = resto === 11 ? '0' : resto === 10 ? 'K' : String(resto);

  return dv === dvEsperado;
}

function validarEmail(email) {
  if (!email) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validarTelefono(telefono) {
  const limpio = String(telefono || '').replace(/\s+/g, '');
  return /^(\+?56)?9?[0-9]{8}$/.test(limpio);
}

function validarNombre(valor) {
  const texto = limpiarTexto(valor);
  return texto.length >= 2 && /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s'-]+$/.test(texto);
}

function validarFechaNacimiento(fecha) {
  if (!fecha) return false;

  const nacimiento = new Date(fecha);
  const hoy = new Date();

  if (Number.isNaN(nacimiento.getTime())) {
    return false;
  }

  return nacimiento <= hoy;
}

function normalizarPersona(data) {
  return {
    rut: limpiarTexto(data.rut),
    nombres: limpiarTexto(data.nombres),
    apellido_paterno: limpiarTexto(data.apellido_paterno),
    apellido_materno: limpiarTexto(data.apellido_materno),
    email: limpiarTexto(data.email).toLowerCase(),
    telefono: limpiarTexto(data.telefono),
    fecha_nacimiento: data.fecha_nacimiento
  };
}

function validarPersona(data) {
  if (!validarRut(data.rut)) {
    return 'Ingrese un RUT chileno válido';
  }

  if (!validarNombre(data.nombres)) {
    return 'Ingrese nombres válidos';
  }

  if (!validarNombre(data.apellido_paterno)) {
    return 'Ingrese un apellido paterno válido';
  }

  if (data.apellido_materno && !validarNombre(data.apellido_materno)) {
    return 'Ingrese un apellido materno válido';
  }

  if (!validarEmail(data.email)) {
    return 'Ingrese un email válido';
  }

  if (!validarTelefono(data.telefono)) {
    return 'Ingrese un teléfono chileno válido';
  }

  if (!validarFechaNacimiento(data.fecha_nacimiento)) {
    return 'Ingrese una fecha de nacimiento válida';
  }

  return null;
}

exports.listar = (req, res) => {
  personaModel.obtenerPersonas((err, results) => {
    if (err) {
      return res.status(500).send(err);
    }

    res.json(results);
  });
};

exports.crear = (req, res) => {

 const data = normalizarPersona(req.body);
const errorValidacion = validarPersona(data);

if (errorValidacion) {
  return res.status(400).json({
    mensaje: errorValidacion
  });
}

responderCreacionPersona(res, data);

};

function responderCreacionPersona(res, data) {
  personaModel.obtenerPersonaPorRutIncluyendoInactivos(
    limpiarRut(data.rut),
    (errBusqueda, resultados) => {
      if (errBusqueda) {
        console.error('Error buscando persona por RUT:', errBusqueda);
        return res.status(500).json({
          mensaje: 'Error al crear integrante'
        });
      }

      const personaExistente =
        Array.isArray(resultados) ? resultados[0] : null;

      if (personaExistente && Number(personaExistente.activo) === 1) {
        return res.status(409).json({
          mensaje: 'Ya existe un integrante activo con ese RUT'
        });
      }

      if (personaExistente) {
        return personaModel.reactivarPersona(
          personaExistente.id,
          data,
          (errReactivar) => {
            if (errReactivar) {
              console.error('Error reactivando persona:', errReactivar);
              return res.status(500).json({
                mensaje: 'Error al reactivar integrante'
              });
            }

            return res.json({
              mensaje: 'Integrante reactivado correctamente'
            });
          }
        );
      }

      personaModel.crearPersona(
        data,
        (errCrear) => {
          if (errCrear) {
            if (errCrear.code === 'ER_DUP_ENTRY') {
              return res.status(409).json({
                mensaje: 'Ya existe un integrante registrado con ese RUT'
              });
            }

            console.error('Error creando persona:', errCrear);
            return res.status(500).json({
              mensaje: 'Error al crear integrante'
            });
          }

          return res.json({
            mensaje: 'Integrante creado correctamente'
          });
        }
      );
    }
  );
}

exports.eliminar = (req, res) => {

  personaModel.eliminarPersona(

    req.params.id,

    (err, result) => {

      if (err) {

        return res.status(500).json(err);

      }

      res.json({
        mensaje: 'Integrante eliminado correctamente'
      });

    }

  );

};

exports.actualizar = (req, res) => {

  const data = normalizarPersona(req.body);
const errorValidacion = validarPersona(data);

if (errorValidacion) {
  return res.status(400).json({
    mensaje: errorValidacion
  });
}

  personaModel.actualizarPersona(

    req.params.id,

    data,

    (err, result) => {

      if (err) {
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      mensaje: 'Ya existe un integrante registrado con ese RUT'
    });
  }

  console.error('Error actualizando persona:', err);
  return res.status(500).json({
    mensaje: 'Error al actualizar integrante'
  });
}

      res.json({
        mensaje: 'Integrante actualizado correctamente'
      });

    }

  );

};
