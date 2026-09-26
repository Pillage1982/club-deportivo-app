// =====================================
// NAVEGACION POR VISTAS (sidebar)
// =====================================

// El contenido se muestra de a una vista a la vez. Cada bloque del <main>
// declara a qué vista pertenece con data-vista="..."; una <section> sin
// bloques de la vista activa se oculta completa. Los títulos (h2) y demás
// elementos sin data-vista se muestran junto con su sección.
//
// El sidebar (escritorio y móvil) se arma desde estos arreglos. La clase
// `clase` de cada ítem la usa aplicarRolesFrontend() para ocultarlo por rol.

const MENU_PRINCIPAL = [
  { vista: 'dashboard', texto: 'Dashboard', icono: 'bi-speedometer2', clase: 'nav-dashboard' },
  { vista: 'registrar_asistencia', texto: 'Registrar Asistencia', icono: 'bi-qr-code-scan', clase: 'nav-registrar-asistencia' }
];

const MENU_FORMULARIOS = [
  { vista: 'form_integrantes', texto: 'Integrantes', icono: 'bi-person-plus', clase: 'nav-form-integrantes' },
  { vista: 'form_eventos', texto: 'Eventos', icono: 'bi-calendar-plus', clase: 'nav-eventos' },
  { vista: 'form_pagos', texto: 'Pagos', icono: 'bi-cash-coin', clase: 'nav-pagos' },
  { vista: 'form_ingresos', texto: 'Ingresos', icono: 'bi-piggy-bank', clase: 'nav-ingresos' },
  { vista: 'form_gastos', texto: 'Gastos', icono: 'bi-currency-dollar', clase: 'nav-gastos' },
  { vista: 'form_actas', texto: 'Actas de Reunión', icono: 'bi-journal-plus', clase: 'nav-form-actas' }
];

const MENU_TABLAS = [
  { vista: 'tabla_integrantes', texto: 'Integrantes', icono: 'bi-people', clase: 'nav-tabla-integrantes' },
  { vista: 'tabla_eventos', texto: 'Eventos', icono: 'bi-calendar-event', clase: 'nav-eventos' },
  { vista: 'tabla_asistencias', texto: 'Asistencias', icono: 'bi-check2-square', clase: 'nav-asistencias' },
  { vista: 'tabla_pagos', texto: 'Pagos', icono: 'bi-receipt', clase: 'nav-pagos' },
  { vista: 'tabla_cuotas', texto: 'Cuotas', icono: 'bi-graph-up', clase: 'nav-cuotas' },
  { vista: 'tabla_ingresos', texto: 'Ingresos', icono: 'bi-piggy-bank', clase: 'nav-ingresos' },
  { vista: 'tabla_gastos', texto: 'Gastos', icono: 'bi-currency-dollar', clase: 'nav-gastos' },
  { vista: 'tabla_actas', texto: 'Actas de Reunión', icono: 'bi-journal-text', clase: 'nav-actas' },
  { vista: 'tabla_acceso_socios', texto: 'Acceso Socios', icono: 'bi-shield-lock', clase: 'nav-acceso-socios' }
];

const GRUPOS_MENU = [
  { id: 'formularios', texto: 'Formularios', icono: 'bi-ui-checks', items: MENU_FORMULARIOS },
  { id: 'tablas', texto: 'Tablas', icono: 'bi-table', items: MENU_TABLAS }
];

const VISTA_INICIAL = 'dashboard';
const CLAVE_VISTA_GUARDADA = 'vista_actual';

function crearItemMenu(item, esSubitem) {
  return `
    <li class="nav-item mb-1 ${item.clase}">
      <a
        class="nav-link text-white ${esSubitem ? 'nav-subitem' : ''}"
        href="#"
        data-ir-vista="${item.vista}">
        <i class="bi ${item.icono}"></i>
        ${item.texto}
      </a>
    </li>`;
}

