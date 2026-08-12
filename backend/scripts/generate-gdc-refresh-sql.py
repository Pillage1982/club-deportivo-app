import collections
import datetime as dt
import hashlib
import json
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
      "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships"}
PERIODS = [(2025,10),(2025,11),(2025,12),(2026,1),(2026,2),(2026,3),(2026,4),(2026,5),(2026,6),(2026,7)]
COLS = list("OPQRSTUVWX")

def norm_rut(value):
    raw = re.sub(r"[^0-9Kk]", "", str(value or "")).upper()
    return raw[:-1] + "-" + raw[-1] if len(raw) >= 2 else ""

def valid_rut(rut):
    raw = re.sub(r"[^0-9K]", "", rut.upper())
    if len(raw) < 2 or not raw[:-1].isdigit(): return False
    total, factor = 0, 2
    for ch in reversed(raw[:-1]):
        total += int(ch) * factor; factor = factor + 1 if factor < 7 else 2
    dv = 11 - total % 11
    return raw[-1] == ("0" if dv == 11 else "K" if dv == 10 else str(dv))

def plain(value):
    import unicodedata
    value = unicodedata.normalize("NFD", str(value or ""))
    return re.sub(r"[^a-z0-9]+", " ", "".join(c for c in value if not unicodedata.combining(c)).lower()).strip()

def levenshtein(a,b):
    prev=list(range(len(b)+1))
    for i,ca in enumerate(a,1):
        cur=[i]
        for j,cb in enumerate(b,1): cur.append(min(cur[-1]+1,prev[j]+1,prev[j-1]+(ca!=cb)))
        prev=cur
    return prev[-1]

def excel_date(value):
    try: return (dt.datetime(1899,12,30)+dt.timedelta(days=float(value))).date()
    except Exception: return None

def workbook_rows(path):
    with zipfile.ZipFile(path) as z:
        shared=[]
        if "xl/sharedStrings.xml" in z.namelist():
            root=ET.fromstring(z.read("xl/sharedStrings.xml"))
            shared=["".join(t.text or "" for t in si.iterfind(".//m:t",NS)) for si in root.findall("m:si",NS)]
        wb=ET.fromstring(z.read("xl/workbook.xml")); rel=ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
        targets={x.attrib["Id"]:x.attrib["Target"] for x in rel}; out={}
        for sheet in wb.find("m:sheets",NS):
            target=targets[sheet.attrib["{%s}id"%NS["r"]]].lstrip("/")
            if not target.startswith("xl/"): target="xl/"+target
            root=ET.fromstring(z.read(target)); rows=[]
            for row in root.findall(".//m:sheetData/m:row",NS):
                item={}
                for c in row.findall("m:c",NS):
                    col=re.match(r"[A-Z]+",c.attrib.get("r","")).group(); typ=c.attrib.get("t")
                    v=c.find("m:v",NS); inline=c.find("m:is",NS); val=None
                    if typ=="s" and v is not None: val=shared[int(v.text)]
                    elif typ=="inlineStr" and inline is not None: val="".join(t.text or "" for t in inline.iterfind(".//m:t",NS))
                    elif v is not None: val=v.text
                    item[col]=val
                rows.append(item)
            out[sheet.attrib["name"]]=rows
        return out

def sql_people(path):
    text=Path(path).read_text(encoding="utf-8",errors="replace")
    start=text.index("INSERT INTO `personas`")
    end=text.index(";",start)
    # Include every split INSERT block for personas.
    blocks=re.findall(r"INSERT INTO `personas`[^;]+;",text,re.S)
    people={}; duplicate_db=[]
    for block in blocks:
        for match in re.finditer(r"\((\d+),\s*(NULL|'(?:''|\\'|[^'])*'),\s*'((?:''|\\'|[^'])*)',\s*'((?:''|\\'|[^'])*)',\s*(NULL|'(?:''|\\'|[^'])*')",block):
            pid=int(match.group(1)); rut_token=match.group(2); rut=norm_rut(None if rut_token=="NULL" else rut_token[1:-1])
            if not rut: continue
            maternal="" if match.group(5)=="NULL" else match.group(5)[1:-1]
            name=plain(match.group(3)+" "+match.group(4)+" "+maternal)
            if rut in people: duplicate_db.append(rut)
            people[rut]={"id":pid,"name":name}
    return people,sorted(set(duplicate_db))

