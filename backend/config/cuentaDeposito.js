// Cuenta para depósitos y transferencias de cuotas. Se muestra en Portal del
// Socio → Documentos → "Datos para depositar". Un campo en null no se muestra;
// si falta el número de cuenta, el portal avisa que los datos están pendientes.
//
// Pendiente: datos de la cuenta de la Unión Morenada Centralista.
module.exports = Object.freeze({
  titular: null,
  rut: null,
  banco: null,
  tipo_cuenta: null,
  numero: null,
  email: null,
  nota: null
});
