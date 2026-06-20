/* ============================================================
   SYNC.JS — Lee el Excel local del profesor y lo sincroniza
   con Google Sheets a través de Apps Script
   ============================================================ */

let datosListos = null; // { alumnos: [[Grupo,Alumno],...], tr: [[...]] }

const inputExcel = document.getElementById('input-excel');
const btnSync = document.getElementById('btn-sincronizar');
const nombreArchivoEl = document.getElementById('nombre-archivo-excel');
const previewEl = document.getElementById('previsualizacion');
const resumenPreviewEl = document.getElementById('resumen-preview');
const estadoSyncEl = document.getElementById('estado-sync');

inputExcel.addEventListener('change', manejarArchivo);
btnSync.addEventListener('click', sincronizar);

function manejarArchivo(e) {
  const file = e.target.files[0];
  if (!file) return;
  nombreArchivoEl.textContent = file.name;

  const reader = new FileReader();
  reader.onload = (evt) => {
    try {
      const data = new Uint8Array(evt.target.result);
      const wb = XLSX.read(data, { type: 'array' });

      if (!wb.SheetNames.includes('TR')) {
        throw new Error('El Excel debe tener una hoja llamada "TR" con los trabajos por grupo.');
      }

      // ---- 1. Leer "TR": encabezado = nombre de cada grupo, filas = trabajos ----
      let tr = XLSX.utils.sheet_to_json(wb.Sheets['TR'], { header: 1, defval: '' });
      tr = recortarFilasVacias(tr);
      tr = normalizarMatriz(tr);

      const filaGrupos = tr[0] || [];
      const nombresGrupos = filaGrupos.map(g => String(g).trim()).filter(g => g !== '');
      if (nombresGrupos.length === 0) {
        throw new Error('No se encontraron nombres de grupo en la primera fila de la hoja "TR".');
      }

      // ---- 2. Para cada grupo, buscar su propia hoja (mismo nombre) y extraer alumnos ----
      const alumnos = [['Grupo', 'Alumno']];
      const avisos = [];

      nombresGrupos.forEach(grupo => {
        const sheetName = wb.SheetNames.find(n => n.trim() === grupo);
        if (!sheetName) { avisos.push(`"${grupo}": no existe una hoja con ese nombre`); return; }

        const filas = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '' });
        const ubic = ubicarColumnaNombre(filas);
        if (!ubic) { avisos.push(`"${grupo}": no se encontró una columna "NOMBRE"`); return; }

        let encontrados = 0;
        for (let r = ubic.fila + 1; r < filas.length; r++) {
          const valor = filas[r][ubic.col];
          if (valor === '' || valor === undefined || valor === null) break;
          alumnos.push([grupo, String(valor).trim()]);
          encontrados++;
        }
        if (encontrados === 0) avisos.push(`"${grupo}": no se detectaron alumnos`);
      });

      datosListos = { alumnos, tr };

      const totalAlumnos = alumnos.length - 1; // menos encabezado
      let resumen = `Se detectaron ${totalAlumnos} alumno(s) en ${nombresGrupos.length} grupo(s) (leídos directamente de sus hojas).`;
      if (avisos.length) resumen += ` Atención — ${avisos.join(' · ')}.`;

      resumenPreviewEl.textContent = resumen;
      previewEl.classList.remove('oculto');
      btnSync.disabled = totalAlumnos === 0;
      estadoSyncEl.classList.add('oculto');
    } catch (err) {
      alert('Error leyendo el Excel: ' + err.message);
      btnSync.disabled = true;
    }
  };
  reader.readAsArrayBuffer(file);
}

// Busca la celda "NOMBRE" (sin importar mayúsculas/acentos/espacios) en una matriz de filas
function ubicarColumnaNombre(filas) {
  for (let r = 0; r < filas.length; r++) {
    for (let c = 0; c < filas[r].length; c++) {
      const val = filas[r][c];
      if (typeof val === 'string' && quitarAcentos(val.trim().toUpperCase()) === 'NOMBRE') {
        return { fila: r, col: c };
      }
    }
  }
  return null;
}

function quitarAcentos(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Quita filas totalmente vacías al final de la matriz (por si TR trae filas de más)
function recortarFilasVacias(matriz) {
  let fin = matriz.length;
  while (fin > 0 && matriz[fin - 1].every(c => c === '' || c === undefined || c === null)) fin--;
  return matriz.slice(0, fin);
}

// Asegura que todas las filas tengan el mismo número de columnas
function normalizarMatriz(matriz) {
  const maxCols = Math.max(...matriz.map(f => f.length));
  return matriz.map(fila => {
    const nueva = fila.slice();
    while (nueva.length < maxCols) nueva.push('');
    return nueva;
  });
}

async function sincronizar() {
  if (!datosListos) return;
  btnSync.disabled = true;
  btnSync.textContent = 'SINCRONIZANDO...';

  try {
    const res = await fetch(CONFIG.APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'syncExcel',
        alumnos: datosListos.alumnos,
        tr: datosListos.tr
      })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    estadoSyncEl.classList.remove('oculto');
    estadoSyncEl.innerHTML = `<p style="color:var(--verde-exito)">✔ Sincronización completa. Los alumnos ya verán la información actualizada.</p>`;
  } catch (err) {
    estadoSyncEl.classList.remove('oculto');
    estadoSyncEl.innerHTML = `<p style="color:var(--rojo-error)">⚠ Error al sincronizar: ${err.message}</p>`;
  } finally {
    btnSync.disabled = false;
    btnSync.textContent = 'SINCRONIZAR CON EL SISTEMA';
  }
}
