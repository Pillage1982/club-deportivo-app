# Roadmap - Gestion de Organizaciones Adaptable

## Vision del Proyecto

El proyecto debe evolucionar desde una aplicacion especifica para un club deportivo hacia una plataforma adaptable para organizaciones, agrupaciones y comunidades.

La idea central es que una misma base tecnica pueda configurarse para distintos contextos:

- Agrupaciones culturales.
- Clubes deportivos.
- Academias o talleres.
- Agrupaciones culturales.
- Juntas vecinales.
- Organizaciones comunitarias.
- Grupos juveniles o formativos.

El objetivo no es crear una aplicacion distinta para cada cliente, sino una base comun con configuracion visual, textual y funcional segun la necesidad de cada organizacion.

---

## Principios de Trabajo

### 1. No romper produccion

La rama `main` queda como produccion estable.

Todo desarrollo nuevo se trabaja en:

```text
v1.1-dev
```

Solo se mezcla a `main` cuando la version este probada.

### 2. Primero configurar, despues reestructurar

Antes de cambiar tablas o backend, se debe crear una capa de configuracion:

- Nombre de sistema.
- Nombre de organizacion.
- Logo.
- Paleta de colores.
- Textos visibles.
- Nombres de modulos.
- Roles visibles.

### 3. Mantener nombres internos estables

Por ahora se mantienen nombres internos como:

- `personas`
- `eventos`
- `cuotas`
- `multas`
- `entrenador`

Pero visualmente se muestran segun el cliente:

- Integrantes.
- Actividades.
- Aportes o cuotas.
- Sanciones o multas.
- Encargado o entrenador.

### 4. Desarrollo por capas

Cada avance debe hacerse por capas pequenas:

1. Configuracion.
2. Textos visibles.
3. Visual.
4. Roles.
5. Datos demo.
6. Funcionalidad.
7. Base de datos.

---

## Estado Actual

### Produccion

Rama:

```text
main
```

Estado:

- Estable.
- Funcional.
- Con despliegue Hostinger.
- Validaciones principales listas.
- Permisos por rol aplicados.

### Desarrollo

Rama:

```text
v1.1-dev
```

Estado:

- Base visual neutral de NexoComunidad.
- Logo y paleta generica aplicados.
- Textos especificos de rubro corregidos.
- Actividades reemplazan eventos visualmente.
- Integrantes reemplazan personas visualmente.
- Tipos visuales adaptados:
  - Entrenamiento -> Actividad.
  - Partido -> Encuentro.
  - Reunion -> Reunion.

---

## Objetivo v1.1

Convertir la aplicacion en una demo neutral y adaptable para organizaciones.

Nombre conceptual recomendado:

```text
NexoComunidad
```

Alternativas:

- GestionaOrg.
- Sistema de Gestion Organizacional.
- Panel Administrativo para Agrupaciones.

---

## Fase 1 - Configuracion de Cliente

### Objetivo

Evitar editar muchos archivos para adaptar la app a un cliente.

### Crear archivo

```text
frontend/js/config.js
```

### Contenido esperado

```js
const APP_CONFIG = {
  nombreSistema: 'NexoComunidad',
  nombreOrganizacion: 'Organizacion Demo',
  logo: 'img/logo-nexocomunidad.svg',
  tema: {
    primario: '#172033',
    secundario: '#24344d',
    acento: '#2f80ed',
    acentoOscuro: '#1f5fb5'
  },
  labels: {
    personas: 'Integrantes',
    persona: 'Integrante',
    eventos: 'Actividades',
    evento: 'Actividad',
    cuotas: 'Cuotas',
    multas: 'Multas',
    encargado: 'Encargado'
  },
  tiposActividad: {
    entrenamiento: 'Actividad',
    partido: 'Encuentro',
    reunion: 'Reunion'
  }
};
```

### Resultado esperado

La app debe tomar sus textos principales desde `APP_CONFIG`.

---

## Fase 2 - Capa de Textos Dinamicos

### Objetivo

Reemplazar textos duros del frontend por textos configurables.

### Acciones

- Crear funcion para aplicar textos:

```js
aplicarConfiguracionVisual()
```

- Usar atributos HTML como:

```html
data-label="personas"
data-label="eventos"
data-label="cuotas"
```

- Reemplazar textos visibles sin tocar ids ni rutas.

### Cuidado

No cambiar:

- `tabla_personas`
- `modulo_personas`
- `evento_id`
- `pago_persona_id`
- rutas `/eventos`, `/personas`, `/cuotas`

---

## Fase 3 - Tema Visual Configurable

### Objetivo

Permitir que cada cliente tenga logo y colores propios.

### Acciones

- Variables CSS desde configuracion.
- Logo configurable en navbar.
- Logo configurable en login.
- Colores de botones.
- Colores de navbar/sidebar.

### Resultado esperado

Cambiar de cliente no debe requerir reescribir CSS completo.

