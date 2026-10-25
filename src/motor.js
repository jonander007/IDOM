"use strict";
/* ============================================================
   FORMATO
   ============================================================ */
const nf2=new Intl.NumberFormat('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2,useGrouping:'always'});
const nf0=new Intl.NumberFormat('es-ES',{maximumFractionDigits:0,useGrouping:'always'});
const nfx=new Intl.NumberFormat('es-ES',{maximumFractionDigits:2,useGrouping:'always'});
const eur=n=>nf2.format(n)+' €';
const eur0=n=>nf0.format(n)+' €';
const pct=n=>nf2.format(n)+' %';          // n ya en porcentaje
const milar=n=>nfx.format(n);
const menos=v=>v>0.004?'−'+eur(v):'—';
const signo=(n,f)=>(n>=0?'+':'−')+f(Math.abs(n));
const mesLabel=i=>MESES[((i%12)+12)%12]+' '+Math.floor(i/12);
const ymKey=i=>Math.floor(i/12)+'-'+String(i%12+1).padStart(2,'0');

/* Las fechas se leen a mano para no depender de la zona horaria del navegador */
function parseFecha(s){
  const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(s||''); if(!m)return null;
  const y=+m[1],mo=+m[2],d=+m[3];
  if(mo<1||mo>12||d<1||d>diasMes(y,mo))return null;
  return {y,m:mo,d,i:y*12+mo-1};
}
function parseYM(s){
  const m=/^(\d{4})-(\d{1,2})$/.exec(s||''); if(!m)return NaN;
  const mo=+m[2]; if(mo<1||mo>12)return NaN;
  return +m[1]*12+mo-1;
}
function diasMes(y,m){return new Date(y,m,0).getDate();}

/* ============================================================
   IRPF
   ============================================================ */
function filaTabla(b){return TABLA.find(r=>b<=r[0]);}
function reduccion(b,disc){return disc===0?0:DISCAP.find(r=>b<=r[0])[1][disc-1];}
function tipoUnico(b,desc,disc){return Math.max(0,filaTabla(b)[1][Math.min(desc,6)]-reduccion(b,disc));}
function irpfProgresivo(b,desc,disc){
  let acc=0,prev=0;
  for(const r of TABLA){
    const top=Math.min(b,r[0]);
    if(top>prev){
      const t=Math.max(0,r[1][Math.min(desc,6)]-reduccion(prev+0.01,disc));
      acc+=(top-prev)*t/100; prev=top;
    }
    if(b<=r[0])break;
  }
  return acc;
}
/* ---------- parámetros que cambian con el año ---------- */
const aniosDesdeBase=y=>Math.max(0,(y||ANIO_BASE)-ANIO_BASE);
/* Factor para actualizar con el IPC los tramos y bases de años posteriores a las tablas */
function factorIPC(P,y){ return P.indexar?Math.pow(1+P.ipc,aniosDesdeBase(y)):1; }
function meiObrero(y){
  y=y||ANIO_BASE;
  if(MEI_OBRERO[y]!=null) return MEI_OBRERO[y];
  return y<2023?0.10:0.20;
}
/* Cuota obrera del año: la que hay en el panel (2026) más lo que sube el MEI */
function tipoSS(P,y){ return P.tSS+(P.meiProg?(meiObrero(y)-meiObrero(ANIO_BASE))/100:0); }
/* Bases de cotización del año: la máxima sube IPC + 1,2 puntos al año (reforma de pensiones) */
function basesSS(P,y){
  const n=aniosDesdeBase(y);
  if(!P.indexar||!n) return {min:P.bMin,max:P.bMax};
  return {min:P.bMin*Math.pow(1+P.ipc,n),max:P.bMax*Math.pow(1+P.ipc+0.012,n)};
}
function clampBase(x,P,y){ const B=basesSS(P,y); return Math.min(Math.max(x,B.min),B.max); }

/* retención anual objetivo para una base anual (tabla del año, con los tramos actualizados si toca) */
function retencionAnual(b,P,modo,y){
  modo=modo||P.irpf;
  if(modo==='zero'||b<=0)return 0;
  if(modo==='manual')return b*P.irpfManual;
  const f=factorIPC(P,y);
  if(modo==='prog')return irpfProgresivo(b/f,P.desc,P.disc)*f;
  return b*tipoUnico(b/f,P.desc,P.disc)/100;
}
/* Euros de un año expresados en euros de hoy (año de las tablas), descontando el IPC */
const aHoy=(v,y,P)=>v/Math.pow(1+P.ipc,(y||ANIO_BASE)-ANIO_BASE);
function tipoTabla(b,P,y){ return tipoUnico(b/factorIPC(P,y),P.desc,P.disc); }

/* ---------- declaración de la renta (estimación) ---------- */
function bonificacionTrabajo(rn,f){
  const B=BONIF_TRABAJO;
  let v;
  if(rn<=B.hasta*f) v=B.max*f;
  else if(rn<=B.tope*f) v=B.max*f-B.coef*(rn-B.hasta*f);
  else v=B.min*f;
  return Math.max(0,Math.min(v,rn));
}
function cuotaEscala(base,f){
  let c=0, prev=0;
  for(const [hasta,t] of ESCALA){
    const top=Math.min(base,hasta*f);
    if(top>prev){ c+=(top-prev)*t/100; prev=top; }
    if(base<=hasta*f) break;
  }
  return c;
}
/* Renta de un año a partir de su simulación: rendimientos del trabajo, sin otras rentas ni deducciones familiares */
function rentaAnio(A,P){
  const f=factorIPC(P,A.y), T=A.tot;
  const integro=T.suj, exento=T.exento, gastos=T.ss;
  const rn=Math.max(0,integro-exento-gastos);
  const bonif=bonificacionTrabajo(rn,f);
  const base=Math.max(0,rn-bonif);
  const cuota=cuotaEscala(base,f);
  const minor=Math.min(cuota,MINORACION*f);
  const liquida=Math.max(0,cuota-minor);
  const retenido=T.irpf;
  return {integro,exento,gastos,rn,bonif,base,cuota,minor,liquida,retenido,resultado:liquida-retenido,
          tipoMedio:integro>0?liquida/integro:0};
}

/* ============================================================
   MOTOR
   ============================================================ */
/* Salario anual vigente en el mes absoluto i (año*12+mes-1), con las subidas encadenadas */
function salAnual(P,i){
  let s=P.salario0;
  for(const sub of P.subidas) if(i>=sub.i) s*=1+sub.pct/100;
  return s;
}

/* Meses (índices absolutos) que devenga la extra que se paga en el mes absoluto i */
function periodoExtra(P,i){
  const [a,b]=P.extraMeses, y=Math.floor(i/12), m=i%12+1;
  const prev=m===a?(y-1)*12+(b-1):y*12+(a-1);
  const out=[]; for(let k=prev+1;k<=i;k++)out.push(k);
  return out;
}
/* Largo del periodo de devengo al que pertenece el mes m (1-12) */
function largoPeriodo(P,m){
  const [a,b]=P.extraMeses;
  return (m>a&&m<=b)?b-a:a+12-b;
}
function importeExtra(P,i){
  const per=periodoExtra(P,i);
  return per.reduce((s,k)=>s+salAnual(P,k)/P.pagas,0)/per.length;
}
function infoExtra(P,i){
  const per=periodoExtra(P,i), f=per[0], l=per[per.length-1];
  const y0=Math.floor(f/12), y1=Math.floor(l/12);
  let t='devengo '+MESES[f%12]+(y0!==y1?' '+y0:'')+'–'+MESES[l%12];
  const s0=salAnual(P,f), sl=salAnual(P,l);
  if(Math.abs(sl-s0)>0.005){
    const nuevos=per.filter(k=>Math.abs(salAnual(P,k)-sl)<0.005).length;
    t+=' · '+nuevos+' de '+per.length+' meses con el sueldo subido';
  }
  return t;
}

/* Días en destino que cuentan para plus y dietas entre los días a y b (inclusive) de un mes */
function diasDestino(P,a,b,cub,dim){
  if(P.modoDias==='naturales') return cub;
  if(P.modoDias==='laborables'){
    let n=0;
    for(let d=a;d<=b;d++){ const w=new Date(d*864e5).getUTCDay(); if(w>0&&w<6) n++; }
    return n;
  }
  return Math.round(P.diasDef*cub/dim);
}
/* Días en destino de un mes completo, para proyectar lo que queda de año */
const diasMesTipico=P=>P.modoDias==='naturales'?30.44:P.modoDias==='laborables'?21.75:P.diasDef;

/* Situación de un mes respecto a las estancias (una o dos) */
const diaNum=(y,m,d)=>Date.UTC(y,m-1,d)/864e5;
const solapeDias=(a0,a1,b0,b1)=>Math.max(0,Math.min(a1,b1)-Math.max(a0,b0)+1);
const tramosOk=P=>(P.estancias||[]).filter(t=>isFinite(t.a)&&isFinite(t.b)&&t.b>=t.a);
function situacion(P,y,m,est){
  if(!est)return {dias:0,fin:false,sit:'origen',partes:[]};
  const i=y*12+m-1, dim=diasMes(y,m), m0=diaNum(y,m,1), m1=diaNum(y,m,dim);
  const T=tramosOk(P);
  const partes=[];
  for(const t of T){
    const cub=solapeDias(m0,m1,t.a,t.b);
    if(cub>0){
      const a=Math.max(m0,t.a), b=Math.min(m1,t.b);
      partes.push({t,cub,d0:a-m0+1,d1:b-m0+1,dias:diasDestino(P,a,b,cub,dim)});
    }
  }
  if(!partes.length){
    const sit=!T.length||m1<T[0].a?'antes':m0>T[T.length-1].b?'despues':'entre';
    return {dias:0,fin:false,sit,partes};
  }
  const k=ymKey(i), ov=S.overrides[k]!=null;
  let dias=partes.reduce((a,p)=>a+p.dias,0);
  if(ov){
    const v=S.overrides[k];
    if(dias>0) partes.forEach(p=>p.dias=v*p.dias/dias); else partes[0].dias=v;
    dias=v;
  }
  const finT=T.find(t=>t.a<=m1&&t.b>m1)||null;
  let sit;
  if(partes.length>1) sit='varias';
  else{
    const p=partes[0], ini=p.d0>1, fin=p.d1<dim;
    sit=ini&&fin?'ida-vuelta':ini?'salida':fin?'regreso':'destino';
  }
  return {dias,fin:!!finT,finT,sit,ov,d0:partes[0].d0,d1:partes[partes.length-1].d1,partes,dest:partes[0].t.destino};
}
function textoSituacion(D,P){
  const dests=new Set(tramosOk(P).map(t=>t.destino));
  const dest=dests.size>1&&D.dest?' · '+D.dest:'';
  if(D.sit==='antes'||D.sit==='despues') return 'En España';
  if(D.sit==='entre') return 'En España · vuelta intermedia';
  if(D.sit==='varias') return 'Vuelve el '+D.partes[0].d1+' y sale el '+D.partes[1].d0;
  return {destino:'En destino',salida:'Sale el '+D.d0,regreso:'Vuelve el '+D.d1,'ida-vuelta':'Del '+D.d0+' al '+D.d1}[D.sit]+dest;
}
const enEspana=D=>D.sit==='antes'||D.sit==='despues'||D.sit==='entre';

/* Días naturales fuera de España en el año y, sumando las estancias */
function residencia(P,y,est){
  const diasAnio=diaNum(y+1,1,1)-diaNum(y,1,1);
  let fuera=0;
  if(est) for(const t of tramosOk(P)) fuera+=solapeDias(diaNum(y,1,1),diaNum(y,12,31),t.a,t.b);
  const espana=diasAnio-fuera;
  const reg=P.regimen||'183';
  const noRes=!!(est&&reg==='183'&&fuera>0&&fuera<183);
  /* libre: lo cobrado fuera ese año no tributa en España (183 simplificada o exención 9.17) */
  const libre=!!(est&&fuera>0&&(noRes||reg==='917'));
  /* el país de destino puede gravar: más de 183 días allí en el año natural o coste soportado allí */
  const destinoGrava=!!(est&&fuera>0&&(fuera>183||P.costeDestino));
  return {fuera,espana,noRes,libre,destinoGrava};
}

/* Parte del mes absoluto i que pasas fuera (días naturales dentro de alguna estancia) */
function fraccionFuera(P,i){
  const y0=Math.floor(i/12), m0=i%12+1, dim=diasMes(y0,m0);
  let f=0;
  for(const t of tramosOk(P)) f+=solapeDias(diaNum(y0,m0,1),diaNum(y0,m0,dim),t.a,t.b);
  return f/dim;
}

/* Un año natural mes a mes. est=true aplica la estancia (plus y dietas). */
function simularAnio(P,y,est){
  const meses=[];
  const RES=residencia(P,y,est);
  for(let m=1;m<=12;m++){
    const i=y*12+m-1;
    const sa=salAnual(P,i), salMes=sa/P.pagas;
    const D=situacion(P,y,m,est);
    const plus=D.partes.reduce((a,p)=>a+sa/365*p.t.pctPlus*p.dias,0);
    const dieta=D.partes.reduce((a,p)=>a+p.t.dietaDia*p.dias,0);
    let extra=0, extraInfo=null;
    if(P.pagas===14){
      if(P.prorr) extra=salMes/largoPeriodo(P,m);
      else if(P.extraMeses.includes(m)){ extra=importeExtra(P,i); extraInfo=infoExtra(P,i); }
    }
    const variable=m===2?P.variable:0;
    const tss=tipoSS(P,y);
    const baseSS=clampBase(salMes*P.pagas/12+plus,P,y);
    const ssVar=(clampBase(salMes*P.pagas/12+plus+variable,P,y)-baseSS)*tss;
    meses.push({y,m,i,sa,salMes,D,plus,dieta,extra,extraInfo,variable,baseSS,ss:baseSS*tss,ssVar,tss,
                subida:P.subidas.find(s=>s.i===i)});
  }

  /* IRPF con regularización mensual.
     Exención de lo cobrado fuera (régimen 9.17, o 183 días simplificada): salario de los días fuera,
     plus y la parte de extras y variable, con el límite anual del 9.17. El tipo sale de todo el año.
     exRet: si la nómina ya aplica la exención en la retención (si no, se recupera en la renta). */
  const ex=RES.libre;
  const exRet=ex&&(P.regimen!=='917'||P.aplicaNomina);
  const limite=P.regimen==='917'?LIMITE_917*factorIPC(P,y):Infinity;
  const fa=i=>ex?fraccionFuera(P,i):0;
  const raV=ex?RES.fuera/(RES.fuera+RES.espana):0;
  let retenido=0, acum=0, acumTax=0, exentoAcum=0;
  for(const M of meses){
    /* las dietas no cuentan para el IRPF; el variable sí */
    const suj=M.salMes+M.extra+M.plus+M.variable;
    const f=fa(M.i);
    let fExt=1;
    if(ex){
      if(P.prorr) fExt=1-f;
      else if(M.extraInfo){ const per=periodoExtra(P,M.i); fExt=1-per.reduce((a,k)=>a+fa(k),0)/per.length; }
    }
    /* partes exentas, recortadas si se pasa del límite anual */
    let exSal=M.salMes*f, exPlus=ex?M.plus:0, exExt=M.extra*(1-fExt), exVar=M.variable*raV;
    const exTot=exSal+exPlus+exExt+exVar, cabe=Math.max(0,limite-exentoAcum);
    if(exTot>cabe){ const k=exTot>0?cabe/exTot:0; exSal*=k; exPlus*=k; exExt*=k; exVar*=k; }
    M.exento=exSal+exPlus+exExt+exVar; exentoAcum+=M.exento;
    const r0=exRet?1:0;
    const salTax=M.salMes-exSal*r0, plusTax=M.plus-exPlus*r0, extTax=M.extra-exExt*r0, varTax=M.variable-exVar*r0;
    const sujTax=salTax+plusTax+extTax+varTax;
    let tipo;
    if(P.irpf==='zero') tipo=0;
    else if(P.irpf==='manual') tipo=P.irpfManual;
    else{
      /* lo que queda del año, suponiendo que las condiciones de este mes se mantienen */
      const salCur=M.salMes;
      const plusCur=M.D.fin?M.sa/365*M.D.finT.pctPlus*diasMesTipico(P):0;
      const fueraFut=exRet&&M.D.fin;
      let fut=0, futTax=0;
      for(let j=M.m+1;j<=12;j++){
        fut+=salCur+plusCur+(j===2?P.variable:0);
        futTax+=(fueraFut?0:salCur)+(exRet?0:plusCur)+(j===2?P.variable*(1-raV*r0):0);
        if(P.pagas===14){
          const e=P.prorr?salCur/largoPeriodo(P,j):(P.extraMeses.includes(j)?salCur:0);
          fut+=e; futTax+=fueraFut?0:e;
        }
      }
      const proj=acum+suj+fut, projTax=acumTax+sujTax+futTax;
      const r=proj>0?retencionAnual(proj,P,null,y)/proj:0;
      const resto=sujTax+futTax;
      tipo=resto>0?Math.max(0,(r*projTax-retenido)/resto):0;
      M.proj=proj;
    }
    M.sujTax=sujTax;
    const baseMes=M.salMes+M.plus+(P.prorr?M.extra:0);
    const baseExtra=P.prorr?0:M.extra;
    M.tipo=tipo;
    M.irpfMes=(salTax+plusTax+(P.prorr?extTax:0))*tipo;
    M.irpfExtra=(P.prorr?0:extTax)*tipo;
    M.irpfVar=varTax*tipo;
    M.irpf=M.irpfMes+M.irpfExtra+M.irpfVar;
    M.brutoMes=baseMes+M.dieta;
    M.netoMes=baseMes+M.dieta-M.irpfMes-M.ss;
    M.netoExtra=baseExtra-M.irpfExtra;
    M.netoVar=M.variable-M.irpfVar-M.ssVar;
    M.neto=M.netoMes+M.netoExtra+M.netoVar;
    retenido+=M.irpf; acum+=suj; acumTax+=sujTax;
  }
  return {y,meses,res:RES,exRet,comp:0,tot:totales(meses,P)};
}

function totales(meses,P){
  const t={sal:0,extra:0,plus:0,dieta:0,variable:0,irpf:0,ss:0,neto:0,netoMes:0,netoExtra:0,netoVar:0,
           irpfMes:0,irpfExtra:0,irpfVar:0,ssVar:0,dias:0,suj:0,comp:0,exento:0};
  for(const M of meses){
    t.sal+=M.salMes; t.extra+=M.extra; t.plus+=M.plus; t.dieta+=M.dieta; t.variable+=M.variable;
    t.irpf+=M.irpf; t.ss+=M.ss+M.ssVar; t.ssVar+=M.ssVar; t.neto+=M.neto;
    t.netoMes+=M.netoMes; t.netoExtra+=M.netoExtra; t.netoVar+=M.netoVar;
    t.irpfMes+=M.irpfMes; t.irpfExtra+=M.irpfExtra; t.irpfVar+=M.irpfVar; t.dias+=M.D.dias; t.exento+=M.exento||0;
  }
  t.suj=t.sal+t.extra+t.plus+t.variable;
  t.dev=t.suj+t.dieta;
  t.tipoEf=t.suj>0?t.irpf/t.suj:0;
  return t;
}

/* Tope de IDOM: en los años con residencia en España no pagas más IRPF que quedándote.
   La diferencia se suma como compensación al final del año. */
function aplicarTope(con,sin,P){
  const comp=(P.tope&&!(P.regimen==='183'&&con.res.noRes))?Math.max(0,con.tot.irpf-sin.tot.irpf):0;
  con.comp=comp; con.tot.comp=comp; con.tot.neto+=comp;
  con.tot.irpfNeto=con.tot.irpf-comp;
  return con;
}

/* Nómina anualizada para un bruto fijo todo el año (sin desplazamiento) */
function motor(b,P,modo,y){
  modo=modo||P.irpf; y=y||ANIO_BASE;
  const v=P.variable||0, total=b+v, tss=tipoSS(P,y);
  const salMes=b/P.pagas;
  const baseM=clampBase(b/12,P,y);
  const ss=baseM*tss, ssVar=(clampBase(b/12+v,P,y)-baseM)*tss, ssAnual=ss*12+ssVar;
  const irpf=retencionAnual(total,P,modo,y);
  const tipo=total>0?irpf/total:0;
  const aparte=P.pagas===14&&!P.prorr;
  const brutoMes=aparte?salMes:b/12;
  const brutoExtra=aparte?salMes:0;
  return {b,v,y,total,tU:tipoTabla(total,P,y),irpf,tipo,ss,ssVar,ssAnual,brutoMes,brutoExtra,
          irpfMes:brutoMes*tipo,irpfExtra:brutoExtra*tipo,irpfVar:v*tipo,
          netoMes:brutoMes-ss-brutoMes*tipo,netoExtra:brutoExtra-brutoExtra*tipo,
          netoVar:v-v*tipo-ssVar,
          neto:total-ssAnual-irpf};
}