def esc(value): return "'"+str(value).replace("\\","\\\\").replace("'","''")+"'"
def values(rows): return ",\n".join("("+",".join("NULL" if v is None else str(v) if isinstance(v,(int,float)) else esc(v) for v in row)+")" for row in rows)

def main(finance_path,attendance_path,dump_path,output_path,report_path):
    people,db_dupes=sql_people(dump_path); fin=workbook_rows(finance_path)["Data"][2:]
    finance=[]
    for source_row,row in enumerate(fin,start=3):
        rut=norm_rut(row.get("A"));
        if not rut: continue
        payments=[]
        for col,period in zip(COLS,PERIODS):
            try: amount=int(round(float(row.get(col) or 0)))
            except Exception: amount=0
            if amount>0: payments.append((period,amount,col))
        finance.append({"row":source_row,"rut":rut,"name":" ".join(filter(None,[str(row.get('B') or '').strip(),str(row.get('C') or '').strip()])),
                        "status":plain(row.get("K")),"payments":payments})
    fin_counts=collections.Counter(x["rut"] for x in finance)
    ambiguous={rut for rut,n in fin_counts.items() if n>1}
    eligible=[x for x in finance if x["status"]=="activo" and x["rut"] in people and x["rut"] not in ambiguous]

    payment_rows=[]; allocation_rows=[]; score_rows=[]; paid_through={}
    for member in eligible:
        quotas=[{"period":p,"remaining":12000,"parts":[]} for p in PERIODS]
        for period,amount,col in member["payments"]:
            ref=hashlib.sha256(f"gdc-refresh-2026|{member['rut']}|{period[0]}-{period[1]:02}|{member['row']}|{amount}".encode()).hexdigest()
            payment_rows.append((member["rut"],period[0],period[1],amount,ref,member["row"],col))
            available=amount
            for quota in quotas:
                if available<=0: break
                if quota["remaining"]<=0: continue
                assigned=min(available,quota["remaining"]); quota["remaining"]-=assigned; available-=assigned
                quota["parts"].append((period,assigned,ref))
                allocation_rows.append((member["rut"],ref,quota["period"][0],quota["period"][1],assigned))
        completion={}
        for quota in quotas:
            if quota["remaining"]>0: continue
            completed=quota["parts"][-1][0]; completion[quota["period"]]=completed
            score_rows.append([member["rut"],quota["period"][0],quota["period"][1],10,f"Cuota {quota['period'][1]:02}/{quota['period'][0]} pagada",completed[0],completed[1]])
        # Art. 9.3: la bonificacion nace del esfuerzo adicional dentro de una
        # operacion mensual. Un pago unitario posterior vale 10 puntos normales,
        # aunque exista credito acumulado; solo las cuotas adicionales incluidas
        # en la misma operacion reciben 10 puntos extra cada una.
        completed_rows=[row for row in score_rows if row[0]==member["rut"]]
        bonus_periods=set()
        for payment_period,amount,_ in member["payments"]:
            if amount<=12000: continue
            candidates=[q["period"] for q in quotas if q["remaining"]==0 and q["parts"][-1][0]==payment_period and q["period"]>payment_period]
            bonus_periods.update(candidates[:max(0,(amount//12000)-1)])
        for row in completed_rows:
            if (row[1],row[2]) in bonus_periods:
                row[3]=20; row[4]+=" + bonificacion por pago conjunto anticipado (art. 9.3)"
        annual_october=any(period==(2025,10) and amount>=120000 for period,amount,_ in member["payments"]) and len(completed_rows)==10
        if annual_october:
            for row in completed_rows:
                if (row[1],row[2])==(2025,10):
                    row[3]=20; row[4]="Cuota 10/2025 + bonificacion escenario anual al inicio (art. 9.3)"
        paid_through[member["rut"]]=completion

    att=workbook_rows(attendance_path)
    corrected=[]; unresolved=[]; marks=[]
    finance_by_name=collections.defaultdict(list)
    for member in eligible: finance_by_name[plain(member["name"])].append(member["rut"])
    db_by_name=collections.defaultdict(list)
    for rut,profile in people.items(): db_by_name[profile["name"]].append(rut)
    att_rows=att["Asistencias"][1:]
    export_format=bool(att_rows and "E" in att_rows[0] and "Actividad" in str(att["Asistencias"][0].get("C") or ""))
    if export_format:
        headers={plain(value):col for col,value in att["Asistencias"][0].items() if value}
        rut_col=next((col for label,col in headers.items() if label in ("rut","rut integrante","codigo")),None)
        for source_row,row in enumerate(att_rows,start=2):
            try: date=dt.date.fromisoformat(str(row.get("E") or "")[:10])
            except Exception: continue
            if not(dt.date(2025,10,10)<=date<=dt.date(2026,7,31)): continue
            raw_rut=norm_rut(row.get(rut_col)) if rut_col else ""
            if raw_rut and valid_rut(raw_rut) and raw_rut in people:
                candidates=[raw_rut]
            else:
                name=plain(row.get("A")); candidates=finance_by_name.get(name,[]) or db_by_name.get(name,[])
                if len(candidates)!=1:
                    near=[rut for rut,profile in people.items() if levenshtein(name,profile["name"])<=2]
                    if len(near)==1: candidates=near; corrected.append((source_row,str(row.get("A") or ""),near[0]))
            if len(candidates)!=1:
                unresolved.append((source_row,str(row.get("A") or ""),date.isoformat())); continue
            activity=str(row.get("C") or f"Actividad {date.isoformat()}").strip()
            marks.append((candidates[0],date,activity,source_row,"nombre_finanzas"))
    else:
        directory={norm_rut(r.get("A")):plain(str(r.get("B") or "")+" "+str(r.get("C") or "")) for r in att["DATOS"] if norm_rut(r.get("A"))}
        profiles={rut:{people[rut]["name"],directory.get(rut,"")} for rut in people}
        for source_row,row in enumerate(att_rows,start=2):
            date=excel_date(row.get("B"))
            if not date or not(dt.date(2025,10,10)<=date<=dt.date(2026,7,31)): continue
            raw=norm_rut(row.get("A")); rut=raw if raw in people else None; reason="exacto"
            if not rut:
                compact=re.sub(r"[^0-9K]","",raw); candidates=[x for x in people if levenshtein(compact,re.sub(r"[^0-9K]","",x))<=1]
                name=directory.get(raw,"")
                if len(candidates)!=1 and name: candidates=[x for x,names in profiles.items() if name in names]
                if len(candidates)==1: rut=candidates[0]; reason="corregido_por_cruce"; corrected.append((source_row,raw,rut))
            if not rut: unresolved.append((source_row,raw,date.isoformat())); continue
            marks.append((rut,date,f"Actividad {date.isoformat()}",source_row,reason))
    # One attendance per RUT and distinct activity.
    unique={(m[0],m[2]):m for m in marks}; marks=list(unique.values())
    activities=sorted(set((m[2],m[1]) for m in marks),key=lambda x:(x[1],x[0]))
    per_date=collections.Counter(); event_times={}
    for item in activities:
        activity,date=item; event_times[item]=(dt.datetime.min+dt.timedelta(hours=12+per_date[date])).time().replace(microsecond=0); per_date[date]+=1
    attendance_rows=[]
    for rut,date,activity,source_row,reason in marks:
        target=(date.year,date.month); completion=paid_through.get(rut,{})
        due=[p for p in PERIODS if p<=target]
        al_dia=bool(due) and all(p in completion and completion[p]<=target for p in due)
        attendance_rows.append((rut,activity,date.isoformat(),event_times[(activity,date)].isoformat(),10 if al_dia else 5,"Presente + cuota al dia" if al_dia else "Presente sin cuota al dia",source_row))

    header="""-- ACTUALIZACION GDC 2025-2026 - generada desde fuentes entregadas el 12-08-2026
-- Reglas: Estatutos GDC 2016, articulos 8.1, 8.4, 9.2 y 9.3.
-- Ciclo financiero: octubre 2025 a julio 2026, 10 cuotas de $12.000.
-- Todas las fechas marcadas dentro del ciclo fueron declaradas puntuables por el usuario.
-- Cada RUT cuenta una sola vez por fecha y toda marcacion se interpreta como presente.
SET NAMES utf8mb4;
SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';

CREATE TABLE IF NOT EXISTS respaldo_gdc_20260812_personas LIKE personas;
CREATE TABLE IF NOT EXISTS respaldo_gdc_20260812_eventos LIKE eventos;
CREATE TABLE IF NOT EXISTS respaldo_gdc_20260812_asistencias LIKE asistencias;
CREATE TABLE IF NOT EXISTS respaldo_gdc_20260812_cuotas LIKE cuotas;
CREATE TABLE IF NOT EXISTS respaldo_gdc_20260812_pagos LIKE pagos;
CREATE TABLE IF NOT EXISTS respaldo_gdc_20260812_pago_detalle LIKE pago_detalle;
CREATE TABLE IF NOT EXISTS respaldo_gdc_20260812_puntajes LIKE puntajes;
INSERT IGNORE INTO respaldo_gdc_20260812_personas SELECT * FROM personas;
INSERT IGNORE INTO respaldo_gdc_20260812_eventos SELECT * FROM eventos;
INSERT IGNORE INTO respaldo_gdc_20260812_asistencias SELECT * FROM asistencias;
INSERT IGNORE INTO respaldo_gdc_20260812_cuotas SELECT * FROM cuotas;
INSERT IGNORE INTO respaldo_gdc_20260812_pagos SELECT * FROM pagos;
INSERT IGNORE INTO respaldo_gdc_20260812_pago_detalle SELECT * FROM pago_detalle;
INSERT IGNORE INTO respaldo_gdc_20260812_puntajes SELECT * FROM puntajes;

START TRANSACTION;
"""
    sql=[header]
    sql.append("CREATE TEMPORARY TABLE src_gdc_personas (rut VARCHAR(20) PRIMARY KEY) ENGINE=InnoDB;\nINSERT INTO src_gdc_personas VALUES\n"+values([(x["rut"],) for x in eligible])+";\n")
    sql.append("CREATE TEMPORARY TABLE src_gdc_pagos (rut VARCHAR(20), anio INT, mes INT, monto INT, ref CHAR(64) PRIMARY KEY, fila INT, columna VARCHAR(3)) ENGINE=InnoDB;\n"+("INSERT INTO src_gdc_pagos VALUES\n"+values(payment_rows)+";\n" if payment_rows else ""))
    sql.append("CREATE TEMPORARY TABLE src_gdc_asignaciones (rut VARCHAR(20), ref CHAR(64), anio INT, mes INT, monto INT) ENGINE=InnoDB;\n"+("INSERT INTO src_gdc_asignaciones VALUES\n"+values(allocation_rows)+";\n" if allocation_rows else ""))
    sql.append("CREATE TEMPORARY TABLE src_gdc_puntaje_cuota (rut VARCHAR(20), anio INT, mes INT, puntos INT, detalle VARCHAR(200), pago_anio INT, pago_mes INT) ENGINE=InnoDB;\n"+("INSERT INTO src_gdc_puntaje_cuota VALUES\n"+values(score_rows)+";\n" if score_rows else ""))
    sql.append("CREATE TEMPORARY TABLE src_gdc_eventos (actividad VARCHAR(100) PRIMARY KEY, fecha DATE, hora TIME) ENGINE=InnoDB;\nINSERT INTO src_gdc_eventos VALUES\n"+values([(a,d.isoformat(),event_times[(a,d)].isoformat()) for a,d in activities])+";\n")
    sql.append("CREATE TEMPORARY TABLE src_gdc_asistencias (rut VARCHAR(20), actividad VARCHAR(100), fecha DATE, hora TIME, puntos INT, detalle VARCHAR(200), fila INT, PRIMARY KEY(rut,actividad)) ENGINE=InnoDB;\nINSERT INTO src_gdc_asistencias VALUES\n"+values(attendance_rows)+";\n")
    sql.append("""
DELETE pt FROM puntajes pt JOIN cuotas c ON c.id=pt.cuota_id
WHERE (c.anio=2025 AND c.mes BETWEEN 10 AND 12) OR (c.anio=2026 AND c.mes BETWEEN 1 AND 9);
DELETE pd FROM pago_detalle pd JOIN cuotas c ON pd.tipo='cuota' AND pd.referencia_id=c.id
WHERE (c.anio=2025 AND c.mes BETWEEN 10 AND 12) OR (c.anio=2026 AND c.mes BETWEEN 1 AND 9);
DELETE FROM pagos WHERE metodo='migracion' AND referencia_externa IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pago_detalle d WHERE d.pago_id=pagos.id);
DELETE FROM cuotas WHERE (anio=2025 AND mes BETWEEN 10 AND 12) OR (anio=2026 AND mes BETWEEN 1 AND 9);
DELETE pt FROM puntajes pt JOIN asistencias a ON a.id=pt.asistencia_id JOIN eventos e ON e.id=a.evento_id
WHERE DATE(e.fecha) BETWEEN '2025-10-10' AND '2026-07-31' AND e.nombre LIKE 'Actividad %';
DELETE a FROM asistencias a JOIN eventos e ON e.id=a.evento_id
WHERE DATE(e.fecha) BETWEEN '2025-10-10' AND '2026-07-31' AND e.nombre LIKE 'Actividad %';
DELETE FROM eventos WHERE DATE(fecha) BETWEEN '2025-10-10' AND '2026-07-31' AND nombre LIKE 'Actividad %';

UPDATE tipos_cuotas SET monto_base=12000, descripcion='Cuota mensual GDC' WHERE nombre='Mensualidad';
SET @tipo_mensualidad=(SELECT id FROM tipos_cuotas WHERE nombre='Mensualidad' ORDER BY id LIMIT 1);
CREATE TEMPORARY TABLE src_gdc_periodos (anio INT, mes INT, vencimiento DATE, PRIMARY KEY(anio,mes));
INSERT INTO src_gdc_periodos VALUES (2025,10,'2025-10-28'),(2025,11,'2025-11-28'),(2025,12,'2025-12-28'),(2026,1,'2026-01-28'),(2026,2,'2026-02-28'),(2026,3,'2026-03-28'),(2026,4,'2026-04-28'),(2026,5,'2026-05-28'),(2026,6,'2026-06-28'),(2026,7,'2026-07-28');
INSERT INTO cuotas (persona_id,tipo_cuota_id,monto,mes,anio,fecha_vencimiento,estado,origen)
SELECT p.id,@tipo_mensualidad,12000,s.mes,s.anio,s.vencimiento,'pendiente','externo'
FROM src_gdc_personas x JOIN personas p ON UPPER(TRIM(p.rut))=x.rut CROSS JOIN src_gdc_periodos s;
INSERT INTO pagos (persona_id,monto_total,metodo,fecha,referencia_externa,fecha_precision)
SELECT p.id,s.monto,'migracion',STR_TO_DATE(CONCAT(s.anio,'-',LPAD(s.mes,2,'0'),'-01'),'%Y-%m-%d'),s.ref,'mensual'
FROM src_gdc_pagos s JOIN personas p ON UPPER(TRIM(p.rut))=s.rut;
INSERT INTO pago_detalle (pago_id,tipo,referencia_id,monto_pagado)
SELECT pg.id,'cuota',c.id,a.monto FROM src_gdc_asignaciones a
JOIN personas p ON UPPER(TRIM(p.rut))=a.rut JOIN pagos pg ON pg.referencia_externa=a.ref
JOIN cuotas c ON c.persona_id=p.id AND c.anio=a.anio AND c.mes=a.mes AND c.tipo_cuota_id=@tipo_mensualidad;
UPDATE cuotas c LEFT JOIN (SELECT referencia_id,SUM(monto_pagado) pagado FROM pago_detalle WHERE tipo='cuota' GROUP BY referencia_id) d ON d.referencia_id=c.id
SET c.estado=CASE WHEN COALESCE(d.pagado,0)>=c.monto THEN 'pagado' WHEN c.fecha_vencimiento<'2026-08-12' THEN 'vencido' ELSE 'pendiente' END
WHERE c.tipo_cuota_id=@tipo_mensualidad AND ((c.anio=2025 AND c.mes BETWEEN 10 AND 12) OR (c.anio=2026 AND c.mes BETWEEN 1 AND 7));
INSERT INTO puntajes (persona_id,cuota_id,puntos,detalle,fecha)
SELECT p.id,c.id,s.puntos,s.detalle,STR_TO_DATE(CONCAT(s.pago_anio,'-',LPAD(s.pago_mes,2,'0'),'-01'),'%Y-%m-%d')
FROM src_gdc_puntaje_cuota s JOIN personas p ON UPPER(TRIM(p.rut))=s.rut
JOIN cuotas c ON c.persona_id=p.id AND c.anio=s.anio AND c.mes=s.mes AND c.tipo_cuota_id=@tipo_mensualidad
WHERE s.puntos<>0;

INSERT INTO eventos (nombre,tipo,fecha,descripcion,finalizado)
SELECT s.actividad,'reunion',TIMESTAMP(s.fecha,s.hora),'Actualizacion GDC 2025-2026; actividad declarada puntuable',1 FROM src_gdc_eventos s;
INSERT INTO asistencias (evento_id,persona_id,estado,minutos_atraso,fecha_registro)
SELECT e.id,p.id,'presente',0,TIMESTAMP(s.fecha,s.hora) FROM src_gdc_asistencias s
JOIN personas p ON UPPER(TRIM(p.rut))=s.rut JOIN eventos e ON e.nombre=s.actividad;
INSERT INTO puntajes (persona_id,asistencia_id,evento_id,puntos,detalle,fecha)
SELECT a.persona_id,a.id,a.evento_id,s.puntos,s.detalle,s.fecha FROM src_gdc_asistencias s
JOIN personas p ON UPPER(TRIM(p.rut))=s.rut JOIN eventos e ON e.nombre=s.actividad
JOIN asistencias a ON a.persona_id=p.id AND a.evento_id=e.id;

COMMIT;

SELECT 'eventos_temporada' control,COUNT(*) total FROM eventos WHERE descripcion='Actualizacion GDC 2025-2026; actividad declarada puntuable'
UNION ALL SELECT 'asistencias_temporada',COUNT(*) FROM asistencias a JOIN eventos e ON e.id=a.evento_id WHERE e.descripcion='Actualizacion GDC 2025-2026; actividad declarada puntuable'
UNION ALL SELECT 'cuotas_12000',COUNT(*) FROM cuotas WHERE monto=12000 AND ((anio=2025 AND mes BETWEEN 10 AND 12) OR (anio=2026 AND mes BETWEEN 1 AND 7))
UNION ALL SELECT 'pagos_importados',COUNT(*) FROM pagos WHERE metodo='migracion' AND referencia_externa IS NOT NULL
UNION ALL SELECT 'personas_con_200_financieros',COUNT(*) FROM (SELECT persona_id FROM puntajes WHERE cuota_id IS NOT NULL GROUP BY persona_id HAVING SUM(puntos)=200) x;
""")
    patch="\n".join(sql)
    original=Path(dump_path).read_text(encoding="utf-8",errors="replace")
    Path(output_path).parent.mkdir(parents=True,exist_ok=True)
    Path(output_path).write_text(original+"\n\n-- ===== ACTUALIZACION CONSOLIDADA =====\n"+patch,encoding="utf-8",newline="\n")
    report={"personas_sql":len(people),"duplicados_rut_sql":db_dupes,"filas_finanzas":len(finance),"ruts_finanzas_duplicados":sorted(ambiguous),
            "integrantes_financieros_importados":len(eligible),"pagos_importados":len(payment_rows),"monto_importado":sum(r[3] for r in payment_rows),
            "cuotas_asignadas":len(allocation_rows),"puntajes_cuota_positivos":sum(r[3]>0 for r in score_rows),
            "personas_200_financieros":sorted({r[0] for r in score_rows if sum(x[3] for x in score_rows if x[0]==r[0])==200}),
            "actividades_puntuables":[a for a,_ in activities],"marcaciones_temporada":len(marks),"asistencias_unicas":len(attendance_rows),
            "ruts_asistencia_corregidos":len(corrected),"marcaciones_no_resueltas":len(unresolved),"detalle_no_resueltas":unresolved,
            "ruts_finanzas_sin_persona_sql":sorted({x['rut'] for x in finance if x['rut'] not in people}),
            "ruts_invalidos_finanzas":sorted({x['rut'] for x in finance if not valid_rut(x['rut'])})}
    report["casos_control"]={rut:{"puntaje_cuotas":sum(r[3] for r in score_rows if r[0]==rut),
                                     "puntaje_asistencia":sum(r[4] for r in attendance_rows if r[0]==rut)}
                               for rut in ("18234880-5","16203401-4","9270984-1")}
    Path(report_path).write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
    print(json.dumps({k:v for k,v in report.items() if k not in ('detalle_no_resueltas',)},ensure_ascii=False,indent=2))

if __name__=="__main__":
    if len(sys.argv)!=6: raise SystemExit("uso: script finanzas.xlsx asistencia.xlsx dump.sql salida.sql reporte.json")
    main(*sys.argv[1:])
