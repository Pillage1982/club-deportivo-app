// "Actualizar datos" del Portal del Socio: paso obligatorio después de crear la contraseña
// (y cada vez que la directiva lo vuelva a exigir). Todos los campos editables son
// obligatorios salvo la fecha de ingreso (vacía = se conserva la registrada);
// RUT, nombre, escuadra, estado y honorario son solo lectura (los mantiene la
// directiva desde el panel admin).
const socioDataModel = require('../models/socioDataModel');
const {
  limpiarTexto,
  validarRut,
  formatearRut,
  validarEmail,
  validarNombre,
  normalizarCelular,
  validarFechaNacimientoISO,
  edadDesde
} = require('../utils/validacionesPersona');

const EDAD_MAYORIA = 18;
const SACRAMENTOS = ['bautizo', 'comunion', 'confirmacion'];

// Sí/No explícito: el valor por defecto de la BD (0) no cuenta como respuesta.
function leerSiNo(valor) {
  if (valor === true || valor === 1 || valor === '1' || valor === 'si') return 1;
  if (valor === false || valor === 0 || valor === '0' || valor === 'no') return 0;
  return null;
}

function validarYNormalizar(body) {
  const datos = {
    telefono: normalizarCelular(body.telefono),
    email: limpiarTexto(body.email).toLowerCase(),
    direccion: limpiarTexto(body.direccion),
    fecha_nacimiento: String(body.fecha_nacimiento || '').substring(0, 10),
    sexo: body.sexo
  };

  if (!datos.telefono) return { error: 'Ingresa un celular válido (ej. +56912345678)' };
  if (!datos.email || !validarEmail(datos.email)) return { error: 'Ingresa un email válido' };
  if (datos.direccion.length < 5 || datos.direccion.length > 255) return { error: 'Ingresa tu dirección completa' };
  if (!validarFechaNacimientoISO(datos.fecha_nacimiento)) return { error: 'Ingresa una fecha de nacimiento válida' };
  if (!['Masculino', 'Femenino'].includes(datos.sexo)) return { error: 'Selecciona tu sexo' };

  // Fecha de ingreso opcional: si no viene, no se toca la registrada. Misma regla
  // de fecha válida y no futura que la de nacimiento, y no anterior a ella.
  const fechaIngreso = String(body.fecha_ingreso || '').substring(0, 10);
  if (fechaIngreso) {
    if (!validarFechaNacimientoISO(fechaIngreso) || fechaIngreso < datos.fecha_nacimiento) {
      return { error: 'Ingresa una fecha de ingreso válida' };
    }
    datos.fecha_ingreso = fechaIngreso;
  }

  for (const campo of SACRAMENTOS) {
    datos[campo] = leerSiNo(body[campo]);
    if (datos[campo] === null) return { error: 'Responde Sí o No en cada sacramento' };
  }

  // Apoderado solo para menores de edad; a los mayores no se les pide ni se les
  // borra lo que ya tuvieran registrado.
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
// GET: datos actuales para precargar el formulario
// =====================================
exports.obtenerMisDatos = (req, res) => {
  socioDataModel.obtenerDatosEditables(req.socio.persona_id, (err, fila) => {
    if (err) {
      console.error('Error obteniendo datos editables del socio:', err);
      return res.status(500).json({ mensaje: 'Error al obtener tus datos' });
    }
    if (!fila) {
      return res.status(404).json({ mensaje: 'Integrante no encontrado' });
    }
    // Si nunca ha confirmado sus datos, los sacramentos vienen en 0 por defecto
    // de la BD: se envían vacíos para que el socio los responda de verdad.
    if (!fila.datos_actualizados_en) {
      SACRAMENTOS.forEach(campo => { fila[campo] = null; });
    }
    res.json({ ...fila, edad_mayoria: EDAD_MAYORIA });
  });
};

// =====================================
// PUT: guardar y marcar la actualización como completa
// =====================================
exports.actualizarMisDatos = (req, res) => {
  const { error, datos } = validarYNormalizar(req.body || {});
  if (error) {
    return res.status(400).json({ mensaje: error });
  }

  socioDataModel.guardarDatosSocio(req.socio.persona_id, datos, (err, result) => {
    if (err) {
      console.error('Error guardando datos del socio:', err);
      return res.status(500).json({ mensaje: 'Error al guardar tus datos' });
    }
    if (!result || !result.affectedRows) {
      return res.status(404).json({ mensaje: 'Integrante no encontrado' });
    }
    res.json({ mensaje: 'Datos actualizados correctamente' });
  });
};
