"use strict";
let UID = 0;   // prefissi univoci per gradienti/pattern/marker SVG (evita id duplicati nella pagina)
const $ = id => document.getElementById(id);
const num = v => { if (v === undefined || v === null) return NaN; const s = String(v).trim().replace(",", "."); return s === "" ? NaN : Number(s); };
const fmt = (x, d = 2) => (x === null || x === undefined || !isFinite(x)) ? "—" : x.toLocaleString("it-IT", {minimumFractionDigits: d, maximumFractionDigits: d});
const eur = x => fmt(x, 0) + " €";
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]));

// ---------------- stato ----------------
const PROG_VUOTO = () => ({int: [], est: []});
const NUOVO = () => ({
  v: 4, pagina: 1,
  gruppo: {nomi: ""},
  dati: {loc: "", zona: "", ti: "", te: "", fi: "", fe: "", budget: "", tipo: "R", A: "", B: "", a: "", b: "", h: "", fin: {}, strati: [{id: "", s: ""}, {id: "", s: ""}, {id: "", s: ""}]},
  s1: {ok: false},
  s2: {ok: false, invii: 0, inviiTot: 0, valori: {}},
  s3: {ok: false, calcoli: 0, prog: {int: [{t: "iso", m: "eps", sp: 6}], est: []}, ultimo: null},
  s4: {ok: false},
  s5: {ok: false, risposta: null, strato: null, esito: null},
  s6: {ok: false, prog: null, modifiche: 0},
  s7: {risposte: [], fatto: false},
  sblocchi: {},
});
let S = NUOVO();
const salvaLocale = () => { try { localStorage.setItem("termoigro", JSON.stringify(S)); } catch (e) {} };
const copia = o => JSON.parse(JSON.stringify(o));

// ---------------- dati derivati ----------------
const D = () => {
  const d = S.dati;
  return {
    ...d, ti: num(d.ti), te: num(d.te), fi: num(d.fi), fe: num(d.fe), budget: num(d.budget),
    A: num(d.A), B: num(d.B), a: num(d.a), b: num(d.b), h: num(d.h),
    fin: Object.fromEntries(Object.entries(d.fin).map(([k, arr]) => [k, arr.map(f => ({w: num(f.w), h: num(f.h), porta: f.porta}))])),
  };
};
const stratiIniziali = () => S.dati.strati.filter(r => MURATURE.some(x => x.id === r.id)).map(r => {
  const m = MURATURE.find(x => x.id === r.id);
  return {nome: m.nome, s: num(r.s), lambda: m.lambda, pi: m.pi, tipo: m.id};
});
const nomeFile = () => (S.gruppo.nomi || "progetto").trim().replace(/[^A-Za-z0-9À-ú]+/g, "_").slice(0, 40);
const progV1 = () => (S.s3.ultimo ? S.s3.ultimo.prog : S.s3.prog);
const stratiIsolati = () => Calc.costruisci(stratiIniziali(), progV1());          // versione 1 (sezione 3)
const stratiFinali = () => Calc.costruisci(stratiIniziali(), S.s6.prog || progV1()); // progetto finale (sezione 6)
const valuta = prog => { const d = D(); return Calc.valuta(stratiIniziali(), prog, d, Calc.geometria(d)); };

// ---------------- navigazione ----------------
const SEZ = ["Dati", "Verifica Excel", "Isolamento", "Riepilogo", "Condensa", "Progetto", "Relazione"];
function aggiornaSteps() {
  const done = [S.s1.ok, S.s2.ok, S.s3.ok, S.s4.ok, S.s5.ok, S.s6.ok, S.s7.fatto];
  let cur = done.findIndex(x => !x); if (cur < 0) cur = 6;
  if (!(S.pagina >= 1 && S.pagina <= cur + 1)) S.pagina = cur + 1;
  $("steps").innerHTML = SEZ.map((n, i) => `<a href="#" data-pag="${i + 1}" class="${done[i] ? "done" : ""} ${i + 1 === S.pagina ? "cur" : ""} ${i > cur ? "lock" : ""}">${i + 1}. ${n}</a>`).join("");
  $("steps").querySelectorAll("[data-pag]").forEach(l => l.onclick = e => { e.preventDefault(); vai(+l.dataset.pag); });
  for (let i = 1; i <= 7; i++) { $("s" + i).classList.toggle("locked", i - 1 > cur); $("s" + i).classList.toggle("hidden", i !== S.pagina); }
  renderSblocchi();
}
function vai(n) { S.pagina = n; aggiornaSteps(); salvaLocale(); window.scrollTo(0, 0); }

// se i dati della sezione 1 cambiano dopo la conferma (prima della verifica), va riconfermata
function modificaS1() {
  if (S.s1.ok && !S.s2.ok) {
    S.s1.ok = false; $("s1msg").className = "msg bad";
    $("s1msg").textContent = "Avete modificato i dati: confermateli di nuovo prima della verifica.";
    aggiornaSteps();
  }
}

// ---------------- sezione 1 ----------------
function initS1() {
  const bind = (id, path) => {
    const el = $(id);
    el.addEventListener("input", () => { modificaS1(); const [o, k] = path; S[o][k] = el.value; if (id === "dTipo" || ["dA", "dB", "da", "db", "dH"].includes(id)) { renderFinestre(); disegnaPianta(); } if (id === "dTipo") disegnaSchizzo(); salvaLocale(); });
  };
  bind("gNomi", ["gruppo", "nomi"]);
  [["dLoc", "loc"], ["dZona", "zona"], ["dTi", "ti"], ["dTe", "te"], ["dFi", "fi"], ["dFe", "fe"], ["dBudget", "budget"], ["dTipo", "tipo"], ["dA", "A"], ["dB", "B"], ["da", "a"], ["db", "b"], ["dH", "h"]].forEach(([id, k]) => bind(id, ["dati", k]));
  $("addStrato").onclick = () => { modificaS1(); S.dati.strati.push({id: "", s: ""}); renderStrati(); };
  $("btnS1").onclick = confermaS1;
}
function riempiS1() {
  $("gNomi").value = S.gruppo.nomi; disegnaSchizzo();
  const m = {dLoc: "loc", dZona: "zona", dTi: "ti", dTe: "te", dFi: "fi", dFe: "fe", dBudget: "budget", dTipo: "tipo", dA: "A", dB: "B", da: "a", db: "b", dH: "h"};
  for (const [id, k] of Object.entries(m)) $(id).value = S.dati[k];
  renderFinestre(); renderStrati(); disegnaPianta();
  bloccaS1(S.s2.ok);
}
function bloccaS1(on) {
  $("s1").querySelectorAll("input,select,button").forEach(el => el.disabled = on);
  if (on) $("s1msg").textContent = "Dati confermati e verificati: non più modificabili.";
}
function renderFinestre() {
  const d = D();
  document.querySelectorAll(".lu").forEach(el => el.classList.toggle("hidden", S.dati.tipo === "R"));
  if (!(d.A > 0 && d.B > 0)) { $("finestre").innerHTML = `<p class="msg">Inserite le misure della pianta.</p>`; return; }
  const pareti = Calc.pareti(d);
  $("finestre").innerHTML = pareti.map(p => {
    const arr = S.dati.fin[p.nome] || [];
    return `<div class="wall"><div class="head"><span>${p.nome} · ${isFinite(p.L) ? fmt(p.L, 2) + " m" : "—"}</span>
      <span><button class="ghost small" data-add="${p.nome}" data-porta="0">+ finestra</button> <button class="ghost small" data-add="${p.nome}" data-porta="1">+ porta</button></span></div>
      ${arr.map((f, i) => `<div class="fin"><label>${f.porta ? "Porta" : "Finestra"} largh. [m]<input class="num" data-w="${p.nome}|${i}" value="${esc(f.w)}"></label>
      <label>alt. [m]<input class="num" data-h="${p.nome}|${i}" value="${esc(f.h)}"></label><span class="msg">${isFinite(num(f.w) * num(f.h)) ? fmt(num(f.w) * num(f.h), 2) + " m²" : ""}</span>
      <button class="x" data-del="${p.nome}|${i}" title="Elimina">✕</button></div>`).join("")}</div>`;
  }).join("");
  $("finestre").querySelectorAll("[data-add]").forEach(b => b.onclick = () => { const k = b.dataset.add; modificaS1(); (S.dati.fin[k] = S.dati.fin[k] || []).push({w: "", h: "", porta: b.dataset.porta === "1"}); renderFinestre(); });
  $("finestre").querySelectorAll("[data-del]").forEach(b => b.onclick = () => { modificaS1(); const [k, i] = b.dataset.del.split("|"); S.dati.fin[k].splice(+i, 1); renderFinestre(); disegnaPianta(); });
  $("finestre").querySelectorAll("[data-w],[data-h]").forEach(inp => inp.oninput = () => {
    const key = inp.dataset.w ? "w" : "h"; const [k, i] = (inp.dataset.w || inp.dataset.h).split("|");
    modificaS1(); const f = S.dati.fin[k][+i]; f[key] = inp.value; salvaLocale(); disegnaPianta();
    const a = num(f.w) * num(f.h); inp.closest(".fin").querySelector(".msg").textContent = isFinite(a) ? fmt(a, 2) + " m²" : "";
  });
}
function renderStrati() {
  $("strati").innerHTML = S.dati.strati.map((r, i) => `<div class="strato"><b>${i + 1}</b>
    <select data-mat="${i}"><option value="" ${r.id ? "" : "selected"}>— nessun materiale —</option>${MURATURE.map(m => `<option value="${m.id}" ${m.id === r.id ? "selected" : ""}>${m.nome}</option>`).join("")}</select>
    <label style="margin:0">s [m]<input class="num" data-s="${i}" value="${esc(r.s)}"></label>
    <button class="x" data-dels="${i}" title="Elimina">✕</button></div>`).join("");
  $("strati").querySelectorAll("[data-mat]").forEach(el => el.onchange = () => { modificaS1(); S.dati.strati[+el.dataset.mat].id = el.value; disegnaStratoIniz(); salvaLocale(); });
  $("strati").querySelectorAll("[data-s]").forEach(el => el.oninput = () => { modificaS1(); S.dati.strati[+el.dataset.s].s = el.value; disegnaStratoIniz(); salvaLocale(); });
  $("strati").querySelectorAll("[data-dels]").forEach(el => el.onclick = () => { modificaS1(); S.dati.strati.splice(+el.dataset.dels, 1); renderStrati(); });
  disegnaStratoIniz();
}
function disegnaStratoIniz() {
  const L = stratiIniziali();
  $("svgStratoIniz").innerHTML = L.length && L.every(l => l.s > 0) ? svgStrato(L, {titolo: "Stratigrafia iniziale"}) : "";
}
function validaS1() {
  const d = D(), err = [];
  if (!S.gruppo.nomi.trim()) err.push("nome del progettista");
  if (!d.loc || !d.zona) err.push("località e zona");
  for (const k of ["ti", "te", "fi", "fe", "budget", "A", "B", "h"]) if (!isFinite(d[k])) err.push(k);
  if (d.tipo !== "R" && !(d.a > 0 && d.b > 0 && d.a < d.A && d.b < d.B)) err.push("a e b (devono essere minori di A e B)");
  if (!(d.fi > 0 && d.fi < 100 && d.fe > 0 && d.fe <= 100)) err.push("umidità relative tra 0 e 100");
  if (!S.dati.strati.length || S.dati.strati.some(r => !r.id)) err.push("materiale di ogni strato (togliete le righe vuote)");
  if (S.dati.strati.some(r => !(num(r.s) > 0))) err.push("spessori degli strati");
  if (S.dati.strati.some(r => num(r.s) > 1)) err.push("spessori in metri (uno strato supera 1 m: avete convertito i millimetri?)");
  if (d.A > 0 && d.B > 0) for (const p of Calc.pareti(d)) for (const f of (d.fin[p.nome] || [])) if (!(f.w > 0 && f.h > 0)) err.push("misure di finestre e porte");
  return [...new Set(err)];
}
function confermaS1() {
  const err = validaS1();
  if (err.length) { $("s1msg").className = "msg bad"; $("s1msg").textContent = "Controllate: " + err.join(", ") + "."; return; }
  // tolgo le aperture di pareti che non esistono nella pianta scelta (resti di prove con un altro tipo di pianta)
  const nomi = Calc.pareti(D()).map(p => p.nome); for (const k of Object.keys(S.dati.fin)) if (!nomi.includes(k)) delete S.dati.fin[k];
  S.s1.ok = true; $("s1msg").className = "msg good"; $("s1msg").textContent = "Dati confermati.";
  renderS2(); vai(2);
}

