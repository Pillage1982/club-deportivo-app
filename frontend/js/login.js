const API_URL = window.API_URL || window.location.origin;

function login() {

  const usuario =
    document.getElementById('usuario').value;

  const password =
    document.getElementById('password').value;

  if (!usuario || !password) {

    document.getElementById('respuesta')
      .innerHTML = `

        <div
          class="alert alert-warning mt-3">

          <i class="bi bi-exclamation-circle-fill"></i>

          Debe completar usuario y contraseña

        </div>

      `;

    return;

  }

  const btnLogin =
    document.getElementById('btnLogin');

    btnLogin.disabled = true;

    btnLogin.innerHTML = `<span
      class="spinner-border spinner-border-sm"
      role="status">
    </span>
  Ingresando...`;

  fetch(`${API_URL}/usuarios/login`, {

    method: 'POST',

    headers: {
      'Content-Type': 'application/json'
    },

    body: JSON.stringify({
      usuario,
      password
    })

  })

  .then(async res => {

    const data = await res.json();

    if (!res.ok) {

      throw new Error(
        data.mensaje || 'Login incorrecto'
      );

    }

    return data;

  })

  .then(data => {

    btnLogin.innerHTML = 'Acceso Correcto';

    localStorage.setItem(
      'token',
      data.token
    );

    localStorage.setItem(
      'usuario',
      JSON.stringify(data.usuario)
    );

    window.location.href = 'index.html';

  })

  .catch(err => {

    btnLogin.disabled = false;

    btnLogin.innerHTML = 'Ingresar';

    console.error(err);

    document.getElementById('respuesta')
  .innerHTML = `

  <div
    class="alert alert-danger mt-3">

    <i class="bi bi-exclamation-triangle-fill"></i>

    ${err.message}

  </div>

`;

  });

}

const togglePassword =
  document.getElementById('togglePassword');

const passwordInput =
  document.getElementById('password');

if (togglePassword && passwordInput) {

  togglePassword.addEventListener(
    'click',
    () => {

      const tipo =
        passwordInput.type === 'password'
          ? 'text'
          : 'password';

      passwordInput.type = tipo;

      togglePassword.innerHTML =
        tipo === 'password'
          ? '<i class="bi bi-eye-fill"></i>'
          : '<i class="bi bi-eye-slash-fill"></i>';

    }
  );

};

document.addEventListener(
  'keydown',
  (e) => {

    if (e.key === 'Enter') {

      e.preventDefault();

      login();

    }

  }
);