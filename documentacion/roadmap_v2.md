# Plan de trabajo - Club Deportivo App

## Estado actual

La aplicacion cuenta con una version V1.0 RC activa en Hostinger, desplegada desde GitHub y con demo funcional.

Ya existe:

- Login con roles.
- Backend Node/Express.
- Frontend publicado.
- Base de datos MySQL en Hostinger.
- Socios/personas.
- Eventos.
- Asistencias.
- Multas.
- Pagos.
- Cuotas.
- Estado financiero.
- Dashboard.
- Datos demo iniciales.

El objetivo ahora es pasar de una RC funcional a una version estable, demostrable y vendible.

## Hallazgos de testers

### Seguridad y autenticacion

- El dashboard podia renderizarse brevemente antes de verificar si existia token.
- Se recomienda agregar una guarda temprana en `index.html`.
- La validacion del token en frontend mejora la experiencia, pero la proteccion real debe mantenerse en backend.

### Validacion de personas

Se detecto que se pueden registrar datos invalidos:

- Nombre numerico o incompleto.
- RUT invalido.
- Telefono invalido.
- Fecha de nacimiento vacia.
- Categoria mostrando `Sin fecha`.

Esto afecta directamente la calidad de datos.

### Asistencia duplicada

Se detecto que al registrar una asistencia ya existente, la base de datos bloquea correctamente el duplicado, pero el sistema muestra el error tecnico crudo de MySQL.

Debe mostrarse un mensaje amigable:

```text
La asistencia ya fue registrada para esta persona en este evento.
```

### Roles y sidebar

Se detecto que el menu lateral necesita pulido segun rol.

Hay que definir claramente que ve y que puede hacer cada usuario:

- Admin.
- Tesorero.
- Entrenador.

### Navegacion y separacion visual

El sistema actualmente concentra muchos modulos dentro del mismo `index.html`.

Para la demo puede funcionar, pero necesita mejor separacion visual y una navegacion mas clara.

## Prioridad inmediata

Antes de agregar nuevas funciones, se debe estabilizar la V1.0.

Orden recomendado:

1. Validaciones de datos.
2. Asistencia duplicada con mensaje amigable.
3. Permisos por rol.
4. Sidebar y navegacion.
5. QA completo.
6. Datos demo controlados.
7. Congelar version V1.0 estable.

## Fase 0 - Estabilizacion tecnica post-deploy

### Objetivo

Mantener la app online y evitar que vuelva a fallar por infraestructura.

### Tareas

- Mantener endpoint `/health`.
- Revisar logs temporales de diagnostico.
- Confirmar que MySQL funciona con pool de conexiones.
- Revisar si `ECONNRESET` ocurre durante acciones reales o solo en reposo.
- No subir `.env`.
- No subir `node_modules`.
- Mantener despliegue desde GitHub.

### Criterio de aceptacion

- `/health` responde correctamente.
- Login funciona despues de cerrar sesion y volver a entrar.
- La app no vuelve a caer en error 503.

## Fase 1 - V1.0 estable

### Objetivo

Convertir la RC actual en una version estable para presentar a un cliente.

## 1.1 Validaciones de personas

### Tareas

- Validar RUT chileno con formato y digito verificador.
- Validar nombre y apellidos.
- Evitar nombres numericos como `111`.
- Validar email.
- Validar telefono chileno.
- Hacer obligatoria la fecha de nacimiento si se calcula edad/categoria.
- Evitar que categoria muestre `Sin fecha`.
- Validar en frontend.
- Validar tambien en backend.

### Criterio de aceptacion

- No se puede crear persona con RUT invalido.
- No se puede crear persona con telefono invalido.
- No se puede crear persona sin fecha de nacimiento.
- La edad y categoria se calculan correctamente.

## 1.2 Asistencia duplicada

### Tareas

- Mantener restriccion unica en base de datos para `(evento_id, persona_id)`.
- Capturar error `ER_DUP_ENTRY` en backend.
- Responder con HTTP `409 Conflict`.
- Mostrar mensaje amigable en frontend.
- Evitar mostrar JSON o error tecnico de MySQL al usuario.

### Criterio de aceptacion

Si se intenta registrar dos veces la misma asistencia, el sistema muestra:

```text
La asistencia ya fue registrada para esta persona en este evento.
```

## 1.3 Permisos por rol

### Reglas propuestas

#### Admin