// ---------------- disegni ----------------
// schizzo generico quotato della pianta (non in scala)
function disegnaSchizzo() { $("svgSchizzo").innerHTML = svgSchizzo(S.dati.tipo); }
function svgSchizzo(tipo) {
  const mk = "q" + (++UID), x0 = 50, y0 = 40, W = 220, H = 150, a = 90, b = 60;
  let pts;
  if (tipo === "R") pts = [[0, 0], [W, 0], [W, H], [0, H]];
  else if (tipo === "L") pts = [[0, 0], [W - a, 0], [W - a, b], [W, b], [W, H], [0, H]];
  else { const c = (W - a) / 2; pts = [[0, 0], [c, 0], [c, b], [c + a, b], [c + a, 0], [W, 0], [W, H], [0, H]]; }
  const P = p => `${x0 + p[0]},${y0 + p[1]}`;
  const quota = (x1, y1, x2, y2, t, dx, dy) => {
    const X1 = x0 + x1 + dx, Y1 = y0 + y1 + dy, X2 = x0 + x2 + dx, Y2 = y0 + y2 + dy;
    return `<line x1="${X1}" y1="${Y1}" x2="${X2}" y2="${Y2}" stroke="#b3261e" marker-start="url(#${mk})" marker-end="url(#${mk})"/>
      <line x1="${x0 + x1}" y1="${y0 + y1}" x2="${X1}" y2="${Y1}" stroke="#b3261e" stroke-width=".6"/><line x1="${x0 + x2}" y1="${y0 + y2}" x2="${X2}" y2="${Y2}" stroke="#b3261e" stroke-width=".6"/>
      <text x="${(X1 + X2) / 2 + (dx ? (dx > 0 ? 8 : -8) : 0)}" y="${(Y1 + Y2) / 2 + (dy ? (dy > 0 ? 16 : -6) : 4)}" text-anchor="${dx > 0 ? "start" : dx < 0 ? "end" : "middle"}" font-size="15" font-weight="700" fill="#b3261e">${t}</text>`;
  };
  let q = quota(0, H, W, H, "A", 0, 28) + quota(0, 0, 0, H, "B", -26, 0);
  if (tipo === "L") q += quota(W - a, 0, W, 0, "a", 0, -22) + quota(W, 0, W, b, "b", 26, 0);
  if (tipo === "U") { const c = (W - a) / 2; q += quota(c, 0, c + a, 0, "a", 0, -22) + quota(c + a, 0, c + a, b, "b", 22, 0); }
  return `<svg viewBox="0 0 340 250" xmlns="http://www.w3.org/2000/svg" font-family="Segoe UI, Arial, sans-serif">
    <defs><marker id="${mk}" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 2L5 5L0 8" fill="none" stroke="#b3261e"/></marker></defs>
    <rect width="100%" height="100%" fill="#fff"/>
    <polygon points="${pts.map(P).join(" ")}" fill="#eef4f3" stroke="#1d2327" stroke-width="2.5"/>${q}
    <g transform="translate(318,170)"><line x1="0" y1="14" x2="0" y2="-10" stroke="#1d2327" stroke-width="2"/><path d="M-5 -4 L0 -14 L5 -4z" fill="#1d2327"/><text x="0" y="28" text-anchor="middle" font-size="12">N</text></g>
    <text x="10" y="244" font-size="11" fill="#5d6a72">Schema quotato (non in scala): inserite A, B${tipo === "R" ? "" : ", a, b"} e l'altezza h</text></svg>`;
}

function disegnaPianta() { const d = D(); $("svgPianta").innerHTML = (d.A > 0 && d.B > 0) ? svgPianta(d) : ""; }
function svgPianta(d) {
  const W = 540, H = 380, m = 84;
  const sc = Math.min((W - 2 * m) / d.A, (H - 2 * m) / d.B);
  const X = x => m + x * sc, Y = y => m + y * sc;   // y verso il basso = sud
  let pts;
  if (d.tipo === "R") pts = [[0, 0], [d.A, 0], [d.A, d.B], [0, d.B]];
  else if (d.tipo === "L") pts = [[0, 0], [d.A - d.a, 0], [d.A - d.a, d.b], [d.A, d.b], [d.A, d.B], [0, d.B]];
  else { const c = (d.A - d.a) / 2; pts = [[0, 0], [c, 0], [c, d.b], [c + d.a, d.b], [c + d.a, 0], [d.A, 0], [d.A, d.B], [0, d.B]]; }
  // nome di ogni lato (stessa convenzione di Calc.pareti)
  const nomi = {R: ["N1", "E1", "S1", "O1"], L: ["N1", "E1", "N2", "E2", "S1", "O1"], U: ["N1", "E2", "N3", "O2", "N2", "E1", "S1", "O1"]}[d.tipo];
  const fin = d.fin || {};
  let lati = "";
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length]; const n = nomi[i];
    const mx = (X(p[0]) + X(q[0])) / 2, my = (Y(p[1]) + Y(q[1])) / 2;
    const L = Math.hypot(q[0] - p[0], q[1] - p[1]);
    const dx = (q[0] - p[0]) / L, dy = (q[1] - p[1]) / L; const nx = dy, ny = -dx; // normale esterna (giro orario)
    const nf = (fin[n] || []).length;
    const vert = Math.abs(nx) > 0.5, anc = nx > 0.5 ? "start" : nx < -0.5 ? "end" : "middle", gap = vert ? 10 : 22;
    const ty = vert ? my - 22 : my + ny * gap + (ny > 0 ? 6 : -10);
    const r2 = `${fmt(L, 2)} m`, r3 = nf ? `${nf} apert.` : "";
    lati += `<text x="${mx + nx * gap}" y="${ty}" text-anchor="${anc}" font-size="12" font-weight="600" fill="#0b6e69">${n}</text>`;
    lati += vert ? `<text x="${mx + nx * gap}" y="${ty + 13}" text-anchor="${anc}" font-size="10.5" fill="#5d6a72">${r2}</text><text x="${mx + nx * gap}" y="${ty + 25}" text-anchor="${anc}" font-size="10.5" fill="#5d6a72">${r3}</text>`
                 : `<text x="${mx + nx * gap}" y="${ty + 13}" text-anchor="${anc}" font-size="10.5" fill="#5d6a72">${r2}${r3 ? " · " + r3 : ""}</text>`;
    // aperture: segmenti chiari centrati sul lato
    const tot = (fin[n] || []).reduce((s, f) => s + (f.w || 0), 0);
    let off = (L - tot) / (nf + 1);
    let pos = off;
    for (const f of (fin[n] || [])) {
      if (!(f.w > 0)) continue;
      const x1 = X(p[0] + dx * pos), y1 = Y(p[1] + dy * pos), x2 = X(p[0] + dx * (pos + f.w)), y2 = Y(p[1] + dy * (pos + f.w));
      lati += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${f.porta ? "#b35c00" : "#2f80c9"}" stroke-width="6"/>`;
      pos += f.w + off;
    }
  });
  return `<svg viewBox="0 0 ${W} ${H + 30}" xmlns="http://www.w3.org/2000/svg" font-family="Segoe UI, Arial, sans-serif">
    <rect width="100%" height="100%" fill="#fff"/>
    <polygon points="${pts.map(p => X(p[0]) + "," + Y(p[1])).join(" ")}" fill="#eef4f3" stroke="#1d2327" stroke-width="3"/>
    ${lati}
    <g transform="translate(${W - 26},28)"><line x1="0" y1="14" x2="0" y2="-10" stroke="#1d2327" stroke-width="2"/><path d="M-5 -4 L0 -14 L5 -4z" fill="#1d2327"/><text x="0" y="28" text-anchor="middle" font-size="12">N</text></g>
    <text x="${m}" y="${H + 20}" font-size="11" fill="#5d6a72">Tipo ${d.tipo === "R" ? "rettangolare" : d.tipo === "L" ? "a L" : "a U"} · h = ${fmt(d.h, 2)} m · blu = finestre, arancio = porte</text>
  </svg>`;
}
const COLORI = {int_gesso: "#e8e4dc", int_calce: "#d9d4ca", int_cem: "#c9c5bd", lat800: "#d98c6a", lat1000: "#d27f5c", lat1200: "#c97352", lat1400: "#bf6747", lat1800: "#a9503a", argex1000: "#b8b2a6", cls2200: "#9a9a96", aria5: "#ffffff", iso: "#f3d36b", cartongesso: "#f1f1ee", rasatura: "#d9d4ca", pe: "#3b4a54"};
function colore(l) {
  if (l.tipo === "iso") return COLORI.iso;
  if (l.nome.startsWith("Cartongesso")) return COLORI.cartongesso;
  if (l.nome.startsWith("Freno")) return COLORI.pe;
  if (l.nome.startsWith("Rasatura")) return COLORI.rasatura;
  return COLORI[l.tipo] || "#ccc";
}
// stratigrafia orizzontale: interno a sinistra
function svgStrato(L, o = {}) {
  const W = 680, x0 = 70, x1 = W - 70, h0 = 34, hh = 150, minW = o.click ? 16 : 5;
  const tot = L.reduce((s, l) => s + l.s, 0);
  let w = L.map(l => Math.max(minW, l.s / tot * (x1 - x0)));
  const k = (x1 - x0) / w.reduce((a, b) => a + b, 0); w = w.map(v => v * k);
  let x = x0, rects = "";
  L.forEach((l, i) => {
    const sel = o.sel === i + 1;
    rects += `<g class="${o.click ? "layer" : ""}" data-strato="${i + 1}">
      <rect x="${x}" y="${h0}" width="${w[i]}" height="${hh}" fill="${colore(l)}" stroke="${sel ? "#b3261e" : "#1d2327"}" stroke-width="${sel ? 4 : 1}"/>
      ${l.tipo === "iso" ? `<path d="M${x} ${h0 + 10} ${Array.from({length: 7}, (_, j) => `Q${x + w[i] * (j % 2 ? 0.1 : 0.9)} ${h0 + 10 + j * 19 + 10} ${x + w[i] / 2} ${h0 + 10 + (j + 1) * 19}`).join(" ")}" fill="none" stroke="#b8963a" stroke-width="1"/>` : ""}
      <text x="${x + w[i] / 2}" y="${h0 + hh + 18}" text-anchor="middle" font-size="12" font-weight="700" fill="${sel ? "#b3261e" : "#1d2327"}">${i + 1}</text></g>`;
    x += w[i];
  });
  const leg = L.map((l, i) => `<text x="${x0}" y="${h0 + hh + 46 + i * 17}" font-size="12" fill="#1d2327">${i + 1}. ${esc(l.nome)} — ${fmt(l.s * 1000, Math.abs(l.s * 1000 - Math.round(l.s * 1000)) > 1e-6 ? 1 : 0)} mm</text>`).join("");
  const Hh = h0 + hh + 46 + L.length * 17;
  return `<svg viewBox="0 0 ${W} ${Hh}" xmlns="http://www.w3.org/2000/svg" font-family="Segoe UI, Arial, sans-serif">
    <rect width="100%" height="100%" fill="#fff"/>
    <text x="${x0}" y="20" font-size="14" font-weight="600" fill="#1d2327">${esc(o.titolo || "Stratigrafia")} · spessore totale ${fmt(tot * 1000, 0)} mm</text>
    <text x="${x0 - 8}" y="${h0 + hh / 2}" text-anchor="end" font-size="12" fill="#b3261e">INTERNO</text>
    <text x="${x1 + 8}" y="${h0 + hh / 2}" font-size="12" fill="#2f80c9">ESTERNO</text>
    ${rects}${leg}</svg>`;
}

