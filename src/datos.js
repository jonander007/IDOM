"use strict";
/* ============================================================
   DATOS
   ============================================================ */
/* Tabla general de retención, Bizkaia 2026: [hasta, [0,1,2,3,4,5,6+ descendientes]] */
const TABLA=[
[20000,[0,0,0,0,0,0,0]],[20510,[7,5,3,0,0,0,0]],[21300,[8,6,4,1,0,0,0]],
[22150,[9,7,5,2,0,0,0]],[23220,[10,9,7,4,0,0,0]],[24050,[11,10,8,5,1,0,0]],
[25410,[12,11,9,6,3,0,0]],[27440,[13,12,10,7,4,0,0]],[29790,[14,13,11,9,6,2,0]],
[32610,[15,14,13,10,8,4,0]],[36350,[16,15,14,12,9,6,0]],[40670,[17,16,15,13,11,8,0]],
[44560,[18,17,16,15,13,10,2]],[48060,[19,18,17,16,14,12,4]],[52020,[20,19,18,17,15,13,7]],
[56780,[21,20,20,18,17,15,9]],[61820,[22,21,21,20,18,16,11]],[65710,[23,22,22,21,19,18,12]],
[70080,[24,23,23,22,21,19,14]],[75020,[25,25,24,23,22,20,16]],[80730,[26,26,25,24,23,22,17]],
[86770,[27,27,26,25,24,23,19]],[92190,[28,28,27,26,25,24,21]],[98350,[29,29,28,27,27,25,22]],
[105380,[30,30,29,29,28,27,23]],[113180,[31,31,30,30,29,28,25]],[122030,[32,32,31,31,30,29,26]],
[132200,[33,33,32,32,31,30,28]],[144140,[34,34,33,33,32,32,29]],[157300,[35,35,34,34,33,33,31]],
[172280,[36,36,36,35,35,34,32]],[190410,[37,37,37,36,36,35,33]],[212820,[38,38,38,37,37,36,35]],
[236060,[39,39,39,38,38,37,36]],[Infinity,[40,40,40,39,39,39,37]]];

/* Reducciones por discapacidad: [hasta, [apartado 4.a), apartados 4.b) y 4.c)]] */
const DISCAP=[[25410,[9,12]],[32610,[7,12]],[48060,[6,10]],[56780,[5,10]],
[80730,[4,8]],[122030,[3,6]],[190410,[2,5]],[Infinity,[1,3]]];

/* [país, dieta diaria €, % plus del país] */
const PAISES=[
  ["Argelia",29,0.35],["Egipto",32,0.25],
  ["Angola",47,0.35],["Etiopía",30,0.35],["Sudáfrica",30,0.20],["Tanzania",36,0.35],
  ["Canadá",44,0.15],["Estados Unidos",49,0.15],
  ["Estados Unidos - Atlanta",56,0.15],["Estados Unidos - Minneapolis",51,0.15],
  ["México",34,0.25],
  ["Costa Rica",39,0.20],["República Dominicana",36,0.25],["Guatemala",40,0.25],
  ["Honduras",33,0.45],["Nicaragua",30,0.35],["Panamá",38,0.20],
  ["Argentina",41,0.20],["Bolivia",33,0.35],["Brasil",32,0.25],
  ["Brasil - Sao Paulo",37,0.25],["Brasil - Rio de Janeiro",35,0.25],
  ["Chile",37,0.15],["Colombia",27,0.25],["Ecuador",40,0.25],
  ["Perú",34,0.25],["Uruguay",44,0.15],
  ["Arabia Saudita",50,0.25],["Bahréin",42,0.20],
  ["Emiratos Árabes Unidos",48,0.15],["Israel",58,0.20],
  ["Jordania",42,0.20],["Kuwait",39,0.20],["Omán",40,0.20],["Qatar",40,0.15],
  ["China",49,0.30],["Corea del Sur",47,0.15],["Hong Kong",55,0.15],
  ["Japón",43,0.15],["Japón - Tokio",44,0.15],["Macao",49,0.15],
  ["Mongolia",36,0.35],["Taiwán",42,0.15],
  ["Bangladesh",38,0.35],["India",31,0.35],["Irán",89,0.25],
  ["Filipinas",37,0.25],["Laos",31,0.30],["Malasia",32,0.20],["Vietnam",36,0.30],
  ["Kazajistán",26,0.35],
  ["Alemania",44,0.15],["Bélgica",45,0.15],["Dinamarca",54,0.15],
  ["Eslovaquia",40,0.20],["Eslovenia",38,0.20],["España",36,0.15],
  ["Francia",41,0.15],["Francia - París",43,0.15],["Grecia",39,0.15],
  ["Holanda",46,0.15],["Irlanda",42,0.15],["Italia",42,0.15],
  ["Lituania",38,0.20],["Luxemburgo",43,0.15],["Polonia",32,0.15],
  ["Portugal",39,0.15],["Reino Unido",42,0.15],["Reino Unido - Londres",44,0.15],
  ["Suecia",44,0.15],
  ["Federación Rusa",36,0.25],["Federación Rusa - Moscú",36,0.25],
  ["Macedonia",29,0.20],["Turquía",23,0.20],
  ["Australia",40,0.15],["Nueva Zelanda",39,0.15],
];

const MESES=["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
const MESES_L=["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

/* ============================================================
   PARÁMETROS POR AÑO
   ============================================================ */
/* Año de las tablas: retenciones (DF 134/2025) y escala y minoración (NF 13/2013, redacción NF 7/2025) */
const ANIO_BASE=2026;

/* Escala general del IRPF de Bizkaia 2026: [base liquidable hasta, tipo marginal %] */
const ESCALA=[[18080,23],[36160,28],[54240,35],[77450,40],[107260,45],[142960,46],[208390,47],[Infinity,49]];

/* Minoración general de la cuota por declaración (2026) */
const MINORACION=1615;

/* Bonificación de los rendimientos del trabajo (art. 23 NF 13/2013, desde 2025):
   8.000 € hasta 14.800 € de rendimiento neto; de ahí a 23.000 €, 8.000 − 0,6098 × exceso; después, 3.000 € */
const BONIF_TRABAJO={hasta:14800, max:8000, coef:0.6098, tope:23000, min:3000};

/* Exención por trabajos efectivamente realizados en el extranjero (art. 9.17 NF 13/2013): límite anual */
const LIMITE_917=60100;

/* Cuota obrera del MEI (mecanismo de equidad intergeneracional) por año, en %. Sube hasta 2029 */
const MEI_OBRERO={2023:0.10,2024:0.12,2025:0.13,2026:0.15,2027:0.17,2028:0.18,2029:0.20};

