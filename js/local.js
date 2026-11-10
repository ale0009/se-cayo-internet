// «¿Solo yo?»: resumen de la prueba local (función pura). La medición real vive en datos.js.

/** Sitios de prueba: grandes, de distintos dueños y uno colombiano. Cualquier respuesta HTTP cuenta. */
export const SITIOS = [
  { id: 'google', nombre: 'Google', url: 'https://www.google.com/generate_204' },
  { id: 'cloudflare', nombre: 'Cloudflare', url: 'https://www.cloudflare.com/favicon.ico' },
  { id: 'wikipedia', nombre: 'Wikipedia', url: 'https://www.wikipedia.org/static/favicon/wikipedia.ico' },
  { id: 'microsoft', nombre: 'Microsoft', url: 'https://www.microsoft.com/favicon.ico' },
  { id: 'amazon', nombre: 'Amazon', url: 'https://www.amazon.com/favicon.ico' },
  { id: 'govco', nombre: 'GOV.CO', url: 'https://www.gov.co/favicon.ico' },
];

/** Mediana por encima de esto = «lento» (incluye DNS + TLS de la primera conexión). */
export const LENTO_MS = 1500;
/** Fracción mínima de sitios alcanzados para decir que tu conexión está bien. */
export const MIN_OK = 0.8;

/**
 * resultados: [{ id, ok, ms }]. Devuelve { total, ok, mediana, estado }.
 * estado: 'ok' | 'lento' | 'parcial' | 'sin-conexion' | 'sin-medir'.
 */
export function resumirSondeo(resultados) {
  if (!Array.isArray(resultados) || !resultados.length) return { total: 0, ok: 0, mediana: null, estado: 'sin-medir' };
  const buenos = resultados.filter((r) => r.ok && Number.isFinite(r.ms)).map((r) => r.ms).sort((a, b) => a - b);
  const total = resultados.length;
  const ok = buenos.length;
  const m = ok ? (ok % 2 ? buenos[ok >> 1] : Math.round((buenos[ok / 2 - 1] + buenos[ok / 2]) / 2)) : null;
  let estado = 'ok';
  if (ok === 0) estado = 'sin-conexion';
  else if (ok / total < MIN_OK) estado = 'parcial';
  else if (m > LENTO_MS) estado = 'lento';
  return { total, ok, mediana: m, estado };
}
