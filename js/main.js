// Página principal: pide todo en paralelo, pinta cada panel cuando llega y recalcula el veredicto.
import { iniciarTema } from './tema.js';
import { SITIOS, resumirSondeo } from './local.js';
import { OPERADORES, etiquetaOperador } from './operadores.js';
import { SERVICIOS, leerEstado, popsColombia } from './servicios.js';
import { evaluarPais, evaluarOperador } from './evaluar.js';
import { eventosIODA, NOMBRE_FUENTE } from './senales.js';
import { decidir } from './veredicto.js';
import { rutaSerie, normalizar, pct } from './graficas.js';
import { RESPALDO, sinConexionForzado, cargarPais, cargarOperador, cargarServicio, sondear } from './datos.js';

const $ = (id) => document.getElementById(id);
const ETIQUETA = { normal: 'Normal', aviso: 'Raro', caida: 'Caída', 'sin-dato': 'Sin dato' };
const ONOMA = { calma: 'PING', ambar: '¿BZZT?', rojo: '¡CRAC!', carga: 'PING…' };
const REFRESCO_MS = 5 * 60 * 1000;

const horaCO = new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', hour: 'numeric', minute: '2-digit' });
const fechaCO = new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

function el(tag, attrs = {}, ...hijos) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v; else if (k === 'text') n.textContent = v; else n.setAttribute(k, v);
  }
  for (const h of hijos) if (h != null) n.append(h);
  return n;
}
const chip = (estado, texto = ETIQUETA[estado]) => el('span', { class: `chip est-${estado}`, text: texto });

// ---------- estado global de una ronda ----------
let ronda = 0;
let estado;

function nuevaRonda() {
  ronda += 1;
  estado = { pais: null, operadores: new Map(), servicios: new Map(), local: null, pendientes: 0, origenes: [] };
  return ronda;
}

function fuenteTexto(nodo, resultados) {
  nodo.replaceChildren();
  const respaldos = resultados.filter((r) => r?.origen === 'respaldo');
  const errores = [...new Set(resultados.map((r) => r?.error).filter(Boolean))];
  if (respaldos.length) {
    nodo.append(el('span', { class: 'chip chip-ejemplo', text: `Sin conexión: datos de ejemplo del ${RESPALDO.fecha}` }));
  }
  if (errores.length) nodo.append(el('span', { class: 'motivo', text: `Qué pasó: ${errores.slice(0, 3).join(' · ')}` }));
}

// ---------- prueba local ----------
async function probarLocal(r) {
  const lista = $('sitios');
  lista.replaceChildren(...SITIOS.map((s) => el('li', { id: `s-${s.id}`, class: 'sitio probando' },
    el('span', { class: 'sitio-n', text: s.nombre }), el('span', { class: 'barra' }, el('i')), el('span', { class: 'sitio-ms', text: '…' }))));
  if (sinConexionForzado()) {
    estado.local = resumirSondeo([]);
    $('local-res').textContent = 'Modo de ejemplo: la prueba local no se hizo.';
    for (const li of lista.children) { li.className = 'sitio'; li.lastChild.textContent = '–'; }
    return;
  }
  $('local-res').textContent = `Probando ${SITIOS.length} sitios desde tu navegador…`;
  const res = await Promise.all(SITIOS.map(async (s) => {
    const x = await sondear(s);
    if (r !== ronda) return x;
    const li = $(`s-${s.id}`);
    li.className = `sitio ${x.ok ? 'ok' : 'falla'}`;
    li.querySelector('.sitio-ms').textContent = x.ok ? `${x.ms} ms` : 'no llega';
    li.querySelector('.barra i').style.width = x.ok ? `${Math.min(100, (x.ms / 1500) * 100)}%` : '100%';
    return x;
  }));
  if (r !== ronda) return;
  const s = resumirSondeo(res);
  estado.local = s;
  const textos = {
    ok: `Llegas a ${s.ok} de ${s.total} sitios · mediana ${s.mediana} ms.`,
    lento: `Llegas a ${s.ok} de ${s.total}, pero lento: mediana ${s.mediana} ms.`,
    parcial: `Solo llegas a ${s.ok} de ${s.total} sitios.`,
    'sin-conexion': 'Tu navegador no llega a ninguno de los sitios.',
  };
  $('local-res').textContent = textos[s.estado];
}

// ---------- Colombia ----------
const SENALES = [
  { k: 'bgp', nombre: 'BGP', ayuda: 'bloques de direcciones anunciados al mundo' },
  { k: 'ping', nombre: 'Sondeo activo', ayuda: 'redes que responden al ping' },
  { k: 'telescopio', nombre: 'Telescopio', ayuda: 'tráfico de fondo que llega desde Colombia' },
];

