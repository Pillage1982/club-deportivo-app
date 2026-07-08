# NexoComunidad

Sistema administrativo web para organizaciones comunitarias: agrupaciones, clubes, academias y juntas vecinales.

**Cliente activo:** Gran Diablada Calameña (`devclub.pillageweb.cl`)

---

## Stack

- Frontend: HTML5, Bootstrap 5, JavaScript Vanilla, Chart.js, PWA (Service Worker + IndexedDB)
- Backend: Node.js, Express.js, JWT
- Base de datos: MySQL

---

## Arquitectura

```
club-deportivo-app/
├── backend/
│   ├── config/          # db.js, migrations.js
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── services/        # emailService.js
│   └── server.js
├── frontend/
│   ├── js/
│   │   ├── config.js    # personalización por cliente
│   │   ├── utils.js
│   │   ├── offline-db.js  # IndexedDB + sync
│   │   ├── main.js
│   │   ├── personas.js
│   │   ├── eventos.js
│   │   ├── asistencias.js
│   │   ├── pagos.js
│   │   ├── multas.js
│   │   ├── finanzas.js
│   │   ├── cuotas.js
│   │   └── dashboard.js
│   ├── sw.js            # Service Worker PWA
│   ├── index.html
│   └── login.html
└── documentacion/
```

---

## Ambientes

| URL | Rama | Propósito |
|-----|------|-----------|
| club.pillageweb.cl | main | Producción NexoComunidad genérico |
| devnexo.pillageweb.cl | v1.3-dev | Desarrollo activo |
| devclub.pillageweb.cl | cliente/calamena | Cliente Gran Diablada Calameña |
| nexocomunidad.pillageweb.cl | — | Landing comercial |

---

## Módulos

| Módulo | Descripción |
|--------|-------------|
| Dashboard | Resumen financiero y estadísticas de asistencia |
| Integrantes | CRUD con validación RUT, apoderado condicional por edad |
| Eventos | CRUD con cierre y notificación por email |
| Asistencia QR | Lector QR/PDF417 offline-first, sin evento ni conexión |
| Finanzas | Vista consolidada del estado financiero por integrante |
| Pagos | Registro y gestión de pagos |
| Cuotas | Generación masiva mensual automática |
| Multas | Registro y seguimiento de multas |

---

## Roles

| Rol | Acceso |
|-----|--------|
| admin | Acceso completo |
| tesorero | Finanzas, pagos, cuotas, multas |
| entrenador | Asistencia, eventos, integrantes (solo lectura) |

---

## PWA offline-first

El módulo de asistencia funciona sin conexión:

- Escaneos se guardan en IndexedDB aunque no haya evento ni red
- Matching automático al seleccionar evento o abrir panel "Sin asignar"
- Sincronización automática al recuperar conexión (retry 30s → 60s → 300s)
- Badge visible con contador de registros pendientes

---

## Instalación local

```bash
# Clonar
git clone https://github.com/Pillage1982/club-deportivo-app.git
cd club-deportivo-app

# Instalar dependencias
cd backend && npm install

# Configurar entorno
cp .env.example .env  # completar con credenciales MySQL y JWT_SECRET

# Iniciar
node server.js
```

Abrir `frontend/index.html` o usar Live Server.

---

## Variables de entorno

```env
DB_HOST=127.0.0.1
DB_USER=usuario_mysql
DB_PASSWORD=password_mysql
DB_NAME=nombre_base_datos
JWT_SECRET=secreto_jwt
EMAIL_USER=correo@gmail.com
EMAIL_PASS=app_password_gmail
```

---

## Autor

Mario Rodrigo Riquelme Cabello
