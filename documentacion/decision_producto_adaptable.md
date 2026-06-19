# Decision de Producto - Plataforma Adaptable

## Contexto

El proyecto comenzo como una aplicacion administrativa para un club deportivo. Durante el desarrollo se estabilizo una version funcional con login, roles, integrantes/personas, actividades/eventos, asistencias, multas, cuotas, pagos, dashboard y estado financiero.

Posteriormente se valido que la misma base tecnica tambien sirve para agrupaciones culturales, comunitarias y potencialmente otros tipos de organizaciones.

## Decision

El proyecto deja de pensarse como una aplicacion exclusiva para un club deportivo y pasa a evolucionar como una plataforma adaptable para organizaciones.

Nombre de producto base:

```text
NexoComunidad
```

La aplicacion debe poder adaptarse a:

- agrupaciones culturales,
- clubes deportivos,
- academias,
- talleres,
- agrupaciones culturales,
- juntas vecinales,
- organizaciones comunitarias.

## Principio Central

No se creara una aplicacion distinta por cliente. Se mantendra una base comun y se agregara una capa de configuracion para adaptar textos, logo, colores, roles visibles y modulos.

## Que se mantiene por ahora

Para evitar romper la version estable, se mantienen los nombres internos:

- `personas`
- `eventos`
- `cuotas`
- `multas`
- `entrenador`

Estos nombres pueden seguir existiendo en codigo, rutas y base de datos.

## Que cambia visualmente

La interfaz puede mostrar otros conceptos segun el cliente:

- personas -> integrantes,
- eventos -> actividades,
- entrenamiento -> actividad,
- partido -> encuentro,
- entrenador -> encargado.

## Estrategia Tecnica

La siguiente evolucion debe comenzar por una capa de configuracion:

```text
frontend/js/config.js
```

Desde esa configuracion deben salir:

- nombre del sistema,
- nombre de la organizacion,
- logo,
- paleta de colores,
- etiquetas visibles,
- roles visibles,
- tipos de actividad visibles.

## Ramas

La produccion estable se mantiene en:

```text
main
```

El desarrollo adaptable se trabaja en:

```text
v1.1-dev
```

## Objetivo de la Decision

Permitir que el producto evolucione hacia una solucion comercial reutilizable, sin perder la estabilidad ya alcanzada.
