// Utilidad manual de desarrollo para generar un hash bcrypt; no forma parte del servidor ni debe contener claves reales.
const bcrypt = require('bcrypt');

const password = '123456';

bcrypt.hash(password, 10, (err, hash) => {

  if (err) {
    console.log(err);
    return;
  }

  console.log('HASH GENERADO:');
  console.log(hash);

});
