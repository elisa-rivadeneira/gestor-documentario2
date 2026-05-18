# Manual de desarrollador — Agregar o quitar columnas en Seguimiento

## Mapa completo de archivos a tocar

Cuando se agrega o quita una columna de la tabla de seguimiento, hay **6 archivos** y **1 tabla de BD** que deben actualizarse. Si se omite alguno, algo falla silenciosamente.

```
backend/models.py          ← definición del campo en SQLAlchemy
backend/main.py            ← 6 secciones distintas (ver abajo)
backend/schemas.py         ← response schema del GET /api/seguimiento
frontend/js/app.js         ← 2 constantes JS
correspondencia.db         ← migración ALTER TABLE + config JSON guardada
```

---

## PASO 1 — `backend/models.py`

Agregar el campo en la clase `SeguimientoComisaria`, en el bloque que corresponda:

```python
# 1. Acta de Conformidad
acta_fecha_firma     = Column(DateTime, nullable=True)
acta_presentado_ne   = Column(String(5), nullable=True)   # ← ejemplo
acta_revisada        = Column(String(5), nullable=True)
acta_remitida_ugpe   = Column(String(5), nullable=True)
```

Tipos válidos: `String(5)` para SI/NO/NA/-, `DateTime` para fechas, `Float` para montos, `Boolean` para merge.

---

## PASO 2 — `backend/main.py` (6 secciones)

### 2a. `migrar_seguimiento()` (~línea 185)
Agregar la columna al loop de migraciones para que SQLite la cree si no existe:

```python
('acta_presentado_ne', 'TEXT'),
```

### 2b. `migrar_columnas_config_db()` (~línea 216)
Agregar un bloque que inserte la columna en la config guardada en BD, indicando **antes de qué campo** va:

```python
campos = [c['campo'] for c in cols]
if 'acta_presentado_ne' not in campos:
    new_col = {"campo":"acta_presentado_ne","label":"PRESENTADO\nAL NE",
               "grupo":"ACTA DE CONFORMIDAD","badge":"1","css_grupo":"seg-th-acta",
               "visible":True,"ancho":54,"tipo":"siono"}
    for i, col in enumerate(cols):
        if col['campo'] == 'acta_revisada':       # insertar ANTES de este
            cols.insert(i, new_col)
            break
    else:
        cols.append(new_col)
    changed = True
```

Para **quitar** una columna de la config guardada, hacer directamente en BD (ver Paso 5).

### 2c. `CAMPOS_SIONO` (~línea 2336)
Si la columna es de tipo SI/NO, agregarla al set:

```python
CAMPOS_SIONO = {
    'acta_presentado_ne', 'acta_revisada', 'acta_remitida_ugpe',
    ...
}
```

### 2d. `DEFAULT_COLS_CONFIG` (~línea 2570)
Agregar la entrada con todos sus atributos. El `orden` es solo un índice relativo; se renumera automáticamente:

```python
{"campo":"acta_presentado_ne","label":"PRESENTADO\nAL NE",
 "grupo":"ACTA DE CONFORMIDAD","badge":"1","css_grupo":"seg-th-acta",
 "visible":True,"ancho":54,"tipo":"siono","orden":1},
```

Para **quitar**: simplemente eliminar esa línea.

### 2e. Excel — `exportar_seguimiento_excel()` (~línea 2345)

Esta sección es la más compleja. La tabla Excel tiene columnas fijas al inicio y columnas dinámicas. El mapa actual es:

```
Col  A  : N°
Col  B  : Comisaría
Col  C  : Avance programado
Col  D  : Avance físico
Col  E  : Fecha fin contractual
Col  F  : acta_fecha_firma          (fija, especial fecha)
Col  G  : acta_presentado_ne  ┐
Col  H  : acta_revisada        │ ACTA (F2:I2)
Col  I  : acta_remitida_ugpe  ┘
Col  J  : mod_presentado_ne   ┐ MOD (J2:K2)
Col  K  : mod_revisado_aprobado┘
Col  L  : amp_presentado_ne   ┐
Col  M  : amp_revisado_aprobado│ AMP (L2:O2)
Col  N  : amp_opinion_legal    │
Col  O  : amp_adenda_firmada  ┘
Col  P  : dossier_presentado_ne    ┐
Col  Q  : dossier_revisado_aprobado│
Col  R  : dossier_remitido_ugpe    │ DOSSIER (P2:T2)
Col  S  : dossier_remitido_pago    │
Col  T  : dossier_monto_pagado     ┘  ← especial (número, no en campos_siono)
Col  U  : liq_presentado_ne   ┐ LIQ (U2:V2)
Col  V  : liq_revisado_aprobado┘
Col  W  : OBSERVACIONES             ← encabezado y datos en la MISMA columna (W)
```