// ---------------- sezione 2 ----------------
function renderS2() {
  const L = stratiIniziali();
  $("tabMateriali").innerHTML = `<table><tr><th>N.</th><th>Strato</th><th class="r">s [m]</th><th class="r">λ [W/(m·K)]</th><th class="r">π·10¹² [kg/(m·s·Pa)]</th></tr>
    ${L.map((l, i) => `<tr><td>${i + 1}</td><td>${esc(l.nome)}</td><td class="r">${fmt(l.s, 4)}</td><td class="r">${fmt(l.lambda, 3)}</td><td class="r">${fmt(l.pi, 2)}</td></tr>`).join("")}
    <tr><td></td><td>Rsi (parete, flusso orizzontale)</td><td colspan="3" class="r">${fmt(RSI, 2)} m²K/W</td></tr>
    <tr><td></td><td>Rse</td><td colspan="3" class="r">${fmt(RSE, 2)} m²K/W</td></tr></table>
    <p class="msg">λ e π dal manuale (Tab. 4.7 e 5.2); Rsi e Rse Tab. 4.13.${L.some(l => l.tipo === "aria5") ? " Intercapedine: λ equivalente = 0,05/0,18 (R = 0,18 m²K/W per 5 cm, Tab. 4.14)." : ""}</p>`;
  for (const k of ["Ag", "Af", "An", "U", "Phi"]) $("v" + k).value = S.s2.valori[k] ?? "";
  const bloccato = S.s2.invii >= MAX_INVII && !S.s2.ok;
  $("btnS2").disabled = bloccato || S.s2.ok;
  $("s2msg").className = "msg" + (bloccato ? " bad" : "");
  $("s2msg").textContent = S.s2.ok ? "Verifica superata." : bloccato ? "5 invii con errori: chiedete al docente lo sblocco (in fondo alla pagina)." : `Invii con errori: ${S.s2.invii} su ${MAX_INVII}.`;
  $("s2dati").classList.toggle("hidden", S.s2.ok || S.s2.invii === 0);
  if (!S.s2.ok && S.s2.invii > 0) $("s2dati").innerHTML = riepilogoDatiS1();
  if (S.s2.ok) mostraEsitoS2();
}
function attesiS2() {
  const d = D(), geo = Calc.geometria(d), g = Calc.glaser(stratiIniziali(), d.ti, d.fi, d.te, d.fe);
  return {geo, g, Ag: geo.Ag, Af: geo.Af, An: geo.An, U: g.U, Phi: g.U * geo.An * (d.ti - d.te)};
}
function inviaS2() {
  const att = attesiS2(); let tutti = true;
  for (const k of ["Ag", "Af", "An", "U", "Phi"]) {
    let v = num($("v" + k).value); S.s2.valori[k] = $("v" + k).value; if (k === "Phi") v = Math.abs(v);
    const ok = isFinite(v) && Math.abs(v - att[k]) <= TOLL * Math.abs(att[k]) + (att[k] === 0 ? 0.01 : 0);
    $("ck" + k).textContent = ok ? "✓" : "✗"; $("ck" + k).className = "ck " + (ok ? "ok" : "no");
    tutti = tutti && ok;
  }
  S.s2.inviiTot++;
  if (tutti) { S.s2.ok = true; bloccaS1(true); mostraEsitoS2(); initS3(); }
  else S.s2.invii++;
  renderS2(); aggiornaSteps(); salvaLocale();
}
// dati di ingresso che il sito sta usando (non i risultati): servono a trovare errori di battitura o aperture in più
function riepilogoDatiS1() {
  const d = D(), pareti = Calc.pareti(d);
  return `<div class="notice warn"><strong>Controllate i dati che il sito sta usando</strong> (sezione 1): se qualcosa non corrisponde alla scheda, tornate alla sezione 1, correggete e confermate di nuovo.
    <table><tr><th>Parete</th><th class="r">Lunghezza [m]</th><th>Aperture (largh. × alt., m)</th></tr>
    ${pareti.map(p => `<tr><td>${p.nome}</td><td class="r">${fmt(p.L, 2)}</td><td>${(d.fin[p.nome] || []).map(f => `${f.porta ? "porta" : "finestra"} ${fmt(f.w, 2)} × ${fmt(f.h, 2)}`).join("; ") || "—"}</td></tr>`).join("")}</table>
    <p>Altezza h = ${fmt(d.h, 2)} m · t_i = ${fmt(d.ti, 1)} °C · t_e = ${fmt(d.te, 1)} °C · strati: ${stratiIniziali().map(l => `${esc(l.nome)} ${fmt(l.s, 3)} m`).join(" / ")}</p></div>`;
}
function mostraEsitoS2() {
  const d = D(), att = attesiS2(), lim = U_LIMITE[d.zona];
  $("s2esito").classList.remove("hidden");
  $("s2esito").innerHTML = `<div class="notice good"><strong>Calcoli corretti.</strong> Da qui budget e obiettivo restano fissi.</div>
    <div class="kpi"><div><span>U iniziale</span><b>${fmt(att.U, 3)}</b><span>W/(m²K)</span></div>
    <div><span>Φ iniziale</span><b>${fmt(att.Phi, 0)} W</b><span>con Δt = ${fmt(d.ti - d.te, 0)} °C</span></div>
    <div><span>Obiettivo: U limite zona ${d.zona}</span><b>≤ ${fmt(lim, 2)}</b><span>${fmt(lim * MAGG_INTERNO, 3)} se l'isolamento è solo interno</span></div>
    <div><span>Budget</span><b>${eur(d.budget)}</b><span>dalla scheda</span></div></div>
    <div class="actions"><button class="primary" onclick="vai(3)">Avanti: isolamento →</button></div>`;
}

function barra(titolo, val, max, segni, colore, testo, sx, dx, nota) {
  const p = v => Math.max(0, Math.min(100, v / max * 100));
  return `<div class="bar"><div class="lbl"><span><b>${titolo}</b></span><span>${testo}</span></div><div class="track">
    <div class="fill" style="width:${p(val)}%;background:${colore}"></div>
    ${segni.map(s => `<div class="mark" style="left:${p(s.v)}%"></div><div class="marklbl" style="left:${p(s.v)}%">${s.t}</div>`).join("")}</div>
    <div class="lbl" style="margin-top:20px"><span>${sx}</span><span>${dx}</span></div><div class="msg">${nota}</div></div>`;
}

