/* ============================================================
   CONFIG.JS — Configuración global del sistema
   ============================================================
   IMPORTANTE: Reemplaza APPS_SCRIPT_URL con la URL de tu
   despliegue de Apps Script (terminada en /exec).
   Instrucciones completas en README.md
   ============================================================ */

const CONFIG = {
  // URL del Web App de Google Apps Script (backend)
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbzwwvHz6PNFPRWCauhifINGXVlNUYZ90Rx8rTcaQa8g6r6wiJXWLQ5yvYdn6IjmDcJCBw/exec',

  // Límites de subida
  MAX_ARCHIVOS: 10,
  MAX_TAMANO_MB: 100,

  // Tipos de archivo aceptados (vacío = todos)
  TIPOS_ACEPTADOS: '*/*'
};
