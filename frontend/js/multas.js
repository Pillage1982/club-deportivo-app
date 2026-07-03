// =====================================
// CARGAR TABLA DE MULTAS
// =====================================

let multasTabla = [];

function normalizarTextoMulta(valor) {
  return String(valor || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

function filtrarMultas() {
  const busqueda = normalizarTextoMulta(document.getElementById('buscar_multas')?.value);

  return multasTabla.filter(m => {
    const texto = normalizarTextoMulta(
      [m.nombres, m.apellido_paterno, m.apellido_materno, m.motivo].join(' ')
    );
    return !busqueda || texto.includes(busqueda);
  });
}

function renderizarTablaMultas(multas) {
  const tabla = document.getElementById('tabla_multas');
  tabla.innerHTML = '';

  if (!multas.length) {
    tabla.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No hay registros para los filtros seleccionados</td></tr>';
    return;
  }

  multas.forEach(multa => {
    tabla.innerHTML += `
      <tr>
        <td>${multa.nombres} ${multa.apellido_paterno} ${multa.apellido_materno || ''}</td>
        <td>${formatearMonto(multa.monto)}</td>
        <td>${multa.motivo}</td>
        <td>${formatearFecha(multa.fecha)}</td>
      </tr>
    `;
  });
}

function configurarFiltrosMultas() {
  const el = document.getElementById('buscar_multas');
  if (!el) return;
  el.addEventListener('input', () => renderizarTablaMultas(filtrarMultas()));
}

function limpiarFiltrosMultas() {
  const buscar = document.getElementById('buscar_multas');
  if (buscar) buscar.value = '';
  renderizarTablaMultas(filtrarMultas());
}

function cargarMultas() {

  fetch(`${API_URL}/multas`, { headers: getAuthHeaders() })
    .then(res => res.json())
    .then(data => {

      if (!Array.isArray(data)) {
        mostrarAlerta(data.mensaje || 'No se pudo cargar la tabla de multas', 'warning');
        return;
      }

      multasTabla = data;
      renderizarTablaMultas(filtrarMultas());

    })
    .catch(err => console.error(err));

}