function xlsParete() {
  const d = D(), L = stratiIsolati(), geo = Calc.geometria(d);
  const rows = [["Progettista", S.gruppo.nomi], ["Località", d.loc, "Zona", d.zona], [],
    ["Dati geometrici"], ["Perimetro P [m]", +geo.P.toFixed(2)], ["Altezza h [m]", d.h], ["Area lorda delle pareti [m²]", +geo.Ag.toFixed(2)],
    ["Area di finestre e porte [m²]", +geo.Af.toFixed(2)], ["Area netta disperdente [m²]", +geo.An.toFixed(2)], [],
    ["Voce", "s [m]", "s cumulato [m]", "λ [W/(m·K)]", "π·10¹² [kg/(m·s·Pa)]", "R [m²K/W]", "R_v [m·s·Pa/kg]", "T [°C]", "φ [%]"]];
  const rAn = 9, rHead = rows.length;                         // numeri di riga Excel (1-based): A netta = 9
  const rTi = rHead + 1, rRsi = rHead + 2, r1 = rHead + 3, rN = r1 + L.length - 1, rRse = rN + 1, rTe = rN + 2;
  rows.push(["Aria interna", "", "", "", "", "", "", d.ti, d.fi]);
  rows.push(["Resistenza superficiale interna Rsi", "", 0, "", "", RSI, "", "", ""]);
  L.forEach((l, i) => rows.push([`${i + 1}. ${l.nome}`, +l.s.toFixed(4), {f: `C${rRsi + i}+B${r1 + i}`}, +l.lambda.toFixed(4), l.pi, "", "", "", ""]));
  rows.push(["Resistenza superficiale esterna Rse", "", "", "", "", RSE, "", "", ""]);
  rows.push(["Aria esterna", "", "", "", "", "", "", d.te, d.fe]);
  rows.push([]);
  const rTot = rows.length + 1;
  rows.push(["R totale R_t [m²K/W] (somma colonna R da Rsi a Rse)", "", "", "", "", {f: `SUM(F${rRsi}:F${rRse})`}]);
  rows.push(["R_v totale [m·s·Pa/kg] (somma colonna R_v degli strati)", "", "", "", "", "", {f: `SUM(G${r1}:G${rN})`}]);
  rows.push(["Trasmittanza U = 1/R_t [W/(m²K)]", "", "", "", "", {f: `IFERROR(1/F${rTot},"")`}]);
  rows.push(["Permeanza Π = 1/R_v [kg/(m²·s·Pa)]", "", "", "", "", "", {f: `IFERROR(1/G${rTot + 1},"")`}]);
  rows.push(["Potenza dispersa Φ = U · A_netta · (t_e − t_i) [W]", "", "", "", "", {f: `IFERROR(F${rTot + 2}*B${rAn}*(H${rTe}-H${rTi}),"")`}]);
  rows.push([]);
  rows.push(["Note"]);
  rows.push(["Pressione di saturazione (T = cella della temperatura):", "=SE(T>=0;610,5*EXP(17,269*T/(237,3+T));610,5*EXP(21,875*T/(265,5+T)))"]);
  rows.push(["Pressione parziale: p_v,i = φ_i/100 · p_s(t_i); p_v,k = p_v,k−1 − R_v,k/R_v · (p_v,i − p_v,e)"]);
  const wb = XLSX.utils.book_new(), ws = XLSX.utils.aoa_to_sheet(rows.map(r => r.map(c => c && c.f ? null : c)));
  rows.forEach((r, i) => r.forEach((c, j) => { if (c && c.f) ws[XLSX.utils.encode_cell({r: i, c: j})] = {t: "n", f: c.f}; }));
  ws["!cols"] = [{wch: 52}, {wch: 10}, {wch: 14}, {wch: 12}, {wch: 20}, {wch: 12}, {wch: 16}, {wch: 9}, {wch: 8}];
  XLSX.utils.book_append_sheet(wb, ws, "Parete isolata");
  const r = S.s3.ultimo;
  const ws2 = XLSX.utils.aoa_to_sheet([["Voce", "Quantità", "Unità", "€/unità", "Totale €"], ...r.voci.map(v => [v.voce, +v.q.toFixed(2), v.u, +v.pu.toFixed(2), +v.tot.toFixed(2)]), ["Totale", "", "", "", +r.costo.toFixed(2)]]);
  ws2["!cols"] = [{wch: 70}, {wch: 10}, {wch: 6}, {wch: 10}, {wch: 12}];
  XLSX.utils.book_append_sheet(wb, ws2, "Preventivo");
  XLSX.writeFile(wb, `${nomeFile()}_parete_isolata.xlsx`);
}
function scaricaPNG(svgStr, nome) {
  const img = new Image(), url = URL.createObjectURL(new Blob([svgStr], {type: "image/svg+xml"}));
  img.onload = () => {
    const vb = svgStr.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/), w = +vb[1] * 2, h = +vb[2] * 2;
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h); ctx.drawImage(img, 0, 0, w, h);
    c.toBlob(b => { const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = nome; a.click(); });
    URL.revokeObjectURL(url);
  };
  img.src = url;
}

