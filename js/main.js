/* ============================================================
   MAIN.JS — Lógica del formulario de entrega (pantalla única)
   ============================================================ */

const estado = {
  grupo: null,
  alumno: null,
  trabajo: null,
  archivos: [],          // array de objetos File
  alumnosPorGrupo: {},
  trabajosPorGrupo: {},
  horarios: {}
};

const pantallas = {
  cargando:      document.getElementById('pantalla-cargando'),
  formulario:    document.getElementById('pantalla-formulario'),
  espera:        document.getElementById('pantalla-espera'),
  confirmacion:  document.getElementById('pantalla-confirmacion'),
  error:         document.getElementById('pantalla-error')
};

function mostrarPantalla(nombre) {
  Object.values(pantallas).forEach(p => p && p.classList.add('oculto'));
  pantallas[nombre].classList.remove('oculto');
}

/* ---------------- Elementos ---------------- */
const selectGrupo   = document.getElementById('select-grupo');
const selectAlumno  = document.getElementById('select-alumno');
const selectTrabajo = document.getElementById('select-trabajo');
const seccionArchivos = document.getElementById('seccion-archivos');
const mensajeArchivosBloqueados = document.getElementById('mensaje-archivos-bloqueados');
const inputArchivos = document.getElementById('input-archivos');
const inputCamara   = document.getElementById('input-camara');
const btnElegirArchivos = document.getElementById('btn-elegir-archivos');
const btnTomarFoto  = document.getElementById('btn-tomar-foto');
const btnEnviar     = document.getElementById('btn-enviar');
const avisoGrupoCerrado = document.getElementById('aviso-grupo-cerrado');
const textoAvisoCerrado = document.getElementById('texto-aviso-cerrado');
const camposDespuesDeGrupo = document.getElementById('campos-despues-de-grupo');

