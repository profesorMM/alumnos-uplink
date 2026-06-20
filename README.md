# Sistema de Entrega de Trabajos — Guía de instalación

Arquitectura 100% gratuita:
- **GitHub Pages** → hospeda la página (HTML/CSS/JS)
- **Google Sheets** → "base de datos" (grupos, alumnos, trabajos, registro de entregas)
- **Google Drive** → almacenamiento de archivos, organizado como `Grupo / Alumno / archivo`
- **Google Apps Script** → backend (gratis, sin servidor)

---

## PASO 1 — Tu Google Sheet (base de datos) ya coincide con tu Excel actual

**No necesitas reestructurar nada.** El sistema lee tu archivo tal cual lo manejas:

1. Una hoja **`TR`**: el encabezado (fila superior) es el nombre de cada grupo, y las filas hacia abajo son los trabajos de ese grupo:

   | 1C | 2C | 1M |
   |----|----|----|
   | RESUMEN | RESUMEN | EXPOSICION |
   | VIDEO | VIDEO | VIDEO |
   | TRIPTICO | TRIPTICO | EXAMEN |

2. **Una hoja por cada grupo**, con el mismo nombre exacto que aparece en "TR" (por ejemplo `1C`, `2C`, `1M`...). Dentro de esa hoja debe existir, en cualquier celda, una columna con el encabezado **"NOMBRE"** — el sistema la busca automáticamente y lee los nombres de alumnos hacia abajo hasta encontrar una celda vacía. No importa en qué columna o fila esté, ni qué otras columnas (calificaciones, asistencias, etc.) tenga la hoja.
3. Cualquier otra hoja (horarios, planeación, hojas en blanco, etc.) se ignora automáticamente — solo se procesan las hojas cuyo nombre coincide con un grupo listado en "TR".

Sube ese mismo Excel desde `sync.html` (PASO 4 más abajo) y el sistema construye por sí solo, dentro de tu Google Sheet central, una hoja limpia `Alumnos` (Grupo | Alumno) y una copia de `TR` — esas dos alimentan el formulario de los alumnos.

1. Crea un Google Sheet vacío en [sheets.google.com](https://sheets.google.com) (este será el "destino" donde se sincroniza la información; no necesitas crear hojas dentro de él manualmente, `sync.html` las genera solas la primera vez).
2. Copia el **ID del Sheet** desde la URL:
   `https://docs.google.com/spreadsheets/d/`**`ESTE_ES_EL_ID`**`/edit`

(Tampoco necesitas crear la pestaña "Entregas" — el sistema la crea sola la primera vez que alguien entrega un trabajo).

---

## PASO 2 — Crear la carpeta raíz en Google Drive

1. En [drive.google.com](https://drive.google.com), crea una carpeta llamada, por ejemplo, **"Entregas"**.
2. Copia su **ID** desde la URL:
   `https://drive.google.com/drive/folders/`**`ESTE_ES_EL_ID`**

---

## PASO 3 — Crear el backend en Google Apps Script

1. Ve a [script.google.com](https://script.google.com) → **Nuevo proyecto**.
2. Borra el contenido por defecto y pega el contenido de `apps-script/Codigo.gs`.
3. En el menú izquierdo, abre **Configuración del proyecto (⚙)** → activa "Mostrar archivo de manifiesto appsscript.json" → edítalo y pega el contenido de `apps-script/appsscript.json`.
4. Reemplaza en `Codigo.gs`:
   - `SPREADSHEET_ID` → el ID del PASO 1
   - `ROOT_FOLDER_ID` → el ID del PASO 2
5. Guarda el proyecto (nómbralo "Backend Entregas").
6. Haz clic en **Implementar → Nueva implementación**:
   - Tipo: **Aplicación web**
   - Ejecutar como: **Yo (tu correo)**
   - Quién tiene acceso: **Cualquier usuario**
7. Autoriza los permisos cuando te lo pida Google (es tu propia cuenta, es seguro).
8. Copia la **URL del Web App** (termina en `/exec`).

> ⚠️ Cada vez que modifiques `Codigo.gs`, debes hacer **Implementar → Administrar implementaciones → Editar (lápiz) → Nueva versión → Implementar**, para que los cambios se apliquen a la URL pública.

---

## PASO 4 — Configurar el frontend

1. Abre `js/config.js` y reemplaza:
   ```js
   APPS_SCRIPT_URL: 'https://script.google.com/macros/s/TU_ID_DE_DESPLIEGUE/exec',
   ```
   con la URL que copiaste en el PASO 3.

---

## PASO 5 — Publicar en GitHub Pages

1. Crea un repositorio nuevo en GitHub (puede ser público o privado, ambos funcionan con Pages en cuentas gratuitas si es público; si es privado necesitas GitHub Pro, así que se recomienda **público**).
2. Sube todo el contenido de esta carpeta (`index.html`, `sync.html`, `css/`, `js/`) a la raíz del repositorio. (No subas la carpeta `apps-script/`, esa va en Apps Script, no en GitHub).
3. Ve a **Settings → Pages** del repositorio:
   - Source: **Deploy from a branch**
   - Branch: **main** / carpeta **/ (root)**
4. En unos minutos tu sitio estará disponible en:
   `https://TU_USUARIO.github.io/TU_REPOSITORIO/`
5. Comparte esa liga (o `.../index.html`) con tus alumnos.
6. Tú usarás `.../sync.html` para sincronizar tu Excel cuando quieras actualizar grupos/alumnos/trabajos.

---

## Cómo se organiza todo después

- **Google Drive** (carpeta raíz "Entregas"):
  ```
  Entregas/
    1A/
      Juan Pérez/
        Tarea 1.pdf
        Examen parcial.docx
      Ana López/
        Tarea 1 (1).jpg
        Tarea 1 (2).jpg
    1B/
      Luis Gómez/
        Proyecto final.mp4
  ```
- **Google Sheets**, pestaña "Entregas": un renglón por cada entrega, con fecha, hora, grupo, alumno, trabajo y los enlaces a los archivos.

---

## Notas importantes

- **Sincronización del Excel**: por seguridad del navegador, ninguna página puede "vigilar" tu Excel local automáticamente. La página `sync.html` lee tu archivo y lo sube con un clic cada vez que lo actualizas — no necesitas copiar/pegar nada a mano.
- **Tamaño de archivos**: hasta 100MB por archivo (configurable en `config.js`), gracias a que la subida va directa a Google Drive (no pasa por el límite de 50MB de Apps Script).
- **Espacio gratis**: tu cuenta de Google Drive trae 15GB gratis (compartidos con Gmail/Fotos). Si llegas a quedarte sin espacio, puedes comprar más almacenamiento o usar una cuenta institucional con más cuota.
- **Seguridad**: el token que se genera para subir archivos pertenece a tu cuenta de Google y expira en aproximadamente 1 hora. Es válido solo durante la sesión de entrega del alumno.
- **Sin instalar nada**: ni tú ni tus alumnos necesitan instalar software. Todo funciona desde el navegador.
- **Interfaz**: pantalla única con 3 combos en cascada (Grupo → Alumno → Trabajo) seguidos de la zona de archivos, optimizada para móvil con tipografía grande y botones táctiles amplios.
