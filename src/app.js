"use strict";
/* ============================================================
   ESTADO Y LECTURA
   ============================================================ */
const $=id=>document.getElementById(id);
const S={mode:'desglose',ultimo:'desglose',periodo:'estancia',cmp:{A:null,B:null,C:null,D:null},modoImporte:'anual',pagas:14,cobroExtra:'aparte',irpf:'tabla',
         subidas:[{pct:3,desde:'2027-01'}],overrides:{}};
const num=id=>{const v=parseFloat($(id).value);return isFinite(v)?v:0;};

/* Lo que hay en pantalla, en el mismo formato que se guarda */
function camposForm(){
  const c={}; CAMPOS.forEach(id=>c[id]=$(id).value);
  CHECKS.forEach(id=>c[id]=$(id).checked);
  return c;
}
function leer(){ return paramsDe(camposForm(),S); }

/* ============================================================
   INTERFAZ: CONTROLES
   ============================================================ */
function poblar(){
  const ord=[...PAISES].sort((a,b)=>a[0].localeCompare(b[0],'es'));
  const opts=ord.map(p=>`<option value="${p[0]}">${p[0]}</option>`).join('');
  $('origen').innerHTML=opts; $('destino').innerHTML=opts;
  $('origen').value='España'; $('destino').value='Francia';
  const mo=MESES_L.map((n,k)=>`<option value="${k+1}">${n[0].toUpperCase()+n.slice(1)}</option>`).join('');
  $('extra1').innerHTML=mo; $('extra2').innerHTML=mo;
  $('extra1').value='6'; $('extra2').value='12';
  $('anio').value=new Date().getFullYear();
}

function seg(idBox,key,cast){
  $(idBox).addEventListener('click',e=>{
    const b=e.target.closest('button'); if(!b)return;
    S[key]=cast?cast(b.dataset.v):b.dataset.v;
    syncSegs(); calc();
  });
}
function syncSegs(){
  const map={segModo:'mode',segImporte:'modoImporte',segPagas:'pagas',segCobro:'cobroExtra',segIrpf:'irpf',segPeriodo:'periodo'};
  for(const [box,key] of Object.entries(map))
    $(box).querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.v===String(S[key]))));
}

/* ---------- subidas ---------- */
function pintarSubidas(){
  if(!S.subidas.length){
    $('subidas').innerHTML='<div class="vacio">Sin subidas. Añade una con los botones.</div>';
    return;
  }
  $('subidas').innerHTML=S.subidas.map((s,k)=>`
    <div class="sub-row" data-k="${k}">
      <span class="n">${k+1}</span>
      <input type="number" class="sub-pct" value="${s.pct}" step="0.1" aria-label="Porcentaje de la subida ${k+1}">
      <input type="month" class="sub-desde" value="${s.desde}" aria-label="Mes desde el que se aplica la subida ${k+1}" placeholder="AAAA-MM">
      <button type="button" class="sub-del" aria-label="Quitar subida ${k+1}" title="Quitar">×</button>
    </div>`).join('');
}
$('subidas').addEventListener('input',e=>{
  const row=e.target.closest('.sub-row'); if(!row)return;
  const s=S.subidas[+row.dataset.k];
  if(e.target.classList.contains('sub-pct')) s.pct=parseFloat(e.target.value)||0;
  if(e.target.classList.contains('sub-desde')) s.desde=e.target.value;
  calc();
});
$('subidas').addEventListener('click',e=>{
  if(!e.target.closest('.sub-del'))return;
  S.subidas.splice(+e.target.closest('.sub-row').dataset.k,1);
  pintarSubidas(); calc();
});
$('quickSub').addEventListener('click',e=>{
  const b=e.target.closest('button'); if(!b)return;
  const validas=S.subidas.map(s=>parseYM(s.desde)).filter(isFinite);
  let i;
  if(validas.length) i=Math.max(...validas)+12;
  else{
    const P=leer();
    const base=S.mode==='estancia'&&P.salida?P.salida.y:(S.mode==='subidas'?P.anio:new Date().getFullYear());
    i=(base+1)*12;
  }
  S.subidas.push({pct:+b.dataset.p,desde:ymKey(i)});
  pintarSubidas(); calc();
});

/* ============================================================
   CÁLCULO Y PINTADO
   ============================================================ */
function calc(){
  const P=leer();
  const body=document.body;
  if(S.mode!=='comparador') S.ultimo=S.mode;
  ['desglose','subidas','estancia','comparador'].forEach(m=>body.classList.toggle('m-'+m,S.mode===m));
  body.classList.toggle('per-custom',S.periodo==='custom');
  body.classList.toggle('con-est2',$('est2').checked);
  body.classList.toggle('reg-917',$('regimen').value==='917');
  body.classList.toggle('dias-fijo',$('modoDias').value==='fijo');
  body.classList.toggle('euros-hoy',$('eurosHoy').checked);
  $('hintRegimen').textContent={
    '917':'Lo cobrado por los días trabajados fuera (salario de esos días, plus y su parte de extras y variable) no tributa en España, hasta 60.100 € al año. Requisitos: trabajo para una entidad o establecimiento en el extranjero y país con un impuesto similar.',
    '183':'Simplificación: si en el año natural estás menos de 183 días fuera, lo cobrado fuera no tributa; con 183 o más, tributa todo.',
    'ninguno':'Todo lo cobrado tributa en España, como si no hubiera ninguna exención.'}[$('regimen').value];
  body.classList.toggle('p12',S.pagas===12);
  ['tabla','prog','manual','zero'].forEach(m=>body.classList.toggle('irpf-'+m,S.irpf===m));

  $('hintImporte').textContent=S.modoImporte==='anual'
    ?'Total del año antes de descuentos: '+eur0(P.salario0)
    :'Cada paga × '+P.pagas+' pagas = '+eur0(P.salario0)+' al año';
  $('hintIrpf').textContent={
    tabla:'Un solo porcentaje de la tabla sobre todo el sueldo. Es lo que aplica la nómina en Bizkaia.',
    prog:'Cada tramo a su propio porcentaje. Simulación de contraste, no es lo que aplica la nómina.',
    manual:'El porcentaje que tú indiques, fijo todo el año.',
    zero:'Sin retención de IRPF.'}[S.irpf];

  let b=P.salario0;
  const cadena=[eur0(b)];
  for(const s of P.subidas){ b*=1+s.pct/100; cadena.push(eur0(b)); }
  $('hintSubidas').textContent=P.subidas.length
    ?'Cada una se aplica sobre la anterior, desde el mes indicado: '+cadena.join(' → ')+
      ' (+'+nfx.format((b/P.salario0-1)*100||0)+' % en total).'
    :'';

  guardarLocal();
  if(S.mode==='comparador') pintarComparador();
  else if(S.mode==='estancia') pintarEstancia(P); else pintarNomina(P);
  pintarBarraMovil();
}

/* Barra fija del móvil: el resultado principal de la pestaña */
function pintarBarraMovil(){
  const t=id=>{const e=$(id);return e?e.textContent.trim():'';};
  const kv=(sel,n)=>{const k=document.querySelectorAll(sel+' .kpi')[n];return k?[k.querySelector('.v').textContent,k.querySelector('.l').textContent]:['—',''];};
  let v='—', l='';
  if(S.mode==='desglose'){ v=t('nHeroNeto'); l='líquido al mes · '+t('nHeroAnual')+' al año'; }
  else if(S.mode==='subidas'){ v=t('sHeroNeto'); l='mensualidad tras las subidas · '+t('sHeroGana')+' al año'; }
  else if(S.mode==='estancia'){
    if($('eAviso').textContent.trim()){ v='Revisa las fechas'; l=t('eAviso'); }
    else{ const a=kv('#eKpis',0), g=kv('#eKpis',2); v=a[0]; l=a[1]+' · '+g[0]+' '+g[1]; }
  }
  else{
    const C=S._cmpR;
    if(!C){ v='—'; l='carga al menos dos escenarios'; }
    else{ const m=C.ks.reduce((a,k)=>C.R[k].neto/C.R[k].meses>C.R[a].neto/C.R[a].meses?k:a,C.ks[0]);
      v=m+' · '+eur0(C.R[m].neto/C.R[m].meses)+'/mes'; l='el que más líquido deja de '+C.ks.length+' escenarios'; }
  }
  $('bmV').textContent=v; $('bmL').textContent=l;
}
function irA(el){ const y=el.getBoundingClientRect().top+window.scrollY-60; window.scrollTo({top:y,behavior:'smooth'}); }
$('bmDatos').addEventListener('click',()=>irA(S.mode==='comparador'?document.querySelector('.solo-comparador'):$('form')));
$('bmRes').addEventListener('click',()=>{
  const el=S.mode==='estancia'?$('eContenido'):S.mode==='comparador'?$('cmpKpis'):$('resultados');
  irA(el);
});
/* resalta qué parte estás viendo */
if('IntersectionObserver' in window){
  const io=new IntersectionObserver(es=>{
    for(const e of es) if(e.target.id==='form'){ $('bmDatos').classList.toggle('on',e.isIntersecting); $('bmRes').classList.toggle('on',!e.isIntersecting); }
  },{rootMargin:'-45% 0px -45% 0px'});
  io.observe($('form'));
}

/* ---------------- NÓMINA ---------------- */
function textoTipo(R,P){
  if(P.irpf==='tabla')return R.tU+' %';
  return pct(R.tipo*100);
}

