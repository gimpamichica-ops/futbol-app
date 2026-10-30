import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {ligas,equipos} from '../public/ligas.js';
import {hora,dia,foco,vivo,agrupar,paralelo,estadoPartido,finalizado,marcador,resumenEquipo,eventosClave,posicion,fechaHora,fechaAmigable} from '../public/logica.js';
import {pedir} from '../public/datos.js';
for(const file of ['index.html','estilos.css','app.js','logica.js','datos.js','ligas.js','manifest.webmanifest','sw.js','icon.svg','_headers'])assert.ok(fs.statSync('public/'+file).size,file);
for(const file of ['README.md','.gitignore'])assert.ok(fs.existsSync(file));
for(const file of ['app.js','datos.js','logica.js','ligas.js','sw.js'])execFileSync(process.execPath,['--check','public/'+file]);
assert.equal(new Set(ligas.map(l=>l.slug)).size,ligas.length);
assert.ok(ligas.length>=27);assert.equal(equipos.length,3);
for(const eq of equipos)for(const slug of eq.ligas)assert.ok(ligas.some(l=>l.slug===slug));
const fixture=JSON.parse(fs.readFileSync('tools/fixtures/scoreboard.json','utf8'));
const summary=JSON.parse(fs.readFileSync('tools/fixtures/summary.json','utf8'));
const e={...fixture.events[0],slug:'arg.2'};
assert.equal(hora(e.date),'20:30');assert.equal(dia('2026-10-30T01:30:00Z'),'2026-10-29');
assert.ok(foco(e));assert.ok(vivo(e));assert.equal(foco({}),false);
const otro={id:'otro',date:'2026-10-29T20:00:00Z',slug:'arg.2'};
const agrupado=agrupar([otro,e],ligas);assert.equal(agrupado.length,1);assert.equal(agrupado[0].eventos[0].id,e.id);
assert.ok(summary.rosters[0].roster.some(p=>p.starter));assert.equal(summary.keyEvents[0].type.text,'Gol');
let activos=0,maximo=0;
const resultados=await paralelo(Array.from({length:15},(_,i)=>i),async i=>{activos++;maximo=Math.max(maximo,activos);await new Promise(r=>setTimeout(r,1));activos--;if(i===2)throw Error('liga caída');return i;});
assert.equal(maximo,6);assert.equal(resultados[2].ok,false);assert.equal(resultados[14].valor,14);
const storage=new Map();globalThis.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)};
let llamadas=0;globalThis.fetch=async()=>{llamadas++;return new Response(JSON.stringify(fixture));};
const antes=Date.now();await pedir('https://ejemplo.test/vivo','scoreboard');const cached=await pedir('https://ejemplo.test/vivo','scoreboard');assert.equal(llamadas,1);assert.ok(cached.vence-antes>=60000&&cached.vence-antes<62000);
globalThis.fetch=async()=>new Response(JSON.stringify({events:[]}));
const normal=await pedir('https://ejemplo.test/programado','scoreboard');assert.ok(normal.vence-Date.now()>599000);
globalThis.fetch=async()=>new Response(JSON.stringify(fixture),{headers:{'X-Futbol-Cache':'stale'}});
const viejo=await pedir('https://ejemplo.test/sw','scoreboard');assert.equal(viejo.obsoleto,true);assert.equal(viejo.vence,0);
const final=structuredClone(summary);Object.assign(final.header.competitions[0].status.type,{state:'post',completed:true});const enJuego=structuredClone(summary);Object.assign(enJuego.header.competitions[0].status.type,{state:'in',completed:false});globalThis.fetch=async()=>new Response(JSON.stringify(enJuego));const vivoSum=await pedir('https://ejemplo.test/vivo-summary','summary');assert.ok(vivoSum.vence-Date.now()<=60000);
globalThis.fetch=async()=>new Response(JSON.stringify(final));const fin=await pedir('https://ejemplo.test/final','summary');assert.ok(fin.vence-Date.now()>86390000);
storage.set('https://ejemplo.test/offline',JSON.stringify({data:fixture,vence:0}));globalThis.fetch=async()=>{throw Error('sin red');};assert.equal((await pedir('https://ejemplo.test/offline')).obsoleto,true);await assert.rejects(pedir('https://ejemplo.test/nuevo'));
const manifest=JSON.parse(fs.readFileSync('public/manifest.webmanifest','utf8'));assert.equal(manifest.display,'standalone');for(const icon of manifest.icons)assert.ok(fs.existsSync('public/'+icon.src));
assert.match(fs.readFileSync('public/_headers','utf8'),/Cache-Control: no-cache/);
console.log('OK: archivos, sintaxis, configuración, fixtures, hora argentina, agrupado, foco, concurrencia, TTL y fallback sin red.');

