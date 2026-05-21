# 🏆 Club Deportivo App

Sistema administrativo web para gestión de clubes deportivos.

---

# 🚀 Descripción

Club Deportivo App es una plataforma web desarrollada para administrar:

- socios
- eventos
- asistencias
- multas
- pagos
- estados financieros
- dashboard administrativo

El sistema fue construido utilizando arquitectura modular frontend/backend y autenticación JWT.

---

# 🛠 Tecnologías Utilizadas

## Frontend

- HTML5
- CSS3
- Bootstrap 5
- JavaScript Vanilla
- Chart.js

## Backend

- Node.js
- Express.js
- JWT Authentication
- Middleware personalizado

## Base de Datos

- MySQL
- UTF8MB4

---

# 📁 Arquitectura Proyecto

```plaintext
club-deportivo-app/
│
├── backend/
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   └── server.js
│
├── frontend/
│   ├── js/
│   │   ├── utils.js
│   │   ├── personas.js
│   │   ├── eventos.js
│   │   ├── pagos.js
│   │   ├── asistencias.js
│   │   ├── dashboard.js
│   │   └── main.js
│   │
│   ├── index.html
│   └── login.html
│
└── README.md
```

---

# 🔐 Roles del Sistema

## 👑 Administrador

Puede:

- gestionar personas
- gestionar eventos
- registrar asistencias
- gestionar pagos
- visualizar dashboard
- visualizar multas
- visualizar finanzas

---

## 💰 Tesorero

Puede:

- gestionar pagos
- visualizar finanzas
- visualizar multas
- visualizar dashboard

No puede:

- registrar asistencias

---

## 🏃 Entrenador

Puede:

- registrar asistencias
- visualizar asistencias
- visualizar eventos

No puede:

- acceder a finanzas
- acceder a multas

---

# 📌 Funcionalidades Principales

## 👥 Gestión Personas

- crear socios
- editar socios
- eliminar socios
- validaciones frontend
- actualización automática tablas

---

## 📅 Gestión Eventos

- crear eventos
- editar eventos
- eliminar eventos
- entrenamientos
- reuniones
- actividades deportivas

---

## ✅ Registro Asistencias

- presente
- atrasado
- ausente
- control minutos atraso
- validación duplicados

---

## ⚠ Sistema Multas

Las multas se generan automáticamente desde asistencias.

Ejemplos:

- atraso
- ausencia

---

## 💰 Gestión Financiera

- registro pagos
- edición pagos
- eliminación pagos
- saldo a favor
- estado al día
- deuda pendiente

---

## 📊 Dashboard Administrativo

Incluye:

- total socios
- total multas
- deuda total
- pagos totales
- gráficos dinámicos

---

# 🔐 Seguridad

El sistema utiliza:

- autenticación JWT
- middleware autenticación
- middleware autorización roles
- rutas protegidas
- control permisos frontend y backend

---

# ⚡ Características Técnicas

## ✅ Frontend Modular

El frontend fue modularizado para mejorar:

- mantenibilidad
- escalabilidad
- legibilidad
- reutilización código

---

## ✅ Backend Organizado

Separación por capas:

- controllers
- models
- routes
- middleware

---

## ✅ Base Datos UTF8

Soporte completo para:

- Ñ
- tildes
- caracteres especiales
- internacionalización

---

# 🚀 Instalación

## 1️⃣ Clonar repositorio

```bash
git clone URL_REPOSITORIO
```

---

## 2️⃣ Instalar dependencias backend

```bash
cd backend
npm install
```

---

## 3️⃣ Configurar variables entorno

Crear archivo:

```plaintext
.env
```

Ejemplo:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=club_deportivo
JWT_SECRET=secret123
```

---

## 4️⃣ Ejecutar backend

```bash
node server.js
```

---

## 5️⃣ Ejecutar frontend

Abrir:

```plaintext
frontend/index.html
```

O utilizar Live Server.

---

# 📊 Estado Proyecto

## ✅ Implementado

- autenticación JWT
- roles
- CRUD personas
- CRUD eventos
- CRUD pagos
- asistencias
- multas automáticas
- dashboard
- gráficos
- finanzas
- frontend modular
- validaciones
- documentación

---

# 🚧 Mejoras Futuras

- responsive móvil avanzado
- modales Bootstrap
- sistema auditoría
- exportación Excel/PDF
- notificaciones
- deploy producción
- backups automáticos
- recuperación contraseña

---

# 👨‍💻 Autor

Mario Rodrigo Riquelme Cabello

---

# 📄 Licencia

Proyecto desarrollado con fines educativos y administrativos.