function pintarNomina(P){
  const R=motor(P.salario0,P);
  const aparte=P.pagas===14&&!P.prorr;

  $('nHeroNeto').innerHTML=eur(R.netoMes).replace(' €','<span> €</span>');
  $('nHeroLab').textContent=aparte?'líquido de una mensualidad, de las doce sin extra'
    :P.pagas===14?'líquido cada mes, con las extras prorrateadas':'líquido cada mes, las doce veces';
  $('nHeroExtraBox').style.display=aparte?'':'none';
  $('nHeroExtra').textContent=eur(R.netoExtra);
  $('nHeroVarBox').style.display=R.v>0?'':'none';
  $('nHeroVar').textContent=eur(R.netoVar);
  $('nHeroAnual').textContent=eur0(R.neto);
  $('nHeroTipo').textContent=textoTipo(R,P);
  $('nHeroTipoLab').textContent={tabla:'tipo de la tabla foral',prog:'tipo medio por tramos',
    manual:'tipo manual',zero:'sin retención'}[P.irpf];

  /* nota de salto de tramo */
  if(P.irpf==='tabla'){
    const bruto=R.total, f=filaTabla(bruto), techo=f[0];
    let t;
    if(bruto<=20000) t='Por debajo de 20.000 € no hay retención. Te quedan '+eur0(20000-bruto)+' de margen.';
    else if(techo===Infinity) t='Estás en el último tramo de la tabla.';
    else{
      const sig=TABLA[TABLA.indexOf(f)+1];
      const tSig=Math.max(0,sig[1][Math.min(P.desc,6)]-reduccion(techo+0.01,P.disc));
      const extra=(techo+0.01)*(tSig-R.tU)/100;
      t=(R.v>0?'Con el variable, tu base de retención es '+eur0(bruto)+'. ':'')+'El tramo llega hasta <b>'+eur0(techo)+'</b>. Te faltan '+eur0(techo-bruto)+
        ' para saltar al '+tSig+' %, que se aplica sobre todo el sueldo: unos <b>'+eur0(extra)+
        '</b> más de retención al año por cruzar la línea.';
    }
    $('nTramoNota').innerHTML=t;
  }else $('nTramoNota').innerHTML='';

  /* nómina línea a línea */
  pintarLineas(P,R,aparte);

  /* reparto mensualidad / extra / año */
  const tt=$('nTablaReparto');
  const cols=[{h:aparte?'Mensualidad (×12)':'Cada mes (×12)',b:R.brutoMes,ss:R.ss,irpf:R.irpfMes,neto:R.netoMes}];
  if(aparte) cols.push({h:'Paga extra (×2)',b:R.brutoExtra,ss:null,irpf:R.irpfExtra,neto:R.netoExtra});
  if(R.v>0) cols.push({h:'Variable (febrero)',b:R.v,ss:R.ssVar,irpf:R.irpfVar,neto:R.netoVar});
  cols.push({h:'Año',b:R.total,ss:R.ssAnual,irpf:R.irpf,neto:R.neto});
  const fl=(f,neg)=>cols.map(c=>{const v=f(c);return '<td class="n">'+(v==null?'—':(neg?'−':'')+eur(v))+'</td>';}).join('');
  tt.innerHTML='<tr class="th"><td></td>'+cols.map(c=>'<td class="n">'+c.h+'</td>').join('')+'</tr>'+
    '<tr><td>Bruto'+(!aparte&&P.pagas===14?' <span class="tag">con 2/12 de extra</span>':'')+'</td>'+fl(c=>c.b)+'</tr>'+
    '<tr class="neg"><td>Seguridad Social</td>'+fl(c=>c.ss,true)+'</tr>'+
    '<tr class="neg"><td>IRPF <span class="tag">'+textoTipo(R,P)+'</span></td>'+fl(c=>c.irpf,true)+'</tr>'+
    '<tr class="total"><td>Líquido</td>'+fl(c=>c.neto)+'</tr>';
  const bm=clampBase(P.salario0/12,P);
  const costeEmp=(bm*12+clampBase(P.salario0/12+R.v,P)-bm)*P.tEmp;
  $('nCosteNota').innerHTML='Le cuestas a la empresa <b>'+eur0(R.total+costeEmp)+'</b> al año: tu bruto más '+
    eur0(costeEmp)+' de cotización a su cargo.'+
    (aparte?' Las extras no cotizan cuando se cobran: ya van prorrateadas en la base de cada mes.':'')+
    (R.v>0?' El variable cotiza en febrero, hasta la base máxima.':'');

  /* declaración de la renta del año */
  if(S.mode==='desglose') pintarRenta(P);

  /* recorrido de subidas */
  const pasos=[{et:'Hoy',desde:'',b:P.salario0,y:Math.max(ANIO_BASE,P.anio)}];
  let b=P.salario0;
  P.subidas.forEach((s,k)=>{ b*=1+s.pct/100; pasos.push({et:'Subida '+(k+1)+' <span class="tag">'+signo(s.pct,milar)+' %</span>',desde:mesLabel(s.i),b,y:Math.floor(s.i/12)}); });
  pasos.forEach(p=>p.R=motor(p.b,P,null,p.y));
  const hoyCol=P.eurosHoy;
  const hayVar=P.variable>0;
  let h='<thead><tr><th>Momento</th><th>Desde</th><th class="n">Salario base anual</th>'+
    '<th class="n sep">Mensualidad bruta</th>'+(aparte?'<th class="n">Extra bruta</th>':'')+
    '<th class="n sep">Retención</th><th class="n sep">Líquido mensualidad</th>'+
    (aparte?'<th class="n">Líquido extra</th>':'')+(hayVar?'<th class="n">Líquido variable</th>':'')+
    '<th class="n">Líquido anual</th>'+(hoyCol?'<th class="n">En € de hoy</th>':'')+'<th class="n">Cambio al mes</th></tr></thead><tbody>';
  let malos=0;
  pasos.forEach((p,k)=>{
    const prev=k?pasos[k-1].R:null, d=prev?p.R.netoMes-prev.netoMes:null;
    const baja=d!=null&&d<-0.004; if(baja)malos++;
    h+=`<tr class="${baja?'cliff':''}"><td>${p.et}</td><td>${p.desde||'—'}</td><td class="n">${eur0(p.b)}</td>
      <td class="n sep">${eur(p.R.brutoMes)}</td>${aparte?`<td class="n">${eur(p.R.brutoExtra)}</td>`:''}
      <td class="n sep">${textoTipo(p.R,P)}</td><td class="n sep">${eur(p.R.netoMes)}</td>
      ${aparte?`<td class="n">${eur(p.R.netoExtra)}</td>`:''}${hayVar?`<td class="n">${eur(p.R.netoVar)}</td>`:''}<td class="n">${eur0(p.R.neto)}</td>
      ${hoyCol?`<td class="n">${eur0(aHoy(p.R.neto,p.y,P))}</td>`:''}
      <td class="n ${baja?'warn':''}">${d==null?'—':signo(d,eur)}</td></tr>`;
  });
  $('nRecorrido').innerHTML=h+'</tbody>';
  const fin=pasos[pasos.length-1];
  let nota;
  if(pasos.length===1) nota='Añade subidas en el panel para ver cómo evolucionan la mensualidad y las pagas extras.';
  else if(malos) nota='<b>'+(malos===1?'Hay una subida que te deja':'Hay '+malos+' subidas que te dejan')+
    ' con menos líquido que antes.</b> Pasa con la tabla foral: al cruzar de tramo, el porcentaje nuevo se aplica a todo el sueldo.';
  else{
    const inc=fin.b-P.salario0, dn=fin.R.neto-pasos[0].R.neto;
    nota='Sumas '+eur0(inc)+' de bruto en todo el recorrido y te llegan <b>'+eur0(dn)+'</b> líquidos al año ('+
      (inc>0?nfx.format(dn/inc*100):'0')+' % de lo que subes).'+
      (aparte?' La mensualidad pasa de '+eur(pasos[0].R.netoMes)+' a '+eur(fin.R.netoMes)+
        ' y cada extra de '+eur(pasos[0].R.netoExtra)+' a '+eur(fin.R.netoExtra)+'.':'');
    if(hoyCol){
      const h0=aHoy(pasos[0].R.neto,pasos[0].y,P), h1=aHoy(fin.R.neto,fin.y,P);
      nota+=' <b>En euros de hoy</b> (IPC '+nfx.format(P.ipc*100)+' %), el líquido anual pasa de '+eur0(h0)+' a '+eur0(h1)+
        ': '+(h1>=h0?'ganas':'pierdes')+' '+eur0(Math.abs(h1-h0))+' de poder de compra al año.';
    }
  }
  $('nRecorridoNota').innerHTML=nota;
  $('sHeroNeto').innerHTML=eur(fin.R.netoMes).replace(' €','<span> €</span>');
  $('sHeroLab').textContent=pasos.length>1
    ?'líquido de una mensualidad tras las subidas, frente a '+eur(pasos[0].R.netoMes)+' hoy'
    :'líquido de una mensualidad hoy (sin subidas añadidas)';
  $('sHeroExtraBox').style.display=aparte?'':'none';
  $('sHeroExtra').textContent=eur(fin.R.netoExtra);
  $('sHeroExtraLab').textContent='líquido de cada paga extra'+(pasos.length>1?', frente a '+eur(pasos[0].R.netoExtra):'');
  $('sHeroBruto').textContent=eur0(fin.b);
  $('sHeroBrutoLab').textContent=(pasos.length>1?'salario base anual al final, desde '+eur0(P.salario0):'salario base anual')+(hayVar?' (más '+eur0(P.variable)+' de variable)':'');
  $('sHeroGana').textContent=signo(fin.R.neto-pasos[0].R.neto,eur0);
  dibujarNeto(P,pasos);

  /* calendario del año */
  const yFin=Math.min(P.anio+9,Math.max(P.anio,...P.subidas.map(x=>Math.floor(x.i/12))));
  const cal=[]; for(let y=P.anio;y<=yFin;y++) cal.push(simularAnio(P,y,false));
  $('nCalTag').textContent='· '+(yFin>P.anio?P.anio+'–'+yFin:P.anio)+', con cada subida en su fecha';
  $('nCalendario').innerHTML=cal.map(A=>tablaAnio(A,P,false,false)).join('');

  /* comparativa */
  const U=motor(P.salario0,P,'tabla'), G=motor(P.salario0,P,'prog');
  $('cU').textContent=eur0(U.irpf); $('cP').textContent=eur0(G.irpf);
  $('cD').textContent=signo(G.irpf-U.irpf,eur0);
  $('cUt').textContent=pct(U.tU); $('cPt').textContent=pct(G.tipo*100);
  $('cUn').textContent=eur0(U.neto); $('cPn').textContent=eur0(G.neto);
  $('cDn').textContent=signo(G.neto-U.neto,eur0);
  dibujarTipo(P);
}

function pintarLineas(P,R,aparte){
  const b=P.salario0, salBase=b/P.pagas;
  const baseCot=clampBase(b/12,P);
  const baseVar=clampBase(b/12+R.v,P)-baseCot;
  const desglosar=Math.abs(P.tSS-0.065)<1e-6;
  const conceptos=desglosar
    ?[['Contingencias comunes',0.047],['Mecanismo de equidad intergeneracional (MEI)',0.0015],
      ['Desempleo',0.0155],['Formación profesional',0.001]]
    :[['Seguridad Social',P.tSS]];
  /* columnas: mensualidad, paga extra (si se cobra aparte) y variable (si hay) */
  const C=[{h:aparte?'Mensualidad':'Cada mes',k:'mes'}];
  if(aparte) C.push({h:'Paga extra',k:'extra'});
  if(R.v>0) C.push({h:'Variable (febrero)',k:'var'});
  const fila=(et,f,cl)=>'<tr class="'+(cl||'')+'"><td>'+et+'</td>'+C.map(c=>{const v=f(c.k);return '<td class="n">'+(v==null?'—':v)+'</td>';}).join('')+'</tr>';
  const sec=t=>'<tr class="sec"><td colspan="'+(C.length+1)+'">'+t+'</td></tr>';
  const pctTxt=f=>nfx.format(f*100)+' %';
  const dev={mes:R.brutoMes,extra:R.brutoExtra,var:R.v};
  const irpf={mes:R.irpfMes,extra:R.irpfExtra,var:R.irpfVar};
  const bss={mes:baseCot,extra:0,var:baseVar};
  const neto={mes:R.netoMes,extra:R.netoExtra,var:R.netoVar};
  let h='<tr class="th"><td></td>'+C.map(c=>'<td class="n">'+c.h+'</td>').join('')+'</tr>';
  h+=sec('Devengos');
  h+=fila('Salario base',k=>k==='var'?null:eur(salBase));
  if(P.pagas===14&&P.prorr) h+=fila('Prorrata de pagas extras <span class="tag">2 × '+eur(salBase)+' ÷ 12</span>',k=>k==='mes'?eur(salBase*2/12):null);
  if(R.v>0) h+=fila('Variable <span class="tag">íntegro, sin prorratear</span>',k=>k==='var'?eur(R.v):null);
  h+=fila('Total devengado',k=>eur(dev[k]),'total');
  h+=sec('Bases');
  h+=fila('Base de cotización <span class="tag">'+(P.pagas===14?'incluye la prorrata de extras':'')+
    (baseCot!==b/12?(baseCot===P.bMax?' · topada en la máxima':' · subida a la mínima'):'')+'</span>',
    k=>k==='extra'?'no cotiza':k==='var'?(baseVar>0?'+'+eur(baseVar):'tope alcanzado'):eur(baseCot));
  h+=fila('Base de retención IRPF',k=>eur(dev[k]));
  h+=sec('Deducciones');
  for(const [n,t] of conceptos) h+=fila(n+' <span class="tag">'+pctTxt(t)+'</span>',k=>bss[k]>0?'−'+eur(bss[k]*t):null,'neg');
  h+=fila('IRPF <span class="tag">'+textoTipo(R,P)+'</span>',k=>'−'+eur(irpf[k]),'neg');
  h+=fila('Total deducciones',k=>'−'+eur(bss[k]*P.tSS+irpf[k]),'neg');
  h+=fila('Líquido a percibir',k=>eur(neto[k]),'total');
  $('nNomina').innerHTML=h;
  $('nNominaNota').innerHTML=(desglosar?'Cuotas del trabajador en 2026 con contrato indefinido. ':'')+
    'La empresa aporta además <b>'+eur(baseCot*P.tEmp)+'</b> al mes de cotización a su cargo.'+
    (aparte?' La paga extra no cotiza cuando se cobra porque ya va prorrateada en la base de cada mes.':'')+
    (R.v>0?' El variable se suma a la base de cotización de febrero, hasta la base máxima, y su IRPF va al mismo tipo que el resto porque cuenta para calcularlo.':'');
}

/* ---------------- ESTANCIA ---------------- */
/* Parte de un año que corresponde a la estancia: salario y extras en proporción a los
   días naturales fuera, plus y dietas enteros. El tipo de IRPF sale del año completo. */
