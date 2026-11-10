// Página /proceso/: gráficas en SVG propio con datos reales guardados.
import { iniciarTema } from './tema.js';
import { serieIODA, mediana } from './senales.js';
import { rutaSerie, normalizar } from './graficas.js';

iniciarTema(document.getElementById('tema'));

const NS = 'http://www.w3.org/2000/svg';
function svg(w, h, html) {
  const s = document.createElementNS(NS, 'svg');
  s.setAttribute('viewBox', `0 0 ${w} ${h}`);
  s.setAttribute('class', 'grafica');
  s.setAttribute('aria-hidden', 'true');
  s.innerHTML = html;
  return s;
}

// 1. Retraso medido el 10 nov 2026, 22:57 UTC (minutos hasta el último dato no vacío).
function graficaRetraso() {
  const datos = [
    ['Sondeo activo (IODA)', 17],
    ['BGP (IODA)', 42],
    ['Telescopio (IODA)', 62],
    ['Visibilidad (RIPEstat)', 417],
  ];
  const W = 500; const fila = 34; const izq = 190; const H = datos.length * fila + 28;
  const max = 420;
  const x = (m) => izq + (m / max) * (W - izq - 70);
  let h = '';
  for (const t of [0, 60, 180, 420]) {
    h += `<line class="g-reji" x1="${x(t)}" x2="${x(t)}" y1="4" y2="${H - 20}"/><text class="g-eje" x="${x(t)}" y="${H - 4}" text-anchor="middle">${t / 60 >= 1 ? `${t / 60} h` : '0'}</text>`;
  }
  datos.forEach(([n, m], i) => {
    const y = 8 + i * fila;
    h += `<text class="g-eje" x="${izq - 8}" y="${y + 15}" text-anchor="end">${n}</text>`;
    h += `<rect class="${m > 120 ? 'g-barra-r' : 'g-barra'}" x="${izq}" y="${y}" width="${x(m) - izq}" height="20"/>`;
    h += `<text class="g-val" x="${x(m) + 5}" y="${y + 15}">${m} min</text>`;
  });
  h += `<line class="g-base" x1="${izq}" x2="${izq}" y1="4" y2="${H - 20}"/>`;
  document.getElementById('g-retraso').append(svg(W, H, h));
}

// 2. La caída del 15 oct 2026: tres señales normalizadas por su mediana.
async function graficaCaida() {
  const caja = document.getElementById('g-caida');
  try {
    const r = await fetch('../datos/caida-2026-10-15.json');
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const b = await r.json();
    const W = 720; const H = 260; const mi = 46; const md = 12; const ms = 14; const mf = 30;
    const ancho = W - mi - md; const alto = H - ms - mf;
    const min = 0; const max = 1.75;
    const y = (v) => ms + (1 - (v - min) / (max - min)) * alto;
    let h = '';
    for (const v of [0, 0.5, 1]) h += `<line class="${v === 1 ? 'g-cien' : 'g-reji'}" x1="${mi}" x2="${W - md}" y1="${y(v)}" y2="${y(v)}"/><text class="g-eje" x="${mi - 6}" y="${y(v) + 4}" text-anchor="end">${v * 100} %</text>`;
    let t0 = null; let t1 = null;
    for (const k of ['telescopio', 'bgp', 'ping']) {
      const s = serieIODA(b[k]);
      t0 ??= s.puntos[0].t; t1 ??= s.puntos[s.puntos.length - 1].t;
      const base = mediana(s.puntos.filter((p) => p.t < b.inicio).map((p) => p.v));
      const { d } = rutaSerie(normalizar(s.puntos, base), ancho, alto, { m: 0, min, max });
      h += `<path class="g-linea g-l-${k}" transform="translate(${mi} ${ms})" d="${d}"/>`;
    }
    const x = (t) => mi + ((t - t0) / (t1 - t0)) * ancho;
    for (const [hrs, txt] of [[0, '−24 h'], [12, '−12 h'], [24, '5:50 p. m.']]) {
      h += `<text class="g-eje" x="${x(t0 + hrs * 3600)}" y="${H - 8}" text-anchor="${hrs === 0 ? 'start' : hrs === 24 ? 'end' : 'middle'}">${txt}</text>`;
    }
    const xi = x(b.inicio);
    h += `<line class="g-base" x1="${xi}" x2="${xi}" y1="${ms}" y2="${ms + alto}" stroke-dasharray="2 3"/>`;
    h += `<text class="g-nota" x="${xi - 6}" y="${y(0.18)}" text-anchor="end">sondeo: 6 %</text>`;
    h += `<text class="g-ley g-ley-bgp" x="${mi + 8}" y="${y(1.62)}">— BGP</text><text class="g-ley g-ley-telescopio" x="${mi + 78}" y="${y(1.62)}">— Telescopio</text><text class="g-ley g-ley-ping" x="${mi + 200}" y="${y(1.62)}">— Sondeo activo</text>`;
    caja.append(svg(W, H, h));
  } catch (e) {
    caja.textContent = `No se pudo cargar la gráfica (${e.message}).`;
  }
}

graficaRetraso();
graficaCaida();
