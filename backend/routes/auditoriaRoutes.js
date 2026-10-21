// Rutas /auditoria: registro de actividad interno. Solo lo ven los roles admin y
// secretaria (exactos, no los directores que heredan de admin) y la cuenta de soporte.
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const auditoriaModel = require('../models/auditoriaModel');
const { esSoporte } = require('../config/roles');

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const ROLES_REGISTRO_ACTIVIDAD = ['admin', 'secretaria'];

function soloAdminOSoporte(req, res, next) {
  const u = req.usuario || {};
  if (ROLES_REGISTRO_ACTIVIDAD.includes(u.rol) || esSoporte(u.usuario)) return next();
  return res.status(403).json({ mensaje: 'Solo el administrador y la secretaria pueden ver el registro de actividad' });
}

router.get('/', authMiddleware, soloAdminOSoporte, async (req, res) => {
  const opciones = {
    modulo: req.query.modulo ? String(req.query.modulo).slice(0, 40) : null,
    usuario: req.query.usuario ? String(req.query.usuario).slice(0, 100) : null,
    desde: FECHA.test(req.query.desde || '') ? req.query.desde : null,
    hasta: FECHA.test(req.query.hasta || '') ? req.query.hasta : null
  };

  try {
    const [registros, conteos, actores] = await Promise.all([
      auditoriaModel.listar(opciones),
      auditoriaModel.contarPorModulo(opciones),
      auditoriaModel.listarActores()
    ]);
    res.json({
      registros,
      conteos: Object.fromEntries(conteos.map(c => [c.modulo, Number(c.total)])),
      usuarios: actores.map(a => a.actor_nombre)
    });
  } catch (err) {
    console.error('Error listando registro de actividad:', err);
    res.status(500).json({ mensaje: 'Error al cargar el registro de actividad' });
  }
});

module.exports = router;
