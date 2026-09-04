// Controlador HTTP del puntaje GDC: consulta el ranking y su detalle desde puntajeModel.
// =====================================
// CONTROLADOR PUNTAJE GDC
// =====================================

const puntajeModel = require('../models/puntajeModel');

// Construye la lista de temporadas seleccionables a partir de las actividades
// "Despedida de Pueblo <anio>" ya ocurridas: cada una abre una temporada que dura
// hasta la siguiente (o hasta hoy, si es la mas reciente). Se agrega al inicio un
// bucket para los puntajes previos a la primera Despedida registrada (temporadas
// migradas antes de que existiera ese marcador).
function construirTemporadas(eventosDespedida) {
  const temporadas = eventosDespedida.map((evento, indice) => ({
    id: String(evento.id),
    nombre: evento.nombre,
    fecha_inicio: evento.fecha,
    fecha_fin: eventosDespedida[indice + 1] ? eventosDespedida[indice + 1].fecha : null
  }));

  temporadas.unshift({
    id: 'anterior',
    nombre: eventosDespedida.length ? `Anterior a ${eventosDespedida[0].nombre}` : 'Todas las temporadas',
    fecha_inicio: null,
    fecha_fin: eventosDespedida.length ? eventosDespedida[0].fecha : null
  });

  const actual = temporadas[temporadas.length - 1];
  actual.actual = true;

  return temporadas;
}

exports.listarTemporadas = async (req, res) => {
  try {
    const eventosDespedida = await puntajeModel.obtenerTemporadas();
    res.json(construirTemporadas(eventosDespedida));
  } catch (err) {
    console.error('Error obteniendo temporadas puntaje:', err);
    res.status(500).json({ mensaje: 'Error al obtener temporadas' });
  }
};

exports.listarRanking = async (req, res) => {
  try {
    const eventosDespedida = await puntajeModel.obtenerTemporadas();
    const temporadas = construirTemporadas(eventosDespedida);

    const idSolicitado = req.query.temporada;
    const temporada =
      temporadas.find(t => t.id === idSolicitado) ||
      temporadas.find(t => t.actual);

    const ranking = await puntajeModel.obtenerRankingPorTemporada(
      temporada.fecha_inicio,
      temporada.fecha_fin
    );
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
