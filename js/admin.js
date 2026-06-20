/* ============================================================
   ADMIN.JS — Panel de administración: horarios y alta de trabajos
   ============================================================ */

let PIN = sessionStorage.getItem('admin_pin') || '';
let grupos = [];
let horarios = {};

const pantallaPin = document.getElementById('pantalla-pin');
const pantallaAdmin = document.getElementById('pantalla-admin');
const inputPin = document.getElementById('input-pin');
const textoErrorPin = document.getElementById('texto-error-pin');
const btnEntrar = document.getElementById('btn-entrar');

const listaGruposHorario = document.getElementById('lista-grupos-horario');
const listaChecksGrupos = document.getElementById('lista-checks-grupos');
const fechasBulk = document.getElementById('fechas-bulk');
const mensajeBulk = document.getElementById('mensaje-bulk');
const selectGrupoTrabajo = document.getElementById('select-grupo-trabajo');
const mensajeTrabajo = document.getElementById('mensaje-trabajo');

/* ---------------- Acceso por PIN ---------------- */
btnEntrar.addEventListener('click', intentarEntrar);
inputPin.addEventListener('keydown', e => { if (e.key === 'Enter') intentarEntrar(); });

async function intentarEntrar() {
  const pin = inputPin.value.trim();
  if (!pin) return;
  btnEntrar.disabled = true;
  btnEntrar.textContent = 'VERIFICANDO...';
  try {
    const data = await llamarPost({ action: 'verificarPin', pin });
    if (data.ok) {
      PIN = pin;
      sessionStorage.setItem('admin_pin', pin);
      pantallaPin.classList.add('oculto');
      pantallaAdmin.classList.remove('oculto');
      await cargarDatos();
    } else {
      textoErrorPin.textContent = 'PIN incorrecto. Intenta de nuevo.';
    }
  } catch (err) {
    textoErrorPin.textContent = 'No se pudo verificar el PIN. Revisa tu conexión.';
  } finally {
    btnEntrar.disabled = false;
    btnEntrar.textContent = 'ENTRAR';
  }
}

// Si ya había un PIN guardado en esta sesión, intenta entrar directo
(async function autoLogin() {
  if (!PIN) return;
  try {
    const data = await llamarPost({ action: 'verificarPin', pin: PIN });
    if (data.ok) {
      pantallaPin.classList.add('oculto');
      pantallaAdmin.classList.remove('oculto');
      await cargarDatos();
    }
  } catch (e) { /* silencioso, se queda en pantalla de PIN */ }
})();

/* ---------------- Cargar datos iniciales ---------------- */
async function cargarDatos() {
  const res = await fetch(`${CONFIG.APPS_SCRIPT_URL}?action=initdata`);
  const data = await res.json();
  if (data.error) { alert('Error cargando datos: ' + data.error); return; }

  grupos = Object.keys(data.alumnosPorGrupo || {}).sort();
  horarios = data.horarios || {};

  renderGruposHorario();
  renderChecksGrupos();
  renderSelectGrupoTrabajo();
}