function porcionEstancia(con,sin,P){
  /* Filas: 'mes' (salario de los días del periodo, plus y dietas), 'extra' y 'var' (partidas
     aparte en el mes en que se cobran, enteras) y 'pend' (extra aún no cobrada al acabar el periodo) */
  const filas=[];
  const T={sal:0,ext:0,variable:0,plus:0,dieta:0,irpf:0,ss:0,neto:0,fuera:0,dias:0,comp:0,periodo:0};
  const B={sal:0,ext:0,variable:0,irpf:0,ss:0,neto:0};
  const ex=con.exRet;
  const solape=solapeDias, TR=tramosOk(P);
  const suma=(r,rs,campo)=>{
    T[campo]+=r.imp; T.irpf+=r.irpf; T.ss+=r.ss; T.neto+=r.neto;
    B[campo]+=r.imp; B.irpf+=rs.irpf; B.ss+=rs.ss; B.neto+=r.netoS;
  };
  con.meses.forEach((M,k)=>{
    const dim=diasMes(M.y,M.m), m0=diaNum(M.y,M.m,1), m1=diaNum(M.y,M.m,dim);
    const enPer=solape(m0,m1,P.per.a,P.per.b); if(!enPer)return;
    const D=M.D, Ms=sin.meses[k], f=enPer/dim;
    const nat=TR.reduce((acc,t)=>acc+solape(Math.max(m0,P.per.a),Math.min(m1,P.per.b),t.a,t.b),0);
    const sal=M.salMes*f, suj=sal+M.plus;
    const tax=ex?sal*(enPer-nat)/enPer:suj;
    const irpf=M.tipo*tax, ss=Math.max(0,M.ss-Ms.ss*(1-f));
    const neto=suj+M.dieta-irpf-ss;
    const salS=Ms.salMes*f, irpfS=Ms.tipo*salS, ssS=Ms.ss*f;
    filas.push({tipoFila:'mes',M,nat,f,enPer,sal,plus:M.plus,dieta:M.dieta,suj,dev:suj+M.dieta,irpf,ss,neto,netoS:salS-irpfS-ssS});
    T.sal+=sal; T.plus+=M.plus; T.dieta+=M.dieta; T.irpf+=irpf; T.ss+=ss; T.neto+=neto;
    T.fuera+=nat; T.dias+=D.dias; T.periodo+=enPer;
    B.sal+=salS; B.irpf+=irpfS; B.ss+=ssS; B.neto+=salS-irpfS-ssS;
    if(M.extraInfo&&M.extra>0){
      const r={tipoFila:'extra',M,info:M.extraInfo,imp:M.extra,irpf:M.irpfExtra,ss:0,
               neto:M.extra-M.irpfExtra,netoS:Ms.extra-Ms.irpfExtra};
      filas.push(r); suma(r,{irpf:Ms.irpfExtra,ss:0},'ext');
    }
    if(M.variable>0){
      const r={tipoFila:'var',M,imp:M.variable,irpf:M.irpfVar,ss:M.ssVar,
               neto:M.variable-M.irpfVar-M.ssVar,netoS:Ms.variable-Ms.irpfVar-Ms.ssVar};
      filas.push(r); suma(r,{irpf:Ms.irpfVar,ss:Ms.ssVar},'variable');
    }
  });
  /* extra que todavía no se ha cobrado cuando acaba el periodo: lo devengado hasta ese día */
  const fin=new Date(P.per.b*864e5), yF=fin.getUTCFullYear(), mF=fin.getUTCMonth()+1, iF=yF*12+mF-1;
  if(P.pagas===14&&yF===con.y&&filas.length){
    let pago=-1;
    for(let k=iF+1;k<=iF+12;k++) if(P.extraMeses.includes(k%12+1)){pago=k;break;}
    const per=pago>=0?periodoExtra(P,pago):[];
    if(per.length&&per[0]<=iF){
      let imp=0,dAcc=0,dTot=0,dFuera=0;
      for(const k of per){
        const yk=Math.floor(k/12), mk=k%12+1, dim=diasMes(yk,mk);
        dTot+=dim;
        const fr=k<iF?1:k===iF?(P.per.b-diaNum(yk,mk,1)+1)/dim:0;
        imp+=salAnual(P,k)/P.pagas/per.length*fr;
        dAcc+=fr*dim; dFuera+=ex?fraccionFuera(P,k)*fr*dim:0;
      }
      const Me=con.meses[mF-1], Mes=sin.meses[mF-1];
      const irpf=Me.tipo*imp*(ex?1-dFuera/Math.max(1,dAcc):1), irpfS=Mes.tipo*imp;
      const r={tipoFila:'pend',M:Me,pago,pct:dAcc/dTot,imp,irpf,ss:0,neto:imp-irpf,netoS:imp-irpfS};
      filas.push(r); suma(r,{irpf:irpfS,ss:0},'ext');
    }
  }
  const comp=con.comp||0; T.comp=comp; T.neto+=comp;
  return {y:con.y,res:con.res,con,sin,filas,comp,T,B};
}

/* Periodo a calcular: la estancia o los meses que elijas */
function periodoCalculo(P){
  if(S.periodo==='custom'){
    const a=parseYM($('calcDesde').value), b=parseYM($('calcHasta').value);
    if(!isFinite(a)||!isFinite(b)) return {err:'Indica el mes de inicio y el de fin del periodo a calcular.'};
    if(b<a) return {err:'El periodo a calcular termina antes de empezar.'};
    const ya=Math.floor(a/12), ma=a%12+1, yb=Math.floor(b/12), mb=b%12+1;
    return {a:diaNum(ya,ma,1),b:diaNum(yb,mb,diasMes(yb,mb)),ya,yb,
            txt:MESES_L[ma-1]+' '+ya+' a '+MESES_L[mb-1]+' '+yb};
  }
  const s=P.salida, r=P.regreso;
  return {a:diaNum(s.y,s.m,s.d),b:diaNum(r.y,r.m,r.d),ya:s.y,yb:r.y,
          txt:s.d+' '+MESES[s.m-1]+' '+s.y+' al '+r.d+' '+MESES[r.m-1]+' '+r.y};
}

function datosEstancia(P){
  const s=P.salida, r=P.regreso;
  if(!s||!r) return {err:'Indica el día de salida y el de regreso.'};
  if(r.i*100+r.d<s.i*100+s.d) return {err:'El regreso no puede ser anterior a la salida.'};
  if(P.pausa){
    const v=P.pausa.vuelta, n=P.pausa.ida;
    if(!v||!n) return {err:'Indica el día que vuelves a España y el día que te vas de nuevo.'};
    const dv=diaNum(v.y,v.m,v.d), dn=diaNum(n.y,n.m,n.d), ds=diaNum(s.y,s.m,s.d), dr=diaNum(r.y,r.m,r.d);
    if(dv<=ds||dn>dr) return {err:'La vuelta intermedia a España tiene que caer dentro de la estancia.'};
    if(dn<=dv) return {err:'El día que te vas de nuevo tiene que ser posterior al día que vuelves a España.'};
  }
  const per=periodoCalculo(P);
  if(per.err) return per;
  if(per.yb-per.ya>9) return {err:'El periodo a calcular no puede pasar de 10 años naturales.'};
  P.per=per;
  P.prorr=false;   /* en la estancia las extras van siempre como partida aparte */
  const anios=[];
  for(let y=per.ya;y<=per.yb;y++){
    const sin=simularAnio(P,y,false);
    anios.push(porcionEstancia(aplicarTope(simularAnio(P,y,true),sin,P),sin,P));
  }
  const T={}, B={};
  for(const a of anios){
    for(const [k,v] of Object.entries(a.T)) T[k]=(T[k]||0)+v;
    for(const [k,v] of Object.entries(a.B)) B[k]=(B[k]||0)+v;
  }
  T.suj=T.sal+T.ext+T.variable+T.plus; T.dev=T.suj+T.dieta;
  B.suj=B.sal+B.ext+B.variable; B.dev=B.suj;
  T.meses=T.periodo/(365.25/12);
  return {anios,T,B,per,filas:anios.flatMap(a=>a.filas)};
}

function pintarEstancia(P){
  const E=datosEstancia(P);
  $('eAviso').innerHTML=E.err?'<div class="aviso">'+E.err+'</div>':'';
  $('eContenido').style.display=E.err?'none':'';
  $('eCalPanel').style.display=E.err?'none':'';
  if(E.err)return;
  const s=P.salida, r=P.regreso, T=E.T, B=E.B;
  const fecha=x=>x.d+' '+MESES[x.m-1]+' '+x.y;

  /* dashboard */
  const completos=E.filas.filter(f=>f.tipoFila==='mes'&&f.M.D.sit==='destino');
  const medio=completos.length?completos.reduce((a,f)=>a+f.neto,0)/completos.length:(T.fuera?T.neto/T.fuera*30.44:0);
  const irpfPaga=T.irpf-T.comp;
  const noRes=E.anios.filter(a=>a.res.libre&&a.con.exRet).map(a=>a.y);
  const enRenta=E.anios.filter(a=>a.res.libre&&!a.con.exRet).map(a=>a.y);
  const TRs=tramosOk(P);
  $('eDashTag').textContent='· estancia del '+fecha(s)+' al '+fecha(r)+
    (P.pausa?', con vuelta a España del '+fecha(P.pausa.vuelta)+' al '+fecha(P.pausa.ida):'')+
    (S.periodo==='custom'?' · calculando de '+E.per.txt:'');
  $('eCfg').innerHTML=
    '<span><b>'+P.origen+' → '+P.destino+(P.pausa?' → '+P.origen+' → '+P.destino:'')+(P.nuclear?' (nuclear)':'')+'</b></span>'+
    '<span>Dieta <b>'+eur(P.dietaDia)+'</b>/día</span><span>Plus <b>'+pct(P.pctPlus*100)+'</b></span>';
  const kpi=(v,l,sub,cl)=>`<div class="kpi ${cl||''}"><div class="v">${v}</div><div class="l">${l}</div>${sub?`<div class="s">${sub}</div>`:''}</div>`;
  $('eKpis').innerHTML=
    kpi(eur0(T.neto),S.periodo==='custom'?'líquido del periodo calculado':'líquido de la estancia','incluye '+eur0(T.dieta)+' de dietas'+(T.comp>0?' y '+eur0(T.comp)+' de compensación':'')+
      (P.eurosHoy?' · '+eur0(E.anios.reduce((a,x)=>a+aHoy(x.T.neto,x.y,P),0))+' en € de hoy':''),'main')+
    kpi(eur0(medio),completos.length?'líquido medio de un mes completo fuera':'líquido por cada 30 días fuera','frente a '+
      eur0(completos.length?completos.reduce((a,f)=>a+f.netoS,0)/completos.length:(T.fuera?B.neto/T.fuera*30.44:0))+' si te quedas')+
    kpi(signo(T.neto-B.neto,eur0),'más que quedándote los mismos días','plus, dietas e IRPF','pos')+
    kpi(nf0.format(T.fuera),'días naturales fuera',(S.periodo==='custom'?'de '+nf0.format(T.periodo)+' días calculados · ':'')+nf0.format(T.dias)+' en destino para plus y dietas')+
    kpi(eur0(T.sal+T.ext+T.variable),S.periodo==='custom'?'salario del periodo':'salario de la estancia','base '+eur0(T.sal)+' · extras '+eur0(T.ext)+(T.variable?' · variable '+eur0(T.variable):''))+
    kpi(eur0(T.plus+T.dieta),'plus y dietas','plus '+eur0(T.plus)+' · dietas exentas '+eur0(T.dieta))+
    kpi(eur0(irpfPaga),'IRPF que pagas',(T.suj>0?pct(irpfPaga/T.suj*100)+' de lo que tributa':'')+
      (noRes.length?' · lo de fuera sin IRPF en '+noRes.join(', '):'')+
      (enRenta.length?' · lo de fuera se recupera en la renta de '+enRenta.join(', '):''))+
    kpi(eur0(T.ss),'Seguridad Social',pct(P.tSS*100)+' sobre la base de cotización');

  /* desglose */
  $('eResTag').textContent=S.periodo==='custom'?'· '+E.per.txt+', '+nf0.format(T.fuera)+' días fuera':'· '+nf0.format(T.fuera)+' días fuera';
  const fila=(et,a,b,cl,neg)=>`<tr class="${cl||''}"><td>${et}</td><td class="n">${neg&&a>0.004?'−':''}${eur(a)}</td><td class="n">${neg&&b>0.004?'−':''}${eur(b)}</td>
    <td class="n ${!neg&&a-b>0.004?'pos':''}">${Math.abs(a-b)<0.005?'—':(neg?signo(-(a-b),eur):signo(a-b,eur))}</td></tr>`;
  const cust=S.periodo==='custom';
  let h='<tr class="th"><td></td><td class="n">'+(cust?'Periodo':'Estancia')+'</td><td class="n">Si te quedas</td><td class="n">Diferencia</td></tr>';
  h+=fila('Salario <span class="tag">'+(cust?'días del periodo':'días fuera')+'</span>',T.sal,B.sal);
  if(P.pagas===14) h+=fila('Pagas extras <span class="tag">las cobradas en el periodo'+(E.filas.some(f=>f.tipoFila==='pend')?' y lo devengado de la siguiente':'')+'</span>',T.ext,B.ext);
  if(P.variable>0) h+=fila('Variable <span class="tag">'+(T.variable>0?'cobrado en febrero':'no hay ningún febrero en el periodo')+'</span>',T.variable,B.variable);
  h+=fila('Plus de desplazamiento',T.plus,0);
  h+=fila('Dieta de manutención <span class="tag">exenta</span>',T.dieta,0);
  h+=fila('Total devengado',T.dev,B.dev,'total');
  h+=fila('IRPF retenido <span class="tag">'+(T.suj>0?pct(T.irpf/T.suj*100):'')+' → '+(B.suj>0?pct(B.irpf/B.suj*100):'')+'</span>',T.irpf,B.irpf,'neg',true);
  if(P.tope) h+=fila('Compensación IDOM <span class="tag">tope España</span>',T.comp,0);
  h+=fila('Seguridad Social <span class="tag">'+(T.suj>0?pct(T.ss/T.suj*100):'')+' → '+(B.suj>0?pct(B.ss/B.suj*100):'')+'</span>',T.ss,B.ss,'neg',true);
  h+=fila('Líquido',T.neto,B.neto,'total');
  $('eResumen').innerHTML=h;
  $('eResNota').innerHTML=(cust
      ?'Se calcula de '+E.per.txt+': los meses sin desplazamiento llevan el sueldo español. '
      :'Solo cuenta el periodo de la estancia; el salario de los meses de salida y regreso va por los días de cada mes. ')+
    'Las pagas extras y el variable no se prorratean: aparecen enteros como partida aparte en el mes en que se cobran'+
    (P.variable>0?' (el variable, en febrero)':'')+
    ', y si al acabar el periodo aún no toca cobrar una extra, sale lo devengado hasta ese día. El tipo de IRPF se calcula con todo lo que cobras en el año y las dietas no cuentan.';

  /* residencia fiscal y renta por año */
  let ha='<tr class="th"><td>Año</td><td class="n">Días fuera</td><td class="n">Días en España</td><td>Situación fiscal</td>'+
    '<td class="n">IRPF del año sin desplazarte</td><td class="n">IRPF retenido</td>'+(P.tope?'<td class="n">Compensación IDOM</td>':'')+
    '<td class="n">Exento en la renta</td><td class="n">Cuota en la renta</td><td class="n">Renta: resultado</td></tr>';
  for(const a of E.anios){
    const R=a.res, Rn=rentaAnio(a.con,P);
    ha+=`<tr><td>${a.y}</td><td class="n">${R.fuera}</td><td class="n">${R.espana}</td><td>${pillFiscal(R,P)}</td>
      <td class="n">${eur(a.sin.tot.irpf)}</td><td class="n">${eur(a.con.tot.irpf)}</td>
      ${P.tope?`<td class="n ${a.comp>0?'pos':''}">${a.comp>0?'+'+eur(a.comp):'—'}</td>`:''}
      <td class="n">${Rn.exento>0.5?eur(Rn.exento):'—'}</td><td class="n">${eur(Rn.liquida)}</td>
      <td class="n b ${Rn.resultado<-0.5?'pos':Rn.resultado>0.5?'warn':''}">${textoResultado(Rn.resultado)}</td></tr>`;
  }
  $('eAnios').innerHTML=ha;
  $('eAniosNota').innerHTML=notaRegimen(P)+
    (P.tope?' IDOM compensa para que no pagues más IRPF que quedándote en España; la diferencia se abona al cerrar el año.':'')+
    ' <b>Renta:</b> estimación del año completo solo con rendimientos del trabajo (escala de Bizkaia, bonificación del trabajo y minoración de 1.615 €), sin deducciones familiares, de vivienda ni EPSV. «A devolver» es lo que te devolverían frente a lo retenido.';

  $('eCalendario').innerHTML=tablaEstancia(E,P);
  dibujarEstancia(E.filas);
}

