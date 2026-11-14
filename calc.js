// Calcoli: stesse formule del manuale e del foglio Excel (Glaser ai nodi, p_s con Magnus).
const Calc = {
  ps(t) {
    return t >= 0 ? 610.5 * Math.exp(17.269 * t / (237.3 + t))
                  : 610.5 * Math.exp(21.875 * t / (265.5 + t));
  },

  // Pareti della pianta: nord in alto. Restituisce [{nome, L}]
  pareti(d) {
    const {tipo, A, B, a, b} = d;
    if (tipo === "R") return [["N1", A], ["E1", B], ["S1", A], ["O1", B]].map(([n, L]) => ({nome: n, L}));
    if (tipo === "L") return [["S1", A], ["O1", B], ["N1", A - a], ["E1", b], ["N2", a], ["E2", B - b]].map(([n, L]) => ({nome: n, L}));
    return [["S1", A], ["O1", B], ["E1", B], ["N1", (A - a) / 2], ["N2", (A - a) / 2], ["E2", b], ["O2", b], ["N3", a]].map(([n, L]) => ({nome: n, L}));
  },

  geometria(d) {
    const pareti = this.pareti(d);
    const P = pareti.reduce((s, p) => s + p.L, 0);
    const Ag = P * d.h;
    let Af = 0;
    for (const p of pareti) for (const f of (d.fin[p.nome] || [])) Af += f.w * f.h;
    return {pareti, P, Ag, Af, An: Ag - Af};
  },

  // strati: [{nome, s, lambda, pi}] dall'interno; restituisce nodi 0..n
  glaser(strati, ti, fi, te, fe) {
    // fm = fattore di umidità sulla conducibilità (λ_bagnata = λ·fm): R = s/(λ·fm)
    const R = [RSI, ...strati.map(l => l.s / (l.lambda * (l.fm || 1))), RSE];
    const Rt = R.reduce((a, b) => a + b, 0), U = 1 / Rt;
    const t = [ti];
    for (const r of R) t.push(t[t.length - 1] - r / Rt * (ti - te));
    const tn = t.slice(1, -1);                      // nodi 0..n
    const Rv = strati.map(l => l.s / (l.pi * 1e-12));
    const RvT = Rv.reduce((a, b) => a + b, 0);
    const pvi = fi / 100 * this.ps(ti), pve = fe / 100 * this.ps(te);
    const pv = [pvi];
    for (const r of Rv) pv.push(pv[pv.length - 1] - r / RvT * (pvi - pve));
    const psn = tn.map(x => this.ps(x));
    const d = psn.map((p, k) => p - pv[k]);
    const x = [0];
    for (const l of strati) x.push(x[x.length - 1] + l.s);
    // strato del primo incrocio (1..n) e strati della zona di condensa
    let primo = null; const zona = [];
    for (let k = 1; k < tn.length; k++) {
      if (d[k] <= 0 || d[k - 1] <= 0) zona.push(k);
      if (primo === null && d[k] <= 0) primo = k;
    }
    if (primo === null && d[0] <= 0) primo = 1;
    const dmin = Math.min(...d);
    return {R, Rt, U, t: tn, Rv, RvT, pvi, pve, pv, ps: psn, d, x, primo, zona, dmin, ti, te};
  },

  // Glaser completo (retta tesa sotto p_s): flussi e condensa per i 30 giorni di freddo
  freddo30(strati, ti, fi, te, fe) {
    const g = this.glaser(strati, ti, fi, te, fe);
    const X = [0];
    for (const r of g.Rv) X.push(X[X.length - 1] + r);
    const pts = [[X[0], g.pvi]];
    for (let k = 1; k < strati.length; k++) pts.push([X[k], g.ps[k]]);
    pts.push([X[X.length - 1], g.pve]);
    const path = [0]; let i = 0;
    while (i < pts.length - 1) {
      let best = i + 1, bs = Infinity;
      for (let j = i + 1; j < pts.length; j++) {
        const sl = (pts[j][1] - pts[i][1]) / (pts[j][0] - pts[i][0]);
        if (sl < bs) { bs = sl; best = j; }
      }
      path.push(best); i = best;
    }
    const flux = [];
    for (let n = 0; n < path.length - 1; n++) {
      const a = pts[path[n]], b = pts[path[n + 1]];
      flux.push(-(b[1] - a[1]) / (b[0] - a[0]));
    }
    const bagnati = strati.map(l => ({...l}));
    const eventi = [];
    for (let n = 0; n < flux.length - 1; n++) {
      const node = path[n + 1], gc = flux[n] - flux[n + 1];
      if (gc <= 0) continue;
      const Mw = gc * GIORNI_FREDDO * 86400;            // kg/m²
      let k = [node - 1, node].find(c => c >= 0 && c < strati.length && strati[c].fpsi);
      if (k === undefined) k = Math.min(node, strati.length - 1);
      const l = strati[k];
      const psi = Math.min(Mw / (1000 * l.s), 0.15);
      const fm = Math.exp((l.fpsi || 4) * psi);
      bagnati[k] = {...l, fm};
      eventi.push({nodo: node, strato: k, acqua: Mw, psi, fm});
    }
    const g2 = this.glaser(bagnati, ti, fi, te, fe);
    return {g, g2, eventi, acqua: eventi.reduce((s, e) => s + e.acqua, 0)};
  },

  // Stratigrafia isolata dalla scelta
  isolata(iniziale, sc) {
    const iso = ISOLANTI.find(m => m.id === sc.iso);
    const strIso = {nome: `${iso.nome} ${sc.sp} cm`, s: sc.sp / 100, lambda: iso.lambda, pi: iso.pi, fpsi: iso.fpsi, tipo: "iso"};
    if (sc.pos === "esterno") {
      const r = ACCESSORI.rasatura;
      return [...iniziale, strIso, {nome: r.nome, s: r.s, lambda: r.lambda, pi: r.pi, tipo: "acc"}];
    }
    const c = ACCESSORI.cartongesso, pe = ACCESSORI.pe;
    const out = [{nome: c.nome, s: c.s, lambda: c.lambda, pi: c.pi, tipo: "acc"}];
    const fr = {nome: pe.nome, s: pe.s, lambda: pe.lambda, pi: pe.pi, tipo: "acc"};
    if (sc.freno === "caldo") out.push(fr);
    out.push(strIso);
    if (sc.freno === "freddo") out.push(fr);
    return [...out, ...iniziale];
  },

  preventivo(sc, geo, h) {
    const iso = ISOLANTI.find(m => m.id === sc.iso);
    const A = geo.An;
    const voci = [];
    voci.push({voce: `${iso.nome} ${sc.sp} cm (materiale)`, q: A, u: "m²", pu: iso.costoCm * sc.sp});
    if (sc.pos === "esterno") {
      voci.push({voce: "Posa esterna a cappotto (collante, tasselli, rete, rasatura, finitura, manodopera)", q: A, u: "m²", pu: COSTI.posaEsterna});
      const Apont = geo.P * (h + 1);
      voci.push({voce: "Ponteggio (facciata = perimetro × (h + 1 m), 2 mesi)", q: Apont, u: "m²", pu: COSTI.ponteggio});
    } else {
      voci.push({voce: "Posa interna: controparete in cartongesso su orditura metallica", q: A, u: "m²", pu: COSTI.posaInterna});
      if (sc.freno !== "no") voci.push({voce: "Freno al vapore in PE 0,2 mm (posato)", q: A, u: "m²", pu: COSTI.freno});
    }
    voci.forEach(v => v.tot = v.q * v.pu);
    return {voci, totale: voci.reduce((s, v) => s + v.tot, 0)};
  },

  uLimite(zona, pos) { return U_LIMITE[zona] * (pos === "interno" ? MAGG_INTERNO : 1); },

  async sha256(s) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
  },
};
