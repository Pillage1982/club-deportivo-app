# Roadmap Maestro - Plataforma de Gestion para Organizaciones

## Objetivo Final

Construir una plataforma adaptable para administrar organizaciones, agrupaciones y comunidades desde una misma base tecnica.

La aplicacion debe poder ajustarse a distintos tipos de cliente sin rehacer el sistema:

- Agrupaciones culturales.
- Clubes deportivos.
- Academias.
- Talleres.
- Agrupaciones culturales.
- Juntas vecinales.
- Organizaciones comunitarias.

La meta final es pasar de una app especifica a un producto configurable.

---

## Enfoque Principal

El roadmap anterior estaba orientado a un club deportivo. Ese trabajo no se pierde: queda como la primera version funcional y validada.

Desde ahora, el enfoque cambia a:

```text
Gestion de Organizaciones Adaptable
```

Esto significa:

- No cambiar tablas internas antes de tiempo.
- No romper produccion.
- No crear una app distinta por cliente.
- Crear una capa de configuracion visual, textual y funcional.
- Mantener una base comun y activar/adaptar modulos segun el tipo de organizacion.

---

## Estado Actual

### Produccion

Rama:

```text
main
```

Estado:

- Estable.
- Desplegada en Hostinger.
- Login funcionando.
- Roles protegidos.
- Validaciones principales listas.
- Datos demo funcionales.
- Documentacion RC2 creada.

### Desarrollo

Rama:

```text
v1.1-dev
```

Estado:

- Base visual neutral de NexoComunidad.
- Logo y paleta generica aplicados.
- Textos deportivos eliminados de la demo.
- Personas visibles como integrantes.
- Eventos visibles como actividades.
- Tipos visibles adaptados:
  - entrenamiento -> actividad.
  - partido -> encuentro.
  - reunion -> reunion.
- Navbar y sidebar fijos.
- Seed demo contextualizado.

---

## Principios de Desarrollo

### 1. Produccion no se toca directamente

Todo avance se realiza en:

```text
v1.1-dev
```

Solo se fusiona a `main` cuando:

- esta probado,
- esta documentado,
- no rompe la demo,
- no afecta datos reales.

### 2. Configuracion antes que migracion

Antes de modificar base de datos, se debe crear una capa de configuracion.

Ejemplo:

```text
frontend/js/config.js
```

Desde ahi deben salir:

- nombre del sistema,
- nombre de la organizacion,
- logo,
- colores,
- labels,
- roles visibles,
- tipos de actividad visibles.

### 3. Interno estable, externo adaptable

Por ahora se mantienen internamente:

- personas,
- eventos,
- cuotas,
- multas,
- entrenador.

Pero visualmente pueden mostrarse como:

- integrantes,
- actividades,
- aportes/cuotas,
- sanciones/multas,
- encargado/entrenador.

### 4. Avances chicos y reversibles

Cada mejora debe poder probarse y revertirse facilmente.

---

## Roadmap por Versiones

## V1.0 RC2 - Base Estable

Estado:

```text
Completado
```

Incluye:

- Despliegue Hostinger estable.
- Login JWT.
- Roles.
- Personas.
- Eventos.
- Asistencias.
- Multas.
- Pagos.
- Cuotas.
- Estado financiero.
- Dashboard.
- Validaciones principales.
- Permisos backend/frontend.
- Documentacion de release.

Objetivo cumplido:

```text
Tener una app funcional, demostrable y recuperable.
```

---

## V1.1 - Personalizacion y Demo Adaptable

Objetivo:

Convertir la app en una demo neutral y adaptable para organizaciones.

### Sprint 1 - Configuracion de Cliente

Crear:

```text
frontend/js/config.js
```

Debe incluir:

- nombreSistema,
- nombreOrganizacion,
- logo,
- tema,
- labels,
- rolesVisuales,
- tiposActividad.

Criterio de exito:

Cambiar cliente no debe requerir editar manualmente muchas secciones HTML.

### Sprint 2 - Aplicar Configuracion Visual

Tareas:

- Cargar `config.js` antes de `utils.js`.
- Crear `aplicarConfiguracionVisual()`.
- Aplicar logo en login y navbar.
- Aplicar nombre del sistema.
- Aplicar labels principales.
- Aplicar rol visual.
- Mantener ids/rutas internas sin cambios.

### Sprint 3 - Tema Visual Configurable

Tareas:

- Pasar colores de cliente a variables CSS.
- Aplicar paleta desde configuracion.
- Mantener fallback generico.
- Evitar CSS duplicado entre login y app.

### Sprint 4 - Demo Generica

Crear una configuracion base:

```text
NexoComunidad
```

Y configuraciones de cliente en ramas separadas:

```text
cliente/nombre-cliente
```

Criterio de exito:

La misma app puede presentarse como demo generica o como demo de cliente sin mezclar marcas en `v1.1-dev`.

---

## V1.2 - Usabilidad Operativa

