"use strict";
/* ============================================================
   PARÁMETROS DEL CÁLCULO
   ============================================================ */
/* Parámetros a partir de los campos del formulario (c: {id: valor o marcado}) y del estado (st).
   Lo usan la calculadora (con lo que hay en pantalla) y el plan (con lo que guardó la calculadora). */
function paramsDe(c,st){
  const v=id=>c[id]==null?'':String(c[id]);
  const n=id=>{const x=parseFloat(c[id]);return isFinite(x)?x:0;};
  const ck=id=>!!c[id];
  const imp=Math.max(0,n('importe'));
  const pagas=+st.pagas===12?12:14;
  const salario0=st.modoImporte==='paga'?imp*pagas:imp;
  let a=+v('extra1')||6,b=+v('extra2')||12;
  if(a===b){a=6;b=12;}
  const extraMeses=pagas===14?[Math.min(a,b),Math.max(a,b)]:[];
  const prorr=pagas===14&&st.cobroExtra==='prorr';
  const po=PAISES.find(p=>p[0]===v('origen'))||PAISES.find(p=>p[0]==='España')||PAISES[0];
  const pd=PAISES.find(p=>p[0]===v('destino'))||PAISES[0];
  const nuclear=ck('nuclear');
  const plusDe=d=>(d[2]<=po[2]?0.15:0.15+(d[2]-po[2]))+(nuclear?0.10:0);
  const pctPlus=plusDe(pd);
  const tramo=(d,x,y)=>{ const sa=parseFecha(x), rb=parseFecha(y);
    return {destino:d[0],dietaDia:d[1],pctPlus:plusDe(d),salida:sa,regreso:rb,
            a:sa?diaNum(sa.y,sa.m,sa.d):NaN,b:rb?diaNum(rb.y,rb.m,rb.d):NaN}; };
  /* una estancia; con vuelta intermedia a España, dos tramos al mismo destino */
  let estancias=[tramo(pd,v('salida'),v('regreso'))];
  const pausa=ck('est2');
  if(pausa){
    const vu=parseFecha(v('vueltaEsp')), id=parseFecha(v('idaDeNuevo'));
    const iso=x=>x?new Date((diaNum(x.y,x.m,x.d))*864e5).toISOString().slice(0,10):'';
    const dia=(x,k)=>x?new Date((diaNum(x.y,x.m,x.d)+k)*864e5).toISOString().slice(0,10):'';
    /* el día que vuelves ya estás en España; el día que te vas de nuevo ya estás fuera */
    estancias=[tramo(pd,v('salida'),dia(vu,-1)),tramo(pd,iso(id),v('regreso'))];
    estancias.pausa={vuelta:vu,ida:id};
  }
  const ult=estancias[estancias.length-1];
  const subidas=(st.subidas||[])
    .map(s=>({pct:+s.pct||0,i:parseYM(s.desde)}))
    .filter(s=>isFinite(s.i)&&st.mode!=='desglose')
    .sort((x,y)=>x.i-y.i);
  const bMax=n('baseMax')||1e9;
  return {
    salario0,pagas,extraMeses,prorr,variable:Math.max(0,n('variable')),
    regimen:v('regimen')||'917',aplicaNomina:ck('aplicaNomina'),costeDestino:ck('costeDestino'),
    tope:ck('tope'),
    ipc:n('ipc')/100,indexar:ck('indexar'),meiProg:ck('meiProg'),eurosHoy:ck('eurosHoy'),
    modoDias:v('modoDias')||'fijo',
    desc:+v('desc')||0,disc:+v('disc')||0,
    irpf:st.irpf||'tabla',irpfManual:n('irpfManual')/100,
    tSS:n('tipoSS')/100,tEmp:n('tipoEmp')/100,bMin:n('baseMin'),bMax,
    subidas,
    origen:po[0],destino:pd[0],nuclear,dietaDia:pd[1],pctPlus,
    estancias,pausa:pausa?estancias.pausa:null,
    salida:estancias[0].salida,regreso:ult.regreso||estancias[0].regreso,
    diasDef:Math.max(0,Math.min(31,n('diasDef'))),
    anio:Math.round(n('anio'))||new Date().getFullYear(),
  };
}