---

## Fase 4 - Dashboard por Rol

### Objetivo

Que cada rol vea un resumen util para su trabajo.

### Admin

- Total integrantes.
- Actividades.
- Asistencias.
- Multas.
- Cuotas.
- Pagos.
- Deuda total.

### Tesorero

- Total recaudado.
- Deuda pendiente.
- Multas pendientes.
- Cuotas generadas.
- Pagos recientes.

### Encargado / Entrenador

- Proximas actividades.
- Asistencias recientes.
- Integrantes activos.
- Ausentes o atrasados.

---

## Fase 5 - Modulos Separados

### Objetivo

Reducir el tamano y complejidad de `index.html`.

### Opciones

#### Opcion simple

Mantener una sola pagina, pero dividir el codigo:

- `frontend/js/personas.js`
- `frontend/js/eventos.js`
- `frontend/js/asistencias.js`
- `frontend/js/pagos.js`
- `frontend/js/cuotas.js`
- `frontend/js/dashboard.js`

Ya existe parcialmente.

#### Opcion intermedia

Separar vistas HTML parciales:

- dashboard.html
- integrantes.html
- actividades.html
- asistencias.html
- finanzas.html

#### Opcion futura

Migrar a framework frontend:

- React.
- Vue.
- Svelte.

No se recomienda para el corto plazo.

---

## Fase 6 - Busqueda y Filtros

### Objetivo

Mejorar el uso diario del sistema.

### Integrantes

- Buscar por nombre.
- Buscar por RUT.
- Filtrar activos/inactivos.

### Actividades

- Filtrar por tipo.
- Filtrar por fecha.
- Buscar por nombre.

### Asistencias

- Filtrar por actividad.
- Filtrar por integrante.
- Filtrar por estado.

### Finanzas

- Filtrar pagos por fecha.
- Filtrar cuotas por mes.
- Filtrar integrantes con deuda.

---

## Fase 7 - Reportes

### Objetivo

Entregar informacion lista para directiva o reuniones.

### Reportes iniciales

- Estado financiero por integrante.
- Asistencia por actividad.
- Pagos por periodo.
- Cuotas pendientes.
- Multas pendientes.

### Exportacion

- Excel.
- PDF.

---

## Fase 8 - Modulos Opcionales por Tipo de Organizacion

### Agrupacion cultural

- Inventario o materiales.
- Instrumentos.
- Citaciones.
- Actividades especiales.
- Aportes extraordinarios.
- Viajes.

### Club deportivo

- Categorias.
- Partidos.
- Convocatorias.
- Entrenamientos.
- Estadisticas deportivas.

### Academia o taller

- Cursos.
- Horarios.
- Profesores.
- Matriculas.
- Mensualidades.

### Junta o agrupacion comunitaria

- Socios.
- Reuniones.
- Actas.
- Cuotas.
- Beneficios.

---

## Fase 9 - Multi Organizacion

### Objetivo

Permitir varios clientes dentro de la misma aplicacion.

### Cambio clave

Agregar:

```text
organizacion_id
```

en tablas principales:

- personas
- eventos
- asistencias
- cuotas
- pagos
- multas
- usuarios

### Resultado esperado

Cada cliente ve solo sus datos.

---

## Fase 10 - Producto SaaS

### Objetivo

Convertir el sistema en producto comercial.

### Posibles modelos

- Instalacion unica.
- Mensualidad por organizacion.
- Plan basico.
- Plan con reportes.
- Plan con portal de integrantes.
- Modulos adicionales pagados.

### Infraestructura futura

- Subdominios por cliente.
- Panel de administracion global.
- Backup automatico.
- Monitoreo.
- Logs de auditoria.

---

## Prioridad Recomendada Ahora

### Sprint inmediato

```text
v1.1-config
```

Objetivo:

Crear la primera capa de configuracion para que la app deje de depender de textos duros.

### Tareas

1. Crear `frontend/js/config.js`.
2. Cargarlo en `login.html` e `index.html`.
3. Crear funcion `aplicarConfiguracionVisual()`.
4. Reemplazar logo y nombre desde configuracion.
5. Reemplazar etiquetas principales desde configuracion.
6. Probar que la base neutral siga funcionando.
7. Hacer commit en `v1.1-dev`.

---

## Criterios de Exito v1.1

La version `v1.1` se considera lista cuando:

- Se puede cambiar nombre/logo/colores desde un archivo.
- La app no contiene textos duros de un rubro especifico en la interfaz principal.
- Las demos de clientes funcionan desde ramas `cliente/...`.
- La version generica funciona como demo para organizaciones.
- Produccion `main` sigue estable.
- Desarrollo `v1.1-dev` esta documentado.

---

## Frase Guia del Proyecto

> Una plataforma adaptable para que cualquier organizacion pueda ordenar integrantes, actividades, asistencias y finanzas sin depender de planillas dispersas.
