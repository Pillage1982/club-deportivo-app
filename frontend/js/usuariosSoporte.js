// "Usuarios del panel" (solo cuenta de soporte, botón junto al nombre en la barra):
// lista los usuarios y permite reiniciar el acceso de uno cuando su cuenta quedó en
// manos de quien no corresponde. El servidor cierra sus sesiones, borra su email y
// entrega una clave temporal que se muestra una sola vez.

let usuariosSoporte = [];

function abrirUsuariosSoporte() {
  document.getElementById('usuarios_soporte_clave').innerHTML = '';
  cargarUsuariosSoporte();
  bootstrap.Modal.getOrCreateInstance(document.getElementById('modal_usuarios_soporte')).show();
}

function cargarUsuariosSoporte() {
  const tabla = document.getElementById('tabla_usuarios_soporte');
  tabla.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Cargando...</td></tr>';

  fetch(`${API_URL}/usuarios/soporte`, { headers: getAuthHeaders() })
    .then(async res => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.mensaje || 'No se pudieron cargar los usuarios');
      return data;
    })
    .then(usuarios => {
      usuariosSoporte = usuarios;
      tabla.innerHTML = usuarios.map(u => `
        <tr>
          <td><strong>${escaparHtml(u.usuario)}</strong></td>
          <td>${escaparHtml(u.rol_nombre)}</td>
          <td class="small">${u.email ? escaparHtml(u.email) : '<span class="text-muted">—</span>'}</td>
          <td>${u.debe_cambiar_password
            ? '<span class="badge bg-warning text-dark">Clave temporal</span>'
            : '<span class="badge bg-success">Clave propia</span>'}</td>
          <td class="text-end">
            ${u.es_propio ? '<span class="small text-muted">Tu cuenta</span>' : `
              <button type="button" class="btn btn-sm btn-outline-danger" onclick="reiniciarAccesoUsuario(${u.id})">
                <i class="bi bi-arrow-counterclockwise me-1"></i>Reiniciar acceso
              </button>`}
          </td>
        </tr>
      `).join('') || '<tr><td colspan="5" class="text-center text-muted">Sin usuarios</td></tr>';
    })
    .catch(err => {
      tabla.innerHTML = `<tr><td colspan="5" class="text-center text-danger">${escaparHtml(err.message)}</td></tr>`;
    });
}

async function reiniciarAccesoUsuario(id) {
  const usuario = escaparHtml(usuariosSoporte.find(u => u.id === id)?.usuario || '');
  if (!(await confirmarAccion(`¿Reiniciar el acceso de "${usuario}"?\n\nSe cerrarán sus sesiones abiertas en todos los dispositivos, se borrará su email y tendrá una clave temporal nueva.`))) return;

  fetch(`${API_URL}/usuarios/soporte/${id}/reiniciar`, { method: 'POST', headers: getAuthHeaders() })
    .then(async res => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.mensaje || 'No se pudo reiniciar el acceso');
      return data;
    })
    .then(data => {
      document.getElementById('usuarios_soporte_clave').innerHTML = `
        <div class="alert alert-success">
          <div>${escaparHtml(data.mensaje)}.</div>
          <div class="mt-2">Clave temporal de <strong>${escaparHtml(usuario)}</strong>:
            <code class="fs-5 user-select-all ms-1">${escaparHtml(data.clave_temporal)}</code>
          </div>
          <div class="small mt-1">Anótala ahora: no se vuelve a mostrar. Entrégala solo a la persona que corresponde;
            al entrar deberá cambiarla y registrar su email.</div>
        </div>`;
      cargarUsuariosSoporte();
    })
    .catch(err => mostrarAlerta(err.message, 'danger'));
}
