import { ligas, equipos } from './ligas.js';
import { hora, dia, fechaAmigable, competidores, foco, vivo, agrupar, paralelo, estadoPartido, finalizado, marcador, resumenEquipo, eventosClave, destacadosPartido, posicion } from './logica.js';
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
  return u && /^https:\/\//.test(u) ? `<img src="${esc(u)}" alt="Escudo de ${esc(t.displayName || t.name)}" loading="lazy">` : `<span class="iniciales" aria-hidden="true">${esc((t?.displayName || t?.name || 'Equipo').split(/\s+/).map(n => n[0]).slice(0, 2).join(''))}</span>`;
};
const nombre = t => esc(t?.displayName || t?.name || 'Equipo');
const puntaje = c => esc(marcador(c));
const estado = e => vivo(e) ? `<span class="estado live">EN VIVO · ${esc(estadoPartido(e)?.displayClock || estadoPartido(e)?.type?.shortDetail || '')}</span>` : finalizado(e) ? '<span class="estado final">Final</span>' : '';
const colorEquipo = id => ({202: '#75aadb', 9743: '#0a7a3d', 20232: '#f7b5cd'}[id] || '#3ddc84');
const skeleton = '<div class="skeletons" role="status" aria-label="Cargando"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div>';
const titulo = texto => '<div class="titulo"><h1>' + texto + '</h1>' + botonReintentar + '</div>';
function tarjeta(e, detalle = false) {
  const cs = competidores(e);
  const a = cs.find(c => c.homeAway === 'home') || cs[0];
  const b = cs.find(c => c.homeAway === 'away') || cs[1];
  const jugado = vivo(e) || finalizado(e);
  const numero = (c, rival) => '<span class="' + (Number(marcador(c)) < Number(marcador(rival)) ? 'perdedor' : '') + '">' + puntaje(c) + '</span>';
  const favorito = cs.find(c => equipos.some(eq => eq.id === String(c.team?.id)));
  const contenido = `<div class="partido-meta"><span class="chip">${esc(ligas.find(l => l.slug === e.slug)?.nombre)}</span><small>${e.date ? esc(fechaAmigable(e.date)) : 'Fecha a confirmar'}</small></div><div class="equipos"><span class="equipo">${imagen(a?.team)}<span class="nombre-equipo">${nombre(a?.team)}</span></span><div class="centro"><span class="marcador">${jugado ? numero(a,b) + ' - ' + numero(b,a) : e.date ? esc(hora(e.date)) : 'A confirmar'}</span>${estado(e)}</div><span class="equipo">${imagen(b?.team)}<span class="nombre-equipo">${nombre(b?.team)}</span></span></div>${detalle && e.date ? '<p class="muted fecha-detalle">' + esc(dia(e.date)) + ' · ' + esc(hora(e.date)) + '</p>' : ''}`;
  const clase = `card partido ${foco(e) ? 'destacado' : ''} ${detalle ? 'marcador-detalle' : ''}`;
  const estilo = 'style="--equipo-color:' + colorEquipo(favorito?.team?.id) + '"';
  return detalle ? `<section class="${clase}" ${estilo}>${contenido}</section>` : `<a class="${clase}" ${estilo} href="#/partido/${encodeURIComponent(e.slug)}/${encodeURIComponent(e.id)}">${contenido}</a>`;
}
let fecha = dia(new Date()),
  grupo = 'Todas',
  seleccion = ligas[0].slug,
  version = 0,
  hayVivo = false;