/* celda de retención: porcentaje que se quita, con el importe al pasar el ratón */
function celPct(imp,base){
  return `<td class="n neg" title="${imp>0.004?'−'+eur(imp):''}">${imp>0.004&&base>0?pct(imp/base*100):'—'}</td>`;
}

function tablaEstancia(E,P){
  const nc=11;
  let h='<div class="scrollx"><table class="cal"><thead><tr><th>Mes</th><th>Situación</th><th class="n">Días fuera</th><th class="n">Días destino</th>'+
    '<th class="n">Salario</th><th class="n">Plus</th><th class="n">Dieta</th><th class="n">Devengado</th>'+
    '<th class="n">IRPF</th><th class="n">SS</th><th class="n">Líquido</th></tr></thead><tbody>';
  const partida=(et,r)=>`<tr class="extra"><td colspan="4">${et}</td><td class="n">${eur(r.imp)}</td><td class="n">—</td><td class="n">—</td>`+
    `<td class="n">${eur(r.imp)}</td>${celPct(r.irpf,r.imp)}${r.ss>0.004?celPct(r.ss,r.imp):'<td class="n">—</td>'}<td class="n b">${eur(r.neto)}</td></tr>`;
  for(const a of E.anios){
    const R=a.res;
    h+=`<tr class="yrow"><td colspan="${nc}">${a.y} <span class="tag">· ${R.fuera} días fuera, ${R.espana} en España</span> `+
      pillFiscal(R,P)+'</td></tr>';
    for(const F of a.filas){
      const M=F.M, D=M.D;
      if(F.tipoFila==='extra'){ h+=partida('Paga extra de '+MESES_L[M.m-1]+' <span class="tag">'+F.info+'</span>',F); continue; }
      if(F.tipoFila==='var'){ h+=partida('Variable <span class="tag">se cobra entero en febrero</span>',F); continue; }
      if(F.tipoFila==='pend'){
        h+=partida('Paga extra de '+MESES_L[F.pago%12]+' '+Math.floor(F.pago/12)+' <span class="tag">aún no se cobra: devengado el '+nfx.format(F.pct*100)+' % de sus días al acabar el periodo</span>',F);
        continue;
      }
      const enEsp=enEspana(D);
      const sit=textoSituacion(D,P);
      const sub=M.subida?` <span class="pill up">${signo(M.subida.pct,milar)} %</span>`:'';
      h+=`<tr class="${D.ov?'ov':''} ${enEsp?'fuera':''}"><td>${MESES[M.m-1]}</td><td>${sit}</td><td class="n">${F.nat||'—'}</td>`+
        `<td class="n">${enEsp?'—':`<input type="number" class="dias" data-k="${ymKey(M.i)}" value="${D.dias}" min="0" max="31" aria-label="Días en destino en ${MESES_L[M.m-1]} ${M.y}">`}</td>`+
        `<td class="n">${eur(F.sal)}${sub}</td><td class="n">${F.plus?eur(F.plus):'—'}</td><td class="n">${F.dieta?eur(F.dieta):'—'}</td>`+
        `<td class="n">${eur(F.dev)}</td>${celPct(F.irpf,F.suj)}${celPct(F.ss,F.suj)}<td class="n b">${eur(F.neto)}</td></tr>`;
    }
    if(a.comp>0){
      h+=`<tr class="extra"><td colspan="8">Compensación IDOM <span class="tag">tope de IRPF de España</span></td>`+
        `<td class="n pos">+${eur(a.comp)}</td><td></td><td class="n b">+${eur(a.comp)}</td></tr>`;
    }
    const t=a.T;
    h+=`<tr class="ysub"><td colspan="2">Total ${a.y}</td><td class="n">${t.fuera}</td><td class="n">${t.dias}</td>`+
      `<td class="n">${eur(t.sal+t.ext+t.variable)}</td><td class="n">${eur(t.plus)}</td><td class="n">${eur(t.dieta)}</td>`+
      `<td class="n">${eur(t.sal+t.ext+t.variable+t.plus+t.dieta)}</td><td class="n">${menos(t.irpf-t.comp)}</td><td class="n">${menos(t.ss)}</td><td class="n">${eur(t.neto)}</td></tr>`;
  }
  const T=E.T;
  h+=`</tbody><tfoot><tr><td colspan="2">Total ${S.periodo==='custom'?'del periodo':'estancia'}</td><td class="n">${nf0.format(T.fuera)}</td><td class="n">${nf0.format(T.dias)}</td>`+
    `<td class="n">${eur(T.sal+T.ext+T.variable)}</td><td class="n">${eur(T.plus)}</td><td class="n">${eur(T.dieta)}</td>`+
    `<td class="n">${eur(T.dev)}</td><td class="n">${menos(T.irpf-T.comp)}</td><td class="n">${menos(T.ss)}</td><td class="n">${eur(T.neto)}</td></tr></tfoot></table></div>`;
  h+='<div class="resumen-anio"><span>Salario de los meses: <b>'+eur0(T.sal)+'</b></span>'+
    (T.ext?'<span>Pagas extras: <b>'+eur0(T.ext)+'</b></span>':'')+(T.variable?'<span>Variable: <b>'+eur0(T.variable)+'</b></span>':'')+'</div>';
  return h;
}

/* ---------------- renta (pestaña de nómina) ---------------- */
function pintarRenta(P){
  const y=ANIO_BASE, A=simularAnio(P,y,false), Rn=rentaAnio(A,P);
  $('nRentaTag').textContent='· '+y+', con tu sueldo actual';
  const f=(et,v,cl,neg)=>`<tr class="${cl||''}"><td>${et}</td><td class="n">${neg&&v>0.004?'−':''}${eur(v)}</td></tr>`;
  let h='';
  h+=f('Rendimientos íntegros del trabajo <span class="tag">salario, extras y variable</span>',Rn.integro);
  h+=f('Cotizaciones a la Seguridad Social <span class="tag">gasto deducible</span>',Rn.gastos,'neg',true);
  h+=f('Rendimiento neto',Rn.rn,'total');
  h+=f('Bonificación de los rendimientos del trabajo',Rn.bonif,'neg',true);
  h+=f('Base liquidable',Rn.base,'total');
  h+=f('Cuota íntegra <span class="tag">escala del 23 % al 49 %</span>',Rn.cuota);
  h+=f('Minoración de cuota',Rn.minor,'neg',true);
  h+=f('Cuota líquida <span class="tag">'+pct(Rn.tipoMedio*100)+' de lo que ganas</span>',Rn.liquida,'total');
  h+=f('Retenido en las nóminas del año',Rn.retenido,'neg',true);
  h+=`<tr class="total"><td>Resultado de la renta</td><td class="n ${Rn.resultado<-0.5?'pos':Rn.resultado>0.5?'warn':''}">${textoResultado(Rn.resultado)}</td></tr>`;
  $('nRenta').innerHTML=h;
  $('nRentaNota').innerHTML='Estimación solo con rendimientos del trabajo: escala general de Bizkaia 2026, bonificación del trabajo (8.000 € hasta 14.800 € de rendimiento neto, bajando hasta 3.000 € a partir de 23.000 €) y minoración de 1.615 €. '+
    'No incluye deducciones por descendientes, discapacidad, vivienda o EPSV, ni otras rentas. La retención de la tabla es un pago a cuenta: por eso la renta sale algo a pagar o a devolver.';
}

/* ---------------- textos fiscales ---------------- */
function pillFiscal(R,P){
  let h;
  if(!R.fuera) h='<span class="pill res">Sin días fuera</span>';
  else if(P.regimen==='917') h='<span class="pill nores">Exención 9.17 · lo de fuera sin IRPF</span>';
  else if(P.regimen==='183') h=R.noRes?'<span class="pill nores">Menos de 183 días fuera · lo de fuera sin IRPF</span>':'<span class="pill res">183 días o más fuera · tributa</span>';
  else h='<span class="pill res">Tributa todo en España</span>';
  if(R.destinoGrava) h+=' <span class="pill alerta" title="Según el convenio, más de 183 días en el año natural en destino, o coste soportado por una entidad de allí">el país de destino puede gravar</span>';
  return h;
}
const textoFiscal=(R,P)=>pillFiscal(R,P).replace(/<[^>]+>/g,'').trim();
const textoResultado=v=>Math.abs(v)<0.5?'—':v<0?'a devolver '+eur(-v):'a pagar '+eur(v);
function notaRegimen(P){
  if(P.regimen==='917') return 'Con la <b>exención del art. 9.17</b>, lo cobrado por los días trabajados fuera (salario de esos días, plus y su parte de extras y variable) no tributa en España, hasta 60.100 € al año, haya o no 183 días.'+
    (P.aplicaNomina?' IDOM la aplica ya en la nómina.':' Como IDOM no la aplica en la nómina, te retienen como siempre y la diferencia sale a devolver en la renta.')+
    ' Requisitos: trabajo para una entidad o establecimiento en el extranjero, y que el país tenga un impuesto similar (Italia y la UE lo cumplen).';
  if(P.regimen==='183') return 'Con la <b>regla simplificada de los 183 días</b>: si en el año natural estás menos de 183 días fuera, lo cobrado fuera no paga IRPF; con 183 o más, tributa todo.';
  return 'Sin exenciones: todo lo cobrado tributa en España.';
}

