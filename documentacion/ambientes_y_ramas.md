# Ambientes y Ramas

## Objetivo

Mantener produccion estable mientras se desarrolla una version adaptable y configurable del sistema.

## Ramas Git

### Produccion

Rama:

```text
main
```

Uso:

- version estable,
- conectada al despliegue principal,
- no se trabaja directamente sobre ella para nuevas funciones.

### Desarrollo

Rama:

```text
v1.1-dev
```

Uso:

- nuevas mejoras,
- base adaptable neutral,
- personalizacion preparada para ramas de cliente,
- pruebas de interfaz,
- ajustes de roadmap,
- cambios que aun no deben llegar a produccion.

### Clientes

Ramas:

```text
cliente/nombre-cliente
```

Uso:

- personalizaciones visuales y documentacion comercial de un cliente concreto,
- logos, colores, textos y pautas de demo especificas,
- no mezclar estos cambios en `v1.1-dev` salvo que sean mejoras reutilizables.

## Ambientes Hostinger

### Produccion

Sitio:

```text
club.pillageweb.cl
```

Rama conectada:

```text
main
```

Base de datos:

```text
BD de produccion
```

Regla:

No cargar seed de pruebas en esta base.

### Desarrollo

Sitio sugerido:

```text
clubdev.pillageweb.cl
```

Rama conectada:

```text
v1.1-dev
```

Base de datos:

```text
BD dev separada
```

Regla:

En esta base si se pueden cargar seeds, borrar datos y probar cambios.

## Flujo de Trabajo

Antes de trabajar:

```bash
git checkout v1.1-dev
git pull origin v1.1-dev
git status
```

Guardar avances:

```bash
git status
git add .
git commit -m "Descripcion del cambio"
git push origin v1.1-dev
```

Pasar a produccion solo cuando este probado:

```bash
git checkout main
git pull origin main
git merge v1.1-dev
git push origin main
```

## Reglas de Seguridad

- No subir `.env`.
- No subir `node_modules`.
- No usar la BD de produccion para pruebas.
- No cargar seeds dev en produccion.
- No cambiar Hostinger produccion para apuntar a ramas dev.
- Probar roles antes de promover cambios.

## Checklist Antes de Merge a Main

- Login admin probado.
- Login tesorero probado.
- Login encargado/entrenador probado.
- Dashboard carga datos.
- Actividades cargan datos.
- Asistencias funcionan.
- Pagos, cuotas y multas visibles.
- No hay errores rojos en consola.
- La rama `v1.1-dev` esta pushada.
- La documentacion esta actualizada.
