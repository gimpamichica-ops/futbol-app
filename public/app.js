import { ligas, equipos } from './ligas.js';
import { hora, dia, fechaHora, competidores, foco, vivo, agrupar, paralelo, estadoPartido, finalizado, marcador, resumenEquipo, eventosClave, posicion } from './logica.js';
import { base, pedir } from './datos.js';
const app = document.querySelector('#app');
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
})[c]);
const imagen = t => {
  const u = t?.logo || t?.logos?.[0]?.href;
  return u && /^https:\/\//.test(u) ? `<img src="${esc(u)}" alt="Escudo de ${esc(t.displayName || t.name)}" loading="lazy">` : '';
};
const nombre = t => esc(t?.displayName || t?.name || 'Equipo');
const puntaje = c => esc(marcador(c));
const estado = e => vivo(e) ? `<span class="live">EN VIVO · ${esc(estadoPartido(e).displayClock || estadoPartido(e).type.shortDetail || '')}</span>` : finalizado(e) ? 'Final' : 'Programado';

function tarjeta(e) {
  const cs = competidores(e);
  const a = cs.find(c => c.homeAway === 'home') || cs[0];
  const b = cs.find(c => c.homeAway === 'away') || cs[1];
  return `<a class="card partido ${foco(e) ? 'destacado' : ''}" href="#/partido/${encodeURIComponent(e.slug)}/${encodeURIComponent(e.id)}"><small>${esc(ligas.find(l => l.slug === e.slug)?.nombre)} · ${e.date ? fechaHora(e.date) : ''}</small><div class="equipos"><span class="equipo">${imagen(a?.team)}${nombre(a?.team)}</span><span class="marcador">${puntaje(a)} : ${puntaje(b)}</span><span class="equipo">${imagen(b?.team)}${nombre(b?.team)}</span></div>${estado(e)}</a>`;
}
let fecha = dia(new Date()),
  grupo = 'Todas',
  seleccion = ligas[0].slug,
  version = 0,
  hayVivo = false;

function avisos(resultados) {
  const fallos = resultados.filter(r => !r.ok).length;
  const viejos = resultados.some(r => r.ok && r.valor.obsoleto);
  return `${fallos ? `<p class="aviso">No pudimos cargar ${fallos} consulta(s). Podés volver a intentar.</p>` : ''}${viejos ? '<p class="aviso">Mostrando datos guardados. No pudimos actualizarlos.</p>' : ''}`;
}
const botonReintentar = '<button id="actualizar">Actualizar</button>';

function enlazarActualizar() {
  document.querySelector('#actualizar')?.addEventListener('click', () => render());
}

async function inicio(v) {
  const trabajos = equipos.flatMap(eq => eq.ligas.flatMap(slug => [false, true].map(fixture => ({
    eq,
    slug,
    fixture
  }))));
  const rs = await paralelo(trabajos, async t => ({
    ...(await pedir(`${base}${t.slug}/teams/${t.eq.id}/schedule${t.fixture ? '?fixture=true' : ''}`)),
    ...t
  }));
  if (v !== version) return;
  let html = '<h1>Mis equipos</h1>' + botonReintentar + avisos(rs);
  for (const eq of equipos) {
    const eventos = new Map();
    for (const r of rs) {
      if (r.ok && r.valor.eq.id === eq.id) {
        for (const e of r.valor.data.events || []) {
          if (competidores(e).some(c => String(c.team?.id) === eq.id)) eventos.set(e.id, {
            ...e,
            slug: r.valor.slug
          });
        }
      }
    }
    const {
      ultimo,
      proximo,
      vivos
    } = resumenEquipo(eventos.values());
    hayVivo ||= vivos.length > 0;
    html += `<section><h2>${esc(eq.nombre)}</h2>${vivos.map(tarjeta).join('')}<h3>Último resultado</h3>${ultimo ? tarjeta(ultimo) : '<p class="muted">No hay resultados disponibles.</p>'}<h3>Próximo partido</h3>${proximo ? tarjeta(proximo) : '<p class="muted">No hay próximos partidos disponibles.</p>'}</section>`;
  }
  app.innerHTML = html;
  enlazarActualizar();
}