/* ---------------- TABLA DE UN AÑO ---------------- */
function tablaAnio(A,P,est,soloAnio,sin){
  const aparte=P.pagas===14&&!P.prorr;
  const T=A.tot;
  let cab='';
  if(est&&A.res){
    cab='<span class="tag">'+A.res.fuera+' días fuera · '+A.res.espana+' en España</span> '+
      pillFiscal(A.res,P);
  }
  let h='<div class="yh">'+(soloAnio?'':'<b>'+A.y+'</b>')+'<span>'+cab+'</span></div>';
  h+='<div class="scrollx"><table class="cal"><thead><tr><th>Mes</th>'+
    (est?'<th>Situación</th><th class="n">Días</th>':'')+
    '<th class="n">Salario</th>'+(P.prorr?'<th class="n">Extra prorr.</th>':'')+
    (est?'<th class="n">Plus</th><th class="n">Dieta</th>':'')+
    '<th class="n">Devengado</th><th class="n">IRPF</th><th class="n">SS</th><th class="n">Líquido</th></tr></thead><tbody>';
  for(const M of A.meses){
    const baseMes=M.salMes+M.plus+(P.prorr?M.extra:0);
    const D=M.D;
    const fuera=est&&enEspana(D);
    let sitTxt='', diasTxt='';
    if(est){
      sitTxt={antes:'En origen',despues:'De vuelta',destino:'En destino',
        salida:'Sale el '+(D.d0),regreso:'Vuelve el '+(D.d1),'ida-vuelta':'Del '+D.d0+' al '+D.d1}[D.sit];
      diasTxt=fuera?'—':`<input type="number" class="dias" data-k="${ymKey(M.i)}" value="${D.dias}" min="0" max="31" aria-label="Días en destino en ${MESES_L[M.m-1]} ${M.y}">`;
    }
    const sub=M.subida?` <span class="pill up">${signo(M.subida.pct,milar)} %</span>`:'';
    h+=`<tr class="${fuera?'fuera':''} ${D.ov?'ov':''}"><td>${MESES[M.m-1]}</td>`+
      (est?`<td>${sitTxt}</td><td class="n">${diasTxt}</td>`:'')+
      `<td class="n">${eur(M.salMes)}${sub}</td>`+
      (P.prorr?`<td class="n">${eur(M.extra)}</td>`:'')+
      (est?`<td class="n">${M.plus?eur(M.plus):'—'}</td><td class="n">${M.dieta?eur(M.dieta):'—'}</td>`:'')+
      `<td class="n">${eur(M.brutoMes)}</td>${celPct(M.irpfMes,baseMes)}${celPct(M.ss,baseMes)}<td class="n b">${eur(M.netoMes)}</td></tr>`;
    if(aparte&&M.extraInfo){
      h+=`<tr class="extra"><td colspan="${est?3:1}">Paga extra <span class="tag">${M.extraInfo}</span></td>`+
        `<td class="n">${eur(M.extra)}</td>`+(est?'<td class="n">—</td><td class="n">—</td>':'')+
        `<td class="n">${eur(M.extra)}</td>${celPct(M.irpfExtra,M.extra)}<td class="n">—</td><td class="n b">${eur(M.netoExtra)}</td></tr>`;
    }
    if(M.variable>0){
      h+=`<tr class="extra"><td colspan="${est?3:1}">Variable <span class="tag">íntegro en febrero</span></td>`+
        `<td class="n">${eur(M.variable)}</td>`+(P.prorr?'<td class="n">—</td>':'')+(est?'<td class="n">—</td><td class="n">—</td>':'')+
        `<td class="n">${eur(M.variable)}</td>${celPct(M.irpfVar,M.variable)}${celPct(M.ssVar,M.variable)}<td class="n b">${eur(M.netoVar)}</td></tr>`;
    }
  }
  if(A.comp>0){
    const span=(est?3:1);
    const antes=1+(P.prorr?1:0)+(est?2:0)+1;
    h+=`<tr class="extra"><td colspan="${span}">Compensación IDOM <span class="tag">tope de IRPF de España</span></td>`+
      `<td colspan="${antes}"></td><td class="n pos">+${eur(A.comp)}</td><td></td><td class="n b">+${eur(A.comp)}</td></tr>`;
  }
  h+='</tbody><tfoot><tr><td'+(est?' colspan="2"':'')+'>Total '+A.y+'</td>'+
    (est?`<td class="n">${nf0.format(T.dias)}</td>`:'')+
    `<td class="n">${eur(T.sal+(aparte?T.extra:0)+T.variable)}</td>`+(P.prorr?`<td class="n">${eur(T.extra)}</td>`:'')+
    (est?`<td class="n">${eur(T.plus)}</td><td class="n">${eur(T.dieta)}</td>`:'')+
    `<td class="n">${eur(T.dev)}</td>`+
    `<td class="n">${menos(T.irpf-(A.comp||0))}</td><td class="n">${menos(T.ss)}</td><td class="n">${eur(T.neto)}</td></tr></tfoot></table></div>`;

  const partes=[];
  partes.push('Mensualidades: bruto <b>'+eur0(T.sal+(P.prorr?T.extra:0)+T.plus)+'</b>, líquido <b>'+eur0(T.netoMes-T.dieta)+'</b>'+
    (T.dieta?' + '+eur0(T.dieta)+' de dietas':''));
  if(aparte) partes.push('Pagas extras: bruto <b>'+eur0(T.extra)+'</b>, líquido <b>'+eur0(T.netoExtra)+'</b>');
  if(P.prorr) partes.push('Extras prorrateadas dentro de cada mes: <b>'+eur0(T.extra)+'</b>');
  if(T.variable>0) partes.push('Variable: bruto <b>'+eur0(T.variable)+'</b>, líquido <b>'+eur0(T.netoVar)+'</b>');
  if(A.comp>0) partes.push('Compensación IDOM <b>+'+eur0(A.comp)+'</b>');
  partes.push('Tipo efectivo del año <b>'+pct(T.tipoEf*100)+'</b>');
  if(!est){ const Rn=rentaAnio(A,P); partes.push('Renta estimada: <b>'+textoResultado(Rn.resultado)+'</b>'); }
  if(P.eurosHoy&&A.y!==ANIO_BASE) partes.push('Líquido en € de hoy: <b>'+eur0(aHoy(T.neto,A.y,P))+'</b>');
  if(sin) partes.push('Frente a quedarte: <b>'+signo(T.neto-sin.tot.neto,eur0)+'</b> líquidos');
  h+='<div class="resumen-anio">'+partes.map(x=>'<span>'+x+'</span>').join('')+'</div>';
  return h;
}

$('eCalendario').addEventListener('change',e=>{
  if(!e.target.classList.contains('dias'))return;
  const v=parseFloat(e.target.value);
  if(isFinite(v)) S.overrides[e.target.dataset.k]=Math.max(0,Math.min(31,v));
  else delete S.overrides[e.target.dataset.k];
  calc();
});
$('btnResetDias').addEventListener('click',()=>{S.overrides={};calc();});

/* ============================================================
   GRÁFICOS
   ============================================================ */
function dibujarNeto(P,pasos){
  const W=760,H=300,ml=60,mr=14,mt=18,mb=34;
  const bruto=P.salario0, ultimo=pasos[pasos.length-1].b;
  const lo=Math.min(bruto,ultimo), hi=Math.max(bruto,ultimo);
  const x0=Math.max(0,lo-3000), x1=hi+Math.max(6000,(hi-lo)*0.25);
  const paso=Math.max(50,Math.round((x1-x0)/400/50)*50);
  const cu=[],cp=[];
  for(let v=x0;v<=x1;v+=paso){ cu.push([v,motor(v,P,'tabla').neto]); cp.push([v,motor(v,P,'prog').neto]); }
  const ys=cu.concat(cp).map(p=>p[1]).concat(pasos.map(p=>p.R.neto));
  let yMin=Math.min(...ys), yMax=Math.max(...ys);
  const pad=(yMax-yMin)*0.12||1000; yMin-=pad; yMax+=pad;
  const X=v=>ml+(v-x0)/(x1-x0)*(W-ml-mr);
  const Y=v=>mt+(1-(v-yMin)/(yMax-yMin))*(H-mt-mb);
  const linea=(pts,c)=>'<path d="'+pts.map((p,k)=>(k?'L':'M')+X(p[0]).toFixed(1)+','+Y(p[1]).toFixed(1)).join('')+
    '" fill="none" stroke="'+c+'" stroke-width="2"/>';
  let s='';
  for(let k=0;k<=4;k++){
    const val=yMin+(yMax-yMin)*k/4;
    s+=`<line x1="${ml}" y1="${Y(val)}" x2="${W-mr}" y2="${Y(val)}" stroke="#D3DCE8"/>`;
    s+=`<text x="${ml-8}" y="${Y(val)+4}" text-anchor="end" font-size="11" fill="#5B6B82">${Math.round(val/1000)}k</text>`;
  }
  const rej=(x1-x0)>60000?20000:(x1-x0)>25000?10000:5000;
  for(let v=Math.ceil(x0/rej)*rej;v<=x1;v+=rej)
    s+=`<text x="${X(v)}" y="${H-12}" text-anchor="middle" font-size="11" fill="#5B6B82">${v/1000}k</text>`;
  s+=linea(cp,'#0061A8')+linea(cu,'#B3261E');
  pasos.forEach((p,k)=>{
    s+=`<circle cx="${X(p.b)}" cy="${Y(p.R.neto)}" r="4.5" fill="#0F1E33"/>`;
    if(k) s+=`<text x="${X(p.b)}" y="${Y(p.R.neto)+18}" text-anchor="middle" font-size="11" fill="#0F1E33">${k}</text>`;
  });
  $('chartNeto').innerHTML=s;
}

function dibujarTipo(P){
  const W=760,H=300,ml=52,mr=14,mt=14,mb=34;
  const bruto=P.salario0;
  const x0=15000,x1=Math.max(120000,bruto*1.3),y1=42;
  const X=v=>ml+(v-x0)/(x1-x0)*(W-ml-mr);
  const Y=v=>mt+(1-v/y1)*(H-mt-mb);
  let s='';
  for(let g=0;g<=40;g+=10){
    s+=`<line x1="${ml}" y1="${Y(g)}" x2="${W-mr}" y2="${Y(g)}" stroke="#D3DCE8"/>`;
    s+=`<text x="${ml-8}" y="${Y(g)+4}" text-anchor="end" font-size="11" fill="#5B6B82">${g} %</text>`;
  }
  const rej=x1>200000?40000:20000;
  for(let v=rej;v<=x1;v+=rej)
    s+=`<text x="${X(v)}" y="${H-12}" text-anchor="middle" font-size="11" fill="#5B6B82">${v/1000}k</text>`;
  const stepv=Math.max(250,Math.round((x1-x0)/500/50)*50);
  let pu='',pp='';
  for(let v=x0;v<=x1;v+=stepv){
    const a=X(v).toFixed(1);
    pu+=(pu?'L':'M')+a+','+Y(tipoUnico(v,P.desc,P.disc)).toFixed(1);
    pp+=(pp?'L':'M')+a+','+Y(irpfProgresivo(v,P.desc,P.disc)/v*100).toFixed(1);
  }
  s+=`<path d="${pu}" fill="none" stroke="#B3261E" stroke-width="2"/>`;
  s+=`<path d="${pp}" fill="none" stroke="#0061A8" stroke-width="2"/>`;
  if(bruto>=x0&&bruto<=x1){
    s+=`<line x1="${X(bruto)}" y1="${mt}" x2="${X(bruto)}" y2="${H-mb}" stroke="#0F1E33" stroke-dasharray="4 3"/>`;
    s+=`<circle cx="${X(bruto)}" cy="${Y(tipoUnico(bruto,P.desc,P.disc))}" r="4" fill="#B3261E"/>`;
  }
  $('chartTipo').innerHTML=s;
}

function dibujarEstancia(todas){
  const W=760,H=300,ml=52,mr=10,mt=12,mb=30;
  const filas=[];
  for(const r of todas){
    if(r.tipoFila==='mes') filas.push({M:r.M,neto:r.neto,netoS:r.netoS});
    else if(r.tipoFila!=='pend'&&filas.length){ const u=filas[filas.length-1]; u.neto+=r.neto; u.netoS+=r.netoS; }
  }
  const n=Math.max(1,filas.length);
  const yMax=Math.max(...filas.map(F=>F.neto),...filas.map(F=>F.netoS),1)*1.08;
  const bw=(W-ml-mr)/n;
  const Y=v=>mt+(1-v/yMax)*(H-mt-mb);
  let s='';
  for(let k=0;k<=4;k++){
    const val=yMax*k/4;
    s+=`<line x1="${ml}" y1="${Y(val)}" x2="${W-mr}" y2="${Y(val)}" stroke="#D3DCE8"/>`;
    s+=`<text x="${ml-8}" y="${Y(val)+4}" text-anchor="end" font-size="11" fill="#5B6B82">${nfx.format(Math.round(val/100)/10)}k</text>`;
  }
  const cada=Math.ceil(n/10);
  filas.forEach((F,k)=>{
    const x=ml+k*bw, w=Math.max(1,bw-3);
    s+=`<rect x="${(x+1.5).toFixed(1)}" y="${Y(F.neto).toFixed(1)}" width="${w.toFixed(1)}" height="${(H-mb-Y(F.neto)).toFixed(1)}" fill="#0061A8"><title>${mesLabel(F.M.i)}: ${eur(F.neto)} desplazado · ${eur(F.netoS)} si te quedas</title></rect>`;
    s+=`<line x1="${(x+1.5).toFixed(1)}" x2="${(x+1.5+w).toFixed(1)}" y1="${Y(F.netoS).toFixed(1)}" y2="${Y(F.netoS).toFixed(1)}" stroke="#0F1E33" stroke-width="2"/>`;
    if(k%cada===0) s+=`<text x="${(x+1.5+w/2).toFixed(1)}" y="${H-10}" text-anchor="middle" font-size="11" fill="#5B6B82">${MESES[F.M.m-1]}${F.M.m===1||k===0?' '+String(F.M.y).slice(2):''}</text>`;
  });
  $('chartEstancia').innerHTML=s;
}

/* ============================================================
   COMPARADOR
   ============================================================ */
