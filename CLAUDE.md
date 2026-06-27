# NexoComunidad — club-deportivo-app

## Proyecto
Sistema administrativo web para organizaciones comunitarias.
Cliente activo: Gran Diablada Calameña (rama `cliente/calamena`).

## Stack
- Frontend: HTML5, Bootstrap 5, JavaScript Vanilla, Chart.js
- Backend: Node.js, Express.js, JWT
- Base de datos: MySQL (Hostinger)

## Ambientes
- `club.pillageweb.cl` → main
- `devnexo.pillageweb.cl` → v1.3-dev
- `devclub.pillageweb.cl` → cliente/calamena
- `nexocomunidad.pillageweb.cl` → landing comercial

## Ramas
- `main` → producción estable
- `v1.3-dev` → desarrollo activo
- `cliente/calamena` → personalización Gran Diablada Calameña

## Flujo de trabajo
- Cambios se hacen en `v1.3-dev` o `cliente/calamena`
- Revisar en devnexo antes de fusionar a main
- Pedir autorización antes de commit y push

## Estados de socios
- `activo` → participa y genera cuotas
- `receso` → pausado de asistencia y nuevas cuotas, puede hacer pagos
- `inactivo` → eliminación lógica

## Módulos
Dashboard, Integrantes, Asistencia (QR por RUT), Eventos, Finanzas, Pagos, Cuotas, Multas

## Pendiente activo
- Módulo asistencia QR: personasTabla declarada, caché corregido, debug activo
- Separar multas.js y finanzas.js (aún no committeado en escritorio)
- Probar flujo manual RUT en devclub.pillageweb.cl con F12 consola abierta