function mover(n) {
  const d = new Date(fecha + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  fecha = d.toISOString().slice(0, 10);
  render();
}

async function partidos(v) {
  app.innerHTML = `<h1>Partidos</h1><div class="controles"><button id="anterior" aria-label="Día anterior">←</button><button data-dia="-1">Ayer</button><button data-dia="0">Hoy</button><button data-dia="1">Mañana</button><button id="siguiente" aria-label="Día siguiente">→</button><label>Fecha <input id="fecha" type="date" value="${fecha}"></label></div><div class="chips" aria-label="Grupo de competición">${['Todas', ...new Set(ligas.map(l => l.grupo))].map(g => `<button data-grupo="${esc(g)}" aria-pressed="${g === grupo}">${esc(g)}</button>`).join('')}</div>${botonReintentar}<div id="lista">Cargando partidos…</div>`;
  document.querySelector('#anterior').onclick = () => mover(-1);
  document.querySelector('#siguiente').onclick = () => mover(1);
  document.querySelector('#fecha').onchange = e => {
    if (e.target.value) {
      fecha = e.target.value;
      render();
    }
  };
  document.querySelectorAll('[data-dia]').forEach(b => b.onclick = () => {
    fecha = dia(new Date());
    mover(Number(b.dataset.dia));
  });
  document.querySelectorAll('[data-grupo]').forEach(b => b.onclick = () => {
    grupo = b.dataset.grupo;
    render();
  });
  enlazarActualizar();
  const elegidas = ligas.filter(l => grupo === 'Todas' || l.grupo === grupo);
  const rs = await paralelo(elegidas, async l => ({
    ...(await pedir(`${base}${l.slug}/scoreboard?dates=${fecha.replaceAll('-', '')}`, 'scoreboard')),
    slug: l.slug
  }));
  if (v !== version) return;
  const eventos = rs.flatMap(r => r.ok ? (r.valor.data.events || []).map(e => ({
    ...e,
    slug: r.valor.slug
  })) : []);
  hayVivo = eventos.some(vivo);
  const destacados = eventos.filter(foco).sort((a, b) => new Date(a.date) - new Date(b.date));
  document.querySelector('#lista').innerHTML = avisos(rs) + (destacados.length ? '<h2>Mis equipos</h2>' + destacados.map(tarjeta).join('') : '') + agrupar(eventos, elegidas).map(l => `<section><h2>${esc(l.nombre)}</h2>${l.eventos.map(tarjeta).join('')}</section>`).join('') + (!eventos.length ? '<p>No hay partidos disponibles para esta fecha y filtro.</p>' : '');
}
// possessionPct viene como 60.4 y passPct como 0.9: se muestran ambos como %.
const porcentaje = (key, v) => v == null ? v : key === 'possessionPct' ? Math.round(parseFloat(v)) + '%' : key === 'passPct' ? Math.round(parseFloat(v) * 100) + '%' : v;
const estadisticas = {
  possessionPct: 'Posesión',
  totalShots: 'Remates',
  shotsOnTarget: 'Remates al arco',
  wonCorners: 'Córners',
  foulsCommitted: 'Faltas',
  yellowCards: 'Amarillas',
  redCards: 'Rojas',
  offsides: 'Offsides',
  saves: 'Atajadas',
  accuratePasses: 'Pases precisos',
  passPct: '% de pases'
};

async function detalle(slug, id, v) {
  if (!ligas.some(l => l.slug === slug) || !/^\d+$/.test(id || '')) throw Error('Partido inválido');
  const r = await pedir(`${base}${slug}/summary?event=${id}`, 'summary');
  if (v !== version) return;
  const d = r.data;
  const c = d.header?.competitions?.[0];
  if (!c) throw Error('No hay detalle disponible');
  const e = {
    id,
    slug,
    date: c.date || d.header.date,
    status: c.status,
    competitions: [c]
  };
  hayVivo = vivo(e);
  const teams = d.boxscore?.teams || [];
  let stats = '';
  for (const [key, label] of Object.entries(estadisticas)) {
    const values = teams.slice(0, 2).map(t => porcentaje(key, t.statistics?.find(s => s.name === key)?.displayValue));
    if (values.every(x => x == null)) continue;
    const nums = values.map(x => parseFloat(x) || 0),
      total = nums[0] + nums[1];
    stats += `<div class="dato"><span>${esc(values[0] ?? '—')}</span><span>${label}</span><span>${esc(values[1] ?? '—')}</span></div><div class="barra" role="img" aria-label="${label}: ${esc(values[0] ?? 'sin dato')} a ${esc(values[1] ?? 'sin dato')}"><span style="width:${total ? 100 * nums[0] / total : 50}%"></span></div>`;
  }
  const eventos = eventosClave(d.keyEvents || []).map(texto => `<li>${esc(texto)}</li>`).join('');
  const formaciones = (d.rosters || []).map(t => {
    const jugadores = t.roster || [];
    const fila = p => `<li>${esc(p.jersey || p.athlete?.jersey || '—')} · ${esc(p.athlete?.displayName)} <small>${esc(posicion(p.position?.abbreviation))}${p.subbedIn ? ' · Ingresó' : ''}${p.subbedOut ? ' · Salió' : ''}</small></li>`;
    return `<section class="card"><h3>${nombre(t.team)} ${esc(t.formation || '')}</h3>${jugadores.some(p => p.starter) ? '<h4>Titulares</h4><ul>' + jugadores.filter(p => p.starter).sort((a, b) => (a.formationPlace || 0) - (b.formationPlace || 0)).map(fila).join('') + '</ul><h4>Suplentes</h4><ul>' + jugadores.filter(p => !p.starter).map(fila).join('') + '</ul>' : '<p>Formaciones aún no confirmadas.</p>'}</section>`;
  }).join('');
  const arbitros = d.gameInfo?.officials?.map(o => o.fullName || o.displayName).filter(Boolean).join(', ');
  app.innerHTML = `<a href="#/partidos">← Partidos</a><h1>Detalle del partido</h1>${botonReintentar}${avisos([{
    ok: true,
    valor: r
  }])}${tarjeta(e)}<p>Estadio: ${esc(d.gameInfo?.venue?.fullName || c.venue?.fullName || 'Sin confirmar')}<br>Árbitro: ${esc(arbitros || 'Sin confirmar')}</p><h2>Goles y eventos</h2>${eventos ? '<ul>' + eventos + '</ul>' : '<p>No hay eventos disponibles.</p>'}<h2>Estadísticas</h2>${teams.length ? `<div class="dato"><strong>${nombre(teams[0]?.team)}</strong><strong>${nombre(teams[1]?.team)}</strong></div>` : ''}${stats || '<p>Estadísticas aún no disponibles.</p>'}<h2>Formaciones</h2><div class="columnas">${formaciones || '<p>Formaciones aún no confirmadas.</p>'}</div>`;
  enlazarActualizar();
}

const rango = en => Number(en.stats?.find(s => s.name === 'rank')?.value) || 99;

function tablasDe(n) {
  return [...(n.standings?.entries?.length ? [{
    nombre: (n.name || 'Posiciones').replace(/^Group /, 'Zona '),
    entries: [...n.standings.entries].sort((x, y) => rango(x) - rango(y))
  }] : []), ...(n.children || []).flatMap(tablasDe)];
}

async function tablas(v) {
  app.innerHTML = `<h1>Tablas</h1><label>Competición <select id="liga">${ligas.map(l => `<option value="${l.slug}" ${l.slug === seleccion ? 'selected' : ''}>${esc(l.nombre)}</option>`).join('')}</select></label> ${botonReintentar}<div id="tabla">Cargando posiciones…</div>`;
  document.querySelector('#liga').onchange = e => {
    seleccion = e.target.value;
    render();
  };
  enlazarActualizar();
  const r = await pedir(`https://site.api.espn.com/apis/v2/sports/soccer/${seleccion}/standings`);
  if (v !== version) return;
  const ts = tablasDe(r.data);
  document.querySelector('#tabla').innerHTML = avisos([{
    ok: true,
    valor: r
  }]) + (ts.map(t => `<h2>${esc(t.nombre)}</h2><div class="scroll"><table><caption>${esc(ligas.find(l => l.slug === seleccion)?.nombre)} · ${esc(t.nombre)}</caption><thead><tr><th scope="col">Equipo</th>${[['rank', '#'], ['gamesPlayed', 'PJ'], ['wins', 'PG'], ['ties', 'PE'], ['losses', 'PP'], ['pointDifferential', 'DG'], ['points', 'Pts']].map(([k, label]) => `<th scope="col">${label}</th>`).join('')}</tr></thead><tbody>${t.entries.map(en => `<tr><th scope="row">${imagen(en.team)} ${nombre(en.team)}</th>${['rank', 'gamesPlayed', 'wins', 'ties', 'losses', 'pointDifferential', 'points'].map(k => `<td>${esc(en.stats?.find(s => s.name === k)?.displayValue ?? '—')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`).join('') || '<p>Esta competición no tiene tabla disponible.</p>');
}

async function render() {
  const v = ++version;
  hayVivo = false;
  const [pantalla, slug, id] = (location.hash.slice(2) || 'inicio').split('/');
  document.querySelectorAll('nav a').forEach(a => {
    if (a.hash === '#/' + pantalla) a.setAttribute('aria-current', 'page');else a.removeAttribute('aria-current');
  });
  app.innerHTML = '<p>Cargando…</p>';
  try {
    if (pantalla === 'inicio') await inicio(v);else if (pantalla === 'partidos') await partidos(v);else if (pantalla === 'partido') await detalle(slug, id, v);else if (pantalla === 'tablas') await tablas(v);else app.innerHTML = '<h1>Página no encontrada</h1><a href="#/inicio">Volver al inicio</a>';
  } catch {
    if (v === version) {
      app.innerHTML = '<h1>No pudimos cargar los datos</h1><p>Revisá tu conexión y volvé a intentar.</p>' + botonReintentar;
      enlazarActualizar();
    }
  }
}
window.addEventListener('hashchange', () => {
  window.scrollTo(0, 0);
  render();
});
setInterval(() => {
  if (hayVivo && !document.hidden) render();
}, 60000);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && hayVivo) render();
});
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
render();
