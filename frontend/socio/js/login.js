// Login del Portal del Socio: RUT + PIN contra /socio-auth/login (endpoint público,
// rate-limited en el servidor). Guarda el token propio y decide a dónde ir según
// si el socio ya cambió su PIN inicial.

if (sessionStorage.getItem('socio_sesion_expirada')) {
  sessionStorage.removeItem('socio_sesion_expirada');
  document.getElementById('respuesta').innerHTML = `
    <div class="alert alert-warning mt-3">
      <i class="bi bi-shield-lock-fill"></i>
      Por seguridad, tu sesión fue cerrada automáticamente.
    </div>
  `;
}

function loginSocio() {
  const rut = document.getElementById('rut').value.trim();
  const pin = document.getElementById('pin').value.trim();

  if (!rut || !pin) {
    document.getElementById('respuesta').innerHTML = `
      <div class="alert alert-warning mt-3">
        <i class="bi bi-exclamation-circle-fill"></i>
        Debe ingresar RUT y PIN
      </div>
    `;
    return;
  }

  const btnLogin = document.getElementById('btnLogin');
  btnLogin.disabled = true;
  btnLogin.innerHTML = `<span class="spinner-border spinner-border-sm" role="status"></span> Ingresando...`;

  fetch(`${API_URL}/socio-auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rut, pin })
  })
    .then(async res => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.mensaje || 'No se pudo iniciar sesión');
      return data;
    })
    .then(data => {
      btnLogin.innerHTML = 'Acceso Correcto';
      guardarSesionSocio(data);
      window.location.href = data.pinCambiado ? 'index.html' : 'cambiar-pin.html';
    })
    .catch(err => {
      btnLogin.disabled = false;
      btnLogin.innerHTML = 'Ingresar';
      console.error(err);
      document.getElementById('respuesta').innerHTML = `
        <div class="alert alert-danger mt-3">
          <i class="bi bi-exclamation-triangle-fill"></i>
          ${escaparHtml(err.message)}
        </div>
      `;
    });
}

const togglePin = document.getElementById('togglePin');
const pinInput = document.getElementById('pin');

if (togglePin && pinInput) {
  togglePin.addEventListener('click', () => {
    const tipo = pinInput.type === 'password' ? 'text' : 'password';
    pinInput.type = tipo;
    togglePin.innerHTML = tipo === 'password'
      ? '<i class="bi bi-eye-fill"></i>'
      : '<i class="bi bi-eye-slash-fill"></i>';
  });
}

document.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    loginSocio();
  }
});
