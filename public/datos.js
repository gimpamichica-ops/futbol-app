import { vivo, finalizado } from './logica.js';
export const base = 'https://site.api.espn.com/apis/site/v2/sports/soccer/';
const memoria = new Map();

export async function pedir(url, tipo = 'otro') {
  let guardado = memoria.get(url);
  if (!guardado) {
    try {
      guardado = JSON.parse(localStorage.getItem(url));
    } catch {}
  }
  if (guardado?.vence > Date.now()) return {
    ...guardado,
    obsoleto: false
  };
  try {
    const r = await fetch(url, {
      signal: AbortSignal.timeout(15000)
    });
    if (!r.ok) throw Error('HTTP ' + r.status);
    const data = await r.json();
    const enVivo = data.events?.some(vivo) || (data.header && vivo(data.header.competitions?.[0] || {}));
    const ttl = enVivo ? 60000 : tipo === 'summary' && finalizado(data.header || {}) ? 86400000 : 600000;
    const obsoleto = r.headers.get('X-Futbol-Cache') === 'stale';
    const registro = {
      data,
      vence: obsoleto ? 0 : Date.now() + ttl
    };
    memoria.set(url, registro);
    try {
      localStorage.setItem(url, JSON.stringify(registro));
    } catch {}
    return {
      ...registro,
      obsoleto: r.headers.get('X-Futbol-Cache') === 'stale'
    };
  } catch (error) {
    if (guardado) return {
      ...guardado,
      obsoleto: true
    };
    throw error;
  }
}
