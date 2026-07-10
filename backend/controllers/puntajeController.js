// =====================================
// CONTROLADOR PUNTAJE GDC
// =====================================

const puntajeModel = require('../models/puntajeModel');

exports.listarRanking = async (req, res) => {
  try {
    const ranking = await puntajeModel.obtenerRanking();
    res.json(ranking);
  } catch (err) {
    console.error('Error obteniendo ranking puntaje:', err);
    res.status(500).json({ mensaje: 'Error al obtener ranking' });
  }
};

exports.listarHistorial = async (req, res) => {
  try {
    const historial = await puntajeModel.obtenerHistorial(req.params.persona_id);
    res.json(historial);
  } catch (err) {
    console.error('Error obteniendo historial puntaje:', err);
    res.status(500).json({ mensaje: 'Error al obtener historial' });
  }
};
