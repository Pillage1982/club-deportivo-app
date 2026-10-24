// Cuenta para depósitos y transferencias de cuotas. Se muestra en Portal del
// Socio → Finanzas → "Datos para depositar". Un campo en null no se muestra; si
// falta el número de cuenta, el portal avisa que los datos están pendientes.
// Completar con los datos de la organización al instalar.
module.exports = Object.freeze({
  titular: null,
  rut: null,
  banco: null,
  tipo_cuenta: null,
  numero: null,
  email: null,
  nota: null
});
