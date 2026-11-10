import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  serieIODA, mediana, clasificar, evaluarSerie, combinar, peor, alertasActivas, eventosIODA, UMBRALES, MAX_RETRASO_S,
} from '../js/senales.js';
import { evaluarPais } from '../js/evaluar.js';

const leer = (n) => JSON.parse(readFileSync(new URL(`./muestras/${n}`, import.meta.url), 'utf8'));
const { ahora } = leer('ahora.json'); // 10 nov 2026, 22:57 UTC: momento en que se guardaron las muestras
const INICIO_CAIDA = 1792102800; // 15 oct 2026, 22:20 UTC: evento de IODA en Colombia

test('serieIODA lee la respuesta real de BGP de Colombia (24 h, paso de 5 min)', () => {
  const s = serieIODA(leer('ioda-co-bgp.json'));
  assert.equal(s.fuente, 'bgp');
  assert.equal(s.paso, 300);
  assert.equal(s.puntos.length, 289);
  assert.equal(s.puntos[1].t - s.puntos[0].t, 300);
  assert.ok(s.puntos.some((p) => p.v === null), 'los últimos minutos llegan vacíos (retraso de la fuente)');
});

test('serieIODA rechaza respuestas vacías o rotas', () => {
  assert.equal(serieIODA(null), null);
  assert.equal(serieIODA({ data: [] }), null);
  assert.equal(serieIODA({ data: [[{ values: 'x' }]] }), null);
});

test('mediana y clasificar', () => {
  assert.equal(mediana([3, 1, 2]), 2);
  assert.equal(mediana([4, 1, 2, 3]), 2.5);
  assert.equal(mediana([]), null);
  assert.equal(clasificar(0.99, UMBRALES.bgp), 'normal');
  assert.equal(clasificar(0.95, UMBRALES.bgp), 'aviso');
  assert.equal(clasificar(0.89, UMBRALES.bgp), 'caida');
  assert.equal(clasificar(NaN, UMBRALES.bgp), 'sin-dato');
});

test('día normal (10 nov): BGP, sondeo y telescopio de Colombia en «normal»', () => {
  const r = evaluarPais({ bgp: leer('ioda-co-bgp.json'), ping: leer('ioda-co-ping.json'), telescopio: leer('ioda-co-telescopio.json') }, ahora);
  assert.equal(r.senales.bgp.estado, 'normal');
  assert.ok(Math.abs(r.senales.bgp.razon - 1) < 0.01);
  assert.equal(r.senales.ping.estado, 'normal');
  assert.equal(r.senales.telescopio.estado, 'normal');
  assert.equal(r.estado, 'normal');
  assert.deepEqual(r.motivos, []);
});

test('caída real del 15 oct: el sondeo activo cae al 6 % de su mediana', () => {
  const ev = evaluarSerie(serieIODA(leer('caida-2026-10-15-ping.json')), UMBRALES.ping, { hasta: INICIO_CAIDA });
  assert.equal(ev.ultimo, 849);
  assert.equal(ev.estado, 'caida');
  assert.ok(ev.razon < 0.07 && ev.razon > 0.05, `razón ${ev.razon}`);
});

test('15 oct: solo el sondeo cae (BGP y telescopio normales) → «aviso», no «caída»', () => {
  const r = evaluarPais({
    bgp: leer('caida-2026-10-15-bgp.json'),
    ping: leer('caida-2026-10-15-ping.json'),
    telescopio: leer('caida-2026-10-15-telescopio.json'),
    alertas: leer('ioda-co-alertas.json'),
  }, INICIO_CAIDA + 60);
  assert.equal(r.senales.bgp.estado, 'normal');
  assert.equal(r.senales.telescopio.estado, 'normal');
  assert.equal(r.senales.ping.estado, 'caida');
  assert.equal(r.alertas.length, 1);
  assert.equal(r.estado, 'aviso');
  assert.match(r.motivos[0], /sondeo activo al 6 %/);
});

test('un dato con más de 3 h de retraso no sirve para hablar de «ahora»', () => {
  const s = serieIODA(leer('ioda-co-bgp.json'));
  const ev = evaluarSerie(s, UMBRALES.bgp, { hasta: ahora + MAX_RETRASO_S + 3600 });
  assert.equal(ev.estado, 'sin-dato');
  assert.match(ev.motivo, /3 h/);
});

test('red móvil (Claro AS26611): casi nada responde al ping → «sin dato», no «caída»', () => {
  const ev = evaluarSerie(serieIODA(leer('ioda-as26611-ping.json')), UMBRALES.ping, { hasta: ahora });
  assert.equal(ev.estado, 'sin-dato');
  assert.equal(ev.motivo, 'muy pocas redes medibles');
});

test('combinar: BGP basta; otra señal sola solo avisa; dos señales confirman', () => {
  assert.equal(combinar({ bgp: 'caida', ping: 'normal' }), 'caida');
  assert.equal(combinar({ bgp: 'normal', ping: 'caida', telescopio: 'normal' }), 'aviso');
  assert.equal(combinar({ bgp: 'aviso', ping: 'caida', telescopio: 'caida' }), 'caida');
  assert.equal(combinar({ bgp: 'normal', ping: 'normal' }, { extras: 1 }), 'aviso');
  assert.equal(combinar({ bgp: 'sin-dato', ping: 'sin-dato' }), 'sin-dato');
  assert.equal(combinar({ bgp: 'normal', ping: 'sin-dato' }), 'normal');
  assert.equal(peor(['normal', 'caida', 'aviso']), 'caida');
});

test('alertasActivas: la alerta crítica del 15 oct está activa solo hasta que llega la «normal»', () => {
  const al = leer('ioda-co-alertas.json');
  const activa = alertasActivas(al, INICIO_CAIDA + 60);
  assert.equal(activa.length, 1);
  assert.equal(activa[0].nivel, 'critical');
  assert.equal(activa[0].fuente, 'ping-slash24');
  assert.equal(alertasActivas(al, INICIO_CAIDA + 2400 + 60).length, 0);
  assert.equal(alertasActivas(al, ahora).length, 0);
});

test('eventosIODA: dos caídas en 30 días, la más reciente primero', () => {
  const ev = eventosIODA(leer('ioda-co-eventos.json'));
  assert.equal(ev.length, 2);
  assert.ok(ev[0].inicio > ev[1].inicio);
  assert.equal(ev[1].inicio, INICIO_CAIDA);
  assert.equal(ev[1].duracion, 2400);
});
