// Controlador HTTP de integrantes: normaliza y valida RUT/datos antes de usar personaModel.
const personaModel = require('../models/personaModel');

const {
  limpiarTexto,
  limpiarRut,
  validarRut,
  validarEmail,
  validarNombre,
  normalizarCelular
} = require('../utils/validacionesPersona');

// Celulares en formato único +569XXXXXXXX (pedido del cliente GDC, sep-2026),
// igual que en "Actualizar datos" del Portal del Socio. Si no es un celular
// válido se deja el texto tal cual para que validarPersona lo rechace.
function normalizarTelefono(telefono) {
  return normalizarCelular(telefono) || limpiarTexto(telefono);
}

function esCelularNormalizado(telefono) {
  return /^\+569[0-9]{8}$/.test(telefono);
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
    // Estos 6 campos se agregaron a personaModel.js/frontend en jun-2026
    // (commits 894cb62/befde70/d77e494) pero nunca se agregaron aqui: se
    // guardaban siempre como NULL, y cada edicion de un integrante existente
    // borraba el valor que ya tenia (actualizarPersona hace SET completo,
    // no un patch parcial). Bug de perdida de datos activo desde entonces.
    bloque: limpiarTexto(data.bloque),
    sexo: data.sexo || null,
    direccion: limpiarTexto(data.direccion),
    email: limpiarTexto(data.email).toLowerCase(),
    telefono: normalizarTelefono(data.telefono),
    fecha_nacimiento: data.fecha_nacimiento,
    fecha_ingreso: data.fecha_ingreso || null,
    nombre_apoderado: limpiarTexto(data.nombre_apoderado),
    telefono_apoderado: normalizarTelefono(data.telefono_apoderado),
    rut_apoderado: limpiarTexto(data.rut_apoderado).toUpperCase(),
    observacion: limpiarTexto(data.observacion),
    bautizo: data.bautizo ? 1 : 0,
    comunion: data.comunion ? 1 : 0,
    confirmacion: data.confirmacion ? 1 : 0,
    estado: limpiarTexto(data.estado || 'activo').toLowerCase(),
    es_honorario: data.es_honorario ? 1 : 0
  };
}

function validarPersona(data) {
  if (!['activo', 'receso'].includes(data.estado)) {
    return 'Seleccione un estado de integrante valido';
  }

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

  if (!esCelularNormalizado(data.telefono)) {
    return 'Ingrese un celular válido (ej. +56912345678)';
  }

  if (data.telefono_apoderado && !esCelularNormalizado(data.telefono_apoderado)) {
    return 'Ingrese un celular de apoderado válido (ej. +56912345678)';
  }

  if (!validarFechaNacimiento(data.fecha_nacimiento)) {
    return 'Ingrese una fecha de nacimiento válida';
  }

  if (data.rut_apoderado && !validarRut(data.rut_apoderado)) {
    return 'Ingrese un RUT de apoderado válido';
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