function chispa(serie, base) {
  const W = 220; const H = 44;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('class', 'chispa');
  svg.setAttribute('aria-hidden', 'true');
  if (!serie || !base) return svg;
  const n = normalizar(serie.puntos, base);
  const lo = Math.min(0.6, ...n.filter((p) => p.v !== null).map((p) => p.v));
  const hi = Math.max(1.15, ...n.filter((p) => p.v !== null).map((p) => p.v));
  const { d } = rutaSerie(n, W, H, { min: lo, max: hi });
  const y1 = 2 + (1 - (1 - lo) / (hi - lo)) * (H - 4);
  svg.innerHTML = `<line class="chispa-base" x1="0" x2="${W}" y1="${y1.toFixed(1)}" y2="${y1.toFixed(1)}"/><path class="chispa-linea" d="${d}"/>`;
  return svg;
}

function pintarPais(res) {
  const ev = evaluarPais(res.crudos, res.hasta);
  estado.pais = ev;
  const cont = $('senales');
  cont.replaceChildren(...SENALES.map(({ k, nombre, ayuda }) => {
    const s = ev.senales[k];
    const valor = Number.isFinite(s.razon) ? pct(s.razon) : '–';
    return el('div', { class: `senal est-borde-${s.estado}` },
      el('div', { class: 'senal-cab' }, el('strong', { text: nombre }), chip(s.estado)),
      chispa(ev.series[k], s.base),
      el('div', { class: 'senal-pie' },
        el('span', { class: 'senal-v', text: valor }),
        el('span', { class: 'senal-l', text: s.estado === 'sin-dato' ? (s.motivo ?? 'sin dato') : `de lo normal · ${ayuda}` })));
  }));
  const eventos = res.crudos?.eventos ? eventosIODA(res.crudos.eventos).slice(0, 3) : [];
  const hist = $('historial');
  hist.replaceChildren();
  if (ev.alertas.length) hist.append(el('strong', { class: 'rojo-t', text: `Alerta activa de IODA: ${ev.alertas.map((a) => NOMBRE_FUENTE[a.fuente] ?? a.fuente).join(', ')}. ` }));
  hist.append(eventos.length
    ? `Últimas caídas que detectó IODA (30 días): ${eventos.map((e) => `${fechaCO.format(e.inicio * 1000)} (${Math.max(1, Math.round(e.duracion / 60))} min)`).join(' · ')}.`
    : 'IODA no registró caídas en Colombia en los últimos 30 días.');
  fuenteTexto($('pais-fuente'), [res]);
  recalcular(res);
}

// ---------- operadores ----------
function celda(ev) {
  const td = el('td', { class: `c-${ev.estado}` });
  td.append(Number.isFinite(ev.razon) ? pct(ev.razon) : '–');
  if (ev.estado !== 'normal') td.title = ev.motivo ?? ETIQUETA[ev.estado];
  return td;
}

function pintarOperadores() {
  const filas = OPERADORES.map((op) => {
    const r = estado.operadores.get(op.asn);
    const nombre = el('th', { scope: 'row' }, el('span', { class: 'op-n', text: op.nombre }), el('span', { class: 'op-r', text: `${op.red} · AS${op.asn}` }));
    if (!r) return el('tr', { class: 'cargando' }, nombre, el('td', { colspan: '4', text: 'Consultando…' }));
    const ev = r.ev;
    return el('tr', {}, nombre, celda(ev.bgp), celda(ev.ping), celda(ev.vis), el('td', {}, chip(ev.estado)));
  });
  $('ops').replaceChildren(...filas);
  fuenteTexto($('op-fuente'), [...estado.operadores.values()].map((x) => x.res));
}

// ---------- servicios ----------
function pintarServicios() {
  $('srv').replaceChildren(...SERVICIOS.map((s) => {
    const r = estado.servicios.get(s.id);
    const st = r?.st;
    const est = r ? (st?.estado ?? 'sin-dato') : 'carga';
    return el('li', { class: `srv est-borde-${est}` },
      el('a', { href: `https://${s.dominio}`, target: '_blank', rel: 'noopener', text: s.nombre }),
      r ? chip(est, st ? (st.indicador === 'maintenance' ? 'Manten.' : est === 'aviso' ? 'Menor' : ETIQUETA[est]) : 'Sin dato') : el('span', { class: 'chip chip-carga', text: '…' }));
  }));
  const cf = estado.servicios.get('cloudflare');
  const pops = cf?.res?.crudos ? popsColombia(cf.res.crudos) : [];
  $('pops').replaceChildren(...(pops.length
    ? pops.map((p) => el('li', { class: `pop est-borde-${p.estado}`, title: `${p.ciudad}: ${p.crudo}` }, el('b', { text: p.codigo }), el('span', { class: 'pop-c', text: p.ciudad }), chip(p.estado)))
    : [el('li', { class: 'sub', text: cf ? 'Sin dato' : 'Consultando…' })]));
  fuenteTexto($('srv-fuente'), [...estado.servicios.values()].map((x) => x.res));
}

