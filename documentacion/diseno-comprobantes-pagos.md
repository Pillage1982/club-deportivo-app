# Diseño: Comprobantes de pago con reparto familiar y anti-duplicados

**Proyecto:** NexoComunidad (Node.js / Express / MySQL)
**Cliente:** Gran Diablada Calameña — Portal de socios, opción "Enviar comprobante de pago"
**Estado:** Diseño conceptual cerrado. Pendiente aterrizar sobre el código real.

---

## 1. Instrucciones de trabajo (leer primero)

- Trabajar **paso a paso**; no avanzar a la siguiente etapa sin confirmación de Mario.
- **Pedir autorización antes de cualquier commit o push.**
- Mostrar **exactamente qué líneas cambian y en qué archivo**.
- Explicar el código nuevo en estilo docente, señalando conceptos poco familiares.
- **Validar en devnexo antes de mergear a main.**
- **Nunca sobrescribir personalizaciones propias de Calameña** al tocar ramas neutras/compartidas.
- La etapa 0 (reconocimiento) es de **solo lectura**: no modificar nada.

---

## 2. Problema

Los socios reenvían **el mismo comprobante con los mismos datos**, cambiando solo el texto de la observación. Causa probable: no reciben confirmación clara de que su envío llegó.

Restricción importante: existen **pagos familiares legítimos**. Ejemplo: Pablo Díaz hace una sola transferencia de $360.000 y paga su cuota ($120.000), la de su esposa ($120.000) y la de sus dos hijos menores ($60.000 c/u). Hoy reutiliza el mismo comprobante cuatro veces.

Por lo tanto: **bloquear duplicados sin bloquear el reparto de un pago entre varios integrantes.**

---

## 3. Idea central

Separar la **transferencia** (única) de su **reparto** (N asignaciones). Relación 1 a N.

- `comprobantes`: la transferencia en sí. Única por hash de archivo y por banco + nº de transacción. Guarda el monto total.
- `comprobante_asignaciones`: cuánto de ese comprobante se aplica a cada deuda/integrante.
- La observación (texto libre) **no participa** en la detección de duplicados.

**Fase 1 no usa IA.** La detección es determinista (hash + índices UNIQUE). La IA para leer comprobantes queda para una fase 2.

---

## 4. Reglas de negocio

### 4.1 Duplicados
1. Calcular SHA-256 del archivo subido. Si ya existe → es el mismo comprobante.
2. Si banco + nº de transacción ya existen → es el mismo comprobante (cubre capturas distintas o imágenes recomprimidas por WhatsApp).
3. Un comprobante existente **no se rechaza a ciegas**; se informa:
   - Si ya cubre al usuario: *"Este comprobante ya fue registrado por Pablo Díaz y cubre tu cuota de $120.000."*
   - Si tiene saldo: *"Este comprobante tiene $40.000 disponibles, ¿quieres asignarlos?"*
   - Si no tiene saldo ni cubre al usuario: mensaje claro (HTTP 409), con fecha de recepción y estado.

### 4.2 Reparto
1. La suma de asignaciones **nunca supera** el monto total del comprobante.
   Validar dentro de una transacción con `SELECT ... FOR UPDATE` sobre el comprobante (evita que dos envíos simultáneos repartan el mismo saldo).
2. Un comprobante no se asigna dos veces a la misma deuda: `UNIQUE (comprobante_id, deuda_id)`.

### 4.3 Permisos: quién puede asignar a quién
| Beneficiario | Validación | Estado de la asignación |
|---|---|---|
| El mismo que sube | Es el pagador | `automatica` |
| Menor vinculado a él como apoderado | Vínculo apoderado existente **y** el beneficiario sigue siendo menor de edad al momento de asignar | `automatica` |
| Adulto con registro en `pagadores_autorizados` | Existe el par (pagador, beneficiario) | `automatica` |
| Cualquier otro integrante | Sin relación registrada | `pendiente_revision` |

- No existe "grupo familiar" en el sistema ni en los estatutos; solo el vínculo apoderado → menor (obligatorio por estatutos).
- **Pagadores autorizados:** al aprobar una asignación `pendiente_revision`, el tesorero puede marcar *"Autorizar a [pagador] para pagar por [beneficiario] en adelante"*, lo que crea el registro y vuelve automáticas las siguientes.
- **Caso borde:** al cumplir 18 años el beneficiario deja de valer el permiso de apoderado. La validación debe revisar la condición de menor al asignar, no solo que exista `apoderado_id`.

### 4.4 Confirmación humana
El paso final del pago a confirmado lo hace el tesorero. Las asignaciones `automatica` igual quedan sujetas a la confirmación habitual del pago.

---

## 5. Modelo de datos (borrador, ajustar a nombres reales)

> Los nombres de tablas/columnas existentes son desconocidos al momento de este diseño. Adaptar tras la etapa 0.
> Montos en CLP como entero.

