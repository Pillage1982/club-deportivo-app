// =====================================
// CARGAR TABLA DE MULTAS
// =====================================

function cargarMultas() {

  fetch(`${API_URL}/multas`, {
    headers: getAuthHeaders()
  })
    .then(res => res.json())
    .then(data => {

      const tabla = document.getElementById('tabla_multas');
      tabla.innerHTML = '';

      if (!Array.isArray(data)) {
        mostrarAlerta(
          data.mensaje || 'No se pudo cargar la tabla de multas',
          'warning'
        );
        return;
      }

      data.forEach(multa => {
        tabla.innerHTML += `
          <tr>
            <td>${multa.nombres} ${multa.apellido_paterno} ${multa.apellido_materno || ''}</td>
            <td>$${multa.monto}</td>
            <td>${multa.motivo}</td>
            <td>${formatearFecha(multa.fecha)}</td>
          </tr>
        `;
      });

    })
    .catch(err => console.error(err));

}