**Cuando se agrega/quita una columna, actualizar en orden:**

1. **`grupos`** — las letras de inicio/fin de cada bloque afectado
2. **`ws.merge_cells("W2:W3")`** — si OBSERVACIONES se desplaza, cambiar la letra
3. **`sub_hdrs`** — agregar/quitar el sub-encabezado de la nueva columna; ajustar letras de los que siguen
4. **`campos_siono`** (lista, ~línea 2463) — agregar/quitar el campo; **el orden de esta lista define directamente las columnas del Excel** (empieza en col G=7)
5. **Condición de salto del monto** (`if col >= N`) — el número N es la posición (sin shift) del primer campo de liq. Actualmente `>= 20` porque liq empieza en col 20 antes del shift, dejando col 20 para monto
6. **`cell(20)` para monto** — si el bloque dossier cambia de tamaño, actualizar el número de columna del monto
7. **`cell(23)` para observaciones** — debe coincidir con la letra W del encabezado. Actualmente W = col 23
8. **`range(1, 24)`** (dos veces: datos y total_row) — debe cubrir hasta la columna de observaciones inclusive
9. **`col_widths`** — agregar/quitar entradas. Observaciones siempre tiene ancho 22

**Regla de verificación rápida:**
```
col de observaciones = 6 (fija) + len(campos_siono) + 1 (salto monto) - (campos antes del salto)
```
Más simple: después de editar, ejecutar:
```bash
curl -s http://localhost:8000/api/seguimiento/exportar-excel -o test.xlsx
python -c "
import openpyxl, sys; sys.stdout.reconfigure(encoding='utf-8')
wb = openpyxl.load_workbook('test.xlsx'); ws = wb.active
for r in ws.iter_rows():
    for c in r:
        if c.value and 'obs' in str(c.value).lower():
            print(f'Fila {c.row}, col {c.column} ({chr(64+c.column)}): {c.value!r}')
"
```
El encabezado OBSERVACIONES y los datos deben estar en la **misma columna**.

---

## PASO 3 — `backend/schemas.py`

Agregar el campo en `SeguimientoComisariaResponse`. **Si se omite este paso, el GET devuelve los datos sin el campo y el frontend no puede leerlo ni guardarlo.**

```python
class SeguimientoComisariaResponse(BaseModel):
    ...
    acta_presentado_ne: Optional[str] = None   # ← agregar
    acta_revisada: Optional[str] = None
    ...
```

Para **quitar**: eliminar la línea (FastAPI simplemente no devuelve el campo).

---

## PASO 4 — `frontend/js/app.js`

Dos constantes cerca de la línea 3620:

```javascript
const CAMPOS_SIONO = new Set([
    'acta_presentado_ne',   // ← agregar
    'acta_revisada', 'acta_remitida_ugpe',
    ...
]);

const LABELS_CAMPO = {
    acta_presentado_ne: 'Acta: Presentado al NE',   // ← agregar
    acta_revisada: 'Acta: Revisada y aprobada',
    ...
};
```

Para **quitar**: eliminar de ambas constantes.

---

## PASO 5 — Base de datos (`correspondencia.db`)

### 5a. Agregar columna física en SQLite
El servidor la agrega automáticamente al reiniciar si se agregó en `migrar_seguimiento()`. Si el servidor no reinicia limpio, hacerlo manualmente:

```bash
python -c "
import sqlite3
conn = sqlite3.connect('correspondencia.db')
cols = [r[1] for r in conn.execute('PRAGMA table_info(seguimiento_comisaria)').fetchall()]
if 'acta_presentado_ne' not in cols:
    conn.execute('ALTER TABLE seguimiento_comisaria ADD COLUMN acta_presentado_ne TEXT')
    conn.commit()
    print('OK')
conn.close()
"
```

### 5b. Actualizar la config guardada en BD
La tabla `configuracion_sistema` guarda la config de columnas como JSON. `migrar_columnas_config_db()` la actualiza al reiniciar. Para hacerlo manualmente (agregar):