/* Calcula con otro estado sin tocar lo que hay en pantalla */
function conEstado(st,fn){
  const actual=estado(), modo=S.mode, ult=S.ultimo;
  try{ ponerEstado(st); return fn(leer(),S.mode); }
  finally{ ponerEstado(actual); S.mode=modo; S.ultimo=ult; }
}
const NOMBRE_MODO={desglose:'Nómina',subidas:'Subidas de sueldo',estancia:'Estancia',comparador:'Nómina'};
function resumenEscenario(P,modo){
  const base={modo,salario0:P.salario0,variable:P.variable,pagas:P.pagas,
    irpfModo:{tabla:'Tabla foral',prog:'Por tramos',manual:'Manual '+pct(P.irpfManual*100),zero:'0 %'}[P.irpf]};
  if(modo==='estancia'){
    const E=datosEstancia(P);
    if(E.err) return {...base,err:E.err};
    const T=E.T,B=E.B;
    const f=x=>x.d+' '+MESES[x.m-1]+' '+x.y;
    const TRs=tramosOk(P);
    return {...base,titulo:'Estancia en '+P.destino,
      detalle:P.origen+' → '+P.destino+' · del '+f(P.salida)+' al '+f(P.regreso)+
        (P.pausa?'<br>Vuelta a España del '+f(P.pausa.vuelta)+' al '+f(P.pausa.ida):''),
      periodo:S.periodo==='custom'?E.per.txt:'la estancia ('+nf0.format(T.periodo)+' días)',meses:T.meses,
      sal:T.sal+T.ext+T.variable,plus:T.plus,dieta:T.dieta,dev:T.dev,suj:T.suj,
      irpf:T.irpf-T.comp,comp:T.comp,ss:T.ss,neto:T.neto,gana:T.neto-B.neto,fuera:T.fuera,
      netoHoy:E.anios.reduce((a,x)=>a+aHoy(x.T.neto,x.y,P),0),
      renta:E.anios.reduce((a,x)=>a+rentaAnio(x.con,P).resultado,0)};
  }
  let b=P.salario0, yR=ANIO_BASE;
  if(modo==='subidas'){ for(const s of P.subidas){ b*=1+s.pct/100; yR=Math.max(yR,Math.floor(s.i/12)); } }
  const R=motor(b,P,null,yR);
  return {...base,titulo:modo==='subidas'?'Tras '+P.subidas.length+' subida'+(P.subidas.length===1?'':'s'):'Nómina anual',
    detalle:modo==='subidas'?'Salario base '+eur0(P.salario0)+' → '+eur0(b):'Salario base '+eur0(b),
    periodo:'1 año',meses:12,sal:R.total,plus:0,dieta:0,dev:R.total,suj:R.total,
    irpf:R.irpf,comp:0,ss:R.ssAnual,neto:R.neto,gana:null,fuera:0,netoMes:R.netoMes,netoExtra:R.netoExtra,
    netoHoy:aHoy(R.neto,yR,P),renta:null};
}
/* Serie mensual de un escenario: {i: {dev, irpf, ss, neto, notas[]}} */
function rangoNatural(P,modo){
  if(modo==='estancia'){
    const E=datosEstancia(P); if(E.err) return null;
    const is=E.filas.map(f=>f.M.i); return {i0:Math.min(...is),i1:Math.max(...is)};
  }
  if(modo==='subidas'){
    const yFin=Math.min(P.anio+9,Math.max(P.anio,...P.subidas.map(x=>Math.floor(x.i/12))));
    return {i0:P.anio*12,i1:yFin*12+11};
  }
  return null;
}
function serieMensual(P,modo,rango){
  const out={};
  const nuevo=i=>out[i]||(out[i]={dev:0,irpf:0,ss:0,neto:0,notas:[]});
  if(modo==='estancia'){
    const E=datosEstancia(P); if(E.err) return out;
    for(const a of E.anios){
      let ult=null;
      for(const F of a.filas){
        const r=nuevo(F.M.i); ult=F.M.i;
        if(F.tipoFila==='mes'){ r.dev+=F.dev; r.irpf+=F.irpf; r.ss+=F.ss; r.neto+=F.neto;
          if(F.M.D.dias>0) r.notas.push('fuera'); }
        else{ r.dev+=F.imp; r.irpf+=F.irpf; r.ss+=F.ss; r.neto+=F.neto;
          r.notas.push(F.tipoFila==='extra'?'extra':F.tipoFila==='var'?'variable':'extra devengada'); }
      }
      if(a.comp>0&&ult!=null){ const r=nuevo(ult); r.neto+=a.comp; r.irpf-=a.comp; r.notas.push('compensación'); }
    }
    return out;
  }
  for(let y=Math.floor(rango.i0/12);y<=Math.floor(rango.i1/12);y++){
    const A=simularAnio(P,y,false);
    for(const M of A.meses){
      if(M.i<rango.i0||M.i>rango.i1) continue;
      const r=nuevo(M.i);
      r.dev=M.brutoMes+(P.prorr?0:M.extra)+M.variable; r.irpf=M.irpf; r.ss=M.ss+M.ssVar; r.neto=M.neto;
      if(!P.prorr&&M.extraInfo) r.notas.push('extra');
      if(M.variable>0) r.notas.push('variable');
      if(M.subida) r.notas.push('subida');
    }
  }
  return out;
}

const CMP_K=['A','B','C','D'];
const CMP_COL={A:'#0061A8',B:'#5B9BD5',C:'#D9822B',D:'#2E9E6B'};
function pintarSlots(){
  $('cmpSlots').innerHTML=CMP_K.map(k=>`
    <div class="panel cmp-slot">
      <h2><span class="dot" style="background:${CMP_COL[k]}"></span>Escenario ${k} <span class="tag" id="cmpNom${k}"></span></h2>
      <div class="acciones">
        <button class="btn" type="button" data-acc="cargar" data-s="${k}">Cargar JSON</button>
        <button class="btn" type="button" data-acc="actual" data-s="${k}">Usar lo que tengo en pantalla</button>
        <button class="btn" type="button" data-acc="quitar" data-s="${k}">Quitar</button>
      </div>
      <div class="cmp-info" id="cmpInfo${k}"></div>
    </div>`).join('');
}

function pintarCmpMeses(ks){
  const rangos=ks.map(k=>conEstado(S.cmp[k].st,(P,m)=>rangoNatural(P,m)));
  const val=rangos.filter(Boolean);
  const hoyY=new Date().getFullYear();
  const rango=val.length?{i0:Math.min(...val.map(r=>r.i0)),i1:Math.max(...val.map(r=>r.i1))}:{i0:hoyY*12,i1:hoyY*12+11};
  const SR={};
  for(const k of ks) SR[k]=conEstado(S.cmp[k].st,(P,m)=>serieMensual(P,m,rango));
  const is=[...new Set(ks.flatMap(k=>Object.keys(SR[k]).map(Number)))].sort((a,b)=>a-b);
  const ref=ks[0], otros=ks.slice(1);
  $('cmpMesesTag').textContent=is.length?'· de '+MESES_L[is[0]%12]+' '+Math.floor(is[0]/12)+' a '+MESES_L[is[is.length-1]%12]+' '+Math.floor(is[is.length-1]/12):'';
  $('cmpLeyenda').innerHTML=ks.map(k=>`<span><span class="key bar" style="background:${CMP_COL[k]}"></span>Líquido de ${k}</span>`).join('');
  const notas=r=>r&&r.notas.length?'<br><span class="tag">'+[...new Set(r.notas)].join(' · ')+'</span>':'';
  let h='<thead><tr><th>Mes</th>'+ks.map(k=>`<th class="n sep">${k} · líquido</th>`).join('')+
    otros.map(k=>`<th class="n sep">${k} − ${ref}</th>`).join('')+'</tr></thead><tbody>';
  let yPrev=null;
  const tot={}; ks.forEach(k=>tot[k]=0);
  const serie=[];
  for(const i of is){
    const y=Math.floor(i/12);
    if(y!==yPrev){ h+=`<tr class="yrow"><td colspan="${1+ks.length+otros.length}">${y}</td></tr>`; yPrev=y; }
    const v={}; ks.forEach(k=>{ v[k]=SR[k][i]; if(v[k]) tot[k]+=v[k].neto; });
    serie.push({i,v:ks.map(k=>v[k]?v[k].neto:0)});
    h+=`<tr><td>${MESES[i%12]}</td>`+ks.map(k=>`<td class="n sep b">${v[k]?eur(v[k].neto):'—'}${notas(v[k])}</td>`).join('')+
      otros.map(k=>{ const d=(v[k]?v[k].neto:0)-(v[ref]?v[ref].neto:0);
        return `<td class="n sep ${d>0.004?'pos':d<-0.004?'warn':''}">${Math.abs(d)<0.005?'—':signo(d,eur)}</td>`; }).join('')+'</tr>';
  }
  h+='</tbody><tfoot><tr><td>Total</td>'+ks.map(k=>`<td class="n sep">${eur(tot[k])}</td>`).join('')+
    otros.map(k=>`<td class="n sep">${signo(tot[k]-tot[ref],eur)}</td>`).join('')+'</tr></tfoot>';
  $('cmpMeses').innerHTML=h;
  dibujarCmp(serie,ks);
  S._cmpMeses={is,SR,ks};
}

function dibujarCmp(serie,ks){
  const W=1200,H=280,ml=52,mr=10,mt=12,mb=30;
  const n=Math.max(1,serie.length);
  const yMax=Math.max(1,...serie.flatMap(p=>p.v))*1.08;
  const bw=(W-ml-mr)/n, Y=v=>mt+(1-Math.max(0,v)/yMax)*(H-mt-mb);
  let s='';
  for(let k=0;k<=4;k++){
    const val=yMax*k/4;
    s+=`<line x1="${ml}" y1="${Y(val)}" x2="${W-mr}" y2="${Y(val)}" stroke="#D3DCE8"/>`;
    s+=`<text x="${ml-8}" y="${Y(val)+4}" text-anchor="end" font-size="11" fill="#5B6B82">${nfx.format(Math.round(val/100)/10)}k</text>`;
  }
  const cada=Math.ceil(n/12), w=Math.max(1,(bw-4)/ks.length);
  serie.forEach((p,j)=>{
    const x=ml+j*bw;
    ks.forEach((k,q)=>{
      const v=p.v[q];
      s+=`<rect x="${(x+2+q*w).toFixed(1)}" y="${Y(v).toFixed(1)}" width="${w.toFixed(1)}" height="${(H-mb-Y(v)).toFixed(1)}" fill="${CMP_COL[k]}"><title>${mesLabel(p.i)} · ${k}: ${eur(v)}</title></rect>`;
    });
    if(j%cada===0) s+=`<text x="${(x+bw/2).toFixed(1)}" y="${H-10}" text-anchor="middle" font-size="11" fill="#5B6B82">${MESES[p.i%12]}${p.i%12===0||j===0?' '+String(Math.floor(p.i/12)).slice(2):''}</text>`;
  });
  $('chartCmp').innerHTML=s;
}

function guardarComparador(){
  try{ localStorage.setItem('idom-comparador',JSON.stringify(S.cmp)); }catch(e){}
}
function cargarComparador(){
  try{ const t=localStorage.getItem('idom-comparador'); if(t){ const c=JSON.parse(t); if(c&&typeof c==='object') CMP_K.forEach(k=>S.cmp[k]=c[k]||null); } }catch(e){}
}
let cmpDestino='A';
document.querySelector('.solo-comparador').addEventListener('click',e=>{
  const b=e.target.closest('button[data-acc]'); if(!b)return;
  const k=b.dataset.s;
  if(b.dataset.acc==='cargar'){ cmpDestino=k; $('cmpFichero').click(); }
  if(b.dataset.acc==='actual'){
    const st=estado();
    S.cmp[k]={nombre:'Pantalla · '+NOMBRE_MODO[st.S.mode]+' · '+new Date().toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}),st};
    guardarComparador(); calc();
  }
  if(b.dataset.acc==='quitar'){ S.cmp[k]=null; guardarComparador(); calc(); }
});
$('cmpFichero').addEventListener('change',e=>{
  const f=e.target.files[0]; if(!f)return;
  const rd=new FileReader();
  rd.onload=()=>{
    try{
      const st=JSON.parse(rd.result);
      if(!st||!st.S||!st.campos) throw new Error('no es un JSON guardado con esta calculadora');
      S.cmp[cmpDestino]={nombre:f.name,st};
      guardarComparador(); calc();
    }catch(err){ alert('Archivo no válido: '+err.message); }
  };
  rd.readAsText(f); e.target.value='';
});

