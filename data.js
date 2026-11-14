// Database dei materiali e dei costi. Fonti: manuale (λ Tab. 4.7, π Tab. 5.2, Rsi/Rse Tab. 4.13-4.14),
// Prezzario Regione FVG 2025 (voci citate), DM 26/06/2015 e DM 28/10/2025 (U limite), EN ISO 10456 (fψ, da ANIT).
const MURATURE = [
  {id:"int_gesso", nome:"Intonaco di calce e gesso", lambda:0.70, pi:18.75},
  {id:"int_calce", nome:"Intonaco di calce o calce-cemento", lambda:0.90, pi:9.38},
  {id:"int_cem", nome:"Intonaco di cemento", lambda:1.40, pi:6.25},
  {id:"lat800", nome:"Laterizio forato alleggerito (ρ 800)", lambda:0.30, pi:37.5},
  {id:"lat1000", nome:"Laterizio forato (ρ 1000)", lambda:0.36, pi:31.25},
  {id:"lat1200", nome:"Laterizio forato (ρ 1200)", lambda:0.43, pi:31.25},
  {id:"lat1400", nome:"Laterizio forato (ρ 1400)", lambda:0.50, pi:26.79},
  {id:"lat1800", nome:"Mattoni pieni (ρ 1800)", lambda:0.72, pi:20.84},
  {id:"argex1000", nome:"Blocchi in cls di argilla espansa (ρ 1000)", lambda:0.31, pi:18.75},
  {id:"cls2200", nome:"Calcestruzzo (ρ 2200)", lambda:1.48, pi:2.68},
  {id:"aria5", nome:"Intercapedine d'aria non ventilata", lambda:0.05/0.18, pi:187.52, nota:"R = 0,18 m²K/W per 5 cm (Tab. 4.14): λ equivalente = s/R"},
];
const ISOLANTI = [
  {id:"eps", nome:"EPS 100", lambda:0.035, pi:2.34, costoCm:1.52, fpsi:4, esterno:[4,6,8,10,12,14,16,18,20], interno:[4,6,8,10], fonte:"FVG 46.2.KN7.10"},
  {id:"lanaroccia", nome:"Lana di roccia", lambda:0.035, pi:187.52, costoCm:3.99, fpsi:4, esterno:[6,8,10,12,14,16,18,20], interno:[6,8,10], fonte:"FVG 46.2.KM1.04"},
  {id:"lanavetro", nome:"Lana di vetro", lambda:0.038, pi:187.53, costoCm:3.10, fpsi:4, esterno:[], interno:[4,5,6,8,10], fonte:"FVG 46.2.KM1.01"},
  {id:"pir", nome:"PIR con rivestimenti impermeabili", lambda:0.022, pi:0.00375, costoCm:3.64, fpsi:6, esterno:[], interno:[2,3,4,5,6,8,10], fonte:"FVG 46.2.KN7.05"},
];
const ACCESSORI = {
  cartongesso:{id:"cartongesso", nome:"Cartongesso (controparete)", lambda:0.21, pi:23.44, s:0.0125},
  rasatura:{id:"rasatura", nome:"Rasatura e finitura del cappotto", lambda:0.90, pi:9.38, s:0.008},
  pe:{id:"pe", nome:"Freno al vapore in PE 0,2 mm", lambda:0.35, pi:0.00375, s:0.0002},
};
const COSTI = {
  posaEsterna:75.00,   // €/m² sistema a cappotto (quota fissa voci FVG 46.2.KN7.10 e 46.2.KM1.04)
  posaInterna:45.46,   // €/m² controparete in cartongesso (FVG 22.3.RR2.04.A)
  freno:4.00,          // €/m² posato (stima didattica)
  ponteggio:19.67,     // €/m² di facciata, 2 mesi (FVG 99.3.AH2.15 A+B)
};
const RSI = 0.13, RSE = 0.04;
const U_LIMITE = {D:0.32, E:0.28, F:0.26};   // DM 28/10/2025 App. B Tab. 1 (pareti, riqualificazione)
const MAGG_INTERNO = 1.30;                   // All. 1 § 1.4.3: +30% con isolamento interno
const TOLL = 0.02;                           // tolleranza verifica dati
const MAX_INVII = 5;
const BORDER_PA = 15;                        // casi al limite nella verifica di condensa
const GIORNI_FREDDO = 30;
const UNLOCK = ["a2934a154dcbc47c0238ccb8271d783df48dd1a611ce159754cd7e2058c4d871", "8d2bb3d0e64205c8af48d315ece27cfb197813693738467d557818b71d7f574a", "ca8f84cfa02d4063a2e0e2b1952b90e1721318b4fbac06864cc3dbb348c7ea00", "b73a7a9c1121efd1c92d0daa3e3941e2a294b050abcde5c9f20618dda2bc67f0", "cb484fe2715ee93202cb436928d247d478b6c46e370949846874accbbc1cf537", "bae060dbe08981245c47b362cedf80c9161df3eae82f3fd373cb43939a57cb8b", "9b998bfa52cca58280c541bd7b0a5d524bf99a4ff5c07dcdb7041320e75949b2", "2cec998625c3f6e8884c9704dd7c7746243c13b204437ee82924935916b68aff", "a0299046d8973e2a1672d3e9a76edc19096adf86a407cedd37e8c21c0b764627", "7425e84b84dbac399df4245d0dc8c6eaeb627ff78c06a197c7d60b30d0c11975"];  // impronte SHA-256 dei codici di sblocco (qualunque codice valido sblocca)