- Acceso total.
- Gestiona socios.
- Gestiona eventos.
- Gestiona asistencias.
- Gestiona multas.
- Gestiona pagos.
- Gestiona cuotas.
- Ve estado financiero.

#### Tesorero

- Ve dashboard financiero.
- Ve socios en modo lectura.
- Gestiona pagos.
- Genera cuotas.
- Ve multas.
- Ve finanzas.
- No registra asistencias.
- No elimina socios.

#### Entrenador

- Ve dashboard basico.
- Ve socios en modo lectura.
- Gestiona eventos deportivos.
- Registra asistencias.
- No ve pagos.
- No ve cuotas.
- No ve estado financiero.
- No ve finanzas.

### Tareas

- Aplicar permisos en frontend.
- Aplicar permisos en backend.
- Revisar `roleMiddleware`.
- Ocultar opciones del sidebar segun rol.
- Bloquear rutas API segun rol.

### Criterio de aceptacion

Un usuario no puede acceder a una funcion prohibida ni por interfaz ni llamando directamente a la API.

## 1.4 Sidebar y navegacion

### Tareas

- Hacer sidebar fijo o sticky.
- Mejorar separacion visual entre modulos.
- Revisar responsive movil.
- Ocultar links segun rol.
- Evaluar si mantener todo como secciones dentro de `index.html` o separar vistas en una fase posterior.

### Criterio de aceptacion

- El menu se mantiene util durante scroll.
- Cada rol ve solo lo que corresponde.
- La navegacion es clara para una demo.

## 1.5 Mejora de autenticacion visual

### Tareas

- Agregar guarda temprana en `index.html` antes de renderizar el dashboard.
- Evitar flash visual del panel sin token.
- Mantener validacion real en backend.
- En una fase posterior, crear endpoint de verificacion real de token.

### Criterio de aceptacion

Si no hay token, el usuario es redirigido a `login.html` antes de ver el dashboard.

## 1.6 QA completo

### Flujo a probar

- Login admin.
- Crear socio.
- Ver edad y categoria.
- Crear evento.
- Registrar asistencia.
- Intentar registrar asistencia duplicada.
- Ver multas.
- Generar cuotas.
- Ver cuotas.
- Ver estado financiero.
- Registrar pago.
- Confirmar que baja la deuda.
- Probar rol tesorero.
- Probar rol entrenador.
- Cerrar sesion.
- Entrar en modo incognito.
- Probar recarga de pagina con y sin token.

### Criterio de aceptacion

La demo se puede recorrer completa sin errores visibles ni datos inconsistentes.

## 1.7 Datos demo controlados

### Objetivo

Tener datos realistas para mostrar el sistema.

### Datos recomendados

- 5 a 8 socios.
- 2 o 3 eventos.
- Asistencias presentes, atrasadas y ausentes.
- Multas asociadas a atrasos o ausencias.
- Cuotas generadas.
- Al menos un pago registrado.
- Al menos un socio al dia.
- Al menos un socio con deuda.

### Criterio de aceptacion

La demo no se ve vacia y permite mostrar dashboard, asistencias, multas, cuotas, pagos y finanzas.

## Fase 2 - Presentacion comercial

### Objetivo

Preparar la app para mostrarla a un potencial cliente.

### Tareas

- Definir problema que resuelve.
- Listar modulos incluidos.
- Explicar roles disponibles.
- Preparar beneficios para el club.
- Definir precio base.
- Definir que entra en V1.0.
- Definir mejoras futuras.
- Preparar guion de demo.
- Preparar datos demo limpios.

### Criterio de aceptacion

Existe una presentacion clara para explicar y vender la app.

## Fase 3 - Congelar V1.0 estable

### Objetivo

Marcar una version estable en Git.

### Tareas

- Completar QA.
- Corregir errores criticos.
- Limpiar logs temporales.
- Actualizar documentacion.
- Crear tag:

```bash
git tag v1.0
git push origin v1.0
```

### Criterio de aceptacion

Existe una version marcada y recuperable como V1.0 estable.

## Fase 4 - Portal de socios

### Objetivo

Permitir que cada socio entre y vea solo su informacion.

### Funciones

- Login de socio.
- Vista de deuda personal.
- Cuotas pendientes.
- Multas pendientes.
- Historial de pagos.
- Historial de asistencia.
- Datos personales basicos.

### Cambios tecnicos esperados

- Relacionar usuarios con personas.
- Diferenciar usuarios internos de usuarios socios.
- Revisar modelo de permisos.
- Crear vistas separadas para socio.

