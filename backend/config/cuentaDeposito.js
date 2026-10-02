// Cuenta para depósitos y transferencias de cuotas. Se muestra en Portal del
// Socio → Documentos → "Datos para depositar". Un campo en null no se muestra;
// si falta el número de cuenta, el portal avisa que los datos están pendientes.
//
// Fuente: "Autorización para el uso de cuentas bancarias personales con fines
// institucionales GDC" (Primera Notaría El Loa-Calama, 29-09-2026, CVE
// 031-2026092913163942). Es una cuenta personal autorizada de forma temporal
// hasta que la agrupación abra o reactive sus cuentas corporativas: al cambiar,
// reemplazar estos datos. Para transferir, el banco pide el RUT del titular de
// la cuenta, no el de la agrupación (65.109.799-1).
module.exports = Object.freeze({
  titular: 'Jorge Luis Montalbán Cofre',
  rut: '13.216.298-0',
  banco: 'Banco BCI',
  tipo_cuenta: 'Cuenta Vista',
  numero: '47935103',
  email: 'gdcayquina@gmail.com',
  nota: 'Cuenta personal autorizada ante notario (29-09-2026) para recibir los pagos de la Gran Diablada Calameña mientras la agrupación abre sus cuentas propias.'
});
