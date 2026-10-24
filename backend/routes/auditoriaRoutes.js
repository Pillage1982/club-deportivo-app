// Rutas /auditoria: registro de actividad interno. Solo lo ve el rol admin.
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const auditoriaModel = require('../models/auditoriaModel');

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

router.get('/', authMiddleware, roleMiddleware('admin'), async (req, res) => {
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
