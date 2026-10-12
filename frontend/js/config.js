// Configuración visual y funcional del cliente; concentra marca, textos, roles y tipos de actividad visibles.
window.APP_CONFIG = {
  producto: {
    nombre: 'UMC.APP',
    descripcion: 'Sistema administrativo adaptable para organizaciones'
  },

  cliente: {
    nombre: 'Unión Morenada Centralista',
    nombreCorto: 'Morenada Centralista',
    fundacion: 'Fundada el 9 de septiembre de 2000',
    logo: 'img/logo-morenada.png',
    logoOscuro: 'img/logo-morenada.png'
  },

  textos: {
    integrantes: 'Integrantes',
    actividades: 'Actividades',
    asistencia: 'Asistencia',
    finanzas: 'Finanzas',
    cuotas: 'Cuotas',
    multas: 'Multas'
  },

  // La agrupación no aplica multas por ahora (oct-2026): con false se ocultan
  // en todo el panel. Debe coincidir con backend/config/multas.js.
  multas: {
    habilitadas: false
  },

  rolesVisuales: {
    admin: 'Administrador',
    tesorero: 'Tesorero',
    entrenador: 'Encargado'
  },

  tiposActividad: {
    entrenamiento: 'Ensayo',
    partido: 'Presentacion',
    reunion: 'Reunion'
  },

  asistencia: {
    // Minutos de gracia desde la hora de inicio del evento antes de marcar "atrasado"
    // automáticamente en el escaneo QR (ver aplicarAtrasoAsistencia en asistencias.js).
    // Valor heredado de GDC: confirmar con la directiva de la Unión Morenada Centralista.
    toleranciaMinutosAtraso: 30,

    // Ayudas para escanear el QR en poca luz (ver asistencias.js).
    qrPocaLuz: {
      // Luminancia media del cuadro (0–255) bajo la cual se considera "poca luz".
      umbralLuminancia: 80,
      // Segundos sin lograr una lectura antes de mostrar el primer consejo (acercar, limpiar lente).
      segundosAviso: 4,
      // Segundos sin lectura antes de encender la linterna sola
      // (solo dispositivos que permiten controlarla; iOS no).
      segundosLinternaAuto: 6,
      // Segundos sin lectura antes del aviso final (última prioridad): pedir ingreso manual del RUT.
      // Siempre se muestra después de haber intentado la linterna automática.
      segundosAvisoManual: 10,
      // Bajar la resolución de captura al detectar poca luz (píxeles más grandes, menos ruido).
      bajarResolucion: true
    }
  },

  etiquetas: {
    modulos: {
      registrarAsistencia: 'Registrar Asistencia',
      dashboard: 'Dashboard',
      gestionIntegrantes: 'Gestión de Integrantes',
      gestionActividades: 'Gestión de Actividades',
      gestionPagos: 'Gestión de Pagos',
      asistencias: 'Asistencias',
      multas: 'Multas',
      estadoFinanciero: 'Estado Financiero'
    },

    botones: {
      registrar: 'Registrar',
      guardarIntegrante: 'Guardar Integrante',
      guardarActividad: 'Guardar Actividad',
      guardarPago: 'Guardar Pago',
      generarCuotas: 'Generar cuotas del mes',
      cerrarSesion: 'Cerrar Sesión'
    },

    campos: {
      nombreCompleto: 'Nombre Completo',
      nombres: 'Nombres',
      apellidoPaterno: 'Apellido Paterno',
      apellidoMaterno: 'Apellido Materno',
      rut: 'RUT',
      email: 'Email',
      telefono: 'Teléfono',
      fechaNacimiento: 'Fecha de nacimiento',
      nombreActividad: 'Nombre Actividad',
      tipo: 'Tipo',
      fecha: 'Fecha',
      ubicacion: 'Ubicación',
      descripcion: 'Descripción',
      persona: 'Integrante',
      monto: 'Monto',
      metodoPago: 'Método Pago',
      estado: 'Estado',
      minutosAtraso: 'Minutos atraso'
    }
  },

};
