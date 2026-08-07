'use strict';

function cleanRut(value) {
  return String(value == null ? '' : value).replace(/[.\s\u00a0-]/g, '').toUpperCase();
}

function calculateDv(body) {
  let sum = 0;
  let multiplier = 2;
  for (let index = body.length - 1; index >= 0; index -= 1) {
    sum += Number(body[index]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }
  const result = 11 - (sum % 11);
  return result === 11 ? '0' : result === 10 ? 'K' : String(result);
}

function normalizeRut(value) {
  const clean = cleanRut(value);
  if (!/^\d{6,8}[0-9K]$/.test(clean)) return null;
  return `${clean.slice(0, -1)}-${clean.slice(-1)}`;
}

function validateRut(value) {
  const normalized = normalizeRut(value);
  if (!normalized) return false;
  const [body, dv] = normalized.split('-');
  return calculateDv(body) === dv;
}

module.exports = { cleanRut, calculateDv, normalizeRut, validateRut };
