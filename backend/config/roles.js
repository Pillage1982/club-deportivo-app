// Roles del panel. Cada rol hereda los permisos de un rol base (admin, tesorero o
// entrenador): las rutas siguen pidiendo esos tres nombres y roleMiddleware traduce
// el rol del usuario a su base. `eliminar: false` bloquea toda petición DELETE.
// Para agregar un rol: sumarlo aquí y al ENUM usuarios.rol (migrations.js).
const ROLES = Object.freeze({
  admin:      { base: 'admin',      eliminar: true,  nombre: 'Administrador' },
  tesorero:   { base: 'tesorero',   eliminar: true,  nombre: 'Tesorero' },
  entrenador: { base: 'entrenador', eliminar: true,  nombre: 'Encargado' },
  secretaria: { base: 'admin',      eliminar: true,  nombre: 'Secretaria' },
  director1:  { base: 'admin',      eliminar: false, nombre: 'Director 1' },
  director2:  { base: 'tesorero',   eliminar: false, nombre: 'Director 2' },
  director3:  { base: 'entrenador', eliminar: false, nombre: 'Director 3' }
});

function rolBase(rol) {
  return ROLES[rol] ? ROLES[rol].base : rol;
}

function puedeEliminar(rol) {
  return ROLES[rol] ? ROLES[rol].eliminar : false;
}

module.exports = { ROLES, rolBase, puedeEliminar };
