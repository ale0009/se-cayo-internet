// Gráficas en SVG propio: funciones puras que devuelven trazos (sin DOM).

/**
 * Ruta SVG de una serie con huecos: cada tramo de valores no nulos empieza con «M».
 * puntos: [{ t, v }]; devuelve { d, min, max } escalado a ancho × alto (con margen `m`).
 */
export function rutaSerie(puntos, ancho, alto, { m = 2, min: minFijo, max: maxFijo } = {}) {
  const validos = puntos.filter((p) => p.v !== null && Number.isFinite(p.v));
  if (validos.length < 2) return { d: '', min: null, max: null };
  const t0 = puntos[0].t;
  const t1 = puntos[puntos.length - 1].t;
  let min = minFijo ?? Math.min(...validos.map((p) => p.v));
  let max = maxFijo ?? Math.max(...validos.map((p) => p.v));
  if (max === min) { max += 1; min -= 1; }
  const x = (t) => m + ((t - t0) / (t1 - t0 || 1)) * (ancho - 2 * m);
  const y = (v) => m + (1 - (v - min) / (max - min)) * (alto - 2 * m);
  let d = '';
  let abierto = false;
  for (const p of puntos) {
    if (p.v === null || !Number.isFinite(p.v)) { abierto = false; continue; }
    d += `${abierto ? 'L' : 'M'}${x(p.t).toFixed(1)} ${y(p.v).toFixed(1)}`;
    abierto = true;
  }
  return { d, min, max };
}

/** Normaliza una serie dividiendo por una base (para comparar señales en la misma escala). */
export function normalizar(puntos, base) {
  if (!Number.isFinite(base) || base <= 0) return puntos.map((p) => ({ t: p.t, v: null }));
  return puntos.map((p) => ({ t: p.t, v: p.v === null ? null : p.v / base }));
}

/** Formatea un porcentaje en español: 0,973 → «97 %». */
export function pct(r, dec = 0) {
  if (!Number.isFinite(r)) return '–';
  return `${(r * 100).toFixed(dec).replace('.', ',')} %`;
}
