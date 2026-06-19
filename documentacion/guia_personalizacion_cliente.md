# Guia de Personalizacion por Cliente

## Objetivo

Adaptar la aplicacion a distintos clientes sin romper la base tecnica.

La personalizacion debe cambiar principalmente:

- textos visibles,
- logo,
- colores,
- nombres de roles visibles,
- tipos de actividad visibles.

No se deben cambiar nombres internos sin una migracion planificada.

## Que se puede cambiar

### Nombre del sistema

Ejemplos:

- Gestion de Agrupaciones.
- Sistema Administrativo para Agrupaciones.
- GestionaOrg.

### Nombre de organizacion

Ejemplo:

```text
Organizacion Demo
```

### Logo

Ubicacion sugerida:

```text
frontend/img/
```

Ejemplo:

```text
frontend/img/logo-cliente.svg
```

### Paleta de colores

Debe aplicarse desde CSS o, en una fase posterior, desde configuracion.

Ejemplo base neutral:

```css
--primary: #172033;
--secondary: #24344d;
--accent: #2f80ed;
--accent-dark: #1f5fb5;
```

### Textos visibles

Ejemplos:

| Interno | Visible generico | Visible cliente alternativo |
|---|---|---|
| personas | Integrantes | Integrantes |
| eventos | Actividades | Actividades |
| entrenamiento | Actividad | Taller |
| partido | Encuentro | Jornada |
| reunion | Reunion | Reunion |
| entrenador | Encargado | Encargado |

## Que no se debe cambiar aun

No cambiar sin planificar:

- ids HTML,
- nombres de funciones,
- rutas backend,
- nombres de tablas,
- columnas de base de datos,
- valores internos de ENUM.

Ejemplos que no deben tocarse visualmente sin adaptar logica:

```text
tabla_personas
modulo_personas
pago_persona_id
evento_id
crearEvento()
cargarEventos()
/eventos
/personas
```

## Tipos de Actividad

Por ahora la base puede mantener valores internos:

```text
entrenamiento
partido
reunion
```

Pero la interfaz puede mostrarlos como:

```text
Actividad
Encuentro
Reunion
```

Esto evita modificar la base de datos antes de tiempo.

## Recomendacion Tecnica

Crear un archivo:

```text
frontend/js/config.js
```

Ejemplo:

```js
const APP_CONFIG = {
  nombreSistema: 'NexoComunidad',
  nombreOrganizacion: 'Organizacion Demo',
  logo: 'img/logo-cliente.svg',
  labels: {
    personas: 'Integrantes',
    persona: 'Integrante',
    eventos: 'Actividades',
    evento: 'Actividad',
    encargado: 'Encargado'
  },
  tiposActividad: {
    entrenamiento: 'Actividad',
    partido: 'Encuentro',
    reunion: 'Reunion'
  }
};
```

## Flujo Para Nuevo Cliente

1. Crear o seleccionar logo.
2. Definir paleta de colores.
3. Definir nombre del sistema.
4. Definir nombre de la organizacion.
5. Definir etiquetas visibles.
6. Preparar seed demo.
7. Probar roles.
8. Probar responsive.
9. Documentar personalizacion.

## Personalizaciones por Cliente

Las personalizaciones concretas deben vivir en ramas de cliente, por ejemplo:

```text
cliente/nombre-cliente
```

La rama `v1.1-dev` debe mantenerse como base neutral de NexoComunidad.