function pintarComparador(){
  const R={};
  for(const k of CMP_K){
    const c=S.cmp[k];
    $('cmpNom'+k).textContent=c?'· '+c.nombre:'';
    if(!c){ R[k]=null; $('cmpInfo'+k).innerHTML='<div class="cmp-vacio">Carga un JSON guardado con «Guardar JSON» o usa lo que tienes ahora en pantalla.</div>'; continue; }
    let r;
    try{ r=conEstado(c.st,(P,modo)=>resumenEscenario(P,modo)); }
    catch(err){ r={err:'No se ha podido calcular: '+err.message}; }
    R[k]=r;
    $('cmpInfo'+k).innerHTML=r.err?'<div class="aviso">'+r.err+'</div>':
      '<b>'+r.titulo+'</b><br>'+r.detalle+'<br>Periodo: '+r.periodo+' · '+r.irpfModo+(r.variable?' · variable '+eur0(r.variable):'');
  }
  const ks=CMP_K.filter(k=>R[k]&&!R[k].err);
  $('cmpMesesPanel').style.display=ks.length>=2?'':'none';
  if(ks.length<2){
    $('cmpKpis').innerHTML=''; $('cmpTabla').innerHTML='';
    $('cmpNota').innerHTML='Carga al menos dos escenarios (hasta cuatro) para compararlos.';
    S._cmpR=null; S._cmpMeses=null;
    return;
  }
  const ref=ks[0], X=R[ref];
  const kpi=(v,l,sub,cl,col)=>`<div class="kpi ${cl||''}"><div class="v"${col?` style="color:${col}"`:''}>${v}</div><div class="l">${l}</div>${sub?`<div class="s">${sub}</div>`:''}</div>`;
  $('cmpKpis').innerHTML=ks.map(k=>{
    const r=R[k], d=r.neto-X.neto, dm=r.neto/r.meses-X.neto/X.meses;
    return kpi(eur0(r.neto),'líquido de '+k+' · '+eur0(r.neto/r.meses)+' al mes',
      k===ref?r.periodo+' · referencia':r.periodo+' · '+signo(d,eur0)+' ('+signo(dm,eur0)+'/mes) frente a '+ref,'',CMP_COL[k]);
  }).join('');
  const celdas=(get,fmt,neg)=>ks.map(k=>{
    const v=get(R[k]), b=get(X);
    let extra='';
    if(k!==ref&&typeof v==='number'&&typeof b==='number'&&Math.abs(v-b)>0.004){
      const d=v-b, bueno=neg?d<0:d>0;
      extra=`<br><span class="tag" style="color:${bueno?'var(--teal)':'var(--red)'}">${signo(d,eur)}</span>`;
    }
    return `<td class="n">${typeof v==='number'?(neg&&v>0.004?'−':'')+fmt(v):v}${extra}</td>`;
  }).join('');
  const fila=(et,get,cl,neg,fmt)=>`<tr class="${cl||''}"><td>${et}</td>${celdas(get,fmt||eur,neg)}</tr>`;
  const txt=(et,get)=>`<tr><td>${et}</td>${ks.map(k=>`<td class="n">${get(R[k])}</td>`).join('')}</tr>`;
  const pctDe=(x,b)=>b>0?' · '+pct(x/b*100):'';
  let h='<tr class="th"><td></td>'+ks.map(k=>`<td class="n"><span class="dot" style="display:inline-block;width:9px;height:9px;border-radius:2px;background:${CMP_COL[k]};margin-right:5px"></span>${k}</td>`).join('')+'</tr>';
  h+=txt('Cálculo',r=>r.titulo);
  h+=txt('Periodo',r=>r.periodo);
  h+=txt('Salario base anual',r=>eur0(r.salario0));
  if(ks.some(k=>R[k].variable)) h+=txt('Variable anual',r=>eur0(r.variable));
  h+=txt('Pagas · IRPF',r=>r.pagas+' · '+r.irpfModo);
  h+=fila('Salario devengado <span class="tag">base, extras y variable</span>',r=>r.sal);
  if(ks.some(k=>R[k].plus)) h+=fila('Plus de desplazamiento',r=>r.plus);
  if(ks.some(k=>R[k].dieta)) h+=fila('Dietas <span class="tag">exentas</span>',r=>r.dieta);
  h+=fila('Total devengado',r=>r.dev,'total');
  h+=fila('IRPF que pagas',r=>r.irpf,'neg',true);
  h+=txt('<span class="tag">IRPF sobre lo que tributa</span>',r=>r.suj>0?pct(r.irpf/r.suj*100):'—');
  if(ks.some(k=>R[k].comp)) h+=fila('<span class="tag">de ello, compensación IDOM</span>',r=>r.comp);
  h+=fila('Seguridad Social',r=>r.ss,'neg',true);
  h+=fila('Líquido total',r=>r.neto,'total');
  h+=fila('Líquido medio al mes',r=>r.neto/r.meses);
  if(ks.some(k=>Math.abs(R[k].netoHoy-R[k].neto)>1)) h+=fila('Líquido total en euros de hoy',r=>r.netoHoy);
  if(ks.some(k=>R[k].renta!=null)) h+=txt('Renta estimada de los años de la estancia',r=>r.renta==null?'—':textoResultado(r.renta));
  if(ks.some(k=>R[k].gana!=null)) h+=txt('Ganas frente a quedarte',r=>r.gana!=null?signo(r.gana,eur):'—');
  if(ks.some(k=>R[k].fuera)) h+=txt('Días fuera',r=>nf0.format(r.fuera));
  $('cmpTabla').innerHTML=h;
  const mejor=ks.reduce((a,k)=>R[k].neto/R[k].meses>R[a].neto/R[a].meses?k:a,ks[0]);
  const periodos=new Set(ks.map(k=>R[k].periodo));
  $('cmpNota').innerHTML='<b>'+mejor+' es el que más líquido deja al mes</b> ('+eur0(R[mejor].neto/R[mejor].meses)+'). '+
    'Las diferencias de cada columna son frente a '+ref+'. '+
    (periodos.size>1?'Los periodos son distintos: compara mejor el líquido medio al mes. ':'')+
    'Nómina y subidas se comparan con un año completo; la estancia, con su periodo.';
  S._cmpR={R,ks};
  try{ pintarCmpMeses(ks); }catch(err){ $('cmpMeses').innerHTML='<tr><td>No se ha podido calcular mes a mes: '+err.message+'</td></tr>'; }
}

/* ============================================================
   GUARDAR / CARGAR / EXCEL
   ============================================================ */
const CHECKS=['nuclear','tope','est2','aplicaNomina','costeDestino','indexar','meiProg','eurosHoy'];
const CAMPOS=['importe','variable','extra1','extra2','origen','destino','salida','regreso','vueltaEsp','idaDeNuevo','calcDesde','calcHasta','diasDef','anio',
  'regimen','modoDias','ipc',
  'irpfManual','desc','disc','tipoSS','tipoEmp','baseMin','baseMax'];
