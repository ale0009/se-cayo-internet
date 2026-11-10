// Evaluación de una red completa (Colombia o un operador) a partir de las respuestas crudas.
import { UMBRALES, serieIODA, evaluarSerie, combinar, alertasActivas, NOMBRE_FUENTE } from './senales.js';
import { visibilidadRIPE, evaluarVisibilidad } from './operadores.js';
import { pct } from './graficas.js';

const CORTO = { bgp: 'BGP', ping: 'sondeo activo', telescopio: 'telescopio' };

function motivo(nombre, ev) {
  if (ev.estado !== 'caida' && ev.estado !== 'aviso') return null;
  return `${CORTO[nombre]} al ${pct(ev.razon)} de lo normal`;
}

/**
 * crudos = { bgp, ping, telescopio, alertas } (respuestas JSON de IODA o null).
 * Devuelve { estado, senales: { bgp, ping, telescopio }, series, alertas, motivos }.
 */
export function evaluarPais(crudos, hasta) {
  const series = {
    bgp: serieIODA(crudos?.bgp),
    ping: serieIODA(crudos?.ping),
    telescopio: serieIODA(crudos?.telescopio),
  };
  const senales = {};
  for (const k of Object.keys(series)) senales[k] = evaluarSerie(series[k], UMBRALES[k], { hasta });
  const alertas = crudos?.alertas ? alertasActivas(crudos.alertas, hasta) : [];
  const estado = combinar(
    Object.fromEntries(Object.entries(senales).map(([k, v]) => [k, v.estado])),
    { extras: alertas.length },
  );
  const motivos = Object.entries(senales).map(([k, v]) => motivo(k, v)).filter(Boolean);
  for (const a of alertas) motivos.push(`alerta ${a.nivel === 'critical' ? 'crítica' : 'activa'} de IODA en ${NOMBRE_FUENTE[a.fuente] ?? a.fuente}`);
  return { estado, senales, series, alertas, motivos };
}

/** crudos = { bgp, ping, visibilidad } para un ASN. */
export function evaluarOperador(crudos, hasta) {
  const bgp = evaluarSerie(serieIODA(crudos?.bgp), UMBRALES.bgp, { hasta });
  const ping = evaluarSerie(serieIODA(crudos?.ping), UMBRALES.ping, { hasta });
  const vis = evaluarVisibilidad(visibilidadRIPE(crudos?.visibilidad), hasta);
  const estado = combinar({ bgp: bgp.estado, ping: ping.estado, vis: vis.estado });
  return { estado, bgp, ping, vis };
}