```bash
python -c "
import sqlite3, json
conn = sqlite3.connect('correspondencia.db')
row = conn.execute(\"SELECT valor FROM configuracion_sistema WHERE clave='seguimiento_columnas_config'\").fetchone()
if row:
    cols = json.loads(row[0])
    if 'acta_presentado_ne' not in [c['campo'] for c in cols]:
        new_col = {'campo':'acta_presentado_ne','label':'PRESENTADO\nAL NE',
                   'grupo':'ACTA DE CONFORMIDAD','badge':'1','css_grupo':'seg-th-acta',
                   'visible':True,'ancho':54,'tipo':'siono'}
        for i, col in enumerate(cols):
            if col['campo'] == 'acta_revisada':
                cols.insert(i, new_col)
                break
        for idx, col in enumerate(cols): col['orden'] = idx
        conn.execute(\"UPDATE configuracion_sistema SET valor=? WHERE clave='seguimiento_columnas_config'\", [json.dumps(cols)])
        conn.commit()
        print('OK')
conn.close()
"
```

Para **quitar** un campo de la config guardada:

```bash
python -c "
import sqlite3, json
conn = sqlite3.connect('correspondencia.db')
row = conn.execute(\"SELECT valor FROM configuracion_sistema WHERE clave='seguimiento_columnas_config'\").fetchone()
cols = json.loads(row[0])
cols = [c for c in cols if c['campo'] != 'liq_remitido_pago']   # ← cambiar campo
for idx, col in enumerate(cols): col['orden'] = idx
conn.execute(\"UPDATE configuracion_sistema SET valor=? WHERE clave='seguimiento_columnas_config'\", [json.dumps(cols)])
conn.commit()
conn.close()
print('OK')
"
```

---

## PASO 6 — Reiniciar el servidor (IMPORTANTE)

El servidor con `--reload` **no detecta los cambios de los archivos editados por Claude Code**. Hay que matarlo y reiniciarlo manualmente cada vez.

```powershell
# Ver procesos Python activos
cmd /c "tasklist | findstr /i python"

# Matar por PID (reemplazar con los PIDs que aparezcan)
cmd /c "taskkill /F /PID 12345 /PID 67890"

# Verificar que el puerto quedó libre
netstat -ano | Select-String "8000.*LISTEN"
```

Luego reiniciar desde la carpeta `backend/`:
```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

---

## Checklist rápido — Agregar columna

```
[ ] models.py         → Column(String(5), nullable=True)
[ ] main.py §migrar   → ('nuevo_campo', 'TEXT')
[ ] main.py §config   → bloque de inserción en migrar_columnas_config_db()
[ ] main.py §SIONO    → agregar al set CAMPOS_SIONO
[ ] main.py §DEFAULT  → entrada en DEFAULT_COLS_CONFIG
[ ] main.py §Excel    → grupos, sub_hdrs, campos_siono, col numbers
[ ] schemas.py        → campo en SeguimientoComisariaResponse
[ ] app.js            → CAMPOS_SIONO + LABELS_CAMPO
[ ] DB manual         → ALTER TABLE + UPDATE config JSON (si server no reinicia)
[ ] Reiniciar server  → tasklist → taskkill → uvicorn
[ ] Verificar Excel   → encabezado y datos de OBSERVACIONES en misma columna
[ ] Verificar API     → curl GET /api/seguimiento → campo aparece en JSON
[ ] Verificar guardado→ curl PUT /api/seguimiento/{id}/celda → {"ok":true}
```

## Checklist rápido — Quitar columna

```
[ ] main.py §DEFAULT  → eliminar entrada de DEFAULT_COLS_CONFIG
[ ] main.py §SIONO    → quitar del set CAMPOS_SIONO (si aplica)
[ ] main.py §Excel    → grupos, sub_hdrs, campos_siono, col numbers
[ ] schemas.py        → quitar campo de SeguimientoComisariaResponse
[ ] app.js            → quitar de CAMPOS_SIONO + LABELS_CAMPO
[ ] DB manual         → UPDATE config JSON para quitar el campo
[ ] Reiniciar server
[ ] Verificar Excel   → encabezado y datos de OBSERVACIONES en misma columna
```

> **Nota:** No se elimina la columna física de SQLite (no soporta DROP COLUMN fácilmente). Solo se oculta/elimina de la config. El dato sigue en BD pero no se muestra ni se guarda desde la UI.
