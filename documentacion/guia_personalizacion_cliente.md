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
Gran Diablada Calamena
```

### Logo

Ubicacion sugerida:

```text
frontend/img/
```

Ejemplo:

```text
frontend/img/logo-calamena.jpeg
```

### Paleta de colores

Debe aplicarse desde CSS o, en una fase posterior, desde configuracion.

Ejemplo Calamena:

```css
--primary: #050505;
--secondary: #1c120b;
--accent: #f47a22;
--accent-dark: #c95712;
```

### Textos visibles

Ejemplos:

| Interno | Visible generico | Visible Calamena |
|---|---|---|
| personas | Integrantes | Integrantes |
| eventos | Actividades | Actividades |
| entrenamiento | Ensayo | Ensayo |
| partido | Presentacion | Presentacion |
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
Ensayo
Presentacion
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
  nombreSistema: 'Gestion de Agrupaciones',
  nombreOrganizacion: 'Gran Diablada Calamena',
  logo: 'img/logo-calamena.jpeg',
  labels: {
    personas: 'Integrantes',
    persona: 'Integrante',
    eventos: 'Actividades',
    evento: 'Actividad',
    encargado: 'Encargado'
  },
  tiposActividad: {
    entrenamiento: 'Ensayo',
    partido: 'Presentacion',
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

## Caso Calamena

Personalizacion aplicada:

- Logo de la agrupacion.
- Paleta negro/naranjo.
- Personas visibles como integrantes.
- Eventos visibles como actividades.
- Entrenamiento visible como ensayo.
- Partido visible como presentacion.
- Entrenador visible como encargado.

