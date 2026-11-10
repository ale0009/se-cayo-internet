import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { visibilidadRIPE, evaluarVisibilidad, OPERADORES, VISIBILIDAD_FRESCA_S } from '../js/operadores.js';
import { leerEstado, popsColombia, urlEstado, SERVICIOS } from '../js/servicios.js';
import { resumirSondeo, SITIOS } from '../js/local.js';
import { evaluarOperador } from '../js/evaluar.js';
import { rutaSerie, normalizar, pct } from '../js/graficas.js';

const leer = (n) => JSON.parse(readFileSync(new URL(`./muestras/${n}`, import.meta.url), 'utf8'));
const { ahora } = leer('ahora.json');

test('RIPEstat: Tigo UNE (AS13489) visible para 318 de 320 pares con tabla completa', () => {
  const v = visibilidadRIPE(leer('ripestat-vis-as13489.json'));
  assert.equal(v.total, 320);
  assert.equal(v.vistos, 318);
  assert.equal(evaluarVisibilidad(v, ahora).estado, 'normal');
  assert.equal(visibilidadRIPE({ data: {} }), null);
});

test('visibilidad vieja: aunque marque caída, solo puede avisar', () => {
  const t = 1_800_000_000;
  const caida = { razon: 0.3, t };
  assert.equal(evaluarVisibilidad(caida, t + 600).estado, 'caida');
  const vieja = evaluarVisibilidad(caida, t + VISIBILIDAD_FRESCA_S + 1);
  assert.equal(vieja.estado, 'aviso');
  assert.equal(vieja.vieja, true);
  assert.equal(evaluarVisibilidad(null, t).estado, 'sin-dato');
});

test('operador con muestras reales (Tigo UNE, 10 nov) → normal', () => {
  const r = evaluarOperador({ bgp: leer('ioda-as13489-bgp.json'), visibilidad: leer('ripestat-vis-as13489.json') }, ahora);
  assert.equal(r.bgp.estado, 'normal');
  assert.equal(r.ping.estado, 'sin-dato'); // no se pasó la serie de ping
  assert.equal(r.estado, 'normal');
  assert.equal(OPERADORES.length, 5);
  assert.ok(OPERADORES.every((o) => Number.isInteger(o.asn)));
});

test('Statuspage: GitHub sin incidentes y los 4 centros de Cloudflare en Colombia', () => {
  assert.deepEqual(leerEstado(leer('statuspage-github.json')), { indicador: 'none', estado: 'normal', descripcion: 'All Systems Operational' });
  const cf = leer('cloudflare-colombia.json');
  assert.equal(leerEstado(cf).estado, 'aviso'); // «minor»: algo pequeño en algún lugar del mundo
  const pops = popsColombia(cf);
  assert.deepEqual(pops.map((p) => p.codigo).sort(), ['BAQ', 'BOG', 'CLO', 'MDE']);
  assert.ok(pops.every((p) => p.estado === 'normal'));
  assert.equal(leerEstado({}), null);
  assert.equal(leerEstado({ status: { indicator: 'major' } }).estado, 'caida');
  assert.equal(urlEstado(SERVICIOS.find((s) => s.id === 'cloudflare')), 'https://www.cloudflarestatus.com/api/v2/summary.json');
});

test('popsColombia traduce estados de componentes', () => {
  const pops = popsColombia({ components: [
    { name: 'Bogotá, Colombia - (BOG)', status: 'major_outage' },
    { name: 'Lima, Peru - (LIM)', status: 'major_outage' },
    { name: 'Cali, Colombia - (CLO)', status: 'partial_outage' },
  ] });
  assert.deepEqual(pops.map((p) => [p.ciudad, p.estado]), [['Bogotá', 'caida'], ['Cali', 'aviso']]);
});

test('resumirSondeo: bien, lento, parcial, sin conexión y sin medir', () => {
  const ok = (ms) => ({ ok: true, ms });
  const no = { ok: false, ms: null };
  assert.equal(SITIOS.length, 6);
  assert.deepEqual(resumirSondeo([ok(100), ok(200), ok(300)]), { total: 3, ok: 3, mediana: 200, estado: 'ok' });
  assert.equal(resumirSondeo([ok(2000), ok(2500), ok(1800)]).estado, 'lento');
  assert.equal(resumirSondeo([ok(100), ok(200), ok(150), ok(120), no, no]).estado, 'parcial');
  assert.equal(resumirSondeo([ok(100), ok(200), ok(150), ok(120), ok(90), no]).estado, 'ok');
  assert.equal(resumirSondeo([no, no]).estado, 'sin-conexion');
  assert.equal(resumirSondeo([]).estado, 'sin-medir');
});

test('rutaSerie corta la línea en los huecos y normalizar/pct', () => {
  const p = [{ t: 0, v: 1 }, { t: 1, v: 2 }, { t: 2, v: null }, { t: 3, v: 2 }, { t: 4, v: 1 }];
  const r = rutaSerie(p, 100, 40);
  assert.equal((r.d.match(/M/g) || []).length, 2);
  assert.equal(r.min, 1);
  assert.equal(r.max, 2);
  assert.equal(rutaSerie([{ t: 0, v: 1 }], 10, 10).d, '');
  assert.deepEqual(normalizar([{ t: 0, v: 50 }, { t: 1, v: null }], 100).map((x) => x.v), [0.5, null]);
  assert.equal(pct(0.973), '97 %');
  assert.equal(pct(0.0582, 1), '5,8 %');
  assert.equal(pct(undefined), '–');
});