function tabNodi(L, g) {
  return `<table><tr><th>Nodo</th><th>Posizione</th><th class="r">x [cm]</th><th class="r">t [°C]</th><th class="r">p_s [Pa]</th><th class="r">p_v [Pa]</th><th class="r">p_s − p_v [Pa]</th></tr>
  ${g.t.map((t, k) => `<tr class="${g.d[k] <= 0 ? "hl" : ""}"><td>${k}</td><td>${k === 0 ? "superficie interna" : k === L.length ? "superficie esterna" : `tra strato ${k} e ${k + 1}`}</td><td class="r">${fmt(g.x[k] * 100, 1)}</td><td class="r">${fmt(t, 2)}</td><td class="r">${fmt(g.ps[k], 0)}</td><td class="r">${fmt(g.pv[k], 0)}</td><td class="r">${fmt(g.d[k], 0)}</td></tr>`).join("")}</table>`;
}
// segmenti [x1,x2] (m) con p_v ≥ p_s, interpolando dentro gli strati
function zoneCondensa(g) {
  const z = [];
  for (let k = 1; k < g.x.length; k++) {
    const a = g.d[k - 1], b = g.d[k], xa = g.x[k - 1], xb = g.x[k];
    if (a > 0 && b > 0) continue;
    const xs = a <= 0 ? xa : xa + (xb - xa) * a / (a - b), xe = b <= 0 ? xb : xa + (xb - xa) * a / (a - b);
    if (z.length && Math.abs(z[z.length - 1][1] - xs) < 1e-9) z[z.length - 1][1] = xe; else z.push([xs, xe]);
  }
  return z;
}
function svgGlaser(L, g, sottotitolo) {
  const W = 760, H = 380, ml = 64, mr = 60, mt = 50, mb = 50, pw = W - ml - mr, ph = H - mt - mb;
  const xt = g.x[g.x.length - 1], pmax = Math.ceil(Math.max(...g.ps, g.pvi) / 500) * 500;
  const tmin = Math.floor(Math.min(g.te, ...g.t) / 5) * 5, tmax = Math.ceil(g.ti / 5) * 5;
  const X = x => ml + x / xt * pw, Yp = p => mt + ph - p / pmax * ph, Yt = t => mt + ph - (t - tmin) / (tmax - tmin) * ph;
  let s = "";
  for (let p = 0; p <= pmax; p += 500) s += `<line x1="${ml}" x2="${ml + pw}" y1="${Yp(p)}" y2="${Yp(p)}" stroke="#e3e7e8"/><text x="${ml - 6}" y="${Yp(p) + 4}" text-anchor="end" font-size="11" fill="#5d6a72">${p}</text>`;
  const passo = xt * 100 > 30 ? 5 : 2;
  for (let c = 0; c <= xt * 100 + 1e-9; c += passo) s += `<line x1="${X(c / 100)}" x2="${X(c / 100)}" y1="${mt + ph}" y2="${mt + ph + 5}" stroke="#1d2327"/><text x="${X(c / 100)}" y="${mt + ph + 18}" text-anchor="middle" font-size="11" fill="#5d6a72">${c}</text>`;
  for (let t = tmin; t <= tmax; t += 5) s += `<text x="${ml + pw + 6}" y="${Yt(t) + 4}" font-size="11" fill="#2e7d32">${t}</text>`;
  for (const [a, b] of zoneCondensa(g)) s += `<rect x="${X(a)}" y="${mt}" width="${Math.max(2, X(b) - X(a))}" height="${ph}" fill="#2f80c9" fill-opacity=".15"/>`;
  g.x.forEach((x, k) => { s += `<line x1="${X(x)}" x2="${X(x)}" y1="${mt}" y2="${mt + ph}" stroke="#9aa5ab" stroke-dasharray="${k === 0 || k === g.x.length - 1 ? "" : "3 3"}"/>`; });
  L.forEach((l, i) => { const xm = (g.x[i] + g.x[i + 1]) / 2; if (X(g.x[i + 1]) - X(g.x[i]) > 9) s += `<text x="${X(xm)}" y="${mt - 6}" text-anchor="middle" font-size="11" font-weight="700" fill="#1d2327">${i + 1}</text>`; });
  const line = (arr, Y, col, dash) => `<polyline points="${arr.map((v, k) => X(g.x[k]) + "," + Y(v)).join(" ")}" fill="none" stroke="${col}" stroke-width="2.4" ${dash ? `stroke-dasharray="6 4"` : ""}/>` + arr.map((v, k) => `<circle cx="${X(g.x[k])}" cy="${Y(v)}" r="3" fill="${col}"/>`).join("");
  s += line(g.ps, Yp, "#1f5fa8") + line(g.pv, Yp, "#c62828") + line(g.t, Yt, "#2e7d32", true);
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" font-family="Segoe UI, Arial, sans-serif"><rect width="100%" height="100%" fill="#fff"/>
    <text x="${ml}" y="18" font-size="14" font-weight="600" fill="#1d2327">Diagramma di Glaser · ${zoneCondensa(g).length ? "zona azzurra: p_v ≥ p_s, condensa" : "nessuna condensa"}</text>
    <text x="${ml}" y="34" font-size="11" fill="#5d6a72">${sottotitolo}</text>
    ${s}<line x1="${ml}" x2="${ml + pw}" y1="${mt + ph}" y2="${mt + ph}" stroke="#1d2327"/>
    <text x="${ml + pw / 2}" y="${H - 8}" text-anchor="middle" font-size="12" fill="#1d2327">spessore dalla faccia interna [cm] (0 – ${fmt(xt * 100, 1)})</text>
    <text transform="translate(16 ${mt + ph / 2}) rotate(-90)" text-anchor="middle" font-size="12" fill="#1d2327">pressione [Pa]</text>
    <text transform="translate(${W - 12} ${mt + ph / 2}) rotate(90)" text-anchor="middle" font-size="12" fill="#2e7d32">temperatura [°C]</text>
    <g font-size="12"><line x1="${ml + pw - 250}" x2="${ml + pw - 230}" y1="${mt + 14}" y2="${mt + 14}" stroke="#1f5fa8" stroke-width="2.4"/><text x="${ml + pw - 226}" y="${mt + 18}">p_s</text>
    <line x1="${ml + pw - 185}" x2="${ml + pw - 165}" y1="${mt + 14}" y2="${mt + 14}" stroke="#c62828" stroke-width="2.4"/><text x="${ml + pw - 161}" y="${mt + 18}">p_v</text>
    <line x1="${ml + pw - 120}" x2="${ml + pw - 100}" y1="${mt + 14}" y2="${mt + 14}" stroke="#2e7d32" stroke-width="2.4" stroke-dasharray="6 4"/><text x="${ml + pw - 96}" y="${mt + 18}">t (asse dx)</text></g></svg>`;
}
// colore da t (blu freddo → rosso caldo)
function tCol(t, tmin, tmax) {
  const f = Math.max(0, Math.min(1, (t - tmin) / (tmax - tmin)));
  const stops = [[0, [43, 45, 120]], [0.25, [40, 110, 200]], [0.5, [60, 180, 120]], [0.75, [240, 200, 40]], [1, [210, 50, 40]]];
  let i = 0; while (i < stops.length - 2 && f > stops[i + 1][0]) i++;
  const [f0, c0] = stops[i], [f1, c1] = stops[i + 1], u = (f - f0) / (f1 - f0);
  return `rgb(${c0.map((c, j) => Math.round(c + (c1[j] - c) * u)).join(",")})`;
}
function pannelloTermo(L, g, ox, titolo, info, tmin, tmax, id, bagnato) {
  const pw = 230, y0 = 70, hh = 200, tot = g.x[g.x.length - 1];
  const minW = 4; let w = L.map(l => Math.max(minW, l.s / tot * pw)); const k = pw / w.reduce((a, b) => a + b, 0); w = w.map(v => v * k);
  const xs = [ox]; w.forEach(v => xs.push(xs[xs.length - 1] + v));
  let s = `<text x="${ox}" y="24" font-size="13" font-weight="700" fill="#1d2327">${titolo}</text><text x="${ox}" y="42" font-size="11.5" fill="#5d6a72">${info}</text>`;
  s += `<defs>${L.map((l, i) => `<linearGradient id="${id}g${i}" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="${tCol(g.t[i], tmin, tmax)}"/><stop offset="1" stop-color="${tCol(g.t[i + 1], tmin, tmax)}"/></linearGradient>`).join("")}
    <pattern id="${id}h" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="8" stroke="#ffffff" stroke-width="3"/></pattern></defs>`;
  L.forEach((l, i) => { s += `<rect x="${xs[i]}" y="${y0}" width="${w[i]}" height="${hh}" fill="url(#${id}g${i})" stroke="#1d2327" stroke-width=".6"/>`; });
  // zona di condensa (mappata sulla scala visiva)
  const mapX = x => { for (let i = 0; i < L.length; i++) if (x <= g.x[i + 1] + 1e-12) return xs[i] + (x - g.x[i]) / (g.x[i + 1] - g.x[i]) * w[i]; return xs[xs.length - 1]; };
  const zz = zoneCondensa(g);
  for (const [a, b] of zz) {
    const xa = mapX(a), xb = Math.max(mapX(b), xa + 4);
    s += `<rect x="${xa}" y="${y0}" width="${xb - xa}" height="${hh}" fill="#2f80c9" fill-opacity=".12"/><rect x="${xa}" y="${y0}" width="${xb - xa}" height="${hh}" fill="url(#${id}h)" fill-opacity=".3"/><rect x="${xa}" y="${y0}" width="${xb - xa}" height="${hh}" fill="none" stroke="#0d47a1" stroke-width="2" stroke-dasharray="5 3"/>`;
    for (let j = 0; j < 4; j++) s += `<path d="M${(xa + xb) / 2} ${y0 + 30 + j * 45} q -5 8 0 12 q 5 -4 0 -12z" fill="#0d47a1"/>`;
  }
  // didascalia sotto il proprio pannello, allineata a sinistra
  const cap = zz.length ? ["condensa: qui si forma acqua", ...zz.map(([a, b]) => `da ${fmt(a * 100, 1)} a ${fmt(b * 100, 1)} cm dalla faccia interna`)] : ["nessuna condensa"];
  cap.forEach((r, j) => { s += `<text x="${ox}" y="${y0 + hh + 24 + j * 15}" font-size="11.5" ${j === 0 ? 'font-weight="700"' : ""} fill="${zz.length ? "#0d47a1" : "#2e7d32"}">${r}</text>`; });
  const yb = y0 + hh + 24 + cap.length * 15 + 6;
  if (bagnato) bagnato.split("|").forEach((r, j) => { s += `<text x="${ox}" y="${yb + j * 15}" font-size="11.5" fill="#b3261e">${r}</text>`; });
  [0, L.length].forEach(i => { s += `<text x="${xs[i]}" y="${y0 - 6}" text-anchor="${i ? "end" : "start"}" font-size="11" fill="#1d2327">${fmt(g.t[i], 1)} °C</text>`; });
  return s;
}
// ---------------- editor della stratigrafia (sezioni 3 e 6) ----------------
function editorHTML(prog, id) {
  const riga = (it, lato, i, n) => {
    const iso = it.t === "iso" ? ISOLANTI.find(m => m.id === it.m) : null;
    const opz = ISOLANTI.filter(m => m[lato === "int" ? "interno" : "esterno"].length);
    return `<div class="erow">
      <select data-ed="${id}" data-lato="${lato}" data-i="${i}" data-k="mat">${it.t === "pe" ? `<option value="pe" selected>Freno al vapore in PE 0,2 mm</option>` : opz.map(m => `<option value="${m.id}" ${m.id === it.m ? "selected" : ""}>${m.nome}</option>`).join("")}</select>
      ${iso ? `<select data-ed="${id}" data-lato="${lato}" data-i="${i}" data-k="sp">${iso[lato === "int" ? "interno" : "esterno"].map(sp => `<option value="${sp}" ${sp === it.sp ? "selected" : ""}>${sp * 10} mm</option>`).join("")}</select>` : `<span class="msg">0,2 mm</span>`}
      <span class="mv"><button class="x" data-ed="${id}" data-lato="${lato}" data-i="${i}" data-k="su" title="Sposta verso l'interno" ${i === 0 ? "disabled" : ""}>▲</button><button class="x" data-ed="${id}" data-lato="${lato}" data-i="${i}" data-k="giu" title="Sposta verso l'esterno" ${i === n - 1 ? "disabled" : ""}>▼</button><button class="x" data-ed="${id}" data-lato="${lato}" data-i="${i}" data-k="del" title="Elimina">✕</button></span></div>`;
  };
  const base = stratiIniziali();
  return `<div class="editor">
    <div class="elato"><b>INTERNO</b>${prog.int.length ? `<div class="msg">+ controparete in cartongesso 12,5 mm (automatica)</div>` : ""}
      ${prog.int.map((it, i) => riga(it, "int", i, prog.int.length)).join("")}
      <button class="ghost small" data-ed="${id}" data-lato="int" data-k="addiso">+ isolante interno</button> <button class="ghost small" data-ed="${id}" data-lato="int" data-k="addpe">+ freno al vapore interno</button></div>
    <div class="emur">Muratura esistente: ${base.map((l, i) => `${i + 1}. ${esc(l.nome)} ${fmt(l.s * 1000, 0)} mm`).join(" · ")}</div>
    <div class="elato">${prog.est.map((it, i) => riga(it, "est", i, prog.est.length)).join("")}
      <button class="ghost small" data-ed="${id}" data-lato="est" data-k="addiso">+ isolante esterno (cappotto)</button> <button class="ghost small" data-ed="${id}" data-lato="est" data-k="addpe">+ freno al vapore esterno</button>
      ${Calc.haEsterno(prog) ? `<div class="msg">+ rasatura e finitura del cappotto 8 mm (automatica)</div>` : ""}<b>ESTERNO</b></div></div>`;
}
// collega i comandi dell'editor; onChange(prog) viene chiamato a ogni modifica
function collegaEditor(cont, getProg, onChange, id) {
  cont.querySelectorAll(`[data-ed="${id}"]`).forEach(el => {
    const ev = el.tagName === "SELECT" ? "onchange" : "onclick";
    el[ev] = () => {
      const p = getProg(), lato = el.dataset.lato, arr = p[lato], i = +el.dataset.i, k = el.dataset.k;
      const cat = ISOLANTI.filter(m => m[lato === "int" ? "interno" : "esterno"].length);
      if (k === "addiso") { const m = cat[0]; arr.push({t: "iso", m: m.id, sp: m[lato === "int" ? "interno" : "esterno"][1] || m[lato === "int" ? "interno" : "esterno"][0]}); }
      if (k === "addpe") arr.push({t: "pe"});
      if (k === "del") arr.splice(i, 1);
      if (k === "su" && i > 0) [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
      if (k === "giu" && i < arr.length - 1) [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]];
      if (k === "mat") { const m = ISOLANTI.find(x => x.id === el.value), sps = m[lato === "int" ? "interno" : "esterno"]; arr[i] = {t: "iso", m: m.id, sp: sps.includes(arr[i].sp) ? arr[i].sp : sps[Math.min(1, sps.length - 1)]}; }
      if (k === "sp") arr[i].sp = +el.value;
      onChange(p);
    };
  });
}
function alertPonteggio(prog) {
  const d = D(), geo = Calc.geometria(d);
  return `<strong>${Calc.haEsterno(prog) ? "Isolamento esterno: serve il ponteggio." : "Ponteggio: serve solo con isolamento esterno."}</strong> Facciata ${fmt(geo.P, 1)} m × ${fmt(d.h + 1, 2)} m = ${fmt(geo.P * (d.h + 1), 1)} m² × ${fmt(COSTI.ponteggio, 2)} €/m² = <strong>${eur(geo.P * (d.h + 1) * COSTI.ponteggio)}</strong> di costo fisso.<br>
    Con isolamento <strong>solo interno</strong> il limite di U sale del 30 % (${fmt(U_LIMITE[d.zona] * MAGG_INTERNO, 3)} invece di ${fmt(U_LIMITE[d.zona], 2)} W/m²K) e il ponteggio non serve. L'interno costa meno, ma è più difficile da fare bene, soprattutto per la condensa interstiziale.`;
}
function tabCatalogo() {
  return `<table><tr><th>Materiale</th><th class="r">λ</th><th class="r">π·10¹²</th><th class="r">€/(m²·cm)</th><th>Uso</th></tr>
    ${ISOLANTI.map(m => `<tr><td>${m.nome}</td><td class="r">${fmt(m.lambda, 3)}</td><td class="r">${fmt(m.pi, m.pi < 0.1 ? 5 : 2)}</td><td class="r">${fmt(m.costoCm, 2)}</td><td>${[m.esterno.length ? "esterno" : "", m.interno.length ? "interno" : ""].filter(Boolean).join(", ")}</td></tr>`).join("")}
    <tr><td>Posa esterna a cappotto</td><td colspan="3" class="r">${fmt(COSTI.posaEsterna, 2)} €/m²</td><td>+ ponteggio ${fmt(COSTI.ponteggio, 2)} €/m² di facciata</td></tr>
    <tr><td>Posa interna (controparete in cartongesso)</td><td colspan="3" class="r">${fmt(COSTI.posaInterna, 2)} €/m²</td><td>include il cartongesso</td></tr>
    <tr><td>Freno al vapore PE 0,2 mm</td><td class="r">0,35</td><td class="r">0,00375</td><td class="r">${fmt(COSTI.freno, 2)} €/m²</td><td>interno o esterno</td></tr></table>
    <p class="msg">Prezzi: Prezzario Regione FVG 2025 (freno al vapore: stima). λ prodotti dal prezzario, π dal manuale.</p>`;
}
function tabPreventivo(r) {
  return `<table><tr><th>Voce</th><th class="r">Quantità</th><th class="r">€/u</th><th class="r">Totale</th></tr>
    ${r.voci.map(v => `<tr><td>${v.voce}</td><td class="r">${fmt(v.q, 2)} ${v.u}</td><td class="r">${fmt(v.pu, 2)}</td><td class="r">${eur(v.tot)}</td></tr>`).join("")}
    <tr><th colspan="3">Totale</th><th class="r">${eur(r.costo)}</th></tr></table>`;
}
function barre(r, U0) {
  const d = D();
  return barra("Trasmittanza U", U0 - r.U, U0, [{v: U0 - r.lim, t: "limite di legge " + fmt(r.lim, 3)}], r.okU ? "#2e7d32" : "#f0a030", `U = ${fmt(r.U, 3)} W/(m²K)`, `U iniziale ${fmt(U0, 3)}`, "U = 0", r.okU ? "La barra supera la tacca del limite: obiettivo raggiunto." : "La barra deve oltrepassare la tacca nera del limite di legge (U più bassa = barra più lunga).")
    + barra("Budget", r.costo, Math.max(d.budget, r.costo) * 1.15, [{v: d.budget, t: "budget " + eur(d.budget)}], r.okB ? "#0b6e69" : "#b3261e", `spesa ${eur(r.costo)} (${fmt(r.costo / d.budget * 100, 0)} %)`, "0 €", "", r.okB ? "La spesa resta prima della tacca del budget." : "La spesa supera la tacca nera del budget disponibile.");
}