Objetivo:

Mejorar el uso diario del sistema.

### Busquedas y filtros

Integrantes:

- buscar por nombre,
- buscar por RUT,
- filtrar activos/inactivos.

Actividades:

- filtrar por tipo,
- filtrar por fecha,
- buscar por nombre.

Asistencias:

- filtrar por actividad,
- filtrar por integrante,
- filtrar por estado.

Finanzas:

- filtrar por deuda,
- filtrar pagos por fecha,
- filtrar cuotas por mes/estado.

### Dashboard por rol

Admin:

- resumen general.

Tesorero:

- pagos,
- cuotas,
- multas,
- deuda,
- recaudacion.

Encargado:

- actividades,
- asistencias,
- integrantes activos,
- ausentes/atrasados.

---

## V1.3 - Reportes y Exportacion

Objetivo:

Entregar informacion lista para reuniones, directiva o rendicion.

Reportes:

- estado financiero por integrante,
- pagos por periodo,
- cuotas pendientes,
- multas pendientes,
- asistencia por actividad,
- resumen general.

Exportacion:

- Excel,
- PDF.

---

## V1.4 - Portal de Integrantes

Objetivo:

Permitir que cada integrante vea su propia informacion.

Funciones:

- login de integrante,
- deuda personal,
- cuotas pendientes,
- multas pendientes,
- historial de pagos,
- historial de asistencia,
- proximas actividades.

Valor:

Reduce consultas manuales al tesorero y mejora transparencia.

---

## V1.5 - Modulos Opcionales

Objetivo:

Agregar modulos segun rubro, sin obligar a todos los clientes a usarlos.

### Agrupacion cultural

- inventario o materiales,
- instrumentos,
- citaciones,
- actividades especiales,
- viajes,
- aportes extraordinarios.

### Club deportivo

- categorias,
- partidos,
- convocatorias,
- entrenamientos,
- estadisticas.

### Academia / taller

- cursos,
- horarios,
- profesores,
- matriculas,
- mensualidades.

### Agrupacion comunitaria

- reuniones,
- actas,
- socios,
- cuotas,
- beneficios.

---

## V1.6 - Asistencia Avanzada

Objetivo:

Modernizar el registro de asistencia.

Funciones posibles:

- QR por actividad,
- registro desde celular,
- validacion por encargado,
- bloqueo de duplicados,
- historial de escaneos.

---

## V1.7 - Pagos Online

Objetivo:

Permitir pagos desde la app.

Funciones:

- pago de cuotas,
- pago de multas,
- comprobante,
- actualizacion automatica de deuda,
- integracion con pasarela.

Nota:

No debe abordarse antes de estabilizar configuracion, reportes y portal.

---

## V2.0 - Multi Organizacion

Objetivo:

Una sola plataforma para varios clientes.

Cambio clave:

```text
organizacion_id
```

en tablas principales:

- usuarios,
- personas,
- eventos,
- asistencias,
- multas,
- cuotas,
- pagos.

Resultado:

Cada cliente ve solo su informacion.

---

## V3.0 - SaaS Comercial

Objetivo:

Convertir el sistema en producto escalable.

Incluye:

- panel administrador global,
- planes de suscripcion,
- modulos activables,
- backup automatico,
- logs de auditoria,
- subdominios por cliente,
- monitoreo,
- soporte.

---

## Orden Recomendado Inmediato

### Ahora

```text
Sprint v1.1-config
```

Tareas:

1. Crear `frontend/js/config.js`.
2. Cargarlo en `index.html` y `login.html`.
3. Crear `aplicarConfiguracionVisual()`.
4. Mover nombre/logo/roles visuales a config.
5. Mover tipos de actividad visibles a config.
6. Probar la base neutral.
7. Commit en `v1.1-dev`.

### Despues

```text
Sprint v1.2-usabilidad
```

Tareas:

1. Filtros en integrantes.
2. Filtros en actividades.
3. Filtros en pagos/cuotas/deuda.
4. Dashboard por rol.

---

## Como Encajan los Roadmaps Anteriores

### Roadmap V1

Se conserva como la base funcional inicial.

### Roadmap V2

Sus ideas pasan a fases posteriores:

- Portal de socios -> Portal de integrantes.
- QR asistencia -> Asistencia avanzada.
- Pagos online -> V1.7.
- Multi-club -> Multi organizacion.

### Roadmap Adaptable

Pasa a ser el roadmap principal desde ahora.

---

## Criterio de Exito Final

El producto alcanza su objetivo cuando:

- puede configurarse para distintos clientes,
- no depende de textos duros de un rubro,
- permite administrar integrantes, actividades, asistencia y finanzas,
- soporta roles,
- tiene reportes,
- puede evolucionar a multi-organizacion,
- puede venderse como producto repetible.

---

## Frase Guia

> Una misma plataforma, adaptable a cada organizacion, para ordenar personas, actividades, asistencias y finanzas sin depender de planillas dispersas.