function avisos(resultados) {
  const fallos = resultados.filter(r => !r.ok).length;
  const viejos = resultados.some(r => r.ok && r.valor.obsoleto);
  return `${fallos ? `<p class="aviso">ⓘ No pudimos cargar ${fallos} consulta(s). Podés volver a intentar.</p>` : ''}${viejos ? '<p class="aviso">ⓘ Mostrando datos guardados. No pudimos actualizarlos.</p>' : ''}`;
}
const botonReintentar = '<button id="actualizar" class="actualizar" aria-label="Actualizar" title="Actualizar">↻</button>';

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
  let html = titulo('Mis equipos') + avisos(rs);
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
      vivos
    } = resumenEquipo(eventos.values());
    const proximo = resumenEquipo([...eventos.values()].filter(e => !vivo(e))).proximo;
    hayVivo ||= vivos.length > 0;
    const equipoEvento = [...eventos.values()].flatMap(competidores).find(c => String(c.team?.id) === eq.id)?.team;
    const logo = equipoEvento?.logo || equipoEvento?.logos?.[0]?.href || (eq.id === '202' ? 'https://a.espncdn.com/i/teamlogos/countries/500/arg.png' : 'https://a.espncdn.com/i/teamlogos/soccer/500/' + eq.id + '.png');
    html += `<section class="hero hero-${eq.id}" style="--equipo-color:${colorEquipo(eq.id)}"><div class="hero-titulo">${imagen({displayName:eq.nombre,logo})}<h2>${esc(eq.nombre)}</h2></div>${vivos.length ? '<h3>EN VIVO</h3>' + vivos.map(e => tarjeta(e)).join('') : ''}<h3>Próximo</h3>${proximo && !vivo(proximo) ? tarjeta(proximo) : '<p class="muted">No hay próximos partidos disponibles.</p>'}<h3>Último</h3>${ultimo ? tarjeta(ultimo) : '<p class="muted">No hay resultados disponibles.</p>'}</section>`;

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
  const dias = Array.from({length:11}, (_, i) => {
    const d = new Date(dia(new Date()) + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + i - 3);
    const valor = dia(d);
    return `<button data-dia="${i - 3}" aria-pressed="${valor === fecha}">${esc(fechaAmigable(d))}</button>`;
  }).join('');
  app.innerHTML = `${titulo('Partidos')}<div class="controles" aria-label="Día de partidos">${dias}<label class="calendario" aria-label="Elegir fecha">📅<input id="fecha" aria-label="Elegir fecha" type="date" value="${fecha}"></label></div><div class="chips" aria-label="Grupo de competición">${['Todas', ...new Set(ligas.map(l => l.grupo))].map(g => `<button data-grupo="${esc(g)}" aria-pressed="${g === grupo}">${esc(g)}</button>`).join('')}</div><div id="lista">${skeleton}</div>`;
  document.querySelector('[data-dia][aria-pressed="true"]')?.scrollIntoView({block:'nearest', inline:'center'});
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
  document.querySelector('#lista').innerHTML = avisos(rs) + (destacados.length ? '<h2>Mis equipos</h2>' + destacados.map(e => tarjeta(e)).join('') : '') + agrupar(eventos, elegidas).map(l => `<section><h2 class="competicion">${esc(l.nombre)} <span>${l.eventos.length} partidos</span></h2>${l.eventos.map(e => tarjeta(e)).join('')}</section>`).join('') + (!eventos.length ? '<p>No hay partidos disponibles para esta fecha y filtro.</p>' : '');
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
  const locales = competidores(e).find(c => c.homeAway === 'home')?.team?.id;
  const teams = [...(d.boxscore?.teams || [])].sort((a,b) => Number(String(b.team?.id) === String(locales)) - Number(String(a.team?.id) === String(locales)));
  let stats = '';
  for (const [key, label] of Object.entries(estadisticas)) {
    const values = [teams[0], teams[1]].map(t => porcentaje(key, t?.statistics?.find(s => s.name === key)?.displayValue));
    if (values.every(x => x == null)) continue;
    const nums = values.map(x => parseFloat(x) || 0),
      total = nums[0] + nums[1];
    stats += `<div class="dato"><span>${esc(values[0] ?? '—')}</span><span>${label}</span><span>${esc(values[1] ?? '—')}</span></div><div class="barra" role="img" aria-label="${label}: ${esc(values[0] ?? 'sin dato')} a ${esc(values[1] ?? 'sin dato')}">${nums.map((n,i) => `<span class="mitad mitad-${i}"><i class="${n >= nums[1-i] ? 'mayor' : 'menor'}" style="width:${total ? 100 * n / total : 0}%"></i></span>`).join('')}</div>`;
  }
  const eventos = (d.keyEvents || []).flatMap(ev => eventosClave([ev]).map(texto => {
    const minuto = ev.clock?.displayValue || ev.time?.displayValue || '—';
    const contenido = ev.clock?.displayValue || ev.time?.displayValue ? texto.replace(/^\S+\s/, '') : texto;
    return `<li class="${ev.team?.id != null && String(ev.team.id) !== String(locales) ? 'visitante' : 'local'}"><span class="minuto">${esc(minuto)}</span><span>${esc(contenido)}</span></li>`;
  })).join('');
  const { goles, tarjetas } = destacadosPartido(d.keyEvents || []);
  const lado = id => id != null && String(id) !== String(locales) ? 'visitante' : 'local';
  const filaDestacada = (icono, x, sub) => `<li class="${lado(x.equipoId)}"><span class="minuto">${esc(x.minuto || '—')}</span><span class="icono" aria-hidden="true">${icono}</span><span><strong>${esc(x.jugador)}</strong>${sub ? `<small>${esc(sub)}</small>` : ''}</span></li>`;
  const resumen = (goles.length ? '<h2>Goles</h2><ul class="destacados">' + goles.map(g => filaDestacada('⚽', g, g.detalle)).join('') + '</ul>' : '<h2>Goles</h2><p class="muted">Sin goles.</p>')
    + (tarjetas.length ? '<h2>Tarjetas</h2><ul class="destacados">' + tarjetas.map(t => filaDestacada(t.roja ? '🟥' : '🟨', t, t.roja ? 'Roja' : 'Amarilla')).join('') + '</ul>' : '');
  const formaciones = (d.rosters || []).map((t, i) => {
    const jugadores = t.roster || [];
    const fila = p => `<li><span class="dorsal">${esc(p.jersey || p.athlete?.jersey || '—')}</span><span>${esc(p.athlete?.displayName)} <small class="posicion">${esc(posicion(p.position?.abbreviation))}${p.subbedIn ? '<span class="entra" aria-label="Ingresó"> ↑</span>' : ''}${p.subbedOut ? '<span class="sale" aria-label="Salió"> ↓</span>' : ''}</small></span></li>`;
    return `<section class="card formacion" data-formacion="${i}" ${i ? 'hidden' : ''}><h3>${nombre(t.team)} <strong class="esquema">${esc(t.formation || '')}</strong></h3>${jugadores.some(p => p.starter) ? '<h4>Titulares</h4><ul>' + jugadores.filter(p => p.starter).sort((a, b) => (a.formationPlace || 0) - (b.formationPlace || 0)).map(fila).join('') + '</ul><h4>Suplentes</h4><ul>' + jugadores.filter(p => !p.starter).map(fila).join('') + '</ul>' : '<p>Formaciones aún no confirmadas.</p>'}</section>`;
  }).join('');
  const arbitros = d.gameInfo?.officials?.map(o => o.fullName || o.displayName).filter(Boolean).join(', ');
  app.innerHTML = `<a class="volver" href="#/partidos">← Partidos</a>${titulo('Detalle del partido')}${avisos([{ok:true,valor:r}])}${tarjeta(e,true)}<div class="segmentos" role="tablist" aria-label="Detalle del partido">${['Resumen','Estadísticas','Formaciones'].map((t,i) => `<button id="tab-${i}" role="tab" aria-controls="panel-${i}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}" data-panel="${i}">${t}</button>`).join('')}</div><section id="panel-0" role="tabpanel" aria-labelledby="tab-0">${resumen}<h2>Minuto a minuto</h2>${eventos ? '<ul class="timeline">' + eventos + '</ul>' : '<p class="muted">No hay eventos disponibles.</p>'}</section><section id="panel-1" role="tabpanel" aria-labelledby="tab-1" hidden><h2>Estadísticas</h2>${teams.length ? '<div class="dato"><strong>' + nombre(teams[0]?.team) + '</strong><strong>' + nombre(teams[1]?.team) + '</strong></div>' : ''}${stats || '<p class="muted">Estadísticas aún no disponibles.</p>'}</section><section id="panel-2" role="tabpanel" aria-labelledby="tab-2" hidden><h2>Formaciones</h2><div class="chips">${(d.rosters || []).map((t,i) => `<button data-equipo="${i}" aria-pressed="${i === 0}">${imagen(t.team)}${nombre(t.team)}</button>`).join('')}</div>${formaciones || '<p class="muted">Formaciones aún no confirmadas.</p>'}</section><footer class="info"><p>⌖ Estadio <span>${esc(d.gameInfo?.venue?.fullName || c.venue?.fullName || 'Sin confirmar')}</span></p><p>♧ Árbitro <span>${esc(arbitros || 'Sin confirmar')}</span></p></footer>`;
  const tabs = [...document.querySelectorAll('[data-panel]')];
  tabs.forEach((b,i) => {
    b.onclick = () => tabs.forEach(t => {
      const activo = t === b;
      t.setAttribute('aria-selected', activo);
      t.tabIndex = activo ? 0 : -1;
      document.querySelector('#panel-' + t.dataset.panel).hidden = !activo;
    });
    b.onkeydown = ev => {
      if (!['ArrowLeft','ArrowRight','Home','End'].includes(ev.key)) return;
      ev.preventDefault();
      const n = ev.key === 'Home' ? 0 : ev.key === 'End' ? tabs.length - 1 : (i + (ev.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      tabs[n].click(); tabs[n].focus();
    };
  });
  document.querySelectorAll('[data-equipo]').forEach(b => b.onclick = () => {
    document.querySelectorAll('[data-equipo]').forEach(t => t.setAttribute('aria-pressed', t === b));
    document.querySelectorAll('[data-formacion]').forEach(t => t.hidden = t.dataset.formacion !== b.dataset.equipo);
  });
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
  app.innerHTML = `${titulo('Tablas')}<label>Competición <select id="liga">${ligas.map(l => `<option value="${l.slug}" ${l.slug === seleccion ? 'selected' : ''}>${esc(l.nombre)}</option>`).join('')}</select></label><div id="tabla">${skeleton}</div>`;
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
  }]) + (ts.map(t => `<h2>${esc(t.nombre)}</h2><div class="scroll"><table><caption>${esc(ligas.find(l => l.slug === seleccion)?.nombre)} · ${esc(t.nombre)}</caption><thead><tr><th scope="col">#</th><th scope="col">Equipo</th>${[['gamesPlayed', 'PJ'], ['wins', 'PG'], ['ties', 'PE'], ['losses', 'PP'], ['pointDifferential', 'DG'], ['points', 'Pts']].map(([k, label]) => `<th scope="col">${label}</th>`).join('')}</tr></thead><tbody>${t.entries.map(en => `<tr class="${equipos.some(eq => eq.id === String(en.team?.id)) ? 'fila-foco' : ''}"><td class="rango">${esc(en.stats?.find(s => s.name === 'rank')?.displayValue ?? '—')}</td><th scope="row"><span class="tabla-equipo">${imagen(en.team)} <span>${nombre(en.team)}</span></span></th>${['gamesPlayed', 'wins', 'ties', 'losses', 'pointDifferential', 'points'].map(k => `<td>${esc(en.stats?.find(s => s.name === k)?.displayValue ?? '—')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`).join('') || '<p>Esta competición no tiene tabla disponible.</p>');
}

async function render() {
  const v = ++version;
  hayVivo = false;
  const [pantalla, slug, id] = (location.hash.slice(2) || 'inicio').split('/');
  document.querySelectorAll('nav a').forEach(a => {
    if (a.hash === '#/' + (pantalla === 'partido' ? 'partidos' : pantalla)) a.setAttribute('aria-current', 'page');else a.removeAttribute('aria-current');
  });
  app.innerHTML = skeleton;
  app.classList.remove('entrada');
  void app.offsetWidth;
  app.classList.add('entrada');
  try {
    if (pantalla === 'inicio') await inicio(v);else if (pantalla === 'partidos') await partidos(v);else if (pantalla === 'partido') await detalle(slug, id, v);else if (pantalla === 'tablas') await tablas(v);else app.innerHTML = '<h1>Página no encontrada</h1><a href="#/inicio">Volver al inicio</a>';
  } catch {
    if (v === version) {
      app.innerHTML = '<h1>No pudimos cargar los datos</h1><p class="aviso">ⓘ Revisá tu conexión y volvé a intentar.</p>' + botonReintentar;
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
