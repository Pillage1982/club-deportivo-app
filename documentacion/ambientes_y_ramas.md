# Ambientes y Ramas

## Objetivo

Mantener produccion estable, separar la base neutral de NexoComunidad y aislar las personalizaciones por cliente.

## Ramas Git

### Produccion

Rama:

```text
main
```

Uso:

- version estable,
- conectada al despliegue principal,
- contiene la base neutral de NexoComunidad,
- solo recibe cambios ya probados.

### Desarrollo

Rama:

```text
v1.1-dev
```

Uso:

- nuevas mejoras,
- base adaptable neutral,
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

### Landing Comercial

Sitio:

```text
nexocomunidad.pillageweb.cl
```

Uso:

- publicar la propuesta comercial de NexoComunidad,
- presentar beneficios, modulos y casos de uso a clientes potenciales,
- orientar contactos o solicitudes de demo,
- no usar como ambiente operativo ni como backend de clientes.

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

No usar esta base para pruebas destructivas.

### Desarrollo NexoComunidad

Sitio:

```text
devnexo.pillageweb.cl
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

### Cliente Calamena

Sitio:

```text
devclub.pillageweb.cl
```

Rama conectada:

```text
cliente/calamena
```

Base de datos:

```text
BD cliente/dev separada
```

Regla:

Mantener aqui logo, colores, textos, documentos y datos demo especificos de Calamena.

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

Aplicar una mejora reutilizable tambien a un cliente:

```bash
git checkout cliente/calamena
git pull origin cliente/calamena
git cherry-pick <commit_reutilizable>
git push origin cliente/calamena
```

## Reglas de Seguridad

- No subir `.env`.
- No subir `node_modules`.
- No usar la BD de produccion para pruebas.
- No cargar seeds demo en bases reales sin confirmacion.
- No cambiar Hostinger produccion para apuntar a ramas dev.
- Probar roles antes de promover cambios.
- Rotar secretos si fueron expuestos en capturas o logs.

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

## Checklist de Ambientes

### Landing Comercial

- `nexocomunidad.pillageweb.cl` muestra la propuesta comercial.
- Explica que NexoComunidad es adaptable por organizacion.
- No expone datos reales ni accesos internos.
- Deriva a contacto/demo cuando corresponda.

### Main / Produccion

- `club.pillageweb.cl` despliega desde `main`.
- Logo y textos son NexoComunidad neutral.
- Dashboard y graficos aparecen al inicio.
- Actividades muestran fecha y hora.

### Dev Nexo

- `devnexo.pillageweb.cl` despliega desde `v1.1-dev`.
- Usa BD dev separada.
- Permite cargar seeds y probar cambios.
- No contiene Calamena.

### Cliente Calamena

- `devclub.pillageweb.cl` despliega desde `cliente/calamena`.
- Mantiene logo, paleta y textos Calamena.
- Recibe solo mejoras reutilizables seleccionadas.
