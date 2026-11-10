import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decidir } from '../js/veredicto.js';
import { evaluarPais, evaluarOperador } from '../js/evaluar.js';
import { OPERADORES, etiquetaOperador } from '../js/operadores.js';
import { SERVICIOS, leerEstado, popsColombia } from '../js/servicios.js';

const normal = { estado: 'normal', motivos: [] };
const localOk = { estado: 'ok', ok: 6, total: 6 };

test('sin conexión local y ninguna fuente en vivo → «Solo tú» (tu conexión)', () => {
  const v = decidir({ pais: { estado: 'sin-dato' }, local: { estado: 'sin-conexion', ok: 0, total: 6 }, enVivo: 0 });
  assert.equal(v.codigo, 'tu-conexion');
  assert.equal(v.titular, 'Solo tú');
});

test('país en caída manda sobre todo lo demás (salvo tu propia desconexión)', () => {
  const v = decidir({ pais: { estado: 'caida', motivos: ['BGP al 80 % de lo normal'] }, local: localOk, enVivo: 9 });
  assert.equal(v.codigo, 'caida-pais');
  assert.equal(v.titular, 'Sí');
  assert.match(v.detalle, /BGP al 80 %/);
});

test('operadores caídos se nombran en el titular', () => {
  const v = decidir({ pais: normal, operadores: [{ nombre: 'ETB hogar', estado: 'caida' }, { nombre: 'Claro móvil', estado: 'caida' }, { nombre: 'Movistar', estado: 'normal' }], local: localOk, enVivo: 9 });
  assert.equal(v.codigo, 'caida-operador');
  assert.equal(v.titular, 'Sí, en ETB hogar y Claro móvil');
});

test('señal rara sin confirmar → «Quizá»', () => {
  const v = decidir({ pais: { estado: 'aviso', motivos: ['sondeo activo al 6 % de lo normal'] }, local: localOk, enVivo: 9 });
  assert.equal(v.codigo, 'raro');
  assert.equal(v.titular, 'Quizá');
  const w = decidir({ pais: normal, operadores: [{ nombre: 'Tigo UNE hogar', estado: 'aviso' }], local: localOk, enVivo: 9 });
  assert.match(w.detalle, /Tigo UNE hogar/);
});

test('internet bien pero un servicio grande caído → «No: es <servicio>»', () => {
  const v = decidir({ pais: normal, servicios: [{ nombre: 'Discord', estado: 'caida' }, { nombre: 'GitHub', estado: 'aviso' }], local: localOk, enVivo: 9 });
  assert.equal(v.codigo, 'servicio');
  assert.equal(v.titular, 'No: es Discord');
  const w = decidir({ pais: normal, pops: [{ ciudad: 'Bogotá', estado: 'caida' }], local: localOk, enVivo: 9 });
  assert.equal(w.titular, 'No: es Cloudflare Bogotá');
});

test('Colombia normal y tu prueba parcial o lenta → «Solo tú»', () => {
  const v = decidir({ pais: normal, local: { estado: 'parcial', ok: 2, total: 6 }, enVivo: 9 });
  assert.equal(v.codigo, 'solo-tu');
  assert.match(v.detalle, /2 de 6/);
  assert.match(decidir({ pais: normal, local: { estado: 'lento' }, enVivo: 9 }).detalle, /lento/);
});

test('sin datos del país pero conexión local bien → «No sé»', () => {
  const v = decidir({ pais: { estado: 'sin-dato' }, local: localOk, enVivo: 2 });
  assert.equal(v.codigo, 'sin-datos');
  assert.match(v.detalle, /Tu conexión funciona/);
});

test('todo normal → «No»; entrada vacía no rompe', () => {
  assert.equal(decidir({ pais: normal, local: localOk, enVivo: 9 }).titular, 'No');
  assert.equal(decidir(undefined).codigo, 'sin-datos');
});

test('los datos de ejemplo guardados (10 nov 2026) dan «No»', () => {
  const b = JSON.parse(readFileSync(new URL('../datos/ejemplo-2026-11-10.json', import.meta.url), 'utf8'));
  const pais = evaluarPais(b.pais, b.ahora);
  const operadores = OPERADORES.map((o) => ({ nombre: etiquetaOperador(o), ...evaluarOperador(b.operadores[o.asn], b.ahora) }));
  const servicios = SERVICIOS.map((s) => ({ nombre: s.nombre, ...leerEstado(b.servicios[s.dominio]) }));
  const pops = popsColombia(b.servicios['www.cloudflarestatus.com']);
  assert.equal(pais.estado, 'normal');
  assert.ok(operadores.every((o) => o.estado === 'normal'), JSON.stringify(operadores.map((o) => [o.nombre, o.estado])));
  assert.equal(servicios.length, 9);
  assert.equal(pops.length, 4);
  const v = decidir({ pais, operadores, servicios, pops, local: { estado: 'sin-medir' }, enVivo: 0 });
  assert.equal(v.codigo, 'normal');
});