// ---------------- sezione 3 ----------------
function initS3() {
  $("tabCatalogo").innerHTML = tabCatalogo();
  renderEditor3();
  if (S.s3.ultimo) mostraRisultati3(S.s3.ultimo); else $("risultati3").innerHTML = `<p class="msg">Premete Calcola.</p>`;
  $("nCalcoli").textContent = `Calcoli eseguiti: ${S.s3.calcoli}`;
  bloccaS3(S.s3.ok);
}
function renderEditor3() {
  const cont = $("editor3"); cont.innerHTML = editorHTML(S.s3.prog, "e3");
  $("alertPonteggio3").classList.remove("hidden"); $("alertPonteggio3").innerHTML = alertPonteggio(S.s3.prog);
  if (S.s3.ok) { cont.querySelectorAll("select,button").forEach(e => e.disabled = true); return; }
  collegaEditor(cont, () => S.s3.prog, p => { S.s3.prog = p; renderEditor3(); $("btnS3").disabled = true; $("s3msg").className = "msg"; $("s3msg").textContent = "Stratigrafia cambiata: premete Calcola."; salvaLocale(); }, "e3");
}
function calcolaS3() {
  const p = S.s3.prog;
  if (!p.int.some(it => it.t === "iso") && !p.est.some(it => it.t === "iso")) { $("s3msg").className = "msg bad"; $("s3msg").textContent = "Aggiungete almeno un isolante."; return; }
  S.s3.calcoli++;
  const r = valuta(p), d = D(), geo = Calc.geometria(d), g0 = Calc.glaser(stratiIniziali(), d.ti, d.fi, d.te, d.fe);
  S.s3.ultimo = {prog: copia(p), U: r.U, U0: g0.U, lim: r.lim, costo: r.costo, voci: r.voci, okU: r.okU, okB: r.okB, ok: r.okU && r.okB,
    Phi: r.U * geo.An * (d.ti - d.te), Phi0: g0.U * geo.An * (d.ti - d.te)};
  mostraRisultati3(S.s3.ultimo); salvaLocale();
}
function mostraRisultati3(r) {
  $("nCalcoli").textContent = `Calcoli eseguiti: ${S.s3.calcoli}`;
  $("risultati3").innerHTML = `
    <div class="kpi"><div><span>U isolata</span><b>${fmt(r.U, 3)}</b><span>W/(m²K) · prima ${fmt(r.U0, 3)}</span></div>
    <div><span>Φ</span><b>${fmt(r.Phi, 0)} W</b><span>−${fmt((1 - r.Phi / r.Phi0) * 100, 0)} % rispetto a ${fmt(r.Phi0, 0)} W</span></div>
    <div><span>Costo</span><b>${eur(r.costo)}</b><span>budget ${eur(D().budget)}</span></div></div>
    ${barre(r, r.U0)}${tabPreventivo(r)}
    <div class="figure">${svgStrato(Calc.costruisci(stratiIniziali(), r.prog), {titolo: "Stratigrafia isolata"})}</div>`;
  const ok = r.ok && JSON.stringify(r.prog) === JSON.stringify(S.s3.prog);
  $("btnS3").disabled = !ok || S.s3.ok;
  $("s3msg").className = "msg " + (r.ok ? "good" : "bad");
  $("s3msg").textContent = S.s3.ok ? "Isolamento confermato." : r.ok ? "Obiettivo raggiunto nel budget: potete confermare." : [!r.okU ? "U sopra il limite" : "", !r.okB ? "costo oltre il budget" : ""].filter(Boolean).join(" e ") + ".";
}
function bloccaS3(on) { $("s3").querySelectorAll("#editor3 select,#editor3 button,#btnCalcola,#btnS3").forEach(el => el.disabled = on); if (on) { $("s3msg").textContent = "Isolamento confermato."; } }
function confermaS3() { S.s3.ok = true; S.s6.prog = copia(S.s3.ultimo.prog); bloccaS3(true); renderS4(); vai(4); }

// ---------------- sezione 4 ----------------
function renderS4() {
  const d = D(), r = S.s3.ultimo;
  $("riepilogo4").innerHTML = `<div class="kpi"><div><span>U prima → dopo</span><b>${fmt(r.U0, 3)} → ${fmt(r.U, 3)}</b><span>limite ${fmt(r.lim, 3)}</span></div>
    <div><span>Φ prima → dopo</span><b>${fmt(r.Phi0, 0)} → ${fmt(r.Phi, 0)} W</b></div><div><span>Costo</span><b>${eur(r.costo)}</b><span>budget ${eur(d.budget)}</span></div></div>
    <div class="two"><div class="figure">${svgPianta(d)}</div><div class="figure">${svgStrato(stratiIsolati(), {titolo: "Stratigrafia isolata"})}</div></div>`;
}

// ---------------- sezione 5 ----------------
let sceltaStrato = null;
function renderS5() {
  const L = stratiIsolati();
  $("svgClick").innerHTML = svgStrato(L, {titolo: "Stratigrafia isolata · cliccate uno strato", click: true, sel: S.s5.ok ? S.s5.strato : sceltaStrato});
  $("svgClick").querySelectorAll("[data-strato]").forEach(g => g.onclick = () => {
    if (S.s5.ok) return; sceltaStrato = +g.dataset.strato; renderS5();
    $("sceltaStrato").textContent = `Strato scelto: ${sceltaStrato}. ${L[sceltaStrato - 1].nome}`;
  });
  if (S.s5.ok) { $("domanda5").querySelectorAll("input,button").forEach(e => e.disabled = true); mostraSoluzione5(); }
}
function inviaS5() {
  const r = document.querySelector('input[name="cond"]:checked');
  if (!r) { $("sceltaStrato").textContent = "Scegliete sì o no."; return; }
  if (r.value === "si" && !sceltaStrato) { $("sceltaStrato").textContent = "Cliccate lo strato sulla stratigrafia."; return; }
  if (!confirm("Avete un solo tentativo. Inviare la risposta?")) return;
  const d = D(), g = Calc.glaser(stratiIsolati(), d.ti, d.fi, d.te, d.fe);
  const limite = g.dmin > -BORDER_PA && g.dmin <= BORDER_PA;
  let esito;
  if (r.value === "no") esito = g.primo === null ? "corretta" : (limite ? "corretta (caso al limite)" : "errata");
  else if (g.primo === null) {
    const vic = sceltaStrato && Math.min(g.d[sceltaStrato - 1], g.d[sceltaStrato]) <= BORDER_PA;
    esito = limite && vic ? "corretta (caso al limite)" : "errata";
  } else esito = sceltaStrato === g.primo ? "corretta" : (g.zona.includes(sceltaStrato) ? "parzialmente corretta" : "errata");
  S.s5 = {ok: true, risposta: r.value, strato: r.value === "si" ? sceltaStrato : null, esito};
  renderS5(); renderS6(); aggiornaSteps(); salvaLocale();
}
function mostraSoluzione5() {
  const d = D(), L = stratiIsolati(), g = Calc.glaser(L, d.ti, d.fi, d.te, d.fe);
  const corretta = g.primo === null ? "nessuna condensa" : `condensa: le rette si incrociano nello strato ${g.primo} (${L[g.primo - 1].nome})`;
  const e = S.s5.esito || "", cls = e.startsWith("corrett") ? "good" : e.startsWith("parz") ? "warn" : e.startsWith("saltata") ? "info" : "bad";
  $("soluzione5").classList.remove("hidden");
  $("soluzione5").innerHTML = `<div class="notice ${cls}"><strong>Risposta ${e}.</strong> ${S.s5.risposta ? `Avete risposto: ${S.s5.risposta === "si" ? "sì, strato " + S.s5.strato : "no"}.` : ""} Soluzione: ${corretta}. Minima distanza p_s − p_v: ${fmt(g.dmin, 0)} Pa${Math.abs(g.dmin) <= BORDER_PA ? " (caso al limite: piccoli arrotondamenti possono cambiare il risultato)" : ""}.</div>
    <h3>Diagramma di Glaser della vostra stratigrafia</h3>
    <div class="figure">${svgGlaser(L, g, `t_i ${d.ti} °C, φ_i ${d.fi} %, t_e ${d.te} °C, φ_e ${d.fe} %`)}</div>${tabNodi(L, g)}
    <div class="actions"><button class="primary" onclick="vai(6)">Avanti: ${g.primo === null ? "verificate e confermate il progetto" : "correggete la stratigrafia"} →</button></div>`;
}

