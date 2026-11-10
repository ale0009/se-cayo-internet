// Señales de IODA (Georgia Tech): leer series, compararlas con su mediana y combinar estados.
// Funciones puras: sin DOM ni red, probadas con `node --test`.

/**
 * Umbrales sobre la razón «último valor ÷ mediana de las 24 h anteriores».
 * - BGP cambia muy poco en un día normal (bloques /24 anunciados): una caída del 3 % ya es rara.
 * - Sondeo activo: IODA marca alerta crítica con razón < 0,8 (se ve en sus propias alertas);
 *   aquí «aviso» empieza en 0,85 y «caída» en 0,70 (calculado aquí, decisión propia).
 * - Telescopio (tráfico no solicitado): es ruidoso (un día normal baja hasta 71 % de su mediana),
 *   por eso sus umbrales son más laxos.
 * `minimoBase`: si la mediana es menor, hay muy pocas redes medibles y la razón no dice nada
 * (pasa en redes móviles, que casi no responden al ping).
 */
export const UMBRALES = {
  bgp: { aviso: 0.97, caida: 0.9, minimoBase: 10 },
  ping: { aviso: 0.85, caida: 0.7, minimoBase: 100 },
  telescopio: { aviso: 0.6, caida: 0.4, minimoBase: 5 },
};

/** Un dato con más de 3 h de retraso ya no sirve para decir «ahora». */
export const MAX_RETRASO_S = 3 * 3600;
const VENTANA_BASE_S = 24 * 3600;
const MIN_PUNTOS = 6;

export const ORDEN_ESTADO = { 'sin-dato': 0, normal: 1, aviso: 2, caida: 3 };

/** Convierte la respuesta de /v2/signals/raw/... en { fuente, entidad, paso, puntos:[{t, v}] }. */
export function serieIODA(json) {
  const s = json?.data?.[0]?.[0];
  if (!s || !Array.isArray(s.values) || !Number.isFinite(s.from) || !Number.isFinite(s.step)) return null;
  return {
    fuente: s.datasource,
    entidad: s.entityCode ?? null,
    paso: s.step,
    puntos: s.values.map((v, i) => ({ t: s.from + i * s.step, v: typeof v === 'number' && Number.isFinite(v) ? v : null })),
  };
}

export function mediana(nums) {
  const a = nums.filter((n) => Number.isFinite(n)).sort((x, y) => x - y);
  if (!a.length) return null;
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

/** Clasifica una razón con un juego de umbrales. */
export function clasificar(razon, umbral) {
  if (!Number.isFinite(razon)) return 'sin-dato';
  if (razon < umbral.caida) return 'caida';
  if (razon < umbral.aviso) return 'aviso';
  return 'normal';
}

/**
 * Compara el último dato (hasta `hasta`, en segundos Unix) con la mediana de las 24 h anteriores.
 * Devuelve { estado, razon, ultimo, base, t, motivo }.
 */
export function evaluarSerie(serie, umbral, { hasta = Infinity } = {}) {
  if (!serie) return { estado: 'sin-dato', motivo: 'la fuente no respondió' };
  const validos = serie.puntos.filter((p) => p.t <= hasta && p.v !== null);
  if (validos.length < MIN_PUNTOS) return { estado: 'sin-dato', motivo: 'muy pocos datos' };
  const ultimo = validos[validos.length - 1];
  if (Number.isFinite(hasta) && hasta - ultimo.t > MAX_RETRASO_S) {
    return { estado: 'sin-dato', motivo: 'el último dato tiene más de 3 h', t: ultimo.t };
  }
  const base = mediana(validos.filter((p) => p.t < ultimo.t && p.t >= ultimo.t - VENTANA_BASE_S).map((p) => p.v));
  if (base === null || base <= 0) return { estado: 'sin-dato', motivo: 'sin línea base' };
  if (base < (umbral.minimoBase ?? 0)) {
    return { estado: 'sin-dato', motivo: 'muy pocas redes medibles', ultimo: ultimo.v, base, t: ultimo.t };
  }
  const razon = ultimo.v / base;
  return { estado: clasificar(razon, umbral), razon, ultimo: ultimo.v, base, t: ultimo.t };
}

/**
 * Combina varias señales de una misma red (país u operador).
 * Regla: BGP en caída basta (es la señal más estable); si no, hacen falta dos señales en caída.
 * Una sola señal no-BGP en caída solo cuenta como «aviso» (puede ser un fallo del medidor).
 * `extras` son avisos externos (p. ej. alertas activas de IODA): suben a «aviso» como mucho.
 */
export function combinar(estados, { fuerte = 'bgp', extras = 0 } = {}) {
  const valores = Object.values(estados);
  const caidas = valores.filter((e) => e === 'caida').length;
  if (estados[fuerte] === 'caida' || caidas >= 2) return 'caida';
  if (caidas === 1 || valores.includes('aviso') || extras > 0) return 'aviso';
  if (valores.every((e) => e === 'sin-dato')) return 'sin-dato';
  return 'normal';
}

/** Peor de varios estados (para resúmenes). */
export function peor(estados) {
  return estados.reduce((a, b) => (ORDEN_ESTADO[b] > ORDEN_ESTADO[a] ? b : a), 'sin-dato');
}

/**
 * Alertas de IODA (/v2/outages/alerts): para cada fuente se mira la alerta más reciente
 * dentro de la ventana; si su nivel no es «normal», está activa.
 */
export function alertasActivas(json, ahora, ventanaS = 3 * 3600) {
  const lista = Array.isArray(json?.data) ? json.data : [];
  const ultimaPorFuente = new Map();
  for (const a of lista) {
    if (!Number.isFinite(a?.time) || a.time > ahora || a.time < ahora - ventanaS) continue;
    const prev = ultimaPorFuente.get(a.datasource);
    if (!prev || a.time > prev.time) ultimaPorFuente.set(a.datasource, a);
  }
  return [...ultimaPorFuente.values()]
    .filter((a) => a.level && a.level !== 'normal')
    .map((a) => ({ fuente: a.datasource, nivel: a.level, t: a.time, valor: a.value, historico: a.historyValue }));
}

/** Eventos de caída de IODA (/v2/outages/events), del más reciente al más antiguo. */
export function eventosIODA(json) {
  const lista = Array.isArray(json?.data) ? json.data : [];
  return lista
    .filter((e) => Number.isFinite(e?.start))
    .map((e) => ({ inicio: e.start, fin: e.start + (e.duration || 0), duracion: e.duration || 0, fuente: e.datasource, puntaje: e.score ?? null }))
    .sort((a, b) => b.inicio - a.inicio);
}

/** Nombre corto en español de cada fuente de IODA. */
export const NOMBRE_FUENTE = {
  bgp: 'BGP (rutas anunciadas)',
  'ping-slash24': 'Sondeo activo (ping)',
  'merit-nt': 'Telescopio de red',
};
