// Red (solo navegador): IODA, RIPEstat, Statuspage y la prueba local. Cada parte falla sola, sin romper el resto.
import { urlEstado } from './servicios.js';

export const RESPALDO = { ruta: 'datos/ejemplo-2026-11-10.json', fecha: '10 nov 2026, 5:57 p. m. (hora de Colombia)' };
const IODA = 'https://api.ioda.inetintel.cc.gatech.edu/v2';
const RIPE = 'https://stat.ripe.net/data';
const DIA = 86400;

export function sinConexionForzado() {
  return new URLSearchParams(globalThis.location?.search ?? '').has('sin-conexion');
}

function explicar(err, quien, limite) {
  if (err?.name === 'AbortError') return `${quien} tardó más de ${Math.round(limite / 1000)} s`;
  if (err?.estado) return `${quien} respondió con el código HTTP ${err.estado}`;
  if (err instanceof TypeError) return `no se pudo llegar a ${quien} (sin conexión o bloqueado)`;
  return `${quien}: ${err?.message || 'error desconocido'}`;
}

async function pedirJSON(url, limite = 12000, quien = 'la fuente') {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), limite);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { Accept: 'application/json' } });
    if (!r.ok) throw Object.assign(new Error(`HTTP ${r.status}`), { estado: r.status });
    return await r.json();
  } catch (e) {
    throw Object.assign(new Error(explicar(e, quien, limite)), { causa: e });
  } finally {
    clearTimeout(t);
  }
}

let respaldoP = null;
export function respaldo(base = '') {
  respaldoP ??= pedirJSON(`${base}${RESPALDO.ruta}`, 15000, 'el archivo de ejemplo').catch((e) => { respaldoP = null; throw e; });
  return respaldoP;
}

const senal = (tipo, codigo, fuente, ahora, dias = 1) =>
  `${IODA}/signals/raw/${tipo}/${codigo}?from=${ahora - dias * DIA}&until=${ahora}&datasource=${fuente}`;

/** Ejecuta varias peticiones; devuelve { valores, errores, alguna } (valor null si falló). */
async function varias(pares) {
  const r = await Promise.allSettled(pares.map(([, p]) => p));
  const valores = {};
  const errores = [];
  r.forEach((x, i) => {
    valores[pares[i][0]] = x.status === 'fulfilled' ? x.value : null;
    if (x.status === 'rejected') errores.push(x.reason.message);
  });
  return { valores, errores, alguna: r.some((x) => x.status === 'fulfilled') };
}

async function conRespaldo(base, vivo, deRespaldo, motivoForzado) {
  if (!sinConexionForzado()) {
    const r = await vivo();
    if (r.ok) return { crudos: r.crudos, origen: 'vivo', hasta: r.hasta, error: r.errores.length ? r.errores.join(' · ') : null };
    const b = await respaldo(base);
    return { crudos: deRespaldo(b), origen: 'respaldo', hasta: b.ahora, error: r.errores.join(' · ') || 'sin respuesta' };
  }
  const b = await respaldo(base);
  return { crudos: deRespaldo(b), origen: 'respaldo', hasta: b.ahora, error: motivoForzado };
}

const FORZADO = 'modo sin conexión forzado con ?sin-conexion';

/** Colombia en IODA: BGP, sondeo activo y telescopio (24 h), alertas (6 h) y eventos (30 días). */
export function cargarPais(base = '') {
  return conRespaldo(base, async () => {
    const ahora = Math.floor(Date.now() / 1000);
    const { valores, errores } = await varias([
      ['bgp', pedirJSON(senal('country', 'CO', 'bgp', ahora), 15000, 'IODA (BGP)')],
      ['ping', pedirJSON(senal('country', 'CO', 'ping-slash24', ahora), 15000, 'IODA (sondeo)')],
      ['telescopio', pedirJSON(senal('country', 'CO', 'merit-nt', ahora), 15000, 'IODA (telescopio)')],
      ['alertas', pedirJSON(`${IODA}/outages/alerts?entityType=country&entityCode=CO&from=${ahora - 6 * 3600}&until=${ahora}`, 15000, 'IODA (alertas)')],
      ['eventos', pedirJSON(`${IODA}/outages/events?entityType=country&entityCode=CO&from=${ahora - 30 * DIA}&until=${ahora}`, 15000, 'IODA (eventos)')],
    ]);
    return { ok: Boolean(valores.bgp || valores.ping), crudos: valores, errores, hasta: ahora };
  }, (b) => b.pais, FORZADO);
}

/** Un operador: IODA (BGP y sondeo del ASN) y RIPEstat (visibilidad; sin caché puede pasar de 40 s, así que se corta a los 20 s). */
export function cargarOperador(op, base = '') {
  return conRespaldo(base, async () => {
    const ahora = Math.floor(Date.now() / 1000);
    const { valores, errores, alguna } = await varias([
      ['bgp', pedirJSON(senal('asn', op.asn, 'bgp', ahora), 15000, 'IODA')],
      ['ping', pedirJSON(senal('asn', op.asn, 'ping-slash24', ahora), 15000, 'IODA')],
      ['visibilidad', pedirJSON(`${RIPE}/visibility/data.json?resource=AS${op.asn}&sourceapp=se-cayo-internet`, 20000, 'RIPEstat')],
    ]);
    return { ok: alguna, crudos: valores, errores, hasta: ahora };
  }, (b) => b.operadores[op.asn], FORZADO);
}

/** Página de estado de un servicio (Statuspage). */
export function cargarServicio(s, base = '') {
  return conRespaldo(base, async () => {
    try {
      const json = await pedirJSON(urlEstado(s), 12000, s.nombre);
      return { ok: true, crudos: json, errores: [], hasta: Math.floor(Date.now() / 1000) };
    } catch (e) {
      return { ok: false, crudos: null, errores: [e.message] };
    }
  }, (b) => b.servicios[s.dominio], FORZADO);
}

/**
 * Prueba local: ¿llega tu navegador a este sitio? Con `no-cors` no se lee la respuesta
 * (no hace falta): basta con que llegue algo. Mide el tiempo total, con DNS y TLS incluidos.
 */
export async function sondear(sitio, limite = 6000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), limite);
  const t0 = performance.now();
  try {
    await fetch(`${sitio.url}?_=${Date.now()}`, { mode: 'no-cors', cache: 'no-store', signal: ctl.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
    return { id: sitio.id, ok: true, ms: Math.round(performance.now() - t0) };
  } catch {
    return { id: sitio.id, ok: false, ms: null };
  } finally {
    clearTimeout(t);
  }
}
