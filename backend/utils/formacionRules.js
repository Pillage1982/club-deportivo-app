'use strict';

const CATEGORIAS_EXCLUIDAS = Object.freeze([
  'socios', 'socio', 'socios honorario', 'socios honorarios',
  'socio honorario', 'socio honorarios'
]);

function normalizarCategoria(valor) {
  return String(valor || '').trim().toLocaleLowerCase('es');
}

function esCategoriaExcluida(valor, esHonorario = false) {
  return Boolean(esHonorario) || CATEGORIAS_EXCLUIDAS.includes(normalizarCategoria(valor));
}

module.exports = { CATEGORIAS_EXCLUIDAS, esCategoriaExcluida };