// ---------- veredicto ----------
function recalcular() {
  const terminado = estado.pendientes === 0;
  if (!estado.local || !estado.pais) {
    if (!terminado) return;
  }
  const operadores = OPERADORES.filter((o) => estado.operadores.has(o.asn))
    .map((o) => ({ nombre: etiquetaOperador(o), estado: estado.operadores.get(o.asn).ev.estado }));
  const servicios = SERVICIOS.filter((s) => estado.servicios.get(s.id)?.st)
    .map((s) => ({ nombre: s.nombre, estado: estado.servicios.get(s.id).st.estado }));
  const cf = estado.servicios.get('cloudflare');
  const pops = cf?.res?.crudos ? popsColombia(cf.res.crudos) : [];
  const enVivo = estado.origenes.filter((o) => o === 'vivo').length;
  const v = decidir({
    pais: estado.pais ? { estado: estado.pais.estado, motivos: estado.pais.motivos } : { estado: 'sin-dato', motivos: [] },
    operadores, servicios, pops, local: estado.local ?? { estado: 'sin-medir' }, enVivo,
  });
  const caja = $('respuesta');
  caja.dataset.tono = v.tono;
  $('onoma').textContent = ONOMA[v.tono];
  $('veredicto').replaceChildren(el('span', { class: `tit tit-${v.tono}`, text: v.titular }));
  $('explica').textContent = v.detalle;
  const est = $('estado');
  est.replaceChildren();
  const ejemplo = estado.origenes.some((o) => o === 'respaldo');
  if (!terminado) est.append(el('span', { class: 'chip chip-carga', text: 'Todavía llegan datos…' }));
  else if (ejemplo && enVivo === 0) est.append(el('span', { class: 'chip chip-ejemplo', text: `Sin conexión: datos de ejemplo del ${RESPALDO.fecha}` }));
  else est.append(el('span', { class: 'chip chip-vivo', text: ejemplo ? 'En vivo (parcial)' : 'En vivo' }));
  if (terminado) est.append(el('span', { text: `Revisado a las ${horaCO.format(new Date())}` }));
}

// ---------- ronda completa ----------
async function revisar() {
  const r = nuevaRonda();
  const boton = $('otra-vez');
  boton.disabled = true;
  $('respuesta').dataset.tono = 'carga';
  $('onoma').textContent = ONOMA.carga;
  $('veredicto').replaceChildren(el('span', { class: 'cargando-txt', text: 'Consultando…' }));
  $('explica').textContent = 'Midiendo tu conexión y pidiendo las señales de Colombia.';
  $('estado').replaceChildren(el('span', { class: 'chip chip-carga', text: 'Cargando' }));
  pintarOperadores();
  pintarServicios();

  const tareas = [];
  const seguir = (p, alLlegar) => {
    estado.pendientes += 1;
    tareas.push(p.then((res) => { if (r === ronda) { estado.origenes.push(res.origen); alLlegar(res); } })
      .catch((e) => { if (r === ronda) alLlegar({ origen: 'error', crudos: null, error: e.message, hasta: Math.floor(Date.now() / 1000) }); })
      .finally(() => { if (r === ronda) { estado.pendientes -= 1; recalcular(); } }));
  };

  estado.pendientes += 1;
  tareas.push(probarLocal(r).finally(() => { if (r === ronda) { estado.pendientes -= 1; recalcular(); } }));
  seguir(cargarPais(), pintarPais);
  for (const op of OPERADORES) {
    seguir(cargarOperador(op), (res) => { estado.operadores.set(op.asn, { res, ev: evaluarOperador(res.crudos, res.hasta) }); pintarOperadores(); });
  }
  for (const s of SERVICIOS) {
    seguir(cargarServicio(s), (res) => { estado.servicios.set(s.id, { res, st: leerEstado(res.crudos) }); pintarServicios(); });
  }
  await Promise.allSettled(tareas);
  if (r === ronda) boton.disabled = false;
}

iniciarTema($('tema'));
$('otra-vez').addEventListener('click', revisar);
revisar();
setInterval(() => { if (document.visibilityState === 'visible' && !$('otra-vez').disabled) revisar(); }, REFRESCO_MS);