```sql
-- Transferencia única
CREATE TABLE comprobantes (
  id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  subido_por          INT UNSIGNED NOT NULL,          -- integrante
  banco               VARCHAR(60)  NOT NULL DEFAULT '',
  numero_transaccion  VARCHAR(60)  NOT NULL,
  monto_total         INT UNSIGNED NOT NULL,
  fecha_transferencia DATE         NOT NULL,
  hash_archivo        CHAR(64)     NOT NULL,
  ruta_archivo        VARCHAR(255) NOT NULL,
  observacion         TEXT NULL,
  creado_en           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_hash (hash_archivo),
  UNIQUE KEY uq_banco_numero (banco, numero_transaccion)
);
-- Nota: banco es NOT NULL DEFAULT '' a propósito. En MySQL un índice UNIQUE
-- permite múltiples NULL, así que con banco NULL el duplicado no se detectaría.

-- Reparto del comprobante
CREATE TABLE comprobante_asignaciones (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  comprobante_id  INT UNSIGNED NOT NULL,
  integrante_id   INT UNSIGNED NOT NULL,
  deuda_id        INT UNSIGNED NOT NULL,
  monto_asignado  INT UNSIGNED NOT NULL,
  estado          ENUM('automatica','pendiente_revision','aprobada','rechazada') NOT NULL,
  revisado_por    INT UNSIGNED NULL,
  revisado_en     DATETIME NULL,
  creado_en       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_comprobante_deuda (comprobante_id, deuda_id),
  FOREIGN KEY (comprobante_id) REFERENCES comprobantes(id)
);

-- Permisos entre adultos, creados por el tesorero
CREATE TABLE pagadores_autorizados (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  pagador_id       INT UNSIGNED NOT NULL,
  beneficiario_id  INT UNSIGNED NOT NULL,
  autorizado_por   INT UNSIGNED NOT NULL,
  creado_en        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_par (pagador_id, beneficiario_id)
);
```

---

## 6. Flujo del endpoint de envío (pseudocódigo)

```
recibir archivo + datos (banco, nº, monto_total, fecha, observación, reparto[])
hash = sha256(archivo)

BEGIN
  existente = buscar comprobante por hash O por (banco, nº)  FOR UPDATE
  si existente:
      si ya cubre al usuario → responder informativo (no error de sistema)
      saldo = existente.monto_total - SUM(asignaciones)
      si reparto pedido > saldo → ROLLBACK, 409 con saldo disponible
      comprobante = existente
  si no:
      validar que SUM(reparto) <= monto_total
      insertar comprobante (capturar ER_DUP_ENTRY por concurrencia → tratar como existente)

  por cada item del reparto:
      estado = calcularPermiso(usuario, item.integrante)   -- tabla 4.3
      insertar asignación (capturar ER_DUP_ENTRY → misma deuda ya asignada)
COMMIT
responder resumen: asignaciones creadas, estados, saldo restante
```

---

## 7. Plan de implementación por etapas

**Etapa 0 — Reconocimiento (solo lectura).** En la rama `cliente/calamena`:
- `SHOW CREATE TABLE` de la tabla actual de comprobantes/pagos y de integrantes (cómo se guarda el apoderado y la edad/fecha de nacimiento).
- Localizar la ruta y el controlador que reciben el envío, y el frontend del formulario.
- Revisar cómo se gestionan las migraciones (`migrations.js`).
- Reportar hallazgos a Mario antes de proponer cambios.

**Etapa 1 — Diagnóstico de datos existentes (solo lectura).**
- Buscar registros repetidos por nº de transacción.
- ⚠️ **No borrar.** Muchos "duplicados" pueden ser pagos familiares legítimos. Clasificarlos: mismo integrante (duplicado real) vs. integrantes distintos (reparto familiar).

**Etapa 2 — Migración de esquema.**
- Crear las tablas nuevas de forma **idempotente** (verificar existencia antes de crear). No repetir el patrón de `ALTER TABLE` sin protección que ya se detectó en `migrations.js`.

**Etapa 3 — Migración de datos.**
- Agrupar registros del mismo comprobante en un solo `comprobantes` + N `comprobante_asignaciones`.
- Duplicados reales del mismo integrante: decidir con Mario cuál conservar.
- Script revisable y con respaldo previo.

**Etapa 4 — Backend.** Endpoint de envío según sección 6; función `calcularPermiso`.

**Etapa 5 — Frontend de envío.** Formulario con reparto: "¿A quién cubre este pago?" (él mismo, sus menores a cargo, otros integrantes), monto por persona y saldo en vivo.

**Etapa 6 — "Mis comprobantes".** Lista con estado de cada envío y asignación. Ataca la causa raíz de los reenvíos.

**Etapa 7 — Panel del tesorero.** Revisar asignaciones `pendiente_revision`, aprobar/rechazar, casilla de "autorizar pagos futuros".

**Etapa 8 — Pruebas.** Casos mínimos:
- Mismo archivo subido dos veces → bloqueado con mensaje claro.
- Misma transferencia, captura distinta → detectada por banco + nº.
- Solo cambia la observación → detectado como duplicado.
- Pablo reparte $360.000 entre 4 → 2 automáticas (él + menores), esposa en revisión (o automática si ya es pagador autorizado).
- Esposa sube el mismo comprobante después → mensaje "ya cubre tu cuota".
- Reparto que excede el monto → rechazado.
- Dos envíos simultáneos sobre el mismo saldo → solo uno pasa.
- Hijo que cumplió 18 → cae en revisión.

---

## 8. Estrategia de ramas (a confirmar con Mario)

Propuesta: diseñar el módulo de forma neutra en `v1.3-dev`, validar en devnexo e integrarlo luego a `cliente/calamena` sin pisar personalizaciones de Calameña. Confirmar con Mario antes de empezar, ya que el portal de socios afectado vive en `cliente/calamena`.

---

## 9. Fase 2 (futuro, fuera de alcance)

IA con visión para **leer** el comprobante (monto, fecha, nº, banco, emisor) y precargar el formulario o detectar inconsistencias con lo declarado. La IA **no decide** duplicados ni aprueba pagos. Considerar que los comprobantes contienen RUT y datos bancarios (Ley 21.719 de protección de datos personales, Chile): informar en el portal antes de enviarlos a una API externa.

---

## 10. Preguntas abiertas
- Nombres reales de tablas y columnas; cómo se modela hoy la deuda/cuota.
- ¿Se guarda fecha de nacimiento o un indicador de menor de edad?
- ¿El formulario actual pide banco y nº de transacción, o solo la imagen?
- Rama definitiva de trabajo (sección 8).
