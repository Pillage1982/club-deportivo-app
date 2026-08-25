'use strict';

const CATEGORIAS_EXCLUIDAS = Object.freeze([
  'socios', 'socio', 'socios honorario', 'socios honorarios',
  'socio honorario', 'socio honorarios'
]);

// Subconjunto de CATEGORIAS_EXCLUIDAS libre de pago de cuota (igual que es_honorario=1).
const CATEGORIAS_HONORARIAS = Object.freeze([
  'socios honorario', 'socios honorarios', 'socio honorario', 'socio honorarios'
]);

// Socios (no honorarios): quedan fuera de Formaciones igual que los honorarios,
// pero a diferencia de ellos sí pagan cuota, al 50% (igual que menores de 12 años).
const CATEGORIAS_SOCIO_REDUCIDO = Object.freeze(
  CATEGORIAS_EXCLUIDAS.filter(categoria => !CATEGORIAS_HONORARIAS.includes(categoria))
);

function normalizarCategoria(valor) {
  return String(valor || '').trim().toLocaleLowerCase('es');
}

function esCategoriaExcluida(valor, esHonorario = false) {
  return Boolean(esHonorario) || CATEGORIAS_EXCLUIDAS.includes(normalizarCategoria(valor));
}

module.exports = {
  CATEGORIAS_EXCLUIDAS,
  CATEGORIAS_HONORARIAS,
  CATEGORIAS_SOCIO_REDUCIDO,
  esCategoriaExcluida
};
