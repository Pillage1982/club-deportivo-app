# Carta de permiso para el colegio — especificación (cliente/calamena)

Estado: **implementado en `cliente/calamena` (21-10-2026)**, pendiente de probar en dev.gdcayquina.cl.

Mockup: https://claude.ai/artifact/DjMt2ADz5mZHgcHaCZWu6j (copia local: `mockup_carta_permiso.html`)

## Alcance
- Solo para **integrantes que estudian** (colegio). La versión para trabajadores se descartó.
- Uso: permiso para la Fiesta de la Virgen de Guadalupe de Ayquina (septiembre).

## Archivos en esta carpeta
| Archivo | Qué es | En git |
|---|---|---|
| `carta_original_2023.pdf` | Carta oficial de 2023 (fuente del texto) | No (datos de un menor) |
| `firma_presidente.png` | Firma de Jorge Luis Montalbán Cofre, fondo transparente, 407×199 | No (firma real) |
| `timbre_gdc.png` | Timbre extraído del PDF original, fondo transparente, 140×152 (baja resolución) | Sí |
| `mockup_carta_permiso.html` | Mockup aprobado (lleva la firma embebida) | No |

Exclusiones en `.git/info/exclude` (local). En el servidor, la firma va en `UPLOADS_DIR`, fuera de la app.

## Texto (calcado del original, "eso es ley"; solo cambian los datos entre corchetes)

> BAILE RELIGIOSO / GRAN DIABLADA CALAMEÑA / www.grandiabladacalameña.cl
>
> Calama, [mes] del [año]
>
> **Señor(a):**
> **[Nombre del director/a]**
> **[Colegio]**
> **Presente**.
>
> **Referencia: Solicita autorización a persona que Indica.**
>
> De nuestra consideración:
>
> El baile religioso Gran Diablada Calameña, es devoto de la Virgen Guadalupe de Ayquina desde hace más de [N años] años y está integrado actualmente por [N integrantes] personas; quienes participan todos los años en la celebración que se hace en este poblado en el mes de septiembre.
>
> Es por esta razón, que solicitamos respetuosamente, autorizar un permiso entre los días [dd al dd de mes del aaaa], a **[Nombre del alumno]**, Rut:**[RUT]** del **[Curso]**, integrante activo de nuestra Institución para que exprese su fe en la Fiesta de nuestra Señora Virgen de Guadalupe en el Santuario de Ayquina.
>
> Esperando una buena acogida a la presente, nos despedimos cordialmente,
>
> [timbre] [firma] **Jorge Luis Montalbán Cofre** / **Presidente**

### Datos calculados
- **Años:** años cumplidos desde la fundación (22-10-1961) a la fecha de la carta. Se mantiene "más de".
- **Integrantes:** `COUNT` de personas con estado `activo` al emitir la carta (sin receso ni inactivos).

## Estilo (el del mockup, aprobado por el cliente)
- Membrete con logo y línea café, tipografía serif, firma en tinta azul, timbre al lado.
- Folio N° arriba a la derecha y QR de verificación al pie (agregados por estilo, no estaban en el original).
- **PDF tamaño carta** (21,59 × 27,94 cm, 612 × 792 pt), una página, márgenes 3 cm laterales y 2,5 cm arriba/abajo. No A4.

## Flujo
1. El apoderado la solicita en Portal → Documentos: alumno (hijos a su cargo, una carta por alumno), colegio, nombre del director/a, curso, fechas desde/hasta.
2. Aviso a la directiva por correo. Aparece en Tablas para revisión.
3. Aprueban roles `admin` y `secretaria` (o rechazan con motivo).
4. Al aprobar: folio, PDF con firma y timbre, envío por correo al apoderado y descarga en el Portal.
5. QR → página pública de verificación (folio, alumno, fechas).

## Decisiones (21-10-2026)
- Se pide desde la **cuenta del alumno** (no hay vínculo apoderado → hijos en el sistema).
- Aviso a **secretaria@gdcayquina.cl con copia a presidencia@gdcayquina.cl** (`EMAIL_SECRETARIA`, `EMAIL_PRESIDENCIA`).
- PDF **en el servidor** con pdfkit; se adjunta en el correo al aprobar.
- Es para estudiantes (no para trabajo). El formulario dice "Colegio o establecimiento" y "Curso"; el texto de la carta no cambia.
- Verificación por **código de 8 caracteres** (no por folio, para no exponer datos de menores recorriendo folios).

## Despliegue
- Subir `firma_presidente.png` a `<UPLOADS_DIR>/firmas/` en dev y en producción (no va en el zip).
- `npm install` instala pdfkit y qrcode (package.json de la raíz).

## Pendiente
- Timbre en mejor resolución (opcional): timbrar una hoja blanca y escanear.
