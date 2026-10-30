export const zona = 'America/Argentina/Buenos_Aires';
export const hora = f => new Intl.DateTimeFormat('es-AR', {
  timeZone: zona,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23'
}).format(new Date(f));
export const dia = f => new Intl.DateTimeFormat('sv-SE', {
  timeZone: zona,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
}).format(new Date(f));
export const fechaHora = f => dia(f) + ' · ' + hora(f);
export const competidores = e => e.competitions?.[0]?.competitors || [];
export const foco = e => competidores(e).some(c => ['202', '9743', '20232'].includes(String(c.team?.id)));
export const estadoPartido = e => e.status ?? e.competitions?.[0]?.status;
export const vivo = e => estadoPartido(e)?.type?.state === 'in';
export const finalizado = e => estadoPartido(e)?.type?.state === 'post' || estadoPartido(e)?.type?.completed === true;
export const marcador = c => typeof c?.score === 'object' ? c.score?.displayValue ?? c.score?.value ?? '–' : c?.score ?? '–';

export function resumenEquipo(eventos) {
  const todos = [...eventos].sort((a, b) => new Date(a.date) - new Date(b.date));
  return {
    ultimo: todos.filter(finalizado).at(-1),
    proximo: todos.find(e => ['pre', 'in'].includes(estadoPartido(e)?.type?.state)),
    vivos: todos.filter(vivo)
  };
}
// ESPN usa abreviaturas detalladas (RB, CD-L, CM-R, LF…); se agrupan en las 4 líneas.
export function posicion(abbr = '') {
  const a = abbr.toUpperCase().split('-')[0];
  if (a === 'G' || a === 'GK') return 'Arquero';
  if (['D', 'CD', 'CB', 'RB', 'LB', 'RWB', 'LWB', 'SW'].includes(a)) return 'Defensor';
  if (['M', 'CM', 'DM', 'AM', 'RM', 'LM'].includes(a)) return 'Mediocampista';
  if (['F', 'CF', 'ST', 'RF', 'LF', 'RW', 'LW'].includes(a)) return 'Delantero';
  return '';
}

export function eventosClave(eventos) {
  return eventos.filter(e => {
    const tipo = e.type?.type || '';
    return tipo.startsWith('goal') || tipo.startsWith('penalty---scored') || ['own-goal', 'yellow-card', 'red-card', 'substitution'].includes(tipo);
  }).map(e => {
    const tipo = e.type.type;
    const [entra, sale] = (e.participants || []).map(p => p.athlete?.displayName || '');
    const cambio = tipo === 'substitution';
    const gol = tipo.startsWith('goal') || tipo.startsWith('penalty---scored') || tipo === 'own-goal';
    const icono = cambio ? '🔁' : tipo === 'yellow-card' ? '🟨' : tipo === 'red-card' ? '🟥' : '⚽';
    const texto = cambio ? entra && sale ? 'Entra ' + entra + ' por ' + sale : entra ? 'Entra ' + entra : sale ? 'Sale ' + sale : 'Cambio' : entra || '';
    const reloj = e.clock?.displayValue || e.time?.displayValue || '';
    const minuto = reloj && !/['’′]$/.test(reloj) ? reloj + "'" : reloj;
    return (minuto + ' ' + icono + ' ' + texto + (e.team?.displayName ? ' (' + e.team.displayName + ')' : '') + (gol && sale ? ' · asist. ' + sale : '')).trim();
  });
}
export const agrupar = (eventos, ligas) => ligas.map(l => ({
  ...l,
  eventos: eventos.filter(e => e.slug === l.slug).sort((a, b) => Number(foco(b)) - Number(foco(a)) || new Date(a.date) - new Date(b.date))
})).filter(l => l.eventos.length);

export async function paralelo(items, fn, limite = 6) {
  const resultados = new Array(items.length);
  let siguiente = 0;
  await Promise.all(Array.from({
    length: Math.min(limite, items.length)
  }, async () => {
    while (siguiente < items.length) {
      const i = siguiente++;
      try {
        resultados[i] = {
          ok: true,
          valor: await fn(items[i])
        };
      } catch (error) {
        resultados[i] = {
          ok: false,
          error
        };
      }
    }
  }));
  return resultados;
}