// `sufijo` distingue los ids del sidebar de escritorio y del móvil,
// que se arman con el mismo HTML.
function crearMenuHtml(sufijo) {
  const principales =
    MENU_PRINCIPAL.map(item => crearItemMenu(item, false)).join('');

  const grupos = GRUPOS_MENU.map(grupo => {
    const idSubmenu = `submenu_${grupo.id}_${sufijo}`;

    return `
      <li class="nav-item mb-1 nav-grupo" data-grupo="${grupo.id}">
        <a
          class="nav-link text-white nav-grupo-toggle collapsed"
          href="#${idSubmenu}"
          data-bs-toggle="collapse"
          role="button"
          aria-expanded="false"
          aria-controls="${idSubmenu}">
          <i class="bi ${grupo.icono}"></i>
          ${grupo.texto}
          <i class="bi bi-chevron-down nav-grupo-chevron ms-auto"></i>
        </a>

        <ul class="nav flex-column collapse nav-submenu" id="${idSubmenu}">
          ${grupo.items.map(item => crearItemMenu(item, true)).join('')}
        </ul>
      </li>`;
  }).join('');

  return principales + grupos;
}

function renderizarMenuLateral() {
  const menus = [
    { id: 'menu_lateral_desktop', sufijo: 'desktop' },
    { id: 'menu_lateral_movil', sufijo: 'movil' }
  ];

  menus.forEach(({ id, sufijo }) => {
    const contenedor = document.getElementById(id);

    if (contenedor) {
      contenedor.innerHTML = crearMenuHtml(sufijo);
    }
  });

  document.querySelectorAll('[data-ir-vista]').forEach(enlace => {
    enlace.addEventListener('click', evento => {
      evento.preventDefault();
      mostrarVista(enlace.dataset.irVista);
      cerrarMenuMovil();
    });
  });
}

function cerrarMenuMovil() {
  const offcanvas = document.getElementById('sidebarMobile');

  if (offcanvas && window.bootstrap?.Offcanvas) {
    bootstrap.Offcanvas.getInstance(offcanvas)?.hide();
  }
}

function obtenerGrupoDeVista(vista) {
  return GRUPOS_MENU.find(grupo =>
    grupo.items.some(item => item.vista === vista)
  );
}

function mostrarVista(vista) {
  const main = document.querySelector('main.main-content');

  if (!main || !main.querySelector(`[data-vista="${vista}"]`)) {
    vista = VISTA_INICIAL;
  }

  // Si se sale de Registrar Asistencia con la cámara encendida, se apaga.
  if (
    vista !== 'registrar_asistencia' &&
    typeof detenerEscaneoAsistencia === 'function'
  ) {
    detenerEscaneoAsistencia();
  }

  main.querySelectorAll('[data-vista]').forEach(bloque => {
    bloque.classList.toggle('vista-oculta', bloque.dataset.vista !== vista);
  });

  main.querySelectorAll(':scope > section').forEach(seccion => {
    const tieneVista =
      seccion.dataset.vista === vista ||
      seccion.querySelector(`[data-vista="${vista}"]`);

    seccion.classList.toggle('vista-oculta', !tieneVista);
  });

  document.querySelectorAll('[data-ir-vista]').forEach(enlace => {
    enlace.classList.toggle('active', enlace.dataset.irVista === vista);
  });

  // Deja abierto el submenú que contiene la vista activa
  const grupo = obtenerGrupoDeVista(vista);

  if (grupo && window.bootstrap?.Collapse) {
    document
      .querySelectorAll(`[id^="submenu_${grupo.id}_"]`)
      .forEach(submenu => {
        bootstrap.Collapse.getOrCreateInstance(submenu, { toggle: false }).show();
      });
  }

  try {
    sessionStorage.setItem(CLAVE_VISTA_GUARDADA, vista);
  } catch (err) {
    // Sin sessionStorage (modo privado): solo no se recuerda la vista
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function obtenerVistaGuardada() {
  try {
    return sessionStorage.getItem(CLAVE_VISTA_GUARDADA) || VISTA_INICIAL;
  } catch (err) {
    return VISTA_INICIAL;
  }
}

renderizarMenuLateral();
mostrarVista(obtenerVistaGuardada());
