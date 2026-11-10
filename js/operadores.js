// Operadores colombianos y visibilidad BGP según RIPEstat. Funciones puras.
import { clasificar } from './senales.js';

/**
 * ASN verificados con RIPEstat (as-overview, 10 nov 2026):
 * AS10620 Telmex Colombia S.A. · AS26611 Comunicación Celular S.A. Comcel S.A. ·
 * AS3816 Colombia Telecomunicaciones S.A. ESP BIC · AS13489 UNE EPM Telecomunicaciones S.A. ·
 * AS19429 ETB - Colombia. (AS27831 «Colombia Movil» aparece sin anunciar prefijos: se descarta.)
 */
export const OPERADORES = [
  { asn: 10620, nombre: 'Claro', red: 'hogar' },
  { asn: 26611, nombre: 'Claro', red: 'móvil' },
  { asn: 3816, nombre: 'Movistar', red: 'hogar y móvil' },
  { asn: 13489, nombre: 'Tigo UNE', red: 'hogar' },
  { asn: 19429, nombre: 'ETB', red: 'hogar' },
];

/** Visibilidad: qué fracción de los pares de RIS con tabla completa ve las rutas del ASN. */
export const UMBRAL_VISIBILIDAD = { aviso: 0.9, caida: 0.5 };
/** RIPEstat actualiza este dato cada pocas horas: si es más viejo que esto, solo puede avisar. */
export const VISIBILIDAD_FRESCA_S = 2 * 3600;

function aSegundos(iso) {
  if (typeof iso !== 'string') return null;
  const ms = Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);
  return Number.isFinite(ms) ? Math.round(ms / 1000) : null;
}

/** Lee /data/visibility/ de RIPEstat → { vistos, total, razon, t } (IPv4). */
export function visibilidadRIPE(json) {
  const vis = json?.data?.visibilities;
  if (!Array.isArray(vis) || !vis.length) return null;
  let total = 0;
  let ciegos = 0;
  for (const v of vis) {
    total += Number(v.ipv4_full_table_peer_count) || 0;
    ciegos += Array.isArray(v.ipv4_full_table_peers_not_seeing) ? v.ipv4_full_table_peers_not_seeing.length : 0;
  }
  if (!total) return null;
  return { vistos: total - ciegos, total, razon: (total - ciegos) / total, t: aSegundos(json.data.latest_time ?? json.data.query_time) };
}

/** Clasifica la visibilidad; si el dato es viejo, lo máximo que puede decir es «aviso». */
export function evaluarVisibilidad(vis, ahora) {
  if (!vis) return { estado: 'sin-dato', motivo: 'RIPEstat no respondió' };
  let estado = clasificar(vis.razon, UMBRAL_VISIBILIDAD);
  const vieja = Number.isFinite(ahora) && Number.isFinite(vis.t) && ahora - vis.t > VISIBILIDAD_FRESCA_S;
  if (vieja && estado === 'caida') estado = 'aviso';
  return { estado, razon: vis.razon, vieja, t: vis.t };
}

export function etiquetaOperador(op) {
  return `${op.nombre} ${op.red}`;
}