### Valor comercial

Reduce consultas manuales al tesorero y aumenta el valor percibido del sistema.

## Fase 5 - Asistencia con QR

### Objetivo

Modernizar el registro de asistencia mediante QR.

### Flujo ideal

- Admin o entrenador crea evento.
- Sistema genera QR unico del evento.
- Socio escanea al llegar.
- Sistema registra asistencia.
- Admin o entrenador valida si corresponde.

### Funciones

- QR por evento.
- Registro desde celular.
- Control de duplicados.
- Validacion de asistencia.
- Historial de escaneos.

### Valor comercial

Alto para clubes, academias, escuelas deportivas y talleres.

## Fase 6 - Convocatorias por categoria

### Objetivo

Aprovechar edad y categoria para convocar socios automaticamente.

### Funciones

- Crear evento por categoria.
- Filtrar por Sub-8, Sub-10, Sub-12, Sub-15, Sub-18, Adulto, Senior.
- Generar lista de convocados.
- Registrar asistencia solo de convocados.
- Ver historial por categoria.

### Valor comercial

Muy util para clubes formativos y escuelas deportivas.

## Fase 7 - Pagos online

### Objetivo

Permitir pago de cuotas y multas desde la app.

### Funciones

- Integracion Webpay / Transbank.
- Pago de cuotas.
- Pago de multas.
- Pago parcial o total de deuda.
- Comprobante automatico.
- Actualizacion automatica del estado financiero.
- Historial de transacciones.

### Nota

No conviene incluir esto en V1.0 porque agrega complejidad de integracion, pruebas y certificacion.

## Fase 8 - Multi-club / SaaS

### Objetivo

Convertir la app en una plataforma para varios clubes.

### Cambios necesarios

- Crear tabla `clubes`.
- Agregar `club_id` a tablas principales:
  - usuarios
  - personas
  - eventos
  - asistencias
  - multas
  - cuotas
  - pagos
- Definir acceso por club.
- Separar datos por cliente.
- Evaluar subdominios por club.

### Ejemplo

```text
club1.tusistema.cl
club2.tusistema.cl
club3.tusistema.cl
```

### Recomendacion

No saltar a SaaS antes de validar el sistema con al menos un cliente real.

## Fase 9 - Profesionalizacion del producto

### Objetivo

Preparar el sistema para operar con clientes reales.

### Funciones futuras

- Backups automaticos.
- Logs de auditoria.
- Historial de cambios.
- Exportar PDF.
- Exportar Excel.
- Panel de configuracion por club.
- Plantillas de cuotas.
- Notificaciones por correo.
- Notificaciones por WhatsApp.
- Control de licencias.
- Planes de suscripcion.

## Roadmap resumido

| Version | Objetivo | Estado |
|---|---|---|
| V1.0 RC | App base activa | En linea |
| V1.0 estable | Permisos, QA, validaciones, sidebar, demo limpia | Proximo |
| V1.1 | Portal de socios | Futuro cercano |
| V1.2 | Asistencia con QR | Diferenciador |
| V1.3 | Convocatorias por categoria | Deportivo/formativo |
| V1.5 | Pagos online | Alto valor comercial |
| V2.0 | Multi-club / SaaS | Escalabilidad real |

## Orden recomendado de trabajo

### Sprint 1 - Correcciones criticas de demo

- Validar RUT.
- Validar telefono.
- Hacer obligatoria fecha de nacimiento.
- Corregir categoria `Sin fecha`.
- Capturar asistencia duplicada.
- Mostrar mensajes amigables.

### Sprint 2 - Roles y navegacion

- Definir permisos finales.
- Aplicar permisos en backend.
- Aplicar permisos en frontend.
- Ajustar sidebar por rol.
- Hacer sidebar sticky/fijo.

### Sprint 3 - QA y demo comercial

- Crear seed demo definitivo.
- Probar flujo completo.
- Limpiar logs.
- Documentar version estable.
- Preparar presentacion comercial.

### Sprint 4 - V1.0 estable

- Corregir bugs detectados en QA.
- Congelar version con tag.
- Preparar entrega/demo final.

## Recomendacion estrategica

No conviene saltar directo a SaaS todavia.

Primero:

```text
1 cliente real
feedback real
V1.0 estable
portal socios
QR asistencia
pagos online
multi-club
```

La prioridad inmediata debe ser cerrar una V1.0 estable, confiable y demostrable.
