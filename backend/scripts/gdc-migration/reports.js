'use strict';

const fs = require('fs'); const path = require('path'); const XLSX = require('xlsx');

function writeWorkbook(file, rows, sheetName = 'Reporte') {
  const wb = XLSX.utils.book_new(); const safe = rows.length ? rows : [{ mensaje: 'Sin registros' }];
  const ws = XLSX.utils.json_to_sheet(safe); ws['!autofilter'] = { ref: ws['!ref'] }; ws['!freeze'] = { xSplit: 0, ySplit: 1 };
  const headers = Object.keys(safe[0]); ws['!cols'] = headers.map(key => ({ wch: Math.min(45, Math.max(12, key.length + 2, ...safe.slice(0,100).map(r => String(r[key] ?? '').length + 2))) }));
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0,31)); XLSX.writeFile(wb, file, { compression: true });
}

function generateReports(dir, data) {
  fs.mkdirSync(dir, { recursive: true }); const comparison = data.comparison;
  const mapping = {
    'comparacion_integrantes.xlsx': comparison,
    'duplicados.xlsx': comparison.filter(r => r.cantidad_duplicados),
    'ruts_invalidos.xlsx': data.invalidRuts,
    'integrantes_solo_bd.xlsx': comparison.filter(r => r.accion_recomendada === 'SOLO_EN_BD'),
    'integrantes_solo_nomina.xlsx': comparison.filter(r => r.existe_en_nomina && !r.existe_en_bd),
    'integrantes_solo_finanzas.xlsx': comparison.filter(r => r.existe_en_finanzas && !r.existe_en_bd),
    'integrantes_solo_asistencia.xlsx': comparison.filter(r => r.existe_en_asistencia && !r.existe_en_bd),
    'diferencias_nombres_bloques.xlsx': comparison.filter(r => /NOMBRE|BLOQUE|ACTUALIZAR/.test(r.accion_recomendada)),
    'asistencias_validas.xlsx': data.attendanceValid,
    'asistencias_anteriores_al_corte.xlsx': data.attendanceBefore,
    'asistencias_duplicadas.xlsx': data.attendanceDuplicates,
    'asistencias_rut_invalido.xlsx': data.attendanceInvalid,
    'asistencias_rut_corregido.xlsx': data.attendanceRutCorrected,
    'asistencias_sin_integrante.xlsx': data.attendanceUnmatched,
    'eventos_detectados.xlsx': data.events,
    'comparacion_puntajes.xlsx': data.scoreComparison,
    'resultado_puntajes_2025_2026_preliminar.xlsx': data.scoreComparison,
    'pagos_propuestos.xlsx': data.payments,
    'pagos_en_revision.xlsx': data.paymentReview,
    'asignacion_pagos_cuotas.xlsx': data.paymentAllocations,
    'estado_cuotas_calculado.xlsx': data.quotaStatus,
    'revision_manual.xlsx': comparison.filter(r => /REVISAR|SOLO_/.test(r.accion_recomendada))
  };
  for (const [name, rows] of Object.entries(mapping)) writeWorkbook(path.join(dir, name), rows);
  fs.writeFileSync(path.join(dir, 'resumen_migracion.json'), JSON.stringify(data.summary, null, 2));
}

module.exports = { writeWorkbook, generateReports };
