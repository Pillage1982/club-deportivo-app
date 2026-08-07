'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { esCategoriaExcluida } = require('../../utils/formacionRules');

test('formaciones excluyen socios y socios honorarios', () => {
  assert.equal(esCategoriaExcluida('Socios'), true);
  assert.equal(esCategoriaExcluida(' socios honorarios '), true);
  assert.equal(esCategoriaExcluida('Socios Honorario'), true);
});

test('formaciones conservan bloques de baile activos no honorarios', () => {
  assert.equal(esCategoriaExcluida('Chinas Supay'), false);
  assert.equal(esCategoriaExcluida('Diablos', true), true);
});
