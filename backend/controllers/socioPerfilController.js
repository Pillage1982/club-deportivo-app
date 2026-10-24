// "Actualizar datos" del Portal del Socio: paso obligatorio después de crear la contraseña
// (y cada vez que la directiva lo vuelva a exigir). En esta rama `personas` solo tiene
// contacto y fecha de nacimiento: celular, email y fecha de nacimiento son obligatorios;
// RUT, nombre y estado son solo lectura (los mantiene la directiva desde el panel).
const socioDataModel = require('../models/socioDataModel');
const {
  limpiarTexto,
  validarEmail,
  normalizarCelular,
  validarFechaNacimientoISO
} = require('../utils/validacionesPersona');

function validarYNormalizar(body) {
  const datos = {
    telefono: normalizarCelular(body.telefono),
    email: limpiarTexto(body.email).toLowerCase(),
    fecha_nacimiento: String(body.fecha_nacimiento || '').substring(0, 10)
  };

  if (!datos.telefono) return { error: 'Ingresa un celular válido (ej. +56912345678)' };
  if (!datos.email || !validarEmail(datos.email)) return { error: 'Ingresa un email válido' };
  if (!validarFechaNacimientoISO(datos.fecha_nacimiento)) return { error: 'Ingresa una fecha de nacimiento válida' };

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
      return res.status(404).json({ mensaje: 'Socio no encontrado' });
    }
    res.json(fila);
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
      return res.status(404).json({ mensaje: 'Socio no encontrado' });
    }
    res.json({ mensaje: 'Datos actualizados correctamente' });
  });
};