/* ---------------- Inicialización ---------------- */
async function init() {
  mostrarPantalla('cargando');
  try {
    const res = await fetch(`${CONFIG.APPS_SCRIPT_URL}?action=initdata`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    estado.alumnosPorGrupo = data.alumnosPorGrupo;
    estado.trabajosPorGrupo = data.trabajosPorGrupo;
    estado.horarios = data.horarios || {};

    renderGrupos();
    resetFormulario();
    mostrarPantalla('formulario');
  } catch (err) {
    mostrarError('No se pudo cargar la información de grupos. Verifica tu conexión e intenta de nuevo.', err);
  }
}

function renderGrupos() {
  selectGrupo.innerHTML = '<option value="">Selecciona tu grupo</option>';
  Object.keys(estado.alumnosPorGrupo).sort().forEach(grupo => {
    const opt = document.createElement('option');
    opt.value = grupo;
    opt.textContent = grupo;
    selectGrupo.appendChild(opt);
  });
}

function resetFormulario() {
  estado.grupo = null;
  estado.alumno = null;
  estado.trabajo = null;
  estado.archivos = [];

  selectGrupo.value = '';
  selectAlumno.innerHTML = '<option value="">Primero selecciona tu grupo</option>';
  selectAlumno.disabled = true;
  selectTrabajo.innerHTML = '<option value="">Primero selecciona tu grupo</option>';
  selectTrabajo.disabled = true;

  camposDespuesDeGrupo.classList.remove('oculto');
  avisoGrupoCerrado.classList.add('oculto');

  bloquearArchivos();
  renderListaArchivos();
  actualizarBotonEnviar();
}

/* ---------------- Cascada de selects ---------------- */
selectGrupo.addEventListener('change', () => {
  estado.grupo = selectGrupo.value || null;
  estado.alumno = null;
  estado.trabajo = null;
  estado.archivos = [];
  renderListaArchivos();

  if (!estado.grupo) {
    camposDespuesDeGrupo.classList.remove('oculto');
    avisoGrupoCerrado.classList.add('oculto');
    selectAlumno.innerHTML = '<option value="">Primero selecciona tu grupo</option>';
    selectAlumno.disabled = true;
    selectTrabajo.innerHTML = '<option value="">Primero selecciona tu grupo</option>';
    selectTrabajo.disabled = true;
    bloquearArchivos();
    actualizarBotonEnviar();
    return;
  }

  // ¿El grupo está dentro de su horario de entrega?
  const estadoHorario = estadoGrupoLocal(estado.grupo);
  if (!estadoHorario.abierto) {
    camposDespuesDeGrupo.classList.add('oculto');
    textoAvisoCerrado.textContent = estadoHorario.mensaje;
    avisoGrupoCerrado.classList.remove('oculto');
    actualizarBotonEnviar();
    return;
  }
  camposDespuesDeGrupo.classList.remove('oculto');
  avisoGrupoCerrado.classList.add('oculto');

  // Alumnos del grupo
  selectAlumno.innerHTML = '<option value="">Selecciona tu nombre</option>';
  (estado.alumnosPorGrupo[estado.grupo] || []).slice().sort().forEach(alumno => {
    const opt = document.createElement('option');
    opt.value = alumno;
    opt.textContent = alumno;
    selectAlumno.appendChild(opt);
  });
  selectAlumno.disabled = false;

  // Trabajos del grupo
  selectTrabajo.innerHTML = '<option value="">Selecciona el trabajo</option>';
  (estado.trabajosPorGrupo[estado.grupo] || []).forEach(trabajo => {
    const opt = document.createElement('option');
    opt.value = trabajo;
    opt.textContent = trabajo;
    selectTrabajo.appendChild(opt);
  });
  selectTrabajo.disabled = false;

  evaluarDesbloqueoArchivos();
  actualizarBotonEnviar();
});

// Calcula localmente (en el navegador) si el grupo está dentro de su horario.
// Esto es solo para la experiencia del alumno: el servidor vuelve a validar
// con su propio reloj al momento de generar el token de subida.
function estadoGrupoLocal(grupo) {
  const h = estado.horarios[grupo];
  if (!h || !h.modo || h.modo === 'ABIERTO') return { abierto: true };

  const ahora = new Date();
  const inicio = h.inicio ? new Date(h.inicio) : null;
  const fin = h.fin ? new Date(h.fin) : null;

  if (inicio && ahora < inicio) {
    return { abierto: false, mensaje: 'Tu grupo aún no está en tiempo de entregar.' };
  }
  if (fin && ahora > fin) {
    return { abierto: false, mensaje: 'Tu grupo ya no está en tiempo de entregar.' };
  }
  return { abierto: true };
}

selectAlumno.addEventListener('change', () => {
  estado.alumno = selectAlumno.value || null;
  evaluarDesbloqueoArchivos();
  actualizarBotonEnviar();
});

selectTrabajo.addEventListener('change', () => {
  estado.trabajo = selectTrabajo.value || null;
  evaluarDesbloqueoArchivos();
  actualizarBotonEnviar();
});

function evaluarDesbloqueoArchivos() {
  if (estado.grupo && estado.alumno && estado.trabajo) {
    desbloquearArchivos();
  } else {
    bloquearArchivos();
  }
}

function bloquearArchivos() {
  seccionArchivos.classList.add('seccion-bloqueada');
  mensajeArchivosBloqueados.classList.remove('oculto');
  inputArchivos.disabled = true;
  inputCamara.disabled = true;
}

function desbloquearArchivos() {
  seccionArchivos.classList.remove('seccion-bloqueada');
  mensajeArchivosBloqueados.classList.add('oculto');
  inputArchivos.disabled = false;
  inputCamara.disabled = false;
}

/* ---------------- Archivos ---------------- */
inputArchivos.addEventListener('change', e => agregarArchivos(e.target.files));
inputCamara.addEventListener('change', e => agregarArchivos(e.target.files));

function agregarArchivos(fileList) {
  const nuevos = Array.from(fileList);
  for (const f of nuevos) {
    if (estado.archivos.length >= CONFIG.MAX_ARCHIVOS) {
      alert(`Solo puedes subir hasta ${CONFIG.MAX_ARCHIVOS} archivos.`);
      break;
    }
    if (f.size > CONFIG.MAX_TAMANO_MB * 1024 * 1024) {
      alert(`"${f.name}" supera el límite de ${CONFIG.MAX_TAMANO_MB}MB y no fue agregado.`);
      continue;
    }
    estado.archivos.push(f);
  }
  inputArchivos.value = '';
  inputCamara.value = '';
  renderListaArchivos();
  actualizarBotonEnviar();
}

function quitarArchivo(idx) {
  estado.archivos.splice(idx, 1);
  renderListaArchivos();
  actualizarBotonEnviar();
}

function renderListaArchivos() {
  const cont = document.getElementById('lista-archivos-seleccionados');
  cont.innerHTML = '';
  estado.archivos.forEach((f, idx) => {
    const item = document.createElement('div');
    item.className = 'item-archivo';
    item.innerHTML = `
      <span class="icono-archivo">${iconoPorTipo(f.type, f.name)}</span>
      <span class="nombre-archivo">${f.name}</span>
      <span class="peso-archivo">${(f.size / (1024 * 1024)).toFixed(1)} MB</span>
      <button type="button" class="btn-quitar" aria-label="Quitar archivo">&times;</button>
    `;
    item.querySelector('.btn-quitar').addEventListener('click', () => quitarArchivo(idx));
    cont.appendChild(item);
  });
  document.getElementById('contador-archivos').textContent = `${estado.archivos.length} / ${CONFIG.MAX_ARCHIVOS}`;
}

function iconoPorTipo(mime, nombre) {
  if (mime.startsWith('image/')) return '🖼️';
  if (mime.startsWith('video/')) return '🎬';
  if (mime.includes('pdf')) return '📄';
  if (/\.(doc|docx)$/i.test(nombre)) return '📝';
  if (/\.(xls|xlsx)$/i.test(nombre)) return '📊';
  if (/\.(ppt|pptx)$/i.test(nombre)) return '📽️';
  return '📎';
}

function actualizarBotonEnviar() {
  btnEnviar.disabled = !(estado.grupo && estado.alumno && estado.trabajo && estado.archivos.length > 0);
}

/* ---------------- Envío y subida a Drive ---------------- */
btnEnviar.addEventListener('click', enviarEntrega);

async function enviarEntrega() {
  mostrarPantalla('espera');
  actualizarBarraEspera(0, estado.archivos.length);

  try {
    // 1. Token + carpeta del alumno
    const tokenRes = await fetch(
      `${CONFIG.APPS_SCRIPT_URL}?action=token&grupo=${encodeURIComponent(estado.grupo)}&alumno=${encodeURIComponent(estado.alumno)}`
    );
    const tokenData = await tokenRes.json();
    if (tokenData.error) throw new Error(tokenData.error);

    const { token, folderId } = tokenData;
    const archivosSubidos = [];

    // 2. Subir cada archivo directo a Google Drive
    for (let i = 0; i < estado.archivos.length; i++) {
      const file = estado.archivos[i];
      const nombreFinal = construirNombreArchivo(estado.trabajo, file.name, i, estado.archivos.length);
      const resultado = await subirArchivoADrive(file, nombreFinal, folderId, token);
      archivosSubidos.push({ nombre: nombreFinal, link: resultado.webViewLink || '' });
      actualizarBarraEspera(i + 1, estado.archivos.length);
    }

    // 3. Registrar la entrega en la hoja "Entregas"
    await fetch(CONFIG.APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // evita preflight CORS
      body: JSON.stringify({
        action: 'logEntry',
        grupo: estado.grupo,
        alumno: estado.alumno,
        trabajo: estado.trabajo,
        archivos: archivosSubidos
      })
    });

    mostrarConfirmacion(archivosSubidos);
  } catch (err) {
    mostrarError('Ocurrió un problema al subir tus archivos. Por favor intenta de nuevo.', err);
  }
}