/* ---------------- Tarjetas de horario por grupo ---------------- */
function renderGruposHorario() {
  listaGruposHorario.innerHTML = '';
  grupos.forEach(grupo => {
    const h = horarios[grupo] || { modo: 'ABIERTO' };
    const card = document.createElement('div');
    card.className = 'tarjeta-grupo';

    const idInicio = `inicio-${grupo}`;
    const idFin = `fin-${grupo}`;

    card.innerHTML = `
      <div class="tarjeta-grupo-encabezado">
        <span class="tarjeta-grupo-nombre">${grupo}</span>
        <span class="badge-estado ${claseBadge(h, grupo)}">${textoBadge(h)}</span>
      </div>
      <div class="fila-radios">
        <label class="opcion-radio">
          <input type="radio" name="modo-${grupo}" value="ABIERTO" ${h.modo !== 'PROGRAMADO' ? 'checked' : ''}> Siempre abierto
        </label>
        <label class="opcion-radio">
          <input type="radio" name="modo-${grupo}" value="PROGRAMADO" ${h.modo === 'PROGRAMADO' ? 'checked' : ''}> Programado
        </label>
      </div>
      <div class="fila-fechas" id="fechas-${grupo}" style="${h.modo === 'PROGRAMADO' ? '' : 'display:none;'}">
        <input type="datetime-local" id="${idInicio}" value="${aInputLocal(h.inicio)}">
        <input type="datetime-local" id="${idFin}" value="${aInputLocal(h.fin)}">
      </div>
      <button class="btn-guardar-grupo" data-grupo="${grupo}">Guardar ${grupo}</button>
      <div class="mensaje-admin-grupo" id="mensaje-${grupo}"></div>
    `;
    listaGruposHorario.appendChild(card);

    card.querySelectorAll(`input[name="modo-${grupo}"]`).forEach(radio => {
      radio.addEventListener('change', () => {
        document.getElementById(`fechas-${grupo}`).style.display =
          radio.value === 'PROGRAMADO' && radio.checked ? 'grid' : 'none';
      });
    });

    card.querySelector('.btn-guardar-grupo').addEventListener('click', () => guardarHorarioGrupo(grupo));
  });
}

function claseBadge(h, grupo) {
  if (!h || !h.modo || h.modo === 'ABIERTO') return 'badge-abierto';
  const ahora = new Date();
  const inicio = h.inicio ? new Date(h.inicio) : null;
  const fin = h.fin ? new Date(h.fin) : null;
  if ((inicio && ahora < inicio) || (fin && ahora > fin)) return 'badge-cerrado';
  return 'badge-programado';
}

function textoBadge(h) {
  if (!h || !h.modo || h.modo === 'ABIERTO') return 'Siempre abierto';
  const fIni = formatearFecha(h.inicio);
  const fFin = formatearFecha(h.fin);
  const ahora = new Date();
  const inicio = h.inicio ? new Date(h.inicio) : null;
  const fin = h.fin ? new Date(h.fin) : null;
  if (inicio && ahora < inicio) return `Abre: ${fIni}`;
  if (fin && ahora > fin) return `Cerrado desde: ${fFin}`;
  return `Hasta: ${fFin}`;
}

