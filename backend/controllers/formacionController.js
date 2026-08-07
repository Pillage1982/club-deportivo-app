'use strict';

const model = require('../models/formacionModel');

function cargarConPosiciones(formaciones, res) {
  if (!formaciones.length) return res.json([]);
  let pendientes=formaciones.length; let fallo=false;
  formaciones.forEach(formacion => model.obtenerPosiciones(formacion.id, (err, posiciones) => {
    if (fallo) return;
    if (err) { fallo=true; return res.status(500).json({ mensaje:'No se pudieron cargar las posiciones' }); }
    formacion.posiciones=posiciones; pendientes-=1; if (!pendientes) res.json(formaciones);
  }));
}

exports.bloques = (req,res) => model.listarBloquesElegibles((err,rows) => err ? res.status(500).json({mensaje:'No se pudieron cargar los bloques'}) : res.json(rows));
exports.eventos = (req,res) => model.listarEventos((err,rows) => err ? res.status(500).json({mensaje:'No se pudieron cargar las actividades'}) : res.json(rows));
exports.actual = (req,res) => model.obtenerFormacionActual((err,rows) => {
  if (err) return res.status(500).json({mensaje:'No se pudo calcular la formación vigente'});
  const bloques=[]; const indice=new Map();
  rows.forEach(persona => {
    if (!indice.has(persona.bloque)) {
      indice.set(persona.bloque,bloques.length);
      bloques.push({bloque:persona.bloque,posiciones:[]});
    }
    const formacion=bloques[indice.get(persona.bloque)];
    formacion.posiciones.push({...persona,orden_general:formacion.posiciones.length+1,ajuste_manual:0});
  });
  res.json(bloques);
});
exports.listar = (req,res) => model.obtenerPorEvento(req.query.evento_id ? Number(req.query.evento_id) : null,
  (err,rows) => err ? res.status(500).json({mensaje:'No se pudieron cargar las formaciones'}) : cargarConPosiciones(rows,res));

exports.generar = (req,res) => {
  const eventoId=Number(req.body.evento_id); const bloque=String(req.body.bloque || '').trim();
  if (!Number.isInteger(eventoId) || eventoId<=0 || !bloque) return res.status(400).json({mensaje:'Seleccione actividad y bloque'});
  model.obtenerCandidatos(bloque,(err,candidatos) => {
    if (err) return res.status(500).json({mensaje:'No se pudo calcular el ranking del bloque'});
    if (!candidatos.length) return res.status(400).json({mensaje:'El bloque no tiene bailarines elegibles'});
    model.crearBorrador(eventoId,bloque,req.usuario.id,req.body.observaciones,(err2,result) => {
      if (err2) return res.status(500).json({mensaje:'No se pudo crear la formación'});
      const id=result.insertId;
      model.obtenerFormacion(id,(err3,formacion) => {
        if (err3 || !formacion) return res.status(500).json({mensaje:'No se pudo verificar la formación'});
        if (formacion.estado==='confirmada') return res.status(409).json({mensaje:'La formación está confirmada; debe reabrirse antes de regenerar'});
        model.actualizarBorrador(id,req.usuario.id,req.body.observaciones,err4 => {
          if (err4) return res.status(500).json({mensaje:'No se pudo actualizar el borrador'});
          model.reemplazarPosiciones(id,candidatos,err5 => err5 ? res.status(500).json({mensaje:'No se pudieron guardar las posiciones'}) : res.json({mensaje:'Formación generada desde el ranking',id,cantidad:candidatos.length}));
        });
      });
    });
  });
};

exports.mover = (req,res) => {
  const direccion=req.body.direccion; if (!['arriba','abajo'].includes(direccion)) return res.status(400).json({mensaje:'Dirección inválida'});
  model.obtenerFormacion(Number(req.params.id),(err,formacion) => {
    if (err || !formacion) return res.status(404).json({mensaje:'Formación no encontrada'});
    if (formacion.estado!=='borrador') return res.status(409).json({mensaje:'La formación confirmada no se puede modificar'});
    model.mover(formacion.id,Number(req.body.posicion_id),direccion,err2 => err2 ? res.status(500).json({mensaje:'No se pudo mover la posición'}) : res.json({mensaje:'Posición actualizada'}));
  });
};
exports.confirmar = (req,res) => model.confirmar(Number(req.params.id),req.usuario.id,(err,result) => err ? res.status(500).json({mensaje:'No se pudo confirmar'}) : result.affectedRows ? res.json({mensaje:'Formación final confirmada'}) : res.status(409).json({mensaje:'La formación ya estaba confirmada'}));
exports.reabrir = (req,res) => model.reabrir(Number(req.params.id),(err,result) => err ? res.status(500).json({mensaje:'No se pudo reabrir'}) : res.json({mensaje:'Formación reabierta',actualizadas:result.affectedRows}));
exports.eliminar = (req,res) => model.obtenerFormacion(Number(req.params.id),(err,formacion) => {
  if (err || !formacion) return res.status(404).json({mensaje:'Formación no encontrada'});
  if (formacion.estado==='confirmada') return res.status(409).json({mensaje:'Reabra la formación antes de eliminarla'});
  model.eliminar(formacion.id,(err2,result) => err2 ? res.status(500).json({mensaje:'No se pudo eliminar'}) : res.json({mensaje:'Formación eliminada',eliminadas:result.affectedRows}));
});