// ---------------- sezione 6: progetto senza condensa, aggiornamento in tempo reale ----------------
function renderS6() {
  if (!S.s6.prog) S.s6.prog = copia(progV1());
  const cont = $("editor6"); cont.innerHTML = editorHTML(S.s6.prog, "e6");
  $("alertPonteggio6").classList.remove("hidden"); $("alertPonteggio6").innerHTML = alertPonteggio(S.s6.prog);
  if (S.s6.ok) cont.querySelectorAll("select,button").forEach(e => e.disabled = true);
  else collegaEditor(cont, () => S.s6.prog, p => { S.s6.prog = p; S.s6.modifiche++; renderS6(); salvaLocale(); }, "e6");
  const d = D(), r = valuta(S.s6.prog), g = r.g, U0 = Calc.glaser(stratiIniziali(), d.ti, d.fi, d.te, d.fe).U;
  const cond = g.primo === null && g.dmin > 0;
  $("kpi6").innerHTML = `<div class="kpi"><div><span>U</span><b>${fmt(r.U, 3)}</b><span>limite ${fmt(r.lim, 3)} ${r.okU ? "✓" : "✗"}</span></div>
    <div><span>Costo</span><b>${eur(r.costo)}</b><span>budget ${eur(d.budget)} ${r.okB ? "✓" : "✗"}</span></div>
    <div><span>Condensa interstiziale</span><b style="color:${cond ? "#2e7d32" : "#b3261e"}">${cond ? "no" : "sì"}</b><span>min p_s − p_v = ${fmt(g.dmin, 0)} Pa ${cond ? "✓" : "✗"}</span></div></div>
    ${barre(r, U0)}<details><summary>Preventivo</summary>${tabPreventivo(r)}</details>`;
  $("strato6").innerHTML = svgStrato(r.L, {titolo: "Stratigrafia del progetto"});
  $("glaser6").innerHTML = svgGlaser(r.L, g, `t_i ${d.ti} °C, φ_i ${d.fi} %, t_e ${d.te} °C, φ_e ${d.fe} %`);
  $("nodi6").innerHTML = tabNodi(r.L, g);
  const ok = r.okU && r.okB && cond;
  $("btnS6").disabled = !ok || S.s6.ok;
  $("s6msg").className = "msg " + (ok ? "good" : "bad");
  $("s6msg").textContent = S.s6.ok ? "Progetto confermato." : ok ? "Tutte e tre le condizioni sono rispettate: potete confermare." : "Manca: " + [!r.okU ? "U sotto il limite" : "", !r.okB ? "costo nel budget" : "", !cond ? "nessuna condensa" : ""].filter(Boolean).join(", ") + ".";
}
function confermaS6() { S.s6.ok = true; renderS6(); renderS7(); vai(7); }

// ---------------- termografie ----------------
function svgTermo() {
  const d = D(), L0 = stratiIniziali(), L1 = stratiIsolati(), LF = stratiFinali(), geo = Calc.geometria(d);
  const g0 = Calc.glaser(L0, d.ti, d.fi, d.te, d.fe), f = Calc.freddo30(L1, d.ti, d.fi, d.te, d.fe), gF = Calc.glaser(LF, d.ti, d.fi, d.te, d.fe);
  const tmin = d.te, tmax = d.ti;
  const L2 = L1.map((l, i) => { const e = f.eventi.find(e => e.strato === i); return e ? {...l, fm: e.fm} : l; });
  let wet = "";
  if (f.eventi.length) {
    const e = f.eventi.reduce((a, b) => b.acqua > a.acqua ? b : a);
    wet = `${fmt(f.acqua, 2)} kg/m² di acqua nella parete|≈ ${fmt(f.acqua * geo.An, 0)} litri su tutta la casa|strato ${e.strato + 1} bagnato: λ × ${fmt(e.fm, 2)}`;
  }
  const P = "t" + (++UID);
  let s = pannelloTermo(L0, g0, 20, "Prima (parete iniziale)", `U = ${fmt(g0.U, 3)} W/(m²K)`, tmin, tmax, P + "a");
  s += pannelloTermo(L1, f.g, 275, "Isolamento della sezione 3", `U = ${fmt(f.g.U, 3)} W/(m²K)`, tmin, tmax, P + "b");
  s += `<g transform="translate(0,370)">` + pannelloTermo(L2, f.g2, 20, "Sezione 3 dopo 30 giorni di freddo", `U = ${fmt(f.g2.U, 3)} W/(m²K)${f.eventi.length ? ` (+${fmt((f.g2.U / f.g.U - 1) * 100, 0)} %)` : " (invariata)"}`, tmin, tmax, P + "c", f.eventi.length ? wet : "la parete resta asciutta");
  s += pannelloTermo(LF, gF, 275, "Progetto finale (sezione 6)", `U = ${fmt(gF.U, 3)} W/(m²K)`, tmin, tmax, P + "d") + `</g>`;
  let leg = ""; for (let i = 0; i <= 20; i++) { const t = tmin + (tmax - tmin) * i / 20; leg += `<rect x="${60 + i * 18}" y="790" width="18" height="12" fill="${tCol(t, tmin, tmax)}"/>`; }
  return `<svg viewBox="0 0 540 860" xmlns="http://www.w3.org/2000/svg" font-family="Segoe UI, Arial, sans-serif"><rect width="100%" height="100%" fill="#fff"/>${s}
    ${leg}<text x="54" y="800" text-anchor="end" font-size="11">${fmt(tmin, 0)} °C</text><text x="444" y="800" font-size="11">${fmt(tmax, 0)} °C</text>
    <text x="20" y="826" font-size="10" fill="#5d6a72">Interno a sinistra. Temperature ai nodi, interpolate nello strato; strati sottilissimi ingranditi. La zona bagnata</text>
    <text x="20" y="840" font-size="10" fill="#5d6a72">peggiora perché l'acqua fa condurre di più l'isolante. 30 giorni alle condizioni di progetto: scenario peggiore.</text>
    <text x="20" y="854" font-size="10" fill="#5d6a72">Una termocamera vede solo le superfici, non la condensa interna.</text></svg>`;
}

// ---------------- sezione 7 ----------------
const DOMANDE = [
  "In quale strato cade il salto di temperatura più grande? E il salto di pressione di vapore più grande? Sono nello stesso strato? Citate i vostri valori in °C e Pa.",
  "Nella stratigrafia della sezione 3, dove le due curve erano più vicine (o si incrociavano)? Quanti Pa separavano p_s e p_v?",
  "Il vostro isolante è all'interno o all'esterno della muratura? Come cambia la temperatura della muratura rispetto alla parete non isolata?",
  "Quale strato ha la R_v più grande? Si trova sul lato caldo o sul lato freddo dell'isolante? Perché questo conta?",
  "Che cosa avete cambiato nella sezione 6 per eliminare la condensa (o per migliorare il progetto)? Come si è spostata la spezzata di p_v?",
  "Guardate la termografia «dopo 30 giorni di freddo»: che cosa succede all'isolante bagnato e perché la parete peggiora?",
  "Confrontate costo e U del progetto finale con la prima versione: cosa avete guadagnato e cosa avete speso in più?",
];
function renderS7() {
  $("termoBox").innerHTML = svgTermo();
  $("domande7").innerHTML = DOMANDE.map((q, i) => `<p class="q">${i + 1}. ${q}</p><textarea data-q="${i}">${esc(S.s7.risposte[i] || "")}</textarea>`).join("");
  $("domande7").querySelectorAll("textarea").forEach(t => t.oninput = () => { S.s7.risposte[+t.dataset.q] = t.value; salvaLocale(); });
  if (S.s7.fatto) mostraApprofondimenti();
}
function mostraApprofondimenti() {
  const d = D(), g = Calc.glaser(stratiFinali(), d.ti, d.fi, d.te, d.fe);
  $("approf7").classList.remove("hidden");
  $("approf7").innerHTML = `<h3>Approfondimenti</h3>
    <div class="notice info"><strong>Condensa superficiale.</strong> Sulla superficie interna (nodo 0) del progetto finale t = ${fmt(g.t[0], 1)} °C, p_s = ${fmt(g.ps[0], 0)} Pa, mentre p_v interna = ${fmt(g.pvi, 0)} Pa: ${g.ps[0] > g.pvi ? "nessuna condensa superficiale" : "condensa superficiale!"}. Negli angoli e sui ponti termici la superficie è più fredda: lì nasce la muffa.</div>
    <div class="notice info"><strong>Cosa dice la norma.</strong> La UNI EN ISO 13788 ammette una condensa interstiziale limitata se evapora nei mesi estivi: la verifica reale è mese per mese e conta i grammi d'acqua. Qui si usa solo la condizione di progetto invernale.</div>
    <div class="notice info"><strong>Limite del metodo ai nodi.</strong> La curva vera di p_s dentro uno strato non è una retta ma una curva più bassa: negli isolanti spessi la condensa può comparire prima di quanto mostra il diagramma.</div>
    <div class="actions left wrap"><button class="primary" id="btnPrint">Stampa / salva la relazione in PDF</button><button class="ghost" id="btnXlsRel">Scarica la relazione in Excel</button></div>`;
  $("btnPrint").onclick = stampa; $("btnXlsRel").onclick = xlsRelazione;
}
function generaRelazione() {
  if (S.s7.risposte.filter(x => x && x.trim()).length < DOMANDE.length && !confirm("Alcune domande non hanno risposta. Generare comunque la relazione?")) return;
  S.s7.fatto = true; mostraApprofondimenti(); aggiornaSteps(); salvaLocale();
}
const registro = () => `Invii con errori nella verifica Excel: ${Math.max(0, S.s2.inviiTot - (S.s2.ok && !S.sblocchi[2] ? 1 : 0))} · calcoli nella sezione isolamento: ${S.s3.calcoli} · modifiche nella sezione 6: ${S.s6.modifiche} · sblocchi del docente: ${Object.entries(S.sblocchi).map(([k, v]) => `sezione ${k} (${v})`).join(", ") || "nessuno"}`;
function htmlRelazione() {
  const d = D(), att = attesiS2(), r = S.s3.ultimo, L = stratiIsolati(), g = Calc.glaser(L, d.ti, d.fi, d.te, d.fe), rf = valuta(S.s6.prog || progV1());
  return `<h1>Analisi termoigrometrica</h1><p>Progettista: ${esc(S.gruppo.nomi)} · ${esc(d.loc)} (zona ${d.zona}) · ${new Date().toLocaleDateString("it-IT")}</p>
  <h2>1. Dati di progetto</h2><p>t_i = ${d.ti} °C, φ_i = ${d.fi} %, t_e = ${d.te} °C, φ_e = ${d.fe} %, budget ${eur(d.budget)}.</p>
  <div class="figs">${svgPianta(d)}${svgStrato(stratiIniziali(), {titolo: "Stratigrafia iniziale"})}</div>
  <h2>2. Aree e dispersione iniziale</h2><table><tr><th>A lorda</th><th>A finestre e porte</th><th>A netta</th><th>U iniziale</th><th>Φ iniziale</th></tr>
  <tr><td>${fmt(att.Ag, 2)} m²</td><td>${fmt(att.Af, 2)} m²</td><td>${fmt(att.An, 2)} m²</td><td>${fmt(att.U, 3)} W/(m²K)</td><td>${fmt(att.Phi, 0)} W</td></tr></table>
  <p>${registro()}</p>
  <h2>3. Isolamento (prima versione) e preventivo</h2>${svgStrato(L, {titolo: "Stratigrafia isolata (sezione 3)"})}
  <p>U: ${fmt(r.U0, 3)} → ${fmt(r.U, 3)} W/(m²K) (limite ${fmt(r.lim, 3)}); Φ: ${fmt(r.Phi0, 0)} → ${fmt(r.Phi, 0)} W (−${fmt((1 - r.Phi / r.Phi0) * 100, 0)} %).</p>
  ${tabPreventivo(r)}
  <h2>4. Verifica di Glaser della prima versione</h2><p>Risposta data: ${S.s5.risposta ? (S.s5.risposta === "si" ? "condensa nello strato " + S.s5.strato : "nessuna condensa") : "—"} — esito: <b>${S.s5.esito}</b>.</p>
  ${svgGlaser(L, g, `t_i ${d.ti} °C, φ_i ${d.fi} %, t_e ${d.te} °C, φ_e ${d.fe} %`)}${tabNodi(L, g)}
  <h2>5. Progetto finale senza condensa</h2>${svgStrato(rf.L, {titolo: "Stratigrafia del progetto finale"})}
  <p>U = ${fmt(rf.U, 3)} W/(m²K) (limite ${fmt(rf.lim, 3)}) · costo ${eur(rf.costo)} (budget ${eur(d.budget)}) · minima distanza p_s − p_v = ${fmt(rf.g.dmin, 0)} Pa.</p>
  ${svgGlaser(rf.L, rf.g, "progetto finale")}${tabNodi(rf.L, rf.g)}${tabPreventivo(rf)}
  <h2>6. Termografia simulata della sezione</h2>${svgTermo()}
  <h2>7. Risposte alle domande</h2>${DOMANDE.map((q, i) => `<p><b>${i + 1}. ${q}</b></p><div class="ans">${esc(S.s7.risposte[i] || "(nessuna risposta)")}</div>`).join("")}`;
}
function stampa() {
  $("relazione").innerHTML = htmlRelazione(); document.body.classList.add("print-rel");
  setTimeout(() => { window.print(); document.body.classList.remove("print-rel"); }, 100);
}
function xlsRelazione() {
  const d = D(), att = attesiS2(), r = S.s3.ultimo, L = stratiIsolati(), g = Calc.glaser(L, d.ti, d.fi, d.te, d.fe), rf = valuta(S.s6.prog || progV1());
  const wb = XLSX.utils.book_new(), add = (n, rows, cols) => { const ws = XLSX.utils.aoa_to_sheet(rows); if (cols) ws["!cols"] = cols.map(w => ({wch: w})); XLSX.utils.book_append_sheet(wb, ws, n); };
  const nodi = (L, g) => [["Nodo", "x [cm]", "t [°C]", "p_s [Pa]", "p_v [Pa]", "p_s − p_v [Pa]"], ...g.t.map((t, k) => [k, +(g.x[k] * 100).toFixed(2), +t.toFixed(2), +g.ps[k].toFixed(0), +g.pv[k].toFixed(0), +g.d[k].toFixed(0)])];
  add("Dati", [["Progettista", S.gruppo.nomi], ["Località", d.loc], ["Zona", d.zona], ["t_i [°C]", d.ti], ["φ_i [%]", d.fi], ["t_e [°C]", d.te], ["φ_e [%]", d.fe], ["Budget [€]", d.budget],
    ["A lorda [m²]", +att.Ag.toFixed(2)], ["A finestre e porte [m²]", +att.Af.toFixed(2)], ["A netta [m²]", +att.An.toFixed(2)], ["U iniziale", +att.U.toFixed(3)], ["Φ iniziale [W]", +att.Phi.toFixed(0)], [], ["Registro", registro()]], [28, 60]);
  add("Prima versione", [["Strato", "s [m]", "λ", "π·10¹²"], ...L.map((l, i) => [`${i + 1}. ${l.nome}`, +l.s.toFixed(4), +l.lambda.toFixed(4), l.pi]), [], ["U", +r.U.toFixed(3)], ["U limite", +r.lim.toFixed(3)], ["Costo [€]", +r.costo.toFixed(0)], [],
    ...nodi(L, g), [], ["Risposta data", S.s5.risposta ? (S.s5.risposta === "si" ? "condensa nello strato " + S.s5.strato : "nessuna condensa") : "—"], ["Esito", S.s5.esito]], [60, 10, 10, 12, 12, 14]);
  add("Progetto finale", [["Strato", "s [m]", "λ", "π·10¹²"], ...rf.L.map((l, i) => [`${i + 1}. ${l.nome}`, +l.s.toFixed(4), +l.lambda.toFixed(4), l.pi]), [], ["U", +rf.U.toFixed(3)], ["U limite", +rf.lim.toFixed(3)], [],
    ...nodi(rf.L, rf.g), [], ["Voce", "Quantità", "Unità", "€/u", "Totale €"], ...rf.voci.map(v => [v.voce, +v.q.toFixed(2), v.u, +v.pu.toFixed(2), +v.tot.toFixed(2)]), ["Totale", "", "", "", +rf.costo.toFixed(2)]], [60, 10, 10, 12, 12, 14]);
  add("Risposte", DOMANDE.map((q, i) => [`${i + 1}. ${q}`, S.s7.risposte[i] || ""]), [80, 100]);
  XLSX.writeFile(wb, `${nomeFile()}_relazione.xlsx`);
}