function formatearFecha(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('es-MX', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

// Convierte un ISO string a formato aceptado por <input type="datetime-local">
function aInputLocal(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function guardarHorarioGrupo(grupo) {
  const modo = document.querySelector(`input[name="modo-${grupo}"]:checked`).value;
  const inicio = document.getElementById(`inicio-${grupo}`).value;
  const fin = document.getElementById(`fin-${grupo}`).value;
  const msgEl = document.getElementById(`mensaje-${grupo}`);

  if (modo === 'PROGRAMADO' && (!inicio || !fin)) {
    msgEl.innerHTML = `<div class="mensaje-admin mensaje-admin--error">Indica fecha/hora de inicio y fin.</div>`;
    return;
  }

  try {
    const data = await llamarPost({ action: 'setHorario', pin: PIN, grupo, modo, inicio, fin });
    if (data.error) throw new Error(data.error);
    horarios[grupo] = { modo, inicio: inicio ? new Date(inicio).toISOString() : '', fin: fin ? new Date(fin).toISOString() : '' };
    msgEl.innerHTML = `<div class="mensaje-admin mensaje-admin--ok">✔ Guardado</div>`;
    renderGruposHorario(); // refresca badges
  } catch (err) {
    msgEl.innerHTML = `<div class="mensaje-admin mensaje-admin--error">⚠ ${err.message}</div>`;
  }
}

/* ---------------- Aplicar horario a varios grupos ---------------- */
function renderChecksGrupos() {
  listaChecksGrupos.innerHTML = '';
  grupos.forEach(grupo => {
    const label = document.createElement('label');
    label.className = 'check-grupo';
    label.innerHTML = `<input type="checkbox" value="${grupo}"> <span>${grupo}</span>`;
    listaChecksGrupos.appendChild(label);
  });
}

document.querySelectorAll('input[name="modo-bulk"]').forEach(radio => {
  radio.addEventListener('change', () => {
    fechasBulk.style.display = document.querySelector('input[name="modo-bulk"]:checked').value === 'PROGRAMADO' ? 'grid' : 'none';
  });
});

document.getElementById('btn-aplicar-bulk').addEventListener('click', async () => {
  const seleccionados = Array.from(listaChecksGrupos.querySelectorAll('input[type="checkbox"]:checked')).map(c => c.value);
  if (seleccionados.length === 0) {
    mensajeBulk.innerHTML = `<div class="mensaje-admin mensaje-admin--error">Selecciona al menos un grupo.</div>`;
    return;
  }
  const modo = document.querySelector('input[name="modo-bulk"]:checked').value;
  const inicio = document.getElementById('bulk-inicio').value;
  const fin = document.getElementById('bulk-fin').value;

  if (modo === 'PROGRAMADO' && (!inicio || !fin)) {
    mensajeBulk.innerHTML = `<div class="mensaje-admin mensaje-admin--error">Indica fecha/hora de inicio y fin.</div>`;
    return;
  }

  mensajeBulk.innerHTML = `<div class="mensaje-admin">Aplicando a ${seleccionados.length} grupo(s)...</div>`;
  try {
    for (const grupo of seleccionados) {
      const data = await llamarPost({ action: 'setHorario', pin: PIN, grupo, modo, inicio, fin });
      if (data.error) throw new Error(`${grupo}: ${data.error}`);
      horarios[grupo] = { modo, inicio: inicio ? new Date(inicio).toISOString() : '', fin: fin ? new Date(fin).toISOString() : '' };
    }
    mensajeBulk.innerHTML = `<div class="mensaje-admin mensaje-admin--ok">✔ Horario aplicado a ${seleccionados.length} grupo(s)</div>`;
    renderGruposHorario();
  } catch (err) {
    mensajeBulk.innerHTML = `<div class="mensaje-admin mensaje-admin--error">⚠ ${err.message}</div>`;
  }
});

/* ---------------- Alta de trabajo nuevo ---------------- */
function renderSelectGrupoTrabajo() {
  selectGrupoTrabajo.innerHTML = '<option value="">Selecciona el grupo</option>';
  grupos.forEach(grupo => {
    const opt = document.createElement('option');
    opt.value = grupo;
    opt.textContent = grupo;
    selectGrupoTrabajo.appendChild(opt);
  });
}

document.getElementById('btn-agregar-trabajo').addEventListener('click', async () => {
  const grupo = selectGrupoTrabajo.value;
  const trabajo = document.getElementById('input-nombre-trabajo').value.trim();

  if (!grupo || !trabajo) {
    mensajeTrabajo.innerHTML = `<div class="mensaje-admin mensaje-admin--error">Selecciona el grupo y escribe el nombre del trabajo.</div>`;
    return;
  }

  try {
    const data = await llamarPost({ action: 'agregarTrabajo', pin: PIN, grupo, trabajo });
    if (data.error) throw new Error(data.error);
    mensajeTrabajo.innerHTML = `<div class="mensaje-admin mensaje-admin--ok">✔ "${trabajo}" agregado a ${grupo}</div>`;
    document.getElementById('input-nombre-trabajo').value = '';
  } catch (err) {
    mensajeTrabajo.innerHTML = `<div class="mensaje-admin mensaje-admin--error">⚠ ${err.message}</div>`;
  }
});

/* ---------------- Utilidad ---------------- */
async function llamarPost(payload) {
  const res = await fetch(CONFIG.APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  });
  return res.json();
}
