# Release v1.1 - NexoComunidad Base

## Objetivo

Estabilizar NexoComunidad como base adaptable para organizaciones comunitarias, separando la version neutral de las personalizaciones por cliente.

## Estado de Ramas

```text
main
```

Produccion estable con la base neutral de NexoComunidad.

```text
v1.1-dev
```

Ambiente de desarrollo neutral para probar nuevas mejoras reutilizables antes de promoverlas.

```text
cliente/calamena
```

Adaptacion especifica de Gran Diablada Calamena, con logo, paleta, textos y documentacion propios.

## Ambientes

| Ambiente | URL | Rama | Objetivo |
|---|---|---|---|
| Produccion | club.pillageweb.cl | main | Base estable |
| Desarrollo Nexo | devnexo.pillageweb.cl | v1.1-dev | Pruebas neutrales |
| Cliente Calamena | devclub.pillageweb.cl | cliente/calamena | Validacion cliente |

## Cambios Principales

- Identidad neutral NexoComunidad.
- Configuracion visual desde `frontend/js/config.js`.
- Logo neutral `frontend/img/logo-nexocomunidad.svg`.
- Paleta neutral en login y aplicacion.
- Separacion de rama cliente para Calamena.
- Seeds neutrales con password demo `admin123`.
- Seeds corregidos para importacion con claves foraneas.
- Dashboard y graficos al inicio del contenido.
- Tabla de actividades muestra fecha y hora.
- Validaciones frontend/backend conservadas.
- Roles y visibilidad por perfil conservados.
- Modales Bootstrap de confirmacion conservados.
- Correcciones de backend y conexion MySQL conservadas.

## Credenciales Demo

```text
admin / admin123
tesorero / admin123
entrenador / admin123
```

Usar solo en ambientes de prueba o despues de cargar seeds demo.

## Checklist de Validacion

- Login admin probado.
- Login tesorero probado.
- Login encargado probado.
- Dashboard carga primero.
- Graficos cargan junto al dashboard.
- Integrantes cargan y se pueden gestionar.
- Actividades cargan con fecha y hora.
- Asistencias se pueden registrar.
- Multas se generan/visualizan.
- Pagos se pueden registrar.
- Cuotas se pueden generar.
- Estado financiero carga correctamente.
- Consola del navegador sin errores rojos.
- `devnexo` no muestra marcas de Calamena.
- `devclub` mantiene la personalizacion Calamena.

## Reglas de Promocion

- Las mejoras reutilizables pasan por `v1.1-dev`.
- Las personalizaciones de clientes viven en `cliente/nombre-cliente`.
- No mezclar logos, paletas o textos de cliente en `main` ni `v1.1-dev`.
- No subir `.env`.
- No subir `node_modules`.
- Probar en ambiente correspondiente antes de promover.
