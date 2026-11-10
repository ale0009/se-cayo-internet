// Páginas de estado (Statuspage) de servicios grandes. Funciones puras.

/** Solo las que respondieron con `Access-Control-Allow-Origin: *` el 10 nov 2026. */
export const SERVICIOS = [
  { id: 'github', nombre: 'GitHub', dominio: 'www.githubstatus.com' },
  { id: 'cloudflare', nombre: 'Cloudflare', dominio: 'www.cloudflarestatus.com', resumen: true },
  { id: 'discord', nombre: 'Discord', dominio: 'discordstatus.com' },
  { id: 'openai', nombre: 'ChatGPT', dominio: 'status.openai.com' },
  { id: 'reddit', nombre: 'Reddit', dominio: 'www.redditstatus.com' },
  { id: 'dropbox', nombre: 'Dropbox', dominio: 'status.dropbox.com' },
  { id: 'twitch', nombre: 'Twitch', dominio: 'status.twitch.com' },
  { id: 'epic', nombre: 'Epic Games', dominio: 'status.epicgames.com' },
  { id: 'zoom', nombre: 'Zoom', dominio: 'www.zoomstatus.com' },
];

export function urlEstado(s) {
  return `https://${s.dominio}/api/v2/${s.resumen ? 'summary' : 'status'}.json`;
}

/** Indicador de Statuspage → estado propio. «minor» es frecuente (algo pequeño en algún lugar del mundo). */
const NIVEL = { none: 'normal', minor: 'aviso', major: 'caida', critical: 'caida', maintenance: 'normal' };

export function leerEstado(json) {
  const ind = json?.status?.indicator;
  if (typeof ind !== 'string') return null;
  return { indicador: ind, estado: NIVEL[ind] ?? 'aviso', descripcion: json.status.description ?? '' };
}

/** Estados de componentes Statuspage → estado propio. */
const COMPONENTE = {
  operational: 'normal',
  under_maintenance: 'aviso',
  degraded_performance: 'aviso',
  partial_outage: 'aviso',
  major_outage: 'caida',
};

/** Centros de datos (PoP) de Cloudflare en Colombia, desde summary.json. */
export function popsColombia(json) {
  const comps = Array.isArray(json?.components) ? json.components : [];
  return comps
    .filter((c) => typeof c?.name === 'string' && /,\s*Colombia\b/.test(c.name))
    .map((c) => {
      const m = c.name.match(/^(.+?),\s*Colombia\s*-\s*\((\w+)\)/);
      return { ciudad: m ? m[1] : c.name, codigo: m ? m[2] : '', estado: COMPONENTE[c.status] ?? 'aviso', crudo: c.status };
    });
}
