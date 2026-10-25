"use strict";
/* ============================================================
   MI PLAN: nómina (de la estancia de la calculadora), balance y plan de pagos
   ============================================================ */
const $=id=>document.getElementById(id);
/* motor.js lee los días cambiados a mano de S.overrides */
const S={overrides:{}};
const CLAVE_PLAN='idom-plan', CLAVE_CALC='idom-nomina-estancia', CLAVE_CHAT='idom-plan-chat';

const r2=n=>Math.round(n*100)/100;
const clon=o=>JSON.parse(JSON.stringify(o));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad=n=>String(n).padStart(2,'0');
const isoD=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const parseD=s=>{const[y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d);};
const hoy=()=>isoD(new Date());
const fdate=s=>{const d=parseD(s);return `${d.getDate()} ${MESES[d.getMonth()]}`;};
const fdateY=s=>{const d=parseD(s);return `${d.getDate()} ${MESES[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;};
const fx=x=>x?x.d+' '+MESES[x.m-1]+' '+x.y:'—';
const mesTxt=i=>MESES_L[i%12]+' '+Math.floor(i/12);
const mesCorto=i=>MESES[i%12]+' '+String(Math.floor(i/12)).slice(2);
const mayus=s=>s.charAt(0).toUpperCase()+s.slice(1);
const e0=n=>eur0(r2(n)||0);
const e2=n=>eur(r2(n)||0);

const BLOQ={
  fijo:{label:'Fijas',desc:'no se aplazan',color:'var(--fijo)'},
  aplazable:{label:'Aplazables',desc:'se pagan y se vuelven a pedir',color:'var(--aplazable)'},
  amigo:{label:'Amigos y familia',desc:'sin plazo ni intereses',color:'var(--amigo)'},
  aparte:{label:'Cuotas aparte',desc:'no cuentan en la deuda total',color:'var(--aparte)'},
};
const CUENTAN=['fijo','aplazable','amigo'];

/* ============================================================
   ESTADO
   ============================================================ */
const planVacio=()=>({version:1,saldo:{fecha:hoy(),importe:0},gastosMes:0,deudas:[],movimientos:[],cobrados:{},horizonte:15});
const idNuevo=p=>p+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
const esFecha=s=>/^\d{4}-\d{2}-\d{2}$/.test(String(s||''));
/* Acepta copias de esta página y planes de deudas antiguos (con bloque «santander» y nóminas a mano) */
function normalizarPlan(p){
  p=p&&typeof p==='object'?p:{};
  const out=planVacio();
  if(p.saldo&&esFecha(p.saldo.fecha)) out.saldo={fecha:p.saldo.fecha,importe:r2(+p.saldo.importe||0)};
  out.gastosMes=Math.abs(+p.gastosMes||0);
  out.deudas=(Array.isArray(p.deudas)?p.deudas:[]).filter(d=>d&&d.id!=null).map(d=>({
    id:String(d.id).slice(0,40),nombre:String(d.nombre||d.id).slice(0,60),
    bloque:d.bloque==='santander'?'aparte':(BLOQ[d.bloque]?d.bloque:'fijo'),
    pendiente:r2(Math.max(0,+d.pendiente||0)),notas:String(d.notas||'').slice(0,240),
    cuota:r2(Math.max(0,+d.cuota||0)),dia:Math.min(28,Math.max(1,Math.round(+d.dia||1)))}));
  /* las nóminas salen de la estancia: las apuntadas a mano en planes antiguos se quitan para no contarlas dos veces */
  out.movimientos=(Array.isArray(p.movimientos)?p.movimientos:[])
    .filter(m=>m&&esFecha(m.f)&&!(m.t==='ingreso'&&/^(Nómina|Paga extra|Variable)/.test(m.c||'')))
    .map(m=>{ const x={id:String(m.id||idNuevo('m')),f:m.f,c:String(m.c||'').slice(0,120),t:['ingreso','gasto','pago','prestamo','aplazado'].includes(m.t)?m.t:'gasto',
      d:String(m.d||''),i:r2(+m.i||0),estado:m.estado==='hecho'?'hecho':'previsto'};
      if(m.debe!=null) x.debe=r2(+m.debe||0); if(m.cierra) x.cierra=true; return x; });
  out.cobrados=p.cobrados&&typeof p.cobrados==='object'?p.cobrados:{};
  if([12,15,18,24,36].includes(+p.horizonte)) out.horizonte=+p.horizonte;
  if(p.estancia&&p.estancia.S&&p.estancia.campos) out.estancia=p.estancia;
  return out;
}
let PL=null;
try{ const t=localStorage.getItem(CLAVE_PLAN); PL=t?normalizarPlan(JSON.parse(t)):null; }catch(e){ PL=null; }
if(!PL) PL=planVacio();

/* La estancia: la que guardó la calculadora en este navegador o, si no hay, una copia cargada desde un archivo */
let EST=null, fuenteEst='';
function leerCalc(){ try{ const t=localStorage.getItem(CLAVE_CALC); const v=t?JSON.parse(t):null; return v&&v.S&&v.campos?v:null; }catch(e){ return null; } }
function cargarEstancia(){
  const v=leerCalc();
  if(v){ EST=v; fuenteEst='calc'; }
  else if(PL.estancia){ EST=clon(PL.estancia); fuenteEst='copia'; }
  else{ EST=null; fuenteEst=''; }
}
cargarEstancia();
function guardar(){
  try{ localStorage.setItem(CLAVE_PLAN,JSON.stringify(PL)); }catch(e){}
  if(!EST) return;
  if(fuenteEst==='calc'){ try{ localStorage.setItem(CLAVE_CALC,JSON.stringify(EST)); }catch(e){} }
  else PL.estancia=clon(EST);
}
const undoStack=[];
const foto0=()=>({PL:clon(PL),EST:EST?clon(EST):null});
function pushUndo(){ undoStack.push(foto0()); if(undoStack.length>30) undoStack.shift(); }
function deshacer(){ const s=undoStack.pop(); if(!s) return; PL=s.PL; EST=s.EST; guardar(); pintar(); }
const hechoGen=id=>PL.cobrados[id]!=null;

/* ============================================================
   1 · NÓMINA: la estancia de la calculadora, mes a mes
   ============================================================ */
function paramsEstancia(){
  S.overrides=EST.S.overrides&&typeof EST.S.overrides==='object'?EST.S.overrides:{};
  /* las subidas cuentan siempre, aunque la calculadora se quedara en «Desglosar nómina» */
  const P=paramsDe(EST.campos,{...EST.S,mode:'estancia'});
  P.prorr=false;
  return P;
}
function calcNomina(){
  if(!EST) return {err:'sin',filas:[],ingresos:[],anios:[]};
  const P=paramsEstancia();
  if(!P.salida||!P.regreso) return {err:'Faltan el día de salida o el de vuelta en la pestaña Estancia de la calculadora.',P,filas:[],ingresos:[],anios:[]};
  const s0=parseFecha(PL.saldo.fecha)||parseFecha(hoy()), i0=s0.i, i1=i0+PL.horizonte-1;
  const filas=[], ingresos=[], anios=[];
  for(let y=Math.floor(i0/12);y<=Math.floor(i1/12);y++){
    const sin=simularAnio(P,y,false);
    let Py=P, con=simularAnio(P,y,true);
    const fuera=con.res.fuera;
    /* más de 183 días fuera en el año natural: el destino grava e IDOM iguala a lo de España */
    const igualado=fuera>183&&P.regimen!=='ninguno';
    if(igualado){ Py={...P,regimen:'ninguno'}; con=simularAnio(Py,y,true); }
    aplicarTope(con,sin,Py);
    let netoAnio=0;
    for(const M of con.meses){
      if(M.i<i0||M.i>i1) continue;
      const comp=M.m===12?con.comp:0, total=M.neto+comp;
      netoAnio+=total;
      filas.push({M,i:M.i,y,m:M.m,sit:textoSituacion(M.D,P),dias:M.D.dias,ov:!!M.D.ov,sal:M.salMes,plus:M.plus,dieta:M.dieta,
        extra:M.extra,variable:M.variable,irpf:M.irpf,ss:M.ss+M.ssVar,netoMes:M.netoMes,netoExtra:M.netoExtra,netoVar:M.netoVar,comp,total,igualado,
        subida:!!M.subida});
      const f=`${y}-${pad(M.m)}-${M.m===2?28:29}`;
      ingresos.push({id:`n-${y}-${M.m}`,f,c:`Nómina de ${MESES_L[M.m-1]}`,t:'ingreso',d:'',i:r2(M.netoMes),estado:'previsto',gen:'nomina'});
      if(M.extra>0.5) ingresos.push({id:`x-${y}-${M.m}`,f,c:`Paga extra de ${MESES_L[M.m-1]}`,t:'ingreso',d:'',i:r2(M.netoExtra),estado:'previsto',gen:'nomina'});
      if(M.variable>0.5) ingresos.push({id:`v-${y}-${M.m}`,f,c:'Variable de febrero',t:'ingreso',d:'',i:r2(M.netoVar),estado:'previsto',gen:'nomina'});
      if(comp>0.5) ingresos.push({id:`c-${y}`,f,c:'Compensación de IDOM (tope)',t:'ingreso',d:'',i:r2(comp),estado:'previsto',gen:'nomina'});
    }
    anios.push({y,fuera,igualado,res:con.res,comp:con.comp,neto:netoAnio,regimen:P.regimen});
  }
  return {P,filas,ingresos,anios,i0,i1};
}
let NOM={err:'sin',filas:[],ingresos:[],anios:[]};

/* ============================================================
   PLAN DE PAGOS
   ============================================================ */
/* Movimientos que pone el plan: nóminas, gastos de vida de cada mes y cuotas mensuales de las deudas */
function generados(){
  const out=NOM.ingresos.map(m=>hechoGen(m.id)?{...m,estado:'hecho',i:PL.cobrados[m.id]}:m);
  const s0=parseFecha(PL.saldo.fecha)||parseFecha(hoy()), i0=s0.i, i1=i0+PL.horizonte-1;
  const est=id=>hechoGen(id)?'hecho':'previsto';
  const conGasto=new Set(PL.movimientos.filter(m=>m.t==='gasto'&&/^Gastos de vida/i.test(m.c)).map(m=>m.f.slice(0,7)));
  for(let i=i0;i<=i1;i++){
    const k=ymKey(i), f=k+'-01';
    if(PL.gastosMes>0&&!conGasto.has(k)&&f>=PL.saldo.fecha){ const id='g-'+k;
      out.push({id,f,c:'Gastos de vida',t:'gasto',d:'',i:hechoGen(id)?PL.cobrados[id]:-PL.gastosMes,estado:est(id),gen:'auto'}); }
  }
  for(const d of PL.deudas){
    if(!(d.cuota>0)) continue;
    const propios=PL.movimientos.filter(m=>m.d===d.id);
    const ultimo=propios.reduce((a,m)=>m.f>a?m.f:a,'');
    let resto=d.pendiente||0;
    for(const m of propios) if(m.estado!=='hecho'){ if(m.t==='prestamo') resto+=m.debe||m.i||0; else if(m.i<0) resto+=m.i; if(m.cierra) resto=0; }
    const desde=ultimo?parseFecha(ultimo).i+1:i0;
    for(let i=Math.max(desde,i0);i<=i1;i++){
      const id='s-'+d.id+'-'+ymKey(i), f=ymKey(i)+'-'+pad(d.dia||1);
      if(hechoGen(id)){ out.push({id,f,c:d.nombre+' · cuota',t:'pago',d:d.id,i:PL.cobrados[id],estado:'hecho',gen:'auto'}); continue; }
      if(f<PL.saldo.fecha) continue;
      const q=Math.min(d.cuota,resto); if(q<0.5) break;
      resto=r2(resto-q);
      out.push({id,f,c:d.nombre+' · cuota',t:'pago',d:d.id,i:-r2(q),estado:'previsto',gen:'auto'});
    }
  }
  return out;
}
const movimientos=()=>PL.movimientos.concat(generados());
const pendientes=()=>movimientos().filter(m=>m.estado!=='hecho').sort((a,b)=>a.f.localeCompare(b.f)||(b.i>0)-(a.i>0));
function proyeccion(){
  const s0=PL.saldo; let b=s0.importe; const pts=[{f:s0.fecha,b,evs:[]}];
  for(const m of pendientes()){
    const f=m.f<s0.fecha?s0.fecha:m.f; b=r2(b+(m.i||0));
    const last=pts[pts.length-1];
    if(last.f===f){ last.b=b; last.evs.push(m); } else pts.push({f,b,evs:[m]});
  }
  return pts;
}
const minimo=pts=>pts.reduce((a,p)=>p.b<a.b?p:a,pts[0]);
function restoPorDeuda(hasta){
  const rest={}; for(const d of PL.deudas) rest[d.id]=d.pendiente||0;
  for(const m of pendientes()){
    if(hasta&&m.f>hasta) break;
    if(!m.d||!(m.d in rest)) continue;
    if(m.t==='prestamo') rest[m.d]+=(m.debe||m.i||0); else if(m.i<0) rest[m.d]+=m.i;
    if(m.cierra) rest[m.d]=0;
    rest[m.d]=Math.max(0,r2(rest[m.d]));
  }
  return rest;
}
function deudaPorBloque(hasta){
  const rest=restoPorDeuda(hasta), out={fijo:0,aplazable:0,amigo:0,aparte:0};
  for(const d of PL.deudas) out[d.bloque]=r2((out[d.bloque]||0)+rest[d.id]);
  return out;
}
const deudaHoy=()=>r2(PL.deudas.filter(d=>CUENTAN.includes(d.bloque)).reduce((a,d)=>a+(d.pendiente||0),0));
function finesDeMes(){
  const ini=parseD(PL.saldo.fecha), movs=pendientes(), last=movs.length?parseD(movs[movs.length-1].f):ini, out=[];
  let y=ini.getFullYear(), m=ini.getMonth();
  while(new Date(y,m,1)<=last){ out.push({key:`${y}-${pad(m+1)}`,fin:isoD(new Date(y,m+1,0)),y,m}); m++; if(m===12){m=0;y++;} }
  return out;
}
function resumenMensual(){
  const pts=proyeccion(), movs=pendientes();
  return finesDeMes().map(mm=>{
    const b=deudaPorBloque(mm.fin);
    const saldo=[...pts].reverse().find(p=>p.f<=mm.fin)?.b??PL.saldo.importe;
    const enMes=pts.filter(p=>p.f.startsWith(mm.key));
    const del=movs.filter(m=>m.f.startsWith(mm.key));
    const entra=del.filter(m=>m.i>0).reduce((a,m)=>a+m.i,0), sale=del.filter(m=>m.i<0).reduce((a,m)=>a+m.i,0);
    return {mes:`${MESES_L[mm.m]} ${mm.y}`,key:mm.key,m:mm.m,y:mm.y,saldoFin:r2(saldo),saldoMin:r2(enMes.length?Math.min(...enMes.map(p=>p.b)):saldo),
            entra:r2(entra),sale:r2(sale),deuda:r2(b.fijo+b.aplazable+b.amigo),...b};
  });
}
function libre(){
  if(deudaHoy()<1) return null;
  return resumenMensual().find(r=>r.deuda<1)||null;
}
const libreTxt=()=>{ if(deudaHoy()<1) return 'sin deudas'; const l=libre(); return l?mayus(MESES_L[l.m])+' '+l.y:'fuera del plan'; };

/* Marca un movimiento como pagado o cobrado. importe: lo que de verdad ha entrado o salido, si no coincide con lo previsto. */
function marcarHecho(id,importe){
  const gen=movimientos().find(m=>m.id===id&&m.gen);
  if(gen){
    if(hechoGen(id)) throw new Error('Ya estaba hecho: '+gen.c);
    const v=importe!=null?importe:gen.i; PL.cobrados[id]=v; PL.saldo.importe=r2(PL.saldo.importe+v);
    const d=PL.deudas.find(x=>x.id===gen.d); if(d&&v<0) d.pendiente=Math.max(0,r2((d.pendiente||0)+v));
    return {concepto:gen.c,importe:v,previsto:gen.i};
  }
  const m=PL.movimientos.find(x=>x.id===id); if(!m||m.estado==='hecho') throw new Error('No hay ningún movimiento pendiente con id '+id);
  const previsto=m.i;
  if(importe!=null) m.i=importe;
  m.estado='hecho'; PL.saldo.importe=r2(PL.saldo.importe+(m.i||0));
  const d=PL.deudas.find(x=>x.id===m.d);
  if(d){ if(m.t==='prestamo') d.pendiente=r2((d.pendiente||0)+(m.debe||m.i||0)); else if(m.i<0) d.pendiente=Math.max(0,r2((d.pendiente||0)+m.i)); if(m.cierra) d.pendiente=0; }
  return {concepto:m.c,importe:m.i,previsto};
}
function quitarPrevisto(id){ const s=PL.saldo.importe, r=marcarHecho(id); PL.saldo.importe=s; return r; }
function editarGastos(v){ PL.gastosMes=v; for(const m of PL.movimientos) if(m.estado!=='hecho'&&m.t==='gasto'&&/^Gastos de vida$/i.test(m.c)) m.i=-v; }

/* ============================================================
   PINTADO
   ============================================================ */
const kpi=(l,v,s,cls)=>`<div class="kpi${cls?' '+cls:''}"><div class="v">${v}</div><div class="l">${l}</div>${s?`<div class="s">${s}</div>`:''}</div>`;
function kpisDinero(){
  const pts=proyeccion(), mn=minimo(pts);
  const ap=PL.deudas.filter(d=>d.bloque==='aparte').reduce((a,d)=>a+(d.pendiente||0),0);
  const estMin=mn.b<0?`<span class="estado mal">te faltan ${e0(-mn.b)} el ${fdate(mn.f)}</span>`:mn.b<150?`<span class="estado aviso">muy justo el ${fdate(mn.f)}</span>`:'<span class="estado ok">llegas a todo</span>';
  return kpi('Saldo en cuenta',e2(PL.saldo.importe),'a '+fdateY(PL.saldo.fecha),'main')+
    kpi('Deuda pendiente',e2(deudaHoy()),ap>0?'cuotas aparte: '+e0(ap):'sin cuotas aparte')+
    kpi('Saldo más bajo previsto',e0(mn.b),estMin)+
    kpi('Libre de deudas',libreTxt(),PL.deudas.length?'sin contar las cuotas aparte':'apunta tus deudas en Balance','pos');
}

function pintar(){
  NOM=calcNomina();
  pintarNomina(); pintarBalance(); pintarPagos();
  $('btnDeshacer').hidden=!undoStack.length;
}

function pintarNomina(){
  const N=NOM;
  if(N.err){
    $('nAviso').innerHTML=N.err==='sin'
      ?`<div class="aviso">Todavía no hay ninguna estancia guardada en este navegador. Ábrela en la <a href="calculadora-idom.html">calculadora</a> (pestaña <b>Calcular estancia</b>) y vuelve aquí, o carga el JSON que guardaste desde la calculadora con «Cargar copia».</div>`
      :`<div class="aviso">${esc(N.err)}</div>`;
    ['nHero','nKpis','nAnios','nTabla','nCfg'].forEach(id=>$(id).innerHTML='');
    $('nFuente').textContent=''; $('nHero').hidden=true;
    return;
  }
  $('nAviso').innerHTML=''; $('nHero').hidden=false;
  const P=N.P, E=EST;
  $('nFuente').textContent=fuenteEst==='calc'?'Leída de la calculadora de este navegador: si cambias algo allí, aquí se actualiza.':'Copia cargada desde un archivo.';
  const subs=P.subidas.length?P.subidas.map(s=>signo(s.pct,milar)+' % desde '+mesLabel(s.i)).join(', '):'ninguna';
  const reg={'917':'Exención art. 9.17','183':'Regla de 183 días','ninguno':'Tributa todo en España'}[P.regimen]||P.regimen;
  const fichas=[['Destino',P.origen+' → '+P.destino],['Salida',fx(P.salida)]];
  if(P.pausa) fichas.push(['Vuelves a España',fx(P.pausa.vuelta)],['Regresas a la estancia',fx(P.pausa.ida)]);
  fichas.push(['Vuelta definitiva',fx(P.regreso)],['Salario base',e0(P.salario0)+' al año'],['Subidas',subs],
    ['Variable',P.variable?e0(P.variable)+' en febrero':'—'],['Plus y dieta',nfx.format(P.pctPlus*100)+' % · '+e0(P.dietaDia)+'/día'],
    ['Días en destino',{fijo:P.diasDef+' al mes',laborables:'laborables',naturales:'naturales'}[P.modoDias]],
    ['Impuestos',reg+(P.tope?' · tope IDOM':'')]);
  $('nCfg').innerHTML=fichas.map(([a,b])=>`<div><span>${a}</span><b>${esc(b)}</b></div>`).join('');
  const F=N.filas, tot=F.reduce((a,f)=>a+f.total,0), fuera=F.filter(f=>f.dias>0), esp=F.filter(f=>!f.dias);
  const media=a=>a.length?a.reduce((x,f)=>x+f.netoMes,0)/a.length:0;
  const ev=F.reduce((a,f)=>a+f.netoExtra+f.netoVar+f.comp,0), pd=F.reduce((a,f)=>a+f.plus+f.dieta,0);
  $('nHero').innerHTML=`<div class="row">
    <div><div class="figure">${e0(tot)}</div><div class="fig-lab">cobras en ${F.length} meses, de ${mesTxt(N.i0)} a ${mesTxt(N.i1)}</div></div>
    <div><div class="sub">${e0(F.length?tot/F.length:0)}</div><div class="sub-lab">de media al mes, con extras y variable</div></div>
    <div><div class="sub">${e0(pd)}</div><div class="sub-lab">plus y dietas (las dietas no tributan)</div></div></div>`;
  $('nKpis').innerHTML=kpi('Nómina en destino',e0(media(fuera)),fuera.length+' meses con días fuera','pos')+
    kpi('Nómina en España',e0(media(esp)),esp.length+' meses sin días fuera')+
    kpi('Extras, variable y compensación',e0(ev),'partidas aparte')+
    kpi('IRPF y Seguridad Social',e0(F.reduce((a,f)=>a+f.irpf+f.ss,0)),'en el periodo');
  $('nAnios').innerHTML=N.anios.map(a=>{
    let est;
    if(a.fuera===0) est='<span class="estado neutro">todo el año en España</span>';
    else if(a.igualado) est='<span class="estado aviso">más de 183 días fuera: tributa como en España (IDOM iguala)</span>';
    else if(a.regimen==='ninguno') est='<span class="estado neutro">tributa todo en España</span>';
    else if(a.res.libre) est=`<span class="estado ok">lo de fuera no tributa en España · te quedan ${183-a.fuera} días de margen</span>`;
    else est='<span class="estado neutro">tributa en España</span>';
    return `<div class="anio"><b class="y">${a.y}</b><span>${a.fuera} días fuera</span>${est}${a.comp>0.5?`<span>IDOM compensa ${e0(a.comp)}</span>`:''}<span class="tag">en el plan: ${e0(a.neto)}</span></div>`;
  }).join('');
  let h='<thead><tr><th>Mes</th><th>Situación</th><th class="n">Días fuera</th><th class="n">Salario</th><th class="n">Plus</th><th class="n">Dietas</th><th class="n">IRPF</th><th class="n">SS</th><th class="n">Nómina neta</th><th class="n">Extra · variable</th><th class="n">Cobras</th></tr></thead><tbody>';
  const T={sal:0,plus:0,dieta:0,irpf:0,ss:0,neto:0,ev:0,tot:0};
  let yAnt=null;
  for(const f of F){
    if(f.y!==yAnt){ h+=`<tr class="yrow"><td colspan="11">${f.y}${N.anios.find(a=>a.y===f.y)?.igualado?' <span class="pill alerta">más de 183 días: tributa como en España</span>':''}</td></tr>`; yAnt=f.y; }
    const evv=f.netoExtra+f.netoVar+f.comp, idN=`n-${f.y}-${f.m}`;
    T.sal+=f.sal+f.extra+f.variable; T.plus+=f.plus; T.dieta+=f.dieta; T.irpf+=f.irpf; T.ss+=f.ss; T.neto+=f.netoMes; T.ev+=evv; T.tot+=f.total;
    const etiq=[f.extra>0.5?'extra':'',f.variable>0.5?'variable':'',f.comp>0.5?'compensación':''].filter(Boolean).join(' + ');
    h+=`<tr class="${f.dias>0?'':'fuera'}${evv>0.5?' extra':''}"><td>${MESES[f.m-1]}${f.subida?' <span class="pill up">subida</span>':''}</td><td>${esc(f.sit)}</td>
      <td class="n">${f.dias?nfx.format(f.dias):'—'}${f.ov?' <span class="pill alerta">a mano</span>':''}</td>
      <td class="n">${e2(f.sal)}</td><td class="n">${f.plus?e2(f.plus):'—'}</td><td class="n">${f.dieta?e2(f.dieta):'—'}</td>
      <td class="n">${e2(f.irpf)}</td><td class="n">${e2(f.ss)}</td>
      <td class="n b">${e2(f.netoMes)}${hechoGen(idN)?`<br><span class="tag">cobrada: ${e2(PL.cobrados[idN])}</span>`:''}</td>
      <td class="n">${evv>0.5?e2(evv)+'<br><span class="tag">'+etiq+'</span>':'—'}</td><td class="n b">${e2(f.total)}</td></tr>`;
  }
  h+=`</tbody><tfoot><tr><td colspan="3">Total</td><td class="n">${e0(T.sal)}</td><td class="n">${e0(T.plus)}</td><td class="n">${e0(T.dieta)}</td><td class="n">${e0(T.irpf)}</td><td class="n">${e0(T.ss)}</td><td class="n">${e0(T.neto)}</td><td class="n">${e0(T.ev)}</td><td class="n">${e0(T.tot)}</td></tr></tfoot>`;
  $('nTabla').innerHTML=h;
  $('horizonte').value=String(PL.horizonte);
}

function pintarBalance(){
  $('bKpis').innerHTML=kpisDinero();
  $('sFecha').value=PL.saldo.fecha; $('sImporte').value=PL.saldo.importe; $('sGastos').value=PL.gastosMes||'';
  const html=Object.keys(BLOQ).map(b=>{
    const ds=PL.deudas.filter(d=>d.bloque===b); if(!ds.length) return '';
    return `<div class="grupo"><div class="grupo-hd"><span><i style="background:${BLOQ[b].color}"></i>${BLOQ[b].label} · ${BLOQ[b].desc}</span><span>${e2(ds.reduce((a,d)=>a+(d.pendiente||0),0))}</span></div>`+
      ds.map(d=>`<div class="deuda"><span>${esc(d.nombre)}</span><span class="n">${d.pendiente>0.005?e2(d.pendiente):'<span class="estado ok">saldada</span>'}</span>
        <span class="acc"><button class="btn mini" type="button" data-editar="${esc(d.id)}">Editar</button><button class="btn quitar" type="button" data-borrar-deuda="${esc(d.id)}" aria-label="Borrar ${esc(d.nombre)}">✕</button></span>
        ${d.cuota||d.notas?`<small>${d.cuota?`cuota ${e2(d.cuota)} el día ${d.dia} de cada mes`:''}${d.cuota&&d.notas?' · ':''}${esc(d.notas)}</small>`:''}</div>`).join('')+'</div>';
  }).join('');
  $('bDeudas').innerHTML=html||'<div class="vacio-grande">Aún no hay deudas. Añádelas con el formulario o escribe, por ejemplo, «debo 200 € a Jon».</div>';
  const sel=$('mDeuda'), v=sel.value;
  sel.innerHTML='<option value="">Ninguna</option>'+PL.deudas.map(d=>`<option value="${esc(d.id)}">${esc(d.nombre)}</option>`).join('');
  sel.value=PL.deudas.some(d=>d.id===v)?v:'';
  const mios=PL.movimientos.filter(m=>m.estado!=='hecho').sort((a,b)=>a.f.localeCompare(b.f));
  $('bMovs').innerHTML=mios.length?mios.slice(0,80).map(m=>{ const d=PL.deudas.find(x=>x.id===m.d);
    return `<div class="fila"><span class="f">${fdateY(m.f)}</span><span>${esc(m.c)}${d?`<small>${esc(d.nombre)}${m.cierra?' · la salda':''}</small>`:''}</span>
      <span class="a"><span class="${m.i>0?'entra':''}">${m.i?(m.i>0?'+':'')+e2(m.i):'neto 0'}</span><button class="btn quitar" type="button" data-borrar-mov="${esc(m.id)}" aria-label="Borrar ${esc(m.c)}">✕</button></span></div>`; }).join('')
    +(mios.length>80?`<div class="tag">y ${mios.length-80} más</div>`:'')
    :'<div class="vacio-grande">Sin movimientos apuntados. Las nóminas, los gastos de vida y las cuotas mensuales los pone el plan solo.</div>';
}

let rango='6';
function pintarPagos(){
  $('pKpis').innerHTML=kpisDinero();
  const pts=proyeccion();
  const s=parseD(PL.saldo.fecha), lim=isoD(new Date(s.getFullYear(),s.getMonth()+6,0));
  const ptsV=rango==='6'?pts.filter(p=>p.f<=lim):pts;
  dibujarSaldo(ptsV,minimo(ptsV),rango==='6'?lim:null);
  dibujarDeuda();
  pintarProx();
}

function ticks(lo,hi,n){
  const span=hi-lo||1, raw=span/n, mag=Math.pow(10,Math.floor(Math.log10(raw)));
  const step=[1,2,2.5,5,10].map(k=>k*mag).find(s=>span/s<=n)||10*mag;
  const t=[]; for(let v=Math.floor(lo/step)*step;v<=hi+1e-6;v+=step) t.push(Math.round(v)); return t;
}
const kfmt=v=>Math.abs(v)>=1000?(v/1000).toLocaleString('es-ES',{maximumFractionDigits:1})+'k':String(v);
function dibujarSaldo(pts,mn,hasta){
  const W=900,H=280,L=50,R=14,T=14,B=28;
  const x0=parseD(pts[0].f).getTime(), x1=Math.max(hasta?parseD(hasta).getTime():parseD(pts[pts.length-1].f).getTime(),x0+864e5);
  const ys=pts.map(p=>p.b), lo=Math.min(0,...ys), hi=Math.max(...ys,100), tk=ticks(lo,hi,5);
  const yLo=Math.min(lo,tk[0]), yHi=Math.max(hi,tk[tk.length-1]);
  const X=t=>L+(t-x0)/(x1-x0)*(W-L-R), Y=v=>T+(yHi-v)/(yHi-yLo)*(H-T-B);
  let d=''; pts.forEach((p,k)=>{ const x=X(parseD(p.f).getTime()), y=Y(p.b); d+=k?`H${x}V${y}`:`M${x},${y}`; }); d+=`H${X(x1)}`;
  const xt=[]; let mm=new Date(parseD(pts[0].f).getFullYear(),parseD(pts[0].f).getMonth()+1,1);
  while(mm.getTime()<=x1){ xt.push(mm); mm=new Date(mm.getFullYear(),mm.getMonth()+1,1); }
  const every=xt.length>9?2:1, tx='fill="var(--muted)" font-size="11" font-family="Instrument Sans,system-ui,sans-serif"';
  $('pSaldo').innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Saldo previsto: mínimo ${e0(mn.b)} el ${fdate(mn.f)}">
    ${tk.map(v=>`<line x1="${L}" x2="${W-R}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line-soft)"/><text x="${L-6}" y="${Y(v)+4}" text-anchor="end" ${tx}>${kfmt(v)}</text>`).join('')}
    ${xt.filter((_,k)=>k%every===0).map(t=>`<text x="${X(t.getTime())}" y="${H-8}" text-anchor="middle" ${tx}>${MESES[t.getMonth()]}${t.getMonth()===0?' '+String(t.getFullYear()).slice(2):''}</text>`).join('')}
    <path d="${d}V${Y(Math.max(yLo,0))}H${L}Z" fill="var(--teal)" fill-opacity=".08"/>
    <line x1="${L}" x2="${W-R}" y1="${Y(0)}" y2="${Y(0)}" stroke="var(--ink)" stroke-width="1"/>
    <path d="${d}" fill="none" stroke="var(--teal)" stroke-width="2"/>
    ${pts.filter(p=>p.b<0).map(p=>`<circle cx="${X(parseD(p.f).getTime())}" cy="${Y(p.b)}" r="4" fill="var(--red)"/>`).join('')}
    <circle cx="${X(parseD(mn.f).getTime())}" cy="${Y(mn.b)}" r="5" fill="${mn.b<0?'var(--red)':'var(--teal)'}"/>
    <text x="${Math.min(X(parseD(mn.f).getTime())+8,W-150)}" y="${Y(mn.b)>H-B-30?Y(mn.b)-10:Y(mn.b)+18}" fill="var(--ink)" font-size="12" font-family="Instrument Sans,system-ui,sans-serif">mín. ${e0(mn.b)} · ${fdate(mn.f)}</text>
  </svg>`;
}
function dibujarDeuda(){
  const rows=resumenMensual();
  $('pLeyenda').innerHTML=CUENTAN.map(b=>`<span><i style="background:${BLOQ[b].color}"></i>${BLOQ[b].label}</span>`).join('');
  if(!rows.length){ $('pDeuda').innerHTML='<div class="vacio-grande">Sin movimientos previstos.</div>'; $('pTabla').innerHTML=''; return; }
  const W=600,H=240,L=46,R=8,T=10,B=28, hi=Math.max(...rows.map(r=>r.deuda),100), tk=ticks(0,hi,4), yHi=Math.max(hi,tk[tk.length-1]);
  const n=rows.length, bw=(W-L-R)/n, w=Math.max(5,Math.min(30,bw*.62)), Y=v=>T+(yHi-v)/yHi*(H-T-B);
  const tx='fill="var(--muted)" font-size="11" font-family="Instrument Sans,system-ui,sans-serif"';
  let bars='';
  rows.forEach((r,k)=>{ const cx=L+bw*k+bw/2; let acc=0;
    for(const b of CUENTAN){ if(r[b]<=.5) continue; const y0=Y(acc), y1=Y(acc+r[b]); acc+=r[b];
      bars+=`<rect x="${cx-w/2}" y="${y1}" width="${w}" height="${Math.max(0,y0-y1)}" fill="${BLOQ[b].color}"><title>${r.mes} · ${BLOQ[b].label}: ${e0(r[b])}</title></rect>`; }
    if(acc<.5&&PL.deudas.length) bars+=`<text x="${cx}" y="${Y(0)-6}" text-anchor="middle" fill="var(--ok)" font-size="12">✓</text>`;
  });
  const every=n>14?2:1;
  $('pDeuda').innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Deuda pendiente a fin de cada mes">
    ${tk.map(v=>`<line x1="${L}" x2="${W-R}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line-soft)"/><text x="${L-6}" y="${Y(v)+4}" text-anchor="end" ${tx}>${kfmt(v)}</text>`).join('')}
    ${rows.map((r,k)=>k%every?'':`<text x="${L+bw*k+bw/2}" y="${H-8}" text-anchor="middle" ${tx}>${MESES[r.m]}</text>`).join('')}${bars}</svg>`;
  $('pTabla').innerHTML='<thead><tr><th>Mes</th><th class="n">Entra</th><th class="n">Sale</th><th class="n">Saldo mín.</th><th class="n">Saldo a fin de mes</th><th class="n">Deuda</th><th class="n">Cuotas aparte</th></tr></thead><tbody>'+
    rows.map(r=>`<tr><td>${r.mes}</td><td class="n pos">${e0(r.entra)}</td><td class="n">${e0(r.sale)}</td>
      <td class="n${r.saldoMin<0?' warn':''}">${e0(r.saldoMin)}</td><td class="n">${e0(r.saldoFin)}</td>
      <td class="n b">${e0(r.deuda)}</td><td class="n tag">${e0(r.aparte)}</td></tr>`).join('')+'</tbody>';
}
function pintarProx(){
  const ini=PL.saldo.fecha, lim=isoD(new Date(parseD(ini>hoy()?ini:hoy()).getTime()+45*864e5));
  const movs=pendientes().filter(m=>m.f<=lim);
  $('pProx').innerHTML=movs.length?movs.map(m=>{
    const d=PL.deudas.find(x=>x.id===m.d), atras=m.f<hoy();
    const sub=d?esc(d.nombre):m.gen==='nomina'?'de la pestaña Nómina':m.gen?'lo pone el plan':'';
    return `<div class="fila"><span class="f">${fdate(m.f)}</span><span>${esc(m.c)}${sub||atras?`<small>${sub}${sub&&atras?' · ':''}${atras?'<span style="color:var(--aviso)">pendiente de confirmar</span>':''}</small>`:''}</span>
      <span class="a"><span class="${m.i>0?'entra':''}">${m.i?(m.i>0?'+':'')+e2(m.i):'neto 0'}</span><button class="btn hecho" type="button" data-hecho="${esc(m.id)}">Hecho</button></span></div>`;
  }).join(''):'<div class="vacio-grande">No hay nada previsto en los próximos 45 días.</div>';
}

/* ============================================================
   CÓMO TE AFECTA: foto de lo importante antes y después de un cambio
   ============================================================ */
function foto(st){
  const p0=PL,e0_=EST,n0=NOM; PL=st.PL; EST=st.EST;
  try{
    NOM=calcNomina();
    const pts=proyeccion(), mn=minimo(pts), meses={};
    for(const f of NOM.filas) meses[f.i]={total:r2(f.total),pd:r2(f.plus+f.dieta),imp:r2(f.irpf),sal:r2(f.sal+f.extra)};
    return {saldo:PL.saldo.importe,min:{f:mn.f,b:mn.b},libre:libreTxt(),deuda:deudaHoy(),anios:NOM.anios.map(a=>({y:a.y,fuera:a.fuera,igualado:a.igualado})),
            meses,total:r2(NOM.filas.reduce((a,f)=>a+f.total,0))};
  }finally{ PL=p0; EST=e0_; NOM=n0; }
}
const dif=(a,b)=>{ const d=r2(b-a); return (d>0?'+':'−')+e0(Math.abs(d)); };
function impacto(A,B){
  const a=foto(A), b=foto(B), L=[], z={total:0,pd:0,imp:0,sal:0};
  const cm=Object.keys({...a.meses,...b.meses}).map(Number).filter(k=>Math.abs((a.meses[k]||z).total-(b.meses[k]||z).total)>=1).sort((x,y)=>x-y);
  if(cm.length){
    L.push(`Cobras en el periodo ${e0(a.total)} → ${e0(b.total)} (${dif(a.total,b.total)})`);
    for(const k of cm.slice(0,4)){ const x=a.meses[k]||z, y=b.meses[k]||z, por=[];
      if(Math.abs(y.sal-x.sal)>=1) por.push(`salario ${dif(x.sal,y.sal)}`);
      if(Math.abs(y.pd-x.pd)>=1) por.push(`plus y dietas ${dif(x.pd,y.pd)}`);
      if(Math.abs(y.imp-x.imp)>=1) por.push(`IRPF ${dif(x.imp,y.imp)}`);
      L.push(`· ${mesCorto(k)}: ${e0(x.total)} → ${e0(y.total)}${por.length?' ('+por.join(', ')+')':''}`); }
    if(cm.length>4) L.push(`· y ${cm.length-4} meses más`);
  }
  for(const y of b.anios){ const x=a.anios.find(q=>q.y===y.y)||{fuera:0,igualado:false};
    if(x.fuera!==y.fuera) L.push(`Días fuera en ${y.y}: ${x.fuera} → ${y.fuera}`+(y.igualado&&!x.igualado?' · pasas de 183: ese año tributa como en España'
      :!y.igualado&&x.igualado?' · bajas de 183: recuperas la exención':y.igualado?'':` · margen hasta 183: ${183-y.fuera} días`)); }
  if(a.saldo!==b.saldo) L.push(`Saldo en cuenta ${e2(a.saldo)} → ${e2(b.saldo)}`);
  if(a.deuda!==b.deuda) L.push(`Deuda pendiente ${e2(a.deuda)} → ${e2(b.deuda)}`);
  if(a.min.b!==b.min.b||a.min.f!==b.min.f) L.push(`Saldo más bajo previsto ${e0(a.min.b)} el ${fdate(a.min.f)} → ${e0(b.min.b)} el ${fdate(b.min.f)}`+(b.min.b<0?' · te faltaría dinero':b.min.b<150?' · muy justo':''));
  if(a.libre!==b.libre) L.push(`Libre de deudas: ${a.libre} → ${b.libre}`);
  return L;
}

/* ============================================================
   CUÉNTAME: entiende frases sencillas y explica lo que hace
   ============================================================ */
const sinTilde=s=>s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
const numES=s=>{ s=String(s).trim(); if(/,\d{1,2}$/.test(s)) s=s.replace(/\./g,'').replace(',','.'); else s=s.replace(/[.,](?=\d{3}\b)/g,'').replace(',','.'); return parseFloat(s); };
const MES_ALT='enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre';
const MES_RE='('+MES_ALT+'|este mes|el mes que viene|proximo mes)';
/* Mes absoluto (año*12+mes-1) de un nombre de mes: el próximo que viene si no se dice el año */
function mesDe(txt,anio){
  const h=parseD(hoy()); let m;
  if(txt==='este mes') m=h.getMonth(); else if(txt==='el mes que viene'||txt==='proximo mes') m=(h.getMonth()+1)%12;
  else m=MESES_L.indexOf(txt==='setiembre'?'septiembre':txt);
  const y=anio?+anio:h.getFullYear()+(m<h.getMonth()-1?1:0)+(txt==='el mes que viene'||txt==='proximo mes'?(h.getMonth()===11?1:0):0);
  return y*12+m;
}
const isoDeMes=(i,d)=>`${Math.floor(i/12)}-${pad(i%12+1)}-${pad(d)}`;
function buscarDeuda(texto){
  const t=sinTilde(texto);
  return PL.deudas.find(d=>t.includes(sinTilde(d.nombre)))||PL.deudas.find(d=>sinTilde(d.nombre).split(/\s+/).some(w=>w.length>=4&&t.includes(w)))||null;
}

function entender(texto){
  const t=sinTilde(texto), hechos=[];
  const add=(que,porque)=>hechos.push({que,porque});
  let m;
  /* saldo: se apunta al final, y si lo hay, lo pagado ya está dentro y no se vuelve a restar */
  let saldoNuevo=null;
  if((m=t.match(/\bsaldo\D{0,25}?(-?\d[\d.,]*)/))||(m=t.match(/\b(?:tengo|me quedan|quedan|hay)\s+(-?\d[\d.,]*)\s*(?:€|eur|euros)?\s+en\s+(?:la\s+)?(?:cuenta|banco)/))) saldoNuevo=r2(numES(m[1]));
  const imp=saldoNuevo==null?(t.match(/(-?\d[\d.,]*)\s*(?:€|eur\b|euros)/)||[])[1]:null;

  /* estancia: fechas */
  if(EST&&(m=t.match(new RegExp('(?:vuelvo|vuelta|regreso|volvere|vuelvo definitivamente)\\D{0,30}?(?:el\\s+)?(\\d{1,2})\\s+de\\s+('+MES_ALT+')(?:\\s+(?:de\\s+)?(20\\d\\d))?')))&&!/intermedi|vacaciones|unos dias/.test(t)){
    const i=mesDe(m[2],m[3]), f=isoDeMes(i,Math.min(+m[1],diasMes(Math.floor(i/12),i%12+1)));
    const ant=EST.campos.regreso; EST.campos.regreso=f;
    add(`vuelta definitiva: ${fdateY(f)}${ant?` (antes ${fdateY(ant)})`:''}`,'cambia los meses con plus y dietas, y los días fuera de cada año, que deciden si llegas a 183');
  }
  if(EST&&(m=t.match(new RegExp('(?:me voy|salgo|salida|me marcho)\\D{0,30}?(?:el\\s+)?(\\d{1,2})\\s+de\\s+('+MES_ALT+')(?:\\s+(?:de\\s+)?(20\\d\\d))?')))){
    const i=mesDe(m[2],m[3]), f=isoDeMes(i,Math.min(+m[1],diasMes(Math.floor(i/12),i%12+1)));
    const ant=EST.campos.salida; EST.campos.salida=f;
    add(`salida: ${fdateY(f)}${ant?` (antes ${fdateY(ant)})`:''}`,'la nómina con plus y dietas empieza ese mes');
  }
  /* días de un mes */
  let md=null;
  if((m=t.match(new RegExp('(\\d{1,2})\\s*dias?\\b.{0,40}?\\b'+MES_RE+'(?:\\s+(?:de\\s+)?(20\\d\\d))?'))))md={dias:+m[1],mes:m[2],anio:m[3]};
  else if((m=t.match(new RegExp(MES_RE+'(?:\\s+(?:de\\s+)?(20\\d\\d))?\\D{0,40}?(\\d{1,2})\\s*dias?'))))md={dias:+m[3],mes:m[1],anio:m[2]};
  else if(/\ben espana\b/.test(t)&&!/vuelvo|vuelta|regreso/.test(t)&&(m=t.match(new RegExp(MES_RE+'(?:\\s+(?:de\\s+)?(20\\d\\d))?'))))md={dias:0,mes:m[1],anio:m[2],esp:true};
  if(md&&EST&&NOM.P){
    const i=mesDe(md.mes,md.anio), y=Math.floor(i/12), mo=i%12+1;
    const D=situacion(NOM.P,y,mo,true);
    if(!D.partes.length) throw new Error(`En ${mesTxt(i)} no estás en la estancia (va del ${fx(NOM.P.salida)} al ${fx(NOM.P.regreso)}). Si cambian las fechas, dime por ejemplo «vuelvo el 15 de junio».`);
    const dias=md.dias;
    EST.S.overrides=EST.S.overrides||{}; EST.S.overrides[ymKey(i)]=Math.min(31,Math.max(0,dias));
    add(`${mesTxt(i)}: ${dias} días en destino`,dias===0
      ?'sin plus ni dietas ese mes; para el impuesto sigue contando como estancia mientras las fechas lo incluyan (si vuelves de verdad, cambia la fecha de vuelta)'
      :'plus y dietas se pagan por día en destino, así que la nómina de ese mes cambia');
  }
  /* subidas */
  if(EST&&(m=t.match(new RegExp('(?:subid[oa]s?|suben|subir|aumento|subida)\\D{0,25}?(\\d+(?:[.,]\\d+)?)\\s*(?:%|por ?ciento)(?:.*?\\b'+MES_RE+'(?:\\s+(?:de\\s+)?(20\\d\\d))?)?')))){
    const i=mesDe(m[2]||'este mes',m[3]), desde=ymKey(i), pct=numES(m[1]);
    const habia=(EST.S.subidas||[]).find(s=>s.desde===desde);
    EST.S.subidas=(EST.S.subidas||[]).filter(s=>s.desde!==desde).concat({pct,desde});
    add(`subida del ${nfx.format(pct)} % desde ${mesTxt(i)}`,habia
      ?`sustituye la subida del ${nfx.format(+habia.pct||0)} % que tenías ese mes; si son dos subidas distintas, dímelo con otro mes`
      :'se encadena con las anteriores y sube también las extras que se devengan desde entonces');
  }
  if(EST&&(m=t.match(/(?:sueldo|salario)(?: base)?\D{0,20}?(\d[\d.,]{3,})/))){
    const v=numES(m[1]); EST.campos.importe=String(EST.S.modoImporte==='paga'?r2(v/(+EST.S.pagas||14)):v);
    add(`salario base ${e0(v)} al año`,'cambian todas las nóminas y la retención');
  }
  if((m=t.match(/\bgastos?\b[^\d]{0,30}(\d[\d.,]*)/))&&!/saldo/.test(t)){
    const v=numES(m[1]); editarGastos(v); add(`gastos de vida ${e0(v)} al mes`,'se restan el día 1 de cada mes');
  }
  /* deudas nuevas: «debo 200 € a Jon» */
  if((m=texto.match(/\bdebo\s+(\d[\d.,]*)\s*(?:€|euros?)?\s+(?:a|al)\s+([A-Za-zÁÉÍÓÚÑÜáéíóúñü][\wÁÉÍÓÚÑÜáéíóúñü]*(?:\s+[A-ZÁÉÍÓÚÑ][\wáéíóúñ]*)?)/i))){
    const v=r2(numES(m[1])), nombre=m[2].trim();
    let d=PL.deudas.find(x=>sinTilde(x.nombre)===sinTilde(nombre));
    if(d){ d.pendiente=v; add(`${d.nombre}: le debes ${e2(v)}`,'actualizo lo que queda'); }
    else{ d={id:idNuevo('d'),nombre:mayus(nombre),bloque:'amigo',pendiente:v,notas:'',cuota:0,dia:1}; PL.deudas.push(d);
      add(`nueva deuda: ${d.nombre}, ${e2(v)} (amigos y familia)`,'cuenta en la deuda total; si tiene fecha de pago, dime «pagaré 200 € a '+d.nombre+' el 5 de diciembre»'); }
  }
  /* pagos futuros: «pagaré 200 € a Jon el 5 de diciembre» */
  if((m=t.match(new RegExp('(?:pagare|tengo que pagar|voy a pagar|devolvere)\\s+(\\d[\\d.,]*)\\s*(?:€|euros?)?\\s+(?:a|al|de|del)\\s+(.+?)\\s+el\\s+(\\d{1,2})\\s+de\\s+('+MES_ALT+')(?:\\s+(?:de\\s+)?(20\\d\\d))?')))){
    const v=r2(numES(m[1])), d=buscarDeuda(m[2]), i=mesDe(m[4],m[5]), f=isoDeMes(i,Math.min(+m[3],diasMes(Math.floor(i/12),i%12+1)));
    PL.movimientos.push({id:idNuevo('m'),f,c:d?'Pago '+d.nombre:'Pago '+mayus(m[2]),t:'pago',d:d?d.id:'',i:-v,estado:'previsto'});
    add(`pago previsto de ${e2(v)}${d?' a '+d.nombre:''} el ${fdateY(f)}`,d?'baja esa deuda ese día':'no lo he asociado a ninguna deuda; si es de una, créala antes');
  }
  /* pagado o cobrado */
  if(/(pagad|pague|devuelt|devolvi|cobrad|cobre|llegad|ingresad|recibid|\bhecho\b)/.test(t)){
    const cobro=/(cobr|llegad|ingresad|recibid|nomina|extra|variable)/.test(t);
    const lim=isoD(new Date(parseD(hoy()).getTime()+20*864e5));
    const pal=t.replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(w=>w.length>=4&&!/^(pagad|pague|cobr|llegad|hecho|euros|ahora|tambien|nomina|cuenta|tengo|saldo)/.test(w));
    const cand=pendientes().filter(x=>x.f<=lim&&(cobro?x.i>0:(x.i<0||x.t==='aplazado')));
    let mejor=null, best=0;
    for(const x of cand){
      const d=PL.deudas.find(q=>q.id===x.d), txt=sinTilde(x.c+' '+(d?d.nombre+' '+d.id:''));
      let s=pal.filter(w=>txt.includes(w)).length;
      if(cobro&&/nomina/.test(t)&&/^n-/.test(x.id)) s+=2;
      if(/extra/.test(t)&&/^x-/.test(x.id)) s+=2;
      if(/variable/.test(t)&&/^v-/.test(x.id)) s+=2;
      if(s>best){ best=s; mejor=x; }
    }
    if(mejor){
      if(saldoNuevo!=null){ const r=quitarPrevisto(mejor.id); add(`hecho: ${r.concepto}`,'como me das el saldo nuevo, ya lo incluye: no lo resto otra vez'); }
      else{ const v=imp!=null?(mejor.i<0?-Math.abs(numES(imp)):Math.abs(numES(imp))):null; const r=marcarHecho(mejor.id,v);
        add(`hecho: ${r.concepto} (${e2(r.importe)})`,v!=null&&Math.abs(v-r.previsto)>=0.5?`estaba previsto ${e2(r.previsto)}: apunto lo real y la diferencia (${dif(r.previsto,v)}) pasa a tu saldo`:'lo sumo o resto de tu saldo y, si es una deuda, baja lo que debes'); }
    }else if(!hechos.length&&saldoNuevo==null) throw new Error('No encuentro qué has pagado o cobrado entre lo previsto para los próximos 20 días. Márcalo con «Hecho» en el plan de pagos o dime el nombre (por ejemplo, «he pagado el préstamo del coche»).');
  }
  if(saldoNuevo!=null){ const ant=PL.saldo.importe; PL.saldo={fecha:hoy(),importe:saldoNuevo};
    add(`saldo ${e2(saldoNuevo)} a hoy (antes ${e2(ant)})`,'el plan parte de este saldo; lo previsto antes de hoy sigue pendiente hasta que lo marques como hecho'); }
  return hechos;
}

let hist=[];
try{ hist=JSON.parse(localStorage.getItem(CLAVE_CHAT)||'[]'); }catch(e){ hist=[]; }
const guardarHist=()=>{ try{ localStorage.setItem(CLAVE_CHAT,JSON.stringify(hist.slice(-40))); }catch(e){} };
function md(t){
  const lines=esc(t).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').split('\n');
  let out='', inList=false;
  for(const l of lines){
    const li=l.match(/^\s*[-•]\s+(.*)/);
    if(li){ if(!inList){ out+='<ul>'; inList=true; } out+=`<li>${li[1]}</li>`; continue; }
    if(inList){ out+='</ul>'; inList=false; }
    if(l.trim()) out+=`<p>${l}</p>`;
  }
  return out+(inList?'</ul>':'');
}
function burbuja(rol,txt){
  const el=document.createElement('div'); el.className='msg '+rol;
  if(rol==='a') el.innerHTML=md(txt);
  else if(rol==='imp') el.innerHTML='<b>Cómo te afecta</b>'+txt.map(l=>`<div class="${/^·/.test(l)?'sub':''}${/faltaría/.test(l)?' mal':''}">${esc(l)}</div>`).join('');
  else el.textContent=txt;
  $('msgs').appendChild(el); $('msgs').scrollTop=$('msgs').scrollHeight;
}
const AYUDA='Te entiendo frases como:\n- Mi saldo es 650 € · Tengo 420 € en la cuenta\n- He pagado el préstamo · Me ha llegado la nómina, 2.540 €\n- En noviembre estaré 20 días fuera · Vuelvo el 15 de junio\n- Me suben un 5 % en enero · Gastos 750\n- Debo 200 € a Jon · Pagaré 200 € a Jon el 5 de diciembre\nPara todo lo demás tienes los formularios de la izquierda.';
function pintarHist(){
  $('msgs').innerHTML='';
  if(!hist.length) burbuja('a','Cuéntame lo que vaya pasando y lo apunto en la nómina, el balance o el plan de pagos. Después te enseño cómo te afecta: qué cobras, cuánto debes y cuál es tu saldo más justo.\n'+AYUDA);
  for(const h of hist) burbuja(h.rol,h.txt);
}
function apuntar(texto){
  texto=texto.trim(); if(!texto) return;
  $('input').value='';
  hist.push({rol:'u',txt:texto}); burbuja('u',texto);
  const antes=foto0();
  let hechos=[], err=null;
  try{ hechos=entender(texto); }catch(e){ err=e.message; }
  if(err||!hechos.length){
    PL=antes.PL; EST=antes.EST;
    const r=err?err:'No lo he entendido. '+AYUDA;
    hist.push({rol:'a',txt:r}); burbuja('a',r); guardarHist(); return;
  }
  const r='**Lo que he entendido y apuntado:**\n'+hechos.map(h=>`- ${h.que}`).join('\n')+'\n**Por qué cambia:**\n'+hechos.map(h=>`- ${h.porque}`).join('\n');
  hist.push({rol:'a',txt:r}); burbuja('a',r);
  undoStack.push(antes); guardar();
  const L=impacto(antes,foto0());
  if(L.length){ hist.push({rol:'imp',txt:L}); burbuja('imp',L); }
  guardarHist(); pintar();
}

/* ============================================================
   EVENTOS
   ============================================================ */
function cambio(fn){ pushUndo(); try{ fn(); }catch(e){ undoStack.pop(); alert(e.message); return; } guardar(); pintar(); }
function irTab(t){
  if(!['nomina','balance','pagos'].includes(t)) t='nomina';
  document.querySelectorAll('#tabs button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tab===t)));
  ['nomina','balance','pagos'].forEach(k=>$('t-'+k).hidden=k!==t);
  try{ history.replaceState(null,'','#'+t); }catch(e){}
}
$('tabs').addEventListener('click',e=>{ const b=e.target.closest('[data-tab]'); if(b) irTab(b.dataset.tab); });
$('horizonte').addEventListener('change',()=>cambio(()=>{ PL.horizonte=+$('horizonte').value; }));
$('sGuardar').addEventListener('click',()=>{
  const f=$('sFecha').value, v=parseFloat($('sImporte').value);
  if(!esFecha(f)||!isFinite(v)){ alert('Pon la fecha y el saldo.'); return; }
  cambio(()=>{ PL.saldo={fecha:f,importe:r2(v)}; });
});
$('sGastos').addEventListener('change',()=>cambio(()=>editarGastos(Math.abs(parseFloat($('sGastos').value)||0))));

let editando=null;
function formDeuda(d){
  editando=d?d.id:null;
  $('dNombre').value=d?d.nombre:''; $('dBloque').value=d?d.bloque:'fijo'; $('dPendiente').value=d?d.pendiente:'';
  $('dCuota').value=d&&d.cuota?d.cuota:''; $('dDia').value=d?d.dia:1; $('dNotas').value=d?d.notas:'';
  $('dTitulo').textContent=d?'Editar deuda':'Añadir deuda'; $('dGuardar').textContent=d?'Guardar cambios':'Añadir deuda'; $('dCancelar').hidden=!d;
}
$('dForm').addEventListener('submit',e=>{
  e.preventDefault();
  const datos={nombre:$('dNombre').value.trim().slice(0,60),bloque:$('dBloque').value,pendiente:r2(Math.max(0,parseFloat($('dPendiente').value)||0)),
    cuota:r2(Math.max(0,parseFloat($('dCuota').value)||0)),dia:Math.min(28,Math.max(1,parseInt($('dDia').value)||1)),notas:$('dNotas').value.trim().slice(0,240)};
  if(!datos.nombre) return;
  cambio(()=>{ const d=PL.deudas.find(x=>x.id===editando); if(d) Object.assign(d,datos); else PL.deudas.push({id:idNuevo('d'),...datos}); });
  formDeuda(null);
});
$('dCancelar').addEventListener('click',()=>formDeuda(null));
$('bDeudas').addEventListener('click',e=>{
  const ed=e.target.closest('[data-editar]'), bo=e.target.closest('[data-borrar-deuda]');
  if(ed){ formDeuda(PL.deudas.find(d=>d.id===ed.dataset.editar)); $('dNombre').focus(); }
  if(bo){ const d=PL.deudas.find(x=>x.id===bo.dataset.borrarDeuda); if(!d) return;
    const n=PL.movimientos.filter(m=>m.d===d.id&&m.estado!=='hecho').length;
    if(!confirm(`¿Borrar la deuda «${d.nombre}»?`+(n?` También se borran sus ${n} pagos previstos.`:''))) return;
    cambio(()=>{ PL.deudas=PL.deudas.filter(x=>x.id!==d.id); PL.movimientos=PL.movimientos.filter(m=>!(m.d===d.id&&m.estado!=='hecho')); }); }
});
function tipoMov(){ const t=$('mTipo').value; document.body.classList.toggle('t-prestamo',t==='prestamo'); document.body.classList.toggle('t-pago',t==='pago'); }
$('mTipo').addEventListener('change',tipoMov);
$('mForm').addEventListener('submit',e=>{
  e.preventDefault();
  const t=$('mTipo').value, v=Math.abs(parseFloat($('mImporte').value)||0), f=$('mFecha').value, c=$('mConcepto').value.trim();
  if(!esFecha(f)||!c) return;
  const m={id:idNuevo('m'),f,c:c.slice(0,120),t,d:$('mDeuda').value,i:t==='ingreso'||t==='prestamo'?v:t==='aplazado'?0:-v,estado:'previsto'};
  if(t==='prestamo') m.debe=r2(Math.abs(parseFloat($('mDebe').value)||v));
  if(t==='pago'&&$('mCierra').checked) m.cierra=true;
  cambio(()=>PL.movimientos.push(m));
  $('mConcepto').value=''; $('mImporte').value=''; $('mDebe').value=''; $('mCierra').checked=false;
});
$('bMovs').addEventListener('click',e=>{ const b=e.target.closest('[data-borrar-mov]'); if(b) cambio(()=>{ PL.movimientos=PL.movimientos.filter(m=>m.id!==b.dataset.borrarMov); }); });
$('pProx').addEventListener('click',e=>{ const b=e.target.closest('[data-hecho]'); if(b) cambio(()=>marcarHecho(b.dataset.hecho)); });
$('segRango').addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return; rango=b.dataset.v;
  $('segRango').querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x===b))); pintarPagos(); });
$('btnDeshacer').addEventListener('click',deshacer);
$('form').addEventListener('submit',e=>{ e.preventDefault(); apuntar($('input').value); });
$('input').addEventListener('keydown',e=>{ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); apuntar($('input').value); } });
$('chips').addEventListener('click',e=>{ const b=e.target.closest('button'); if(b){ $('input').value=b.textContent; $('input').focus(); } });
$('clearChat').addEventListener('click',()=>{ hist=[]; guardarHist(); pintarHist(); });

/* copia de seguridad: el plan y la estancia que usa */
$('btnExportar').addEventListener('click',()=>{
  const datos={app:'Mi plan · Calculadora IDOM',version:1,plan:{...PL,estancia:undefined},estancia:EST};
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([JSON.stringify(datos,null,1)],{type:'application/json'}));
  a.download='mi-plan-'+hoy()+'.json'; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),2000);
});
$('btnImportar').addEventListener('click',()=>$('fichero').click());
$('fichero').addEventListener('change',async()=>{
  const f=$('fichero').files[0]; $('fichero').value=''; if(!f) return;
  let j; try{ j=JSON.parse(await f.text()); }catch(e){ alert('Ese archivo no es un JSON válido.'); return; }
  const estDe=x=>x&&x.S&&x.campos?x:null;
  const est=estDe(j)||estDe(j.estancia);
  const plan=j.plan||(Array.isArray(j.deudas)||Array.isArray(j.movimientos)?j:null);
  if(!est&&!plan){ alert('No encuentro ni un plan ni una estancia de la calculadora en ese archivo.'); return; }
  pushUndo();
  if(plan){ const viejo=PL.estancia; PL=normalizarPlan(plan); if(!PL.estancia&&viejo) PL.estancia=viejo; }
  if(est){
    if(!leerCalc()||confirm('¿Usar también la estancia de este archivo en la calculadora? Sustituye la que tienes guardada allí.')){
      try{ localStorage.setItem(CLAVE_CALC,JSON.stringify(est)); }catch(e){}
    }
    PL.estancia=clon(est);
  }
  cargarEstancia(); guardar(); pintar();
});
/* si la calculadora cambia en otra pestaña, se recalcula */
window.addEventListener('storage',e=>{ if(e.key===CLAVE_CALC){ cargarEstancia(); pintar(); } });

if('serviceWorker' in navigator&&/^https?:$/.test(location.protocol)){
  window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
}

$('mFecha').value=hoy();
tipoMov();
pintarHist();
pintar();
irTab((location.hash||'').slice(1));
