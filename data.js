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
const UNLOCK = {"1": "3fbe7deeff1e123edcd2726743db2f8fd9284455c1c1ddb32a36665a9e31f65f", "2": "107acc6ee26dabf7f7b24b52559e67816447f6334fdd51d0121f1ab2cd91644a", "3": "bd6020daa87d207507f8d2c6047f33a3636c3f82b779b42e6a6f84ced8f725ed", "4": "b8fd5e03edfc2f8ab0759151ac4dc63a4dcb5254908cbc8ea7534b4ab20e466a", "5": "064a11ed83d01da3c5a82f536a1ab92c8c9d68020ef54c4e39a62a5e5c8639c4", "6": "ff6a6e60dfdb726e7faf51c954dee0615a8a8dd0c0f8201ce0ce8a0ee0f0c961", "7": "6dbb8f90f693a7330b1897d7a835d2467580618b6f9f09673ba499592c9a9dbd", "8": "89eee31043804c2b96cece16cf998ecbc6a11031235e620ed500227688f5b196", "9": "3b04e525db075ce9dcfaada3f8437b826f09c68106770ddd1451a37bdf0e3ede", "10": "617764ee889174f8f3f3b7bbb84965ef7d7686e74c90cd1bef0eb948983d136a"};