function estado(){
  const c=camposForm();
  const st=JSON.parse(JSON.stringify(S));
  delete st.cmp; delete st.ultimo;
  if(st.mode==='comparador') st.mode=S.ultimo||'desglose';
  return {version:2,app:'Calculadora de nóminas y desplazamientos de IDOM',S:st,campos:c};
}
/* Pone un estado en el formulario sin recalcular */
function ponerEstado(st){
  const s=st.S;
  if(s.mode==='nomina')S.mode='desglose';
  else if(['desglose','subidas','estancia','comparador'].includes(s.mode))S.mode=s.mode;
  if(['estancia','custom'].includes(s.periodo))S.periodo=s.periodo; else S.periodo='estancia';
  if(['anual','paga'].includes(s.modoImporte))S.modoImporte=s.modoImporte;
  if([12,14].includes(+s.pagas))S.pagas=+s.pagas;
  if(['aparte','prorr'].includes(s.cobroExtra))S.cobroExtra=s.cobroExtra;
  if(['tabla','prog','manual','zero'].includes(s.irpf))S.irpf=s.irpf;
  if(Array.isArray(s.subidas))S.subidas=s.subidas.map(x=>({pct:+x.pct||0,desde:String(x.desde||'')}));
  S.overrides=(s.overrides&&typeof s.overrides==='object')?s.overrides:{};
  const c=st.campos||{};
  CAMPOS.forEach(id=>{ if(c[id]!=null) $(id).value=c[id]; });
  CHECKS.forEach(id=>{ if(c[id]!=null) $(id).checked=!!c[id]; });
  /* JSON anteriores: no tenían régimen; se respeta la regla que usaban */
  if(c.regimen==null) $('regimen').value=c.regla183===false?'ninguno':'183';
  if(c.modoDias==null) $('modoDias').value='fijo';
}
function aplicarEstado(st){
  if(!st||!st.S)return;
  ponerEstado(st);
  syncSegs(); pintarSubidas(); calc();
}
function guardarLocal(){ try{ localStorage.setItem('idom-nomina-estancia',JSON.stringify(estado())); }catch(e){} }
function cargarLocal(){
  try{ const t=localStorage.getItem('idom-nomina-estancia'); if(t){ aplicarEstado(JSON.parse(t)); return true; } }catch(e){}
  return false;
}
function flash(btn,txt){
  const o=btn.textContent; btn.textContent=txt; btn.classList.add('ok');
  setTimeout(()=>{btn.textContent=o;btn.classList.remove('ok');},1400);
}
function descargar(blob,nombre){
  const url=URL.createObjectURL(blob), a=document.createElement('a');
  a.href=url; a.download=nombre; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
const hoyISO=()=>new Date().toISOString().slice(0,10);

$('btnGuardar').addEventListener('click',()=>{
  descargar(new Blob([JSON.stringify(estado(),null,2)],{type:'application/json'}),'Calculadora_IDOM_'+(S.mode==='comparador'?S.ultimo:S.mode)+'_'+hoyISO()+'.json');
  flash($('btnGuardar'),'Guardado');
});
$('btnCargar').addEventListener('click',()=>$('fichero').click());
$('fichero').addEventListener('change',e=>{
  const f=e.target.files[0]; if(!f)return;
  const rd=new FileReader();
  rd.onload=()=>{
    try{ aplicarEstado(JSON.parse(rd.result)); flash($('btnCargar'),'Cargado'); }
    catch(err){ alert('Archivo no válido: '+err.message); }
  };
  rd.readAsText(f); e.target.value='';
});

$('btnExcel').addEventListener('click',()=>{
  if(!window.XLSX){ alert('No se ha podido cargar la librería de Excel. Comprueba la conexión.'); return; }
  const P=leer(), wb=XLSX.utils.book_new();
  if(S.mode==='comparador'){
    const C=S._cmpR;
    if(!C){ alert('Carga al menos dos escenarios para exportar la comparación.'); return; }
    const {R,ks}=C, ref=ks[0];
    const campos=[['Cálculo','titulo'],['Periodo','periodo'],['Salario base anual','salario0'],['Variable anual','variable'],
      ['Salario devengado','sal'],['Plus','plus'],['Dietas','dieta'],['Total devengado','dev'],['IRPF que pagas','irpf'],
      ['Compensación IDOM','comp'],['Seguridad Social','ss'],['Líquido total','neto'],['Líquido en euros de hoy','netoHoy'],['Días fuera','fuera']];
    const rows=[['Concepto'].concat(ks.map(k=>k+' · '+S.cmp[k].nombre)).concat(ks.slice(1).map(k=>k+' − '+ref))];
    for(const [l,c] of campos){
      const vals=ks.map(k=>R[k][c]);
      rows.push([l].concat(vals).concat(ks.slice(1).map(k=>typeof R[k][c]==='number'&&typeof R[ref][c]==='number'?R[k][c]-R[ref][c]:'')));
    }
    rows.push(['Líquido medio al mes'].concat(ks.map(k=>R[k].neto/R[k].meses)).concat(ks.slice(1).map(k=>R[k].neto/R[k].meses-R[ref].neto/R[ref].meses)));
    const ws=XLSX.utils.aoa_to_sheet(rows); ws['!cols']=[{wch:24}].concat(Array(rows[0].length-1).fill({wch:26}));
    XLSX.utils.book_append_sheet(wb,ws,'Comparador');
    const CM=S._cmpMeses;
    if(CM){
      const mm=[['Año','Mes'].concat(CM.ks.map(k=>k+' devengado')).concat(CM.ks.map(k=>k+' líquido')).concat(CM.ks.slice(1).map(k=>k+' − '+CM.ks[0]))];
      for(const i of CM.is){
        const v=CM.ks.map(k=>CM.SR[k][i]);
        mm.push([Math.floor(i/12),MESES_L[i%12]].concat(v.map(x=>x?x.dev:'')).concat(v.map(x=>x?x.neto:''))
          .concat(CM.ks.slice(1).map((k,q)=>(v[q+1]?v[q+1].neto:0)-(v[0]?v[0].neto:0))));
      }
      const w2=XLSX.utils.aoa_to_sheet(mm); w2['!cols']=[{wch:6},{wch:11}].concat(Array(mm[0].length-2).fill({wch:15}));
      XLSX.utils.book_append_sheet(wb,w2,'Mes a mes');
    }
    XLSX.writeFile(wb,'Calculadora_IDOM_comparador_'+hoyISO()+'.xlsx');
    flash($('btnExcel'),'Descargado');
    return;
  }
  const EUR='#,##0.00 "€"', PCT='0.00%';
  const hoja=(rows,cols,fmt)=>{
    const ws=XLSX.utils.aoa_to_sheet(rows);
    ws['!cols']=cols.map(w=>({wch:w}));
    rows.forEach((r,ri)=>r.forEach((v,ci)=>{
      const f=fmt(ri,ci); if(!f||typeof v!=='number')return;
      const ref=XLSX.utils.encode_cell({r:ri,c:ci}); if(ws[ref]) ws[ref].z=f;
    }));
    return ws;
  };

  const par=[
    ['Calculadora de nóminas y desplazamientos de IDOM'],['Generado',new Date().toLocaleDateString('es-ES')],[],
    ['Modo',{desglose:'Desglose de nómina',subidas:'Subidas de sueldo',estancia:'Estancia'}[S.mode]],
    ['Salario base bruto anual',P.salario0],['Variable anual (febrero)',P.variable],['Pagas',P.pagas],
    ['Pagas extras',P.pagas===14?(P.prorr?'Prorrateadas':'Aparte, en '+P.extraMeses.map(m=>MESES_L[m-1]).join(' y ')):'—'],
    ['IRPF',{tabla:'Tabla foral Bizkaia 2026',prog:'Por tramos (simulación)',manual:'Manual',zero:'0 %'}[P.irpf]],
    ['Descendientes',P.desc],['Cuota obrera SS',P.tSS],
  ];
  if(P.irpf==='manual') par.push(['Tipo manual',P.irpfManual]);
  P.subidas.forEach((s,k)=>par.push(['Subida '+(k+1)+' desde '+ymKey(s.i),s.pct/100]));
  if(S.mode==='estancia'){
    par.push(['Origen',P.origen],['Destino',P.destino],['Central nuclear',P.nuclear?'Sí':'No'],
      ['Salida',$('salida').value],['Regreso',$('regreso').value],['Días/mes en destino',P.diasDef],
      ['Dieta diaria',P.dietaDia],['% plus',P.pctPlus],
      ['Vuelta intermedia a España',P.pausa?$('vueltaEsp').value+' a '+$('idaDeNuevo').value:'No'],
      ['Régimen de lo cobrado fuera',{'917':'Exención art. 9.17'+(P.aplicaNomina?' (en nómina)':' (en la renta)'),'183':'Regla de 183 días','ninguno':'Tributa todo'}[P.regimen]],['Tope IRPF de España (IDOM)',P.tope?'Sí':'No']);
  }
  XLSX.utils.book_append_sheet(wb,hoja(par,[34,26],(r,c)=>{
    if(c!==1)return null;
    const l=String(par[r][0]||'');
    if(/Subida|Cuota|Tipo manual|% plus/.test(l))return PCT;
    if(/Salario|Variable|Dieta diaria/.test(l))return EUR;
    return null;
  }),'Parámetros');

  if(S.mode!=='estancia'){
    const A=simularAnio(P,S.mode==='subidas'?P.anio:new Date().getFullYear(),false);
    const cal=[['Año','Mes','Concepto','Salario','Extra','Variable','Devengado','Tipo IRPF','IRPF','SS','Líquido']];
    for(const M of A.meses){
      cal.push([M.y,MESES_L[M.m-1],'Mensualidad',M.salMes,P.prorr?M.extra:0,0,M.brutoMes,M.tipo,-M.irpfMes,-M.ss,M.netoMes]);
      if(!P.prorr&&M.extraInfo) cal.push([M.y,MESES_L[M.m-1],'Paga extra',0,M.extra,0,M.extra,M.tipo,-M.irpfExtra,0,M.netoExtra]);
      if(M.variable>0) cal.push([M.y,MESES_L[M.m-1],'Variable',0,0,M.variable,M.variable,M.tipo,-M.irpfVar,-M.ssVar,M.netoVar]);
    }
    XLSX.utils.book_append_sheet(wb,hoja(cal,[6,11,13,12,12,12,12,9,12,12,12],
      (r,c)=>r===0?null:c===7?PCT:(c>=3?EUR:null)),'Mes a mes');
    if(S.mode==='subidas'){
      const rows=[['Momento','Desde','Salario base anual','Mensualidad bruta','Extra bruta','Tipo IRPF','Líquido mensualidad','Líquido extra','Líquido variable','Líquido anual']];
      let b=P.salario0;
      const add=(et,desde)=>{const R=motor(b,P);rows.push([et,desde,b,R.brutoMes,R.brutoExtra,R.tipo,R.netoMes,R.netoExtra,R.netoVar,R.neto]);};
      add('Hoy','');
      P.subidas.forEach((s,k)=>{ b*=1+s.pct/100; add('Subida '+(k+1)+' (+'+s.pct+' %)',ymKey(s.i)); });
      XLSX.utils.book_append_sheet(wb,hoja(rows,[20,10,16,16,14,10,18,14,14,14],
        (r,c)=>r===0?null:c===5?PCT:(c>=2?EUR:null)),'Subidas');
    }
  }else{
    const E=datosEstancia(P);
    if(E.err){ alert(E.err); return; }
    const cal=[['Año','Mes','Concepto','Situación','Días fuera','Días destino','Salario','Plus','Dieta','Devengado','% IRPF','IRPF','% SS','SS','Líquido','Líquido si te quedas']];
    const pc=(x,b)=>b>0?x/b:0;
    for(const a of E.anios){
      for(const F of a.filas){
        const M=F.M;
        if(F.tipoFila==='mes')
          cal.push([M.y,MESES_L[M.m-1],'Mensualidad',M.D.sit,F.nat,M.D.dias,F.sal,F.plus,F.dieta,F.dev,pc(F.irpf,F.suj),-F.irpf,pc(F.ss,F.suj),-F.ss,F.neto,F.netoS]);
        else{
          const et=F.tipoFila==='extra'?'Paga extra':F.tipoFila==='var'?'Variable':'Paga extra devengada ('+nfx.format(F.pct*100)+' %)';
          cal.push([M.y,MESES_L[M.m-1],et,F.info||'','','',F.imp,0,0,F.imp,pc(F.irpf,F.imp),-F.irpf,pc(F.ss,F.imp),-F.ss,F.neto,F.netoS]);
        }
      }
      if(a.comp>0) cal.push([a.y,'','Compensación IDOM','','','',0,0,0,0,'',a.comp,'',0,a.comp,0]);
    }
    XLSX.utils.book_append_sheet(wb,hoja(cal,[6,11,26,14,10,10,12,12,12,12,9,12,9,12,12,14],
      (r,c)=>r===0?null:(c===10||c===12)?PCT:(c>=6?EUR:null)),'Estancia mes a mes');
    const T=E.T,B=E.B;
    const rows=[['Concepto','Estancia','Si te quedas','Diferencia']];
    [['Salario (días fuera)',T.sal,B.sal],['Pagas extras',T.ext,B.ext],['Variable (febrero)',T.variable,B.variable],
     ['Plus',T.plus,0],['Dieta (exenta)',T.dieta,0],['Total devengado',T.dev,B.dev],['IRPF retenido',-T.irpf,-B.irpf],
     ['Compensación IDOM',T.comp,0],['Seguridad Social',-T.ss,-B.ss],['Líquido',T.neto,B.neto]]
      .forEach(([l,a,b])=>rows.push([l,a,b,a-b]));
    rows.push([],['Días naturales fuera',T.fuera],['Días en destino (plus y dietas)',T.dias]);
    const res=[['Año','Días fuera','Días en España','Situación','IRPF sin desplazarte','IRPF retenido','Compensación IDOM','IRPF que pagas']];
    for(const a of E.anios) res.push([a.y,a.res.fuera,a.res.espana,textoFiscal(a.res,P),
      a.sin.tot.irpf,a.con.tot.irpf,a.comp,a.con.tot.irpf-a.comp]);
    XLSX.utils.book_append_sheet(wb,hoja(rows,[32,16,16,16],(r,c)=>r&&c&&r<=10?EUR:null),'Desglose estancia');
    XLSX.utils.book_append_sheet(wb,hoja(res,[6,11,14,28,18,14,18,14],(r,c)=>r&&c>=4?EUR:null),'Residencia fiscal');
  }
  XLSX.writeFile(wb,'Calculadora_IDOM_'+S.mode+'_'+hoyISO()+'.xlsx');
  flash($('btnExcel'),'Descargado');
});

/* ============================================================
   ARRANQUE
   ============================================================ */
poblar();
seg('segModo','mode');
seg('segImporte','modoImporte');
seg('segPagas','pagas',Number);
seg('segCobro','cobroExtra');
seg('segIrpf','irpf');
seg('segPeriodo','periodo');
['importe','variable','regimen','aplicaNomina','costeDestino','ipc','indexar','meiProg','eurosHoy','modoDias','tope','extra1','extra2','origen','destino','nuclear','salida','regreso','vueltaEsp','idaDeNuevo','calcDesde','calcHasta','diasDef','anio',
 'irpfManual','desc','disc','tipoSS','tipoEmp','baseMin','baseMax']
  .forEach(id=>$(id).addEventListener(['salida','regreso','vueltaEsp','idaDeNuevo','anio','calcDesde','calcHasta'].includes(id)?'change':'input',calc));
/* al activar la vuelta intermedia, si sus fechas no caen dentro de la estancia, propone unas a mitad */
$('est2').addEventListener('change',()=>{
  if(!$('est2').checked)return;
  const s1=parseFecha($('salida').value), r1=parseFecha($('regreso').value);
  const v=parseFecha($('vueltaEsp').value), n=parseFecha($('idaDeNuevo').value);
  if(s1&&r1){
    const a=diaNum(s1.y,s1.m,s1.d), b=diaNum(r1.y,r1.m,r1.d);
    const dv=v?diaNum(v.y,v.m,v.d):NaN, dn=n?diaNum(n.y,n.m,n.d):NaN;
    if(!(dv>a&&dn>dv&&dn<=b)){
      const iso=x=>new Date(x*864e5).toISOString().slice(0,10);
      const mid=Math.round((a+b)/2), largo=Math.min(30,Math.max(2,Math.floor((b-a)/4)));
      $('vueltaEsp').value=iso(mid-Math.floor(largo/2)); $('idaDeNuevo').value=iso(mid-Math.floor(largo/2)+largo);
    }
  }
  calc();
},true);
['salida','regreso','anio'].forEach(id=>$(id).addEventListener('input',()=>{ if($(id).value.length>=4) calc(); }));

$('btnReset').addEventListener('click',()=>{
  if(!confirm('¿Borrar todos los datos y volver a los valores iniciales?\n\nSe borran también los escenarios del comparador. Si quieres conservar algo, antes usa «Guardar JSON».')) return;
  try{ localStorage.removeItem('idom-nomina-estancia'); localStorage.removeItem('idom-comparador'); }catch(e){}
  location.reload();
});

/* ---------- informe PDF: hoja de impresión de la pestaña actual ---------- */
$('btnPdf').addEventListener('click',()=>{
  const P=leer(), f=x=>x?x.d+' '+MESES[x.m-1]+' '+x.y:'—';
  const partes=['<b>Informe · '+{desglose:'Desglose de nómina',subidas:'Subidas de sueldo',estancia:'Estancia',comparador:'Comparador'}[S.mode]+'</b>',
    'generado el '+new Date().toLocaleDateString('es-ES',{day:'numeric',month:'long',year:'numeric'})];
  if(S.mode!=='comparador'){
    partes.push('Salario base '+eur0(P.salario0)+(P.variable?' + variable '+eur0(P.variable):'')+' · '+P.pagas+' pagas · '+P.desc+' descendientes');
    if(S.mode==='subidas'&&P.subidas.length) partes.push('Subidas: '+P.subidas.map(s=>signo(s.pct,milar)+' % desde '+mesLabel(s.i)).join(', '));
    if(S.mode==='estancia'){
      partes.push(P.origen+' → '+P.destino+' · del '+f(P.salida)+' al '+f(P.regreso)+(P.pausa?' (vuelta a España del '+f(P.pausa.vuelta)+' al '+f(P.pausa.ida)+')':''));
      partes.push({'917':'Exención art. 9.17'+(P.aplicaNomina?' aplicada en nómina':' recuperada en la renta'),'183':'Regla de 183 días','ninguno':'Tributa todo en España'}[P.regimen]+
        (P.tope?' · tope de IDOM':'')+' · días en destino: '+{fijo:P.diasDef+' al mes',laborables:'laborables',naturales:'naturales'}[P.modoDias]);
    }
    partes.push('IPC '+nfx.format(P.ipc*100)+' %'+(P.indexar?' · tramos y bases actualizados':'')+(P.meiProg?' · MEI previsto':''));
  }
  $('impresion').innerHTML=partes.join(' · ');
  window.print();
});

/* app instalable: guarda la calculadora para usarla sin conexión (solo cuando se sirve por web) */
if('serviceWorker' in navigator&&/^https?:$/.test(location.protocol)){
  window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
}

pintarSlots();
cargarComparador();
if(!cargarLocal()){ syncSegs(); pintarSubidas(); calc(); }