function construirNombreArchivo(trabajo, nombreOriginal, idx, total) {
  const ext = nombreOriginal.includes('.') ? nombreOriginal.split('.').pop() : '';
  const base = trabajo.replace(/[\\/:*?"<>|]/g, '-').trim();
  const sufijo = total > 1 ? ` (${idx + 1})` : '';
  return ext ? `${base}${sufijo}.${ext}` : `${base}${sufijo}`;
}

// Subida "resumable" oficial de Google Drive, directo desde el navegador
async function subirArchivoADrive(file, nombreFinal, folderId, token) {
  const metadata = { name: nombreFinal, parents: [folderId] };

  const initRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,webViewLink', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json; charset=UTF-8'
    },
    body: JSON.stringify(metadata)
  });

  if (!initRes.ok) throw new Error(`No se pudo iniciar la subida de ${file.name}`);
  const uploadUrl = initRes.headers.get('Location');

  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file
  });

  if (!uploadRes.ok) throw new Error(`No se pudo completar la subida de ${file.name}`);
  return uploadRes.json();
}

function actualizarBarraEspera(actual, total) {
  const pct = total === 0 ? 0 : Math.round((actual / total) * 100);
  document.getElementById('barra-progreso').style.width = `${pct}%`;
  document.getElementById('texto-progreso').textContent = `Subiendo archivo ${Math.min(actual + (actual < total ? 1 : 0), total)} de ${total}...`;
  if (actual === total) {
    document.getElementById('texto-progreso').textContent = 'Finalizando entrega...';
  }
}

/* ---------------- Confirmación ---------------- */
function mostrarConfirmacion(archivos) {
  document.getElementById('conf-grupo').textContent = estado.grupo;
  document.getElementById('conf-alumno').textContent = estado.alumno;
  document.getElementById('conf-trabajo').textContent = estado.trabajo;
  document.getElementById('conf-fecha').textContent = new Date().toLocaleString('es-MX');

  const lista = document.getElementById('conf-lista-archivos');
  lista.innerHTML = '';
  archivos.forEach(a => {
    const li = document.createElement('li');
    li.textContent = a.nombre;
    lista.appendChild(li);
  });

  mostrarPantalla('confirmacion');
}

document.getElementById('btn-nueva-entrega').addEventListener('click', () => {
  // Conserva grupo y alumno (suele entregar varios trabajos seguidos), limpia trabajo y archivos
  estado.trabajo = null;
  estado.archivos = [];
  selectTrabajo.value = '';
  renderListaArchivos();
  bloquearArchivos();
  actualizarBotonEnviar();
  mostrarPantalla('formulario');
});

/* ---------------- Errores ---------------- */
function mostrarError(mensaje, err) {
  console.error(err);
  document.getElementById('texto-error').textContent = mensaje;
  mostrarPantalla('error');
}

document.getElementById('btn-reintentar').addEventListener('click', () => init());

/* ---------------- Arranque ---------------- */
init();
