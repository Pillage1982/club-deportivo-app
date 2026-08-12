from pathlib import Path
import sys

source = Path(sys.argv[1] if len(sys.argv)>1 else "output/database/u193403304_club_dev_actualizada_2026-08-12.sql")
target = Path(sys.argv[2] if len(sys.argv)>2 else "output/database/ACTUALIZAR_BD_EXISTENTE_GDC_2026-08-12.sql")
marker = "-- ===== ACTUALIZACION CONSOLIDADA ====="
text = source.read_text(encoding="utf-8")
if marker not in text:
    raise SystemExit("No se encontro el marcador de actualizacion consolidada")
patch = text.split(marker, 1)[1].lstrip()
target.write_text(
    "-- IMPORTAR SOBRE LA BASE EXISTENTE u193403304_club_dev\n"
    "-- No recrea las tablas principales. Incluye respaldos antes de modificar.\n\n"
    + patch,
    encoding="utf-8",
    newline="\n",
)
print(target.resolve())
