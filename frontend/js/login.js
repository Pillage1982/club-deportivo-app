const API_URL = 'http://localhost:3000';

function login() {

  const usuario =
    document.getElementById('usuario').value;

  const password =
    document.getElementById('password').value;

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

    console.error(err);

    document.getElementById('respuesta')
      .innerText = err.message;

  });

}