// ---------------- sblocco docente per ogni sezione ----------------
async function codiceValido(c) { return UNLOCK.includes(await Calc.sha256(String(c || "").trim().toUpperCase())); }
function renderSblocchi() {
  document.querySelectorAll(".sbl").forEach(box => {
    const sez = +box.dataset.sez;
    const fatto = [S.s1.ok, S.s2.ok, S.s3.ok, , S.s5.ok, S.s6.ok][sez - 1];
    if (fatto) { box.innerHTML = ""; return; }
    if (box.dataset.open) return;
    box.innerHTML = `<details class="sblocco"><summary>Sblocco docente</summary>
      <p class="msg">${{1: "Carica i dati di una scheda e prosegue.", 2: "Considera superata la verifica e prosegue.", 3: "Applica l'isolamento più economico che rispetta limite e budget e prosegue.", 5: "Salta la domanda e mostra la soluzione.", 6: "Applica il progetto più economico senza condensa e prosegue."}[sez]}</p>
      ${sez === 1 ? `<label>Scheda <select class="sblScheda">${Object.keys(SCHEDE).map(n => `<option value="${n}">Scheda ${n} · ${SCHEDE[n].loc}</option>`).join("")}</select></label>` : ""}
      <label>Codice <input class="sblCod" maxlength="6"></label> <button class="ghost small sblBtn">Sblocca e prosegui</button> <span class="msg sblMsg"></span></details>`;
    box.querySelector("details").ontoggle = e => { box.dataset.open = e.target.open ? "1" : ""; };
    box.querySelector(".sblBtn").onclick = async () => {
      if (!(await codiceValido(box.querySelector(".sblCod").value))) { box.querySelector(".sblMsg").textContent = "Codice non valido."; return; }
      S.sblocchi[sez] = (S.sblocchi[sez] || 0) + 1; box.dataset.open = "";
      sbloccaSezione(sez, box.querySelector(".sblScheda") ? box.querySelector(".sblScheda").value : null);
    };
  });
}
function sbloccaSezione(sez, scheda) {
  const d = () => D(), geo = () => Calc.geometria(D());
  if (sez === 1) {
    const sc = copia(SCHEDE[scheda]);
    if (!S.gruppo.nomi.trim()) S.gruppo.nomi = `Scheda ${scheda}`;
    S.dati = {...S.dati, ...sc}; S.s1.ok = true; riempiS1(); renderS2(); vai(2);
  } else if (sez === 2) {
    S.s2.ok = true; bloccaS1(true); renderS2(); initS3(); vai(3);
  } else if (sez === 3) {
    S.s3.prog = Calc.progDefault(stratiIniziali(), d(), geo(), false); calcolaS3(); S.s3.calcoli--; confermaS3();
  } else if (sez === 5) {
    S.s5 = {ok: true, risposta: null, strato: null, esito: "saltata (sblocco docente)"}; renderS5(); renderS6(); vai(6);
  } else if (sez === 6) {
    S.s6.prog = Calc.progDefault(stratiIniziali(), d(), geo(), true); renderS6(); confermaS6();
  }
  salvaLocale();
}

// ---------------- salvataggio ----------------
function scaricaJSON() {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(S, null, 1)], {type: "application/json"}));
  a.download = `${nomeFile()}_progresso.json`; a.click();
}
function caricaJSON(file) {
  const rd = new FileReader();
  rd.onload = () => { try { const o = JSON.parse(rd.result); if (o.v !== 4) throw 0; S = Object.assign(NUOVO(), o); renderTutto(); } catch (e) { alert("File non valido."); } };
  rd.readAsText(file);
}
function renderTutto() {
  riempiS1();
  if (S.s1.ok) renderS2();
  if (S.s2.ok) initS3();
  if (S.s3.ok) renderS4();
  if (S.s4.ok) renderS5();
  if (S.s5.ok) renderS6();
  if (S.s6.ok) renderS7();
  aggiornaSteps(); salvaLocale();
}
function nuovoProgetto() { try { localStorage.removeItem("termoigro"); } catch (e) {} location.reload(); }

// ---------------- avvio ----------------
initS1();
$("btnS2").onclick = inviaS2;
$("btnCalcola").onclick = calcolaS3; $("btnS3").onclick = confermaS3;
$("btnXlsParete").onclick = xlsParete;
$("btnPngPianta").onclick = () => scaricaPNG(svgPianta(D()), `${nomeFile()}_pianta.png`);
$("btnPngStrato").onclick = () => scaricaPNG(svgStrato(stratiIsolati(), {titolo: "Stratigrafia isolata"}), `${nomeFile()}_stratigrafia.png`);
$("btnS4").onclick = () => { S.s4.ok = true; renderS5(); vai(5); };
$("btnS5").onclick = inviaS5; $("btnS6").onclick = confermaS6; $("btnS7").onclick = generaRelazione;
$("btnSalva").onclick = scaricaJSON;
$("btnNuovo").onclick = () => { if (confirm("Cancellare il lavoro presente in questo browser e iniziare un nuovo progetto? Salvate prima il progresso se vi serve.")) nuovoProgetto(); };
$("fileCarica").onchange = e => e.target.files[0] && caricaJSON(e.target.files[0]);
let salvato = null;
try { const o = JSON.parse(localStorage.getItem("termoigro")); if (o && o.v === 4) salvato = o; } catch (e) {}
if (salvato && (salvato.gruppo.nomi || salvato.s1.ok)) {
  // lavoro già presente in questo browser (PC condiviso?): si chiede se continuarlo
  S = Object.assign(NUOVO(), salvato);
  $("banner").classList.remove("hidden");
  $("banner").innerHTML = `<span>In questo browser c'è un lavoro salvato${salvato.gruppo.nomi ? ` di <b>${esc(salvato.gruppo.nomi)}</b>` : ""}. È il vostro?</span>
    <button class="primary small" id="bnContinua">Sì, continua</button><button class="ghost small" id="bnNuovo">No, nuovo progetto</button>`;
  $("bnContinua").onclick = () => $("banner").classList.add("hidden");
  $("bnNuovo").onclick = nuovoProgetto;
}
renderTutto();