const schedule = (id, date, state) => ({id, date, competitions:[{status:{type:{state, completed:state==='post'}}, competitors:[{score:{value:2,displayValue:'2'}}]}]});
const desordenados = [schedule('futuro','2026-11-04','pre'),schedule('ultimo','2026-10-28','post'),schedule('proximo','2026-11-01','pre'),schedule('viejo','2026-10-01','post')];
const resumen = resumenEquipo(desordenados);
assert.equal(resumen.ultimo.id,'ultimo');
assert.equal(resumen.proximo.id,'proximo');
assert.equal(desordenados[0].id,'futuro');
const enVivo = schedule('vivo','2026-10-29','in');
assert.ok(vivo(enVivo));
assert.ok(finalizado(desordenados[1]));
assert.equal(estadoPartido({...enVivo,status:{type:{state:'pre'}}}).type.state,'pre');
assert.equal(resumenEquipo([...desordenados,enVivo]).proximo.id,'vivo');
assert.equal(resumenEquipo([enVivo]).vivos.length,1);
assert.equal(resumenEquipo([]).ultimo,undefined);
assert.equal(marcador(enVivo.competitions[0].competitors[0]),'2');
assert.equal(marcador({score:{value:0}}),0);
assert.equal(marcador({score:null}),'–');
assert.equal(fechaHora(e.date),'2026-10-29 · 20:30');
assert.deepEqual(['G','RB','CD-L','CM-R','AM','LF','SUB'].map(posicion),['Arquero','Defensor','Defensor','Mediocampista','Mediocampista','Delantero','']);
const evento = tipo => ({type:{type:tipo},clock:{displayValue:"25'"},participants:[{athlete:{displayName:'Matteo Cichella'}},{athlete:{displayName:'Asistente'}}],team:{displayName:'Frosinone'},text:'Long English commentary'});
for(const tipo of ['goal','goal---header','goal---free-kick','goal---other','penalty---scored','penalty---scored-extra','own-goal'])assert.deepEqual(eventosClave([evento(tipo)]),["25' ⚽ Matteo Cichella (Frosinone) · asist. Asistente"]);
assert.deepEqual(eventosClave([evento('yellow-card'),evento('red-card'),evento('substitution')]),["25' 🟨 Matteo Cichella (Frosinone)","25' 🟥 Matteo Cichella (Frosinone)","25' 🔁 Entra Matteo Cichella por Asistente (Frosinone)"]);
assert.deepEqual(eventosClave([evento('shot'),evento('penalty---missed'),{}]),[]);
assert.match(eventosClave([{...evento('substitution'),participants:[{athlete:{displayName:'Solo'}}]}])[0],/Entra Solo/);
assert.match(eventosClave([{...evento('substitution'),participants:[{}, {athlete:{displayName:'Sale'}}]}])[0],/Sale Sale/);
assert.match(eventosClave([{...evento('goal'),clock:{displayValue:'25'},participants:[]}])[0],/^25' ⚽/);
assert.ok(ligas.some(l=>l.slug==='concacaf.leagues.cup'));
for (const file of fs.readdirSync('public',{recursive:true})) {
  if (!fs.statSync('public/'+file).isFile() || /\.png$/.test(file)) continue;
  const texto=fs.readFileSync('public/'+file,'utf8');
  assert.notEqual(texto.charCodeAt(0),0xfeff,file+' tiene BOM');
  assert.doesNotMatch(texto,/F\?tbol|dom\?sticas|Am\?rica|Navegaci\?n|Posesi\?n|precisi\?n|competici\?n|pr\?ximo|Estad\?sticas|p\?gina|conexi\?n/i,file+' tiene texto dañado');
}
const {icono}=await import('./generar-icons.mjs');
const {inflateSync}=await import('node:zlib');
for(const size of [180,192,512]) {
  const png=fs.readFileSync('public/'+(size===180?'apple-touch-icon.png':'icon-'+size+'.png'));
  assert.deepEqual(png,icono(size));
  assert.equal(png.readUInt32BE(16),size);
  assert.equal(png.readUInt32BE(20),size);
  assert.deepEqual([...png.subarray(0,8)],[137,80,78,71,13,10,26,10]);
  const compressedLength=png.readUInt32BE(33);
  assert.equal(inflateSync(png.subarray(41,41+compressedLength)).length,(size*3+1)*size);
}
assert.match(fs.readFileSync('public/index.html','utf8'),/apple-touch-icon/);
console.log('OK: schedule desordenado, estados, marcadores, eventos en español, posiciones, UTF-8 e íconos PNG.');

assert.deepEqual(manifest.icons.map(i=>i.sizes),['192x192','512x512']);
const sw=fs.readFileSync('public/sw.js','utf8');
for(const icon of [...manifest.icons.map(i=>i.src),'apple-touch-icon.png'])assert.ok(sw.includes(icon));
assert.doesNotMatch(sw,/futbol-v1/);

const hoyFecha = '2026-10-30T01:30:00Z';
assert.equal(fechaAmigable(hoyFecha, hoyFecha), 'Hoy');
assert.equal(fechaAmigable('2026-10-30T12:00:00Z', hoyFecha), 'Mañana');
assert.equal(fechaAmigable('2026-10-28T12:00:00Z', hoyFecha), 'Ayer');
assert.equal(fechaAmigable('2026-10-31T12:00:00Z', hoyFecha), 'sáb 31/10');
assert.equal(fechaAmigable('2027-01-01T12:00:00Z', '2026-12-31T12:00:00Z'), 'Mañana');
assert.equal(fechaAmigable('2026-03-01T12:00:00Z', '2026-02-28T12:00:00Z'), 'Mañana');
console.log('OK: fecha amigable, medianoche argentina y cambios de mes/año.');

// Ejecuta las vistas con fixtures y un DOM mínimo, sin red ni dependencias.
const {runInNewContext} = await import('node:vm');
const logica = await import('../public/logica.js');
const nodos = new Map();
const nodo = selector => {
  if (!nodos.has(selector)) nodos.set(selector, {innerHTML:'', hidden:false, dataset:{}, setAttribute(k,v){this[k]=String(v);}, focus(){}, addEventListener(){}, scrollIntoView(){}, click(){this.onclick?.();}, classList:{remove(){},add(){}}});
  return nodos.get(selector);
};
const tabs = [0,1,2].map(i => Object.assign(nodo('tab'+i),{dataset:{panel:String(i)}}));
const selectores = [0,1].map(i => Object.assign(nodo('equipo'+i),{dataset:{equipo:String(i)}}));
const formacionesUI = [0,1].map(i => Object.assign(nodo('formacion'+i),{dataset:{formacion:String(i)}}));
const contexto = {...logica,ligas,equipos,base:'https://fixture/',pedir:async()=>({data:summary}),
  document:{querySelector:nodo,querySelectorAll:s=>s==='[data-panel]'?tabs:s==='[data-equipo]'?selectores:s==='[data-formacion]'?formacionesUI:[],addEventListener(){}},
  window:{addEventListener(){}},navigator:{},location:{hash:'#/inicio'},setInterval(){},console};
const fuenteUI = fs.readFileSync('public/app.js','utf8').replace(/^import .*;\r?\n/gm,'').replace(/render\(\);\s*$/, '');
runInNewContext(fuenteUI + '\nglobalThis.vistas = {tarjeta,detalle,tablas,inicio,partidos,render};',contexto);
const programado = structuredClone(e);
programado.status = {type:{state:'pre'}};
programado.competitions[0].competitors[0].team.displayName = '<img onerror="alert(1)">';
const cardUI = contexto.vistas.tarjeta(programado);
assert.match(cardUI,/20:30/);
assert.doesNotMatch(cardUI,/class="estado/);
assert.match(cardUI,/&lt;img onerror=&quot;alert\(1\)&quot;&gt;/);
assert.match(cardUI,/class="iniciales"/);
assert.match(contexto.vistas.tarjeta(e),/EN VIVO/);
const terminado = {...e,status:{type:{state:'post'}}};
assert.match(contexto.vistas.tarjeta(terminado),/class="estado final"/);
assert.match(contexto.vistas.tarjeta(terminado),/perdedor/);
await contexto.vistas.detalle('arg.2','123456',0);
const detalleUI = nodo('#app').innerHTML;
assert.match(detalleUI,/marcador-detalle/);
assert.match(detalleUI,/data-formacion="1" hidden/);
assert.match(detalleUI,/55%/);
assert.match(detalleUI,/class="mayor" style="width:55%"/);
assert.match(detalleUI,/Jugador de ejemplo/);
tabs[1].click();
assert.equal(nodo('#panel-0').hidden,true);
assert.equal(nodo('#panel-1').hidden,false);
assert.equal(tabs[1]['aria-selected'],'true');
selectores[1].click();
assert.equal(formacionesUI[0].hidden,true);
assert.equal(formacionesUI[1].hidden,false);
tabs[1].onkeydown({key:'ArrowRight',preventDefault(){}});
assert.equal(nodo('#panel-2').hidden,false);
console.log('OK: tarjetas, escape HTML, estados, estadísticas y pestañas con teclado sin recarga.');

contexto.pedir = async () => ({data:fixture});
await contexto.vistas.partidos(0);
assert.match(nodo('#app').innerHTML,/data-dia="-3"/);
assert.match(nodo('#app').innerHTML,/data-dia="7"/);
assert.ok(nodo('#lista').innerHTML.includes('partidos</span>'));
contexto.pedir = async () => ({data:{events:[programado,terminado]}});
await contexto.vistas.inicio(0);
const inicioUI = nodo('#app').innerHTML;
assert.match(inicioUI,/hero-202/);
assert.match(inicioUI,/hero-9743/);
assert.match(inicioUI,/hero-20232/);
assert.ok(inicioUI.indexOf('<h3>Próximo</h3>') < inicioUI.indexOf('<h3>Último</h3>'));
contexto.pedir = async () => ({data:{children:[{name:'Group A',standings:{entries:[{team:{id:'9743',displayName:'Ferro'},stats:[{name:'rank',value:1,displayValue:'1'},{name:'points',displayValue:'30'}]}]}}]}});
await contexto.vistas.tablas(0);
assert.match(nodo('#tabla').innerHTML,/Zona A/);
assert.match(nodo('#tabla').innerHTML,/fila-foco/);
assert.ok(nodo('#tabla').innerHTML.includes('>30</td>'));
assert.equal(manifest.theme_color,'#0a0f0d');
assert.equal(manifest.background_color,'#0a0f0d');
assert.match(sw,/futbol-v[0-9]+/);
console.log('OK: tira de días, equipos, orden próximo/último, zonas y colores PWA.');
{
  const { destacadosPartido } = await import('../public/logica.js');
  const ev = (type, nombres, extra = {}) => ({ type: { type }, clock: { displayValue: "10'" }, team: { id: '1', displayName: 'Local' }, participants: nombres.map(n => ({ athlete: { displayName: n } })), ...extra });
  const { goles, tarjetas } = destacadosPartido([
    ev('goal', ['Suárez', 'Casemiro']),
    ev('penalty---scored', ['Calò']),
    ev('goal', ['Messi'], { text: 'Lionel Messi scores from a direct free kick.' }),
    ev('own-goal', ['Pérez']),
    ev('goal---header', ['Otamendi', 'Di María']),
    ev('yellow-card', ['De Paul']),
    ev('red-card', ['Romero']),
    ev('goal', ['Álvarez', 'Mac Allister'], { text: 'Julián Álvarez right footed shot from outside the penalty area. Assisted by Mac Allister following a set piece situation.' }),
    ev('own-goal', ['Gómez'], { text: 'Own Goal by Gómez, from inside the penalty area.' }),
    ev('goal', ['Lautaro', 'Otamendi'], { text: 'Lautaro left footed shot. Assisted by Otamendi with a header.' }),
    ev('substitution', ['A', 'B'])
  ]);
  assert.deepEqual(goles.map(g => g.detalle), ['Asistencia: Casemiro', 'De penal', 'De tiro libre', 'En contra', 'De cabeza · Asistencia: Di María', 'Asistencia: Mac Allister', 'En contra', 'Asistencia: Otamendi']);
  assert.deepEqual(tarjetas.map(t => [t.jugador, t.roja]), [['De Paul', false], ['Romero', true]]);
  assert.equal(goles[0].minuto, "10'");
  console.log('OK: resumen de goles (asistencia, penal, tiro libre, en contra, cabeza) y tarjetas.');
}
