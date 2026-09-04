// Interfaz de puntaje GDC: carga ranking/detalle, filtra resultados y prepara exportaciones.
// =====================================
// PUNTAJE GDC
// =====================================

let rankingCargado = [];
let temporadasPuntajeCargadas = [];

// Repuebla el select de temporada. Por defecto (primera carga) selecciona la
// temporada en curso, que el backend marca con "actual"; en recargas posteriores
// respeta lo que el usuario ya haya elegido.
function cargarTemporadasPuntaje() {
  const select = document.getElementById('filtro_puntaje_temporada');
  if (!select) return Promise.resolve();

  return fetch(`${API_URL}/puntaje/temporadas`, { headers: getAuthHeaders() })
    .then(res => res.json())
    .then(data => {
      if (!Array.isArray(data)) return;

      const esPrimeraCarga = select.options.length === 0;
      const seleccionPrevia = select.value;
      temporadasPuntajeCargadas = data;

      select.innerHTML = data.map(t => `<option value="${t.id}">${t.nombre}</option>`).join('');

      const actual = data.find(t => t.actual);
      const seleccionValida = data.some(t => t.id === seleccionPrevia);
      select.value = (!esPrimeraCarga && seleccionValida)
        ? seleccionPrevia
        : (actual ? actual.id : (data[0] ? data[0].id : ''));
    })
    .catch(() => mostrarAlerta('Error al cargar las temporadas de puntaje.', 'danger'));
}

function cargarRankingPuntaje() {
  const temporada = document.getElementById('filtro_puntaje_temporada')?.value || '';
  const query = temporada ? `?temporada=${encodeURIComponent(temporada)}` : '';

  fetch(`${API_URL}/puntaje${query}`, { headers: getAuthHeaders() })
    .then(res => res.json())
    .then(data => {
      rankingCargado = Array.isArray(data) ? data : [];
      renderizarRanking(rankingCargado);
    })
    .catch(() => mostrarAlerta('Error al cargar el ranking de puntaje.', 'danger'));
}

function configurarFiltroTemporadaPuntaje() {
  const select = document.getElementById('filtro_puntaje_temporada');
  if (!select) return;
  select.addEventListener('change', cargarRankingPuntaje);
}

function renderizarRanking(data) {
  const tbody = document.getElementById('tabla_puntaje');
  if (!tbody) return;

  if (data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-3">Sin registros</td></tr>';
    return;
  }

  tbody.innerHTML = data.map((r, i) => {
    const pts = Number(r.puntaje_total);
    const clsPts = pts > 0 ? 'text-success' : pts < 0 ? 'text-danger' : '';
    const nombre = `${r.nombres} ${r.apellido_paterno} ${r.apellido_materno || ''}`.trim();
    const nombreEsc = nombre.replace(/'/g, "\\'");
    return `
    <tr>
      <td class="text-center fw-bold">${i + 1}</td>
      <td>${nombre}</td>
      <td>${r.bloque || '—'}</td>
      <td class="text-center fw-bold ${clsPts}">${pts}</td>
      <td class="text-center">${r.total_registros}</td>
      <td class="text-center">
        <button class="btn btn-sm btn-outline-secondary" onclick="verHistorialPuntaje(${r.id}, '${nombreEsc}')">
          <i class="bi bi-clock-history"></i>
        </button>
      </td>
    </tr>`;
  }).join('');
}

function verHistorialPuntaje(persona_id, nombre) {
  document.getElementById('puntaje_historial_nombre').textContent = nombre;
  const tbody = document.getElementById('tabla_historial_puntaje');
  tbody.innerHTML = '<tr><td colspan="4" class="text-center py-3">Cargando...</td></tr>';

  const modal = new bootstrap.Modal(document.getElementById('modal_historial_puntaje'));
  modal.show();

  fetch(`${API_URL}/puntaje/historial/${persona_id}`, { headers: getAuthHeaders() })
    .then(res => res.json())
    .then(data => {
      if (!Array.isArray(data) || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-3">Sin registros</td></tr>';
        return;
      }
      tbody.innerHTML = data.map(h => {
        const pts = Number(h.puntos);
        const clsPts = pts > 0 ? 'text-success' : pts < 0 ? 'text-danger' : '';
        const signo  = pts > 0 ? '+' : '';
        const fecha  = String(h.fecha || '').substring(0, 10);
        return `
        <tr>
          <td>${fecha}</td>
          <td>${escaparHtml(h.evento)}</td>
          <td>${escaparHtml(h.detalle)}</td>
          <td class="text-center fw-bold ${clsPts}">${signo}${pts}</td>
        </tr>`;
      }).join('');
    })
    .catch(() => {
      tbody.innerHTML = '<tr><td colspan="4" class="text-center text-danger py-3">Error al cargar</td></tr>';
    });
}

function configurarBuscadorPuntaje() {
  const input = document.getElementById('buscar_puntaje');
  if (!input) return;
  input.addEventListener('input', () => {
    const q = input.value.toLowerCase();
    const filtrado = rankingCargado.filter(r => {
      const nombre = `${r.nombres} ${r.apellido_paterno} ${r.apellido_materno || ''}`.toLowerCase();
      return nombre.includes(q) || (r.bloque || '').toLowerCase().includes(q);
    });
    renderizarRanking(filtrado);
  });
}
