"use strict";
/* Stats Basket v2 : données, moteur de saisie et calculs. Aucun affichage ici. */

const QS = ["Q1", "Q2", "Q3", "Q4", "Prol."];
const QLEN = q => (q === 4 ? 300 : 600);
const KEYS = ["rm", "ra", "mm", "ma", "tm", "ta", "fm", "fa", "ast", "reb", "orb", "stl", "blk", "tov", "pf", "fd", "ba", "pm", "min", "scp", "ptov", "fbp"];
const SHOTS = [
  { id: "rim", l: "Raquette", m: "rm", a: "ra", p: 2 },
  { id: "mid", l: "Mi-distance", m: "mm", a: "ma", p: 2 },
  { id: "three", l: "3 pts", m: "tm", a: "ta", p: 3 },
  { id: "ft", l: "LF", m: "fm", a: "fa", p: 1 },
];
const SHOT = Object.fromEntries(SHOTS.map(s => [s.id, s]));
const POS_STATS = [["ast", "Passes décisives"], ["reb", "Rebonds"], ["orb", "Reb. off."], ["stl", "Interceptions"], ["blk", "Contres"], ["fd", "Fautes prov."]];
const NEG_STATS = [["tov", "Balles perdues"], ["pf", "Fautes"], ["ba", "Contres subis"]];
const LIVE = new Set(["rim", "mid", "three", "ast", "reb", "orb", "stl", "blk", "tov", "ba"]);
const CHRONOS = ["guided", "manual", "prop", "none"];
const LOCAL_KEY = "stats-basket-v1";

let SIM = null;
const now = () => (SIM !== null ? SIM : Date.now());
const uid = () => now().toString(36) + Math.random().toString(36).slice(2, 7);
const blank = () => Object.fromEntries(KEYS.map(k => [k, 0]));
const low = s => String(s || "").trim().toLowerCase();
const safe = (a, b) => (b > 0 ? a / b : 0);

/* ---------- Réglages de l'appareil ---------- */
function detectLang() {
  const l = (navigator.language || "fr").slice(0, 2);
  return ["fr", "en", "es"].includes(l) ? l : "fr";
}
const DEF_SETTINGS = { lang: detectLang(), palette: "maillot", mode: "auto", pos: "abbr", chrono: "guided", oppMode: "simple", fast: true, fd: true, ba: true, layout: "c" };
let S = (() => {
  try { return { ...DEF_SETTINGS, ...JSON.parse(localStorage.getItem("stats-basket-settings") || "{}") }; }
  catch (e) { return { ...DEF_SETTINGS }; }
})();
if (S.layout && S.layout.length > 1) S.layout = S.layout[0];
function saveSettings() { try { localStorage.setItem("stats-basket-settings", JSON.stringify(S)); } catch (e) { /* non bloquant */ } }

/* ---------- Données ---------- */
const CATS = ["F", "M"];
function seasonOf(date) {
  const y = +String(date).slice(0, 4), mo = +String(date).slice(5, 7), a = mo >= 8 ? y : y - 1;
  return a + "-" + String((a + 1) % 100).padStart(2, "0");
}
const todayISO = () => new Date(now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const currentSeason = () => seasonOf(todayISO());
const nextSeason = s => { const a = +s.slice(0, 4) + 1; return a + "-" + String((a + 1) % 100).padStart(2, "0"); };
/* Convertit aussi l'ancien format (joueurs rangés dans chaque équipe, sans saisons). */
function migrate(data) {
  data.teams = data.teams || [];
  data.matches = data.matches || [];
  data.players = data.players || [];
  data.trash = data.trash || [];
  (data.matches || []).forEach(m => { if (!m.ox) m.ox = QS.map(blankOx); if (!m.oppMode) m.oppMode = "simple"; });
  data.teams.forEach(t => {
    if (!t.cat) t.cat = /masc/i.test(t.name) ? "M" : "F";
    if (!t.seasons) t.seasons = {};
    if (Array.isArray(t.players)) {
      const seasons = new Set(data.matches.filter(m => m.teamId === t.id).map(m => seasonOf(m.date)));
      seasons.add(currentSeason());
      seasons.forEach(se => {
        const used = new Set(data.matches.filter(m => m.teamId === t.id && seasonOf(m.date) === se).flatMap(m => m.roster.map(r => r.pid)));
        const ids = t.players.filter(p => used.has(p.id) || (se === currentSeason() && !p.archived)).map(p => p.id);
        const cur = t.seasons[se] = t.seasons[se] || { level: "", players: [] };
        ids.forEach(id => { if (!cur.players.includes(id)) cur.players.push(id); });
      });
      t.players.forEach(p => { if (!data.players.some(x => x.id === p.id)) data.players.push({ id: p.id, first: p.first, last: p.last, sex: t.cat, pos: p.pos || [], photo: p.photo || "" }); });
      delete t.players;
    }
  });
  data.players.forEach(p => { if (!p.pos) p.pos = []; if (!p.sex) p.sex = "F"; });
  data.matches.forEach(m => {
    if (!m.chrono) m.chrono = "guided";
    if (!m.real) m.real = QS.map(() => 0);
    if (!m.closed) m.closed = QS.map(() => false);
    if (!m.on) m.on = Object.fromEntries(m.roster.map(r => [r.pid, QS.map(() => 0)]));
    if (!m.fives) m.fives = {};
    if (!m.rot) m.rot = [];
    Object.values(m.stats).forEach(arr => arr.forEach(v => KEYS.forEach(k => { if (v[k] === undefined) v[k] = 0; })));
    m.log.forEach(e => { if (!e.ts) e.ts = 0; if (!e.kind) e.kind = "old"; });
  });
  data.matches.forEach(m => { if (m.clocks && m.roster && m.stats) fixMinutes(m); });
  return data;
}
const freshDb = () => ({ teams: [], players: [], matches: [], trash: [] });

/* ---------- Calculs ---------- */
function derive(v) {
  const fgm = v.rm + v.mm + v.tm, fga = v.ra + v.ma + v.ta, pts = 2 * (v.rm + v.mm) + 3 * v.tm + v.fm;
  const d = { ...v, fgm, fga, tpm: v.tm, tpa: v.ta, ftm: v.fm, fta: v.fa, pts };
  d.pir = pts + v.reb + v.ast + v.stl + v.blk + v.fd - (fga - fgm) - (v.fa - v.fm) - v.tov - v.ba - v.pf;
  return d;
}
const addInto = (into, v) => { KEYS.forEach(k => { into[k] += v[k] || 0; }); return into; };
const playerTotal = (m, pid) => (m.stats[pid] || []).reduce(addInto, blank());
const teamQuarter = (m, q) => m.roster.reduce((s, r) => addInto(s, m.stats[r.pid][q]), blank());
const teamTotal = m => m.roster.reduce((s, r) => addInto(s, playerTotal(m, r.pid)), blank());
const oppTotal = m => m.opp.reduce((a, b) => a + b, 0);
const possessions = d => d.fga + 0.44 * d.fta - d.orb + d.tov;
const eFG = d => safe(d.fgm + d.tpm / 2, d.fga);
const TS = d => safe(d.pts, 2 * (d.fga + 0.44 * d.fta));
const tovPct = d => safe(d.tov, d.fga + 0.44 * d.fta + d.tov);
function usage(d, t) {
  const teamUse = t.fga + 0.44 * t.fta + t.tov;
  return d.min > 0 && t.min > 0 && teamUse > 0 ? ((d.fga + 0.44 * d.fta + d.tov) * (t.min / 5)) / (d.min * teamUse) : 0;
}
function assistPct(d, t) {
  if (!(d.min > 0 && t.min > 0)) return 0;
  const others = (d.min / (t.min / 5)) * t.fgm - d.fgm;
  return others > 0 ? d.ast / others : 0;
}
const timed = m => m.chrono !== "none";
const playedIn = (m, id) => !!m.stats[id] && (playerTotal(m, id).min > 0 || m.court.includes(id) || m.log.some(e => e.in === id || (e.changes || []).some(c => c[0] === id)) || m.rot.some(r => r.court.includes(id)));
const playedQuarters = m => QS.map((_, q) => q).filter(q => q < 4 || m.real[4] > 0 || m.clocks[4] > 0 || teamQuarter(m, 4).fga > 0 || m.opp[4] > 0 || m.qi === 4);
function result(m) { const a = derive(teamTotal(m)).pts, b = oppTotal(m); return a > b ? "W" : a < b ? "L" : "N"; }

/* ---------- Moteur de match ---------- */
function newMatch(teamId, opponent, date, roster, chrono) {
  return {
    id: uid(), teamId, opponent, date, chrono, roster, qi: 0, created: now(),
    clocks: QS.map(() => 0), real: QS.map(() => 0), closed: QS.map(() => false),
    court: [], opp: QS.map(() => 0),
    stats: Object.fromEntries(roster.map(r => [r.pid, QS.map(blank)])),
    on: Object.fromEntries(roster.map(r => [r.pid, QS.map(() => 0)])),
    fives: {}, rot: [], log: [], running: false, last: 0,
  };
}
const fiveKey = m => (m.court.length === 5 ? [...m.court].sort().join("|") : "");
const fiveOf = (m, k) => (m.fives[k] = m.fives[k] || { t: QS.map(() => 0), pf: 0, pa: 0 });
function propMinutes(m, q) {
  m.roster.forEach(r => { m.stats[r.pid][q].min = m.real[q] > 0 ? QLEN(q) * (m.on[r.pid][q] || 0) / m.real[q] : 0; });
}
function accrue(m) {
  if (!m.running) return;
  const t = now();
  let dt = (t - m.last) / 1000;
  m.last = t;
  if (dt <= 0) return;
  const q = m.qi, k = fiveKey(m);
  if (m.chrono === "prop") {
    m.real[q] += dt;
    m.court.forEach(p => { m.on[p][q] += dt; });
    if (k) fiveOf(m, k).t[q] += dt;
    propMinutes(m, q);
  } else {
    dt = Math.min(dt, QLEN(q) - m.clocks[q]);
    if (dt <= 0) return;
    m.clocks[q] += dt;
    m.court.forEach(p => { m.stats[p][q].min += dt; });
    if (k) fiveOf(m, k).t[q] += dt;
  }
}
const extra = m => (m.running ? Math.max(0, (now() - m.last) / 1000) : 0);
const remain = m => Math.ceil(Math.max(0, QLEN(m.qi) - m.clocks[m.qi] - extra(m)));
const realElapsed = m => m.real[m.qi] + extra(m);
const elNow = m => (m.chrono === "prop" ? m.real[m.qi] : m.clocks[m.qi]);
function fiveSeconds(m, f) {
  return f.t.reduce((s, x, q) => s + (m.chrono === "prop" ? (m.real[q] > 0 ? x * QLEN(q) / m.real[q] : 0) : x), 0);
}
const fmtClock = s => { const n = Math.max(0, Math.round(s || 0)); return Math.floor(n / 60) + ":" + String(n % 60).padStart(2, "0"); };
function clockLabel(m) {
  if (m.chrono === "prop") return fmtClock(m.real[m.qi]);
  if (m.chrono === "none") return "";
  return fmtClock(QLEN(m.qi) - m.clocks[m.qi]);
}
function teamFoulsQ(m, q) { return m.roster.reduce((s, r) => s + m.stats[r.pid][q].pf, 0); }
/* Fautes adverses : chaque faute provoquée par une de nos joueuses est une faute de l'adversaire */
function oppFoulsQ(m, q) { return m.roster.reduce((s, r) => s + ((m.stats[r.pid] && m.stats[r.pid][q] && m.stats[r.pid][q].fd) || 0), 0); }
/* Mode avancé : stats de chaque joueuse adverse, d'après le numéro noté sur chaque action */
function oppPlayers(m) {
  const by = {};
  const g = n => (by[n] = by[n] || { no: n, pts: 0, fgm: 0, fga: 0, tpm: 0, ftm: 0, fta: 0, tov: 0, orb: 0, pf: 0 });
  m.log.forEach(e => {
    if (e.on == null) return;
    const x = g(e.on);
    if (e.kind === "opp" && e.oppPts > 0) { x.pts += e.oppPts; if (e.oppPts === 1) { x.ftm++; x.fta++; } else { x.fgm++; x.fga++; if (e.oppPts === 3) x.tpm++; } }
    if (e.ox === "miss") x.fga++;
    if (e.ox === "ftmiss") x.fta++;
    if (e.ox === "tov") x.tov++;
    if (e.ox === "orb") x.orb++;
    if (e.stat === "fd" && (e.d || 1) > 0) x.pf++;
  });
  return Object.values(by).sort((a, b) => b.pts - a.pts || a.no - b.no);
}

/* Saisie adverse : simplifiée (points seuls) ou modérée (+ tirs ratés, LF ratés, balles perdues, rebonds offensifs) */
const OPP_MODES = ["simple", "mod", "adv"];
const OX_KEYS = [["miss", "Tir raté"], ["ftmiss", "LF raté"], ["tov", "BP adv."], ["orb", "Reb. off. adv."]];
const blankOx = () => ({ miss: 0, ftmiss: 0, tov: 0, orb: 0 });
function oppDetail(m) {
  const o = { p1: 0, p2: 0, p3: 0, miss: 0, ftmiss: 0, tov: 0, orb: 0 };
  m.log.forEach(e => { if (e.kind === "opp" && e.oppPts > 0) o["p" + e.oppPts] = (o["p" + e.oppPts] || 0) + 1; });
  (m.ox || []).forEach(x => { if (x) OX_KEYS.forEach(([k]) => { o[k] += x[k] || 0; }); });
  const fgm = o.p2 + o.p3, fga = fgm + o.miss, fta = o.p1 + o.ftmiss;
  return { ...o, fgm, fga, fta, ftm: o.p1, tpm: o.p3, pts: oppTotal(m), efg: fga ? (fgm + .5 * o.p3) / fga : null, ft: fta ? o.p1 / fta : null, poss: fga + .44 * fta - o.orb + o.tov };
}
function applyEntry(m, e, sign) {
  if (e.ox) { m.ox = m.ox || QS.map(blankOx); m.ox[e.q][e.ox] = Math.max(0, (m.ox[e.q][e.ox] || 0) + sign); }
  (e.changes || []).forEach(([pid, delta]) => {
    const v = m.stats[pid] && m.stats[pid][e.q];
    if (!v) return;
    Object.keys(delta).forEach(k => { v[k] = k === "pm" ? v[k] + sign * delta[k] : Math.max(0, v[k] + sign * delta[k]); });
  });
  if (e.oppPts) m.opp[e.q] = Math.max(0, m.opp[e.q] + sign * e.oppPts);
  if (e.five && (e.pts || e.oppPts)) { const f = fiveOf(m, e.five); f.pf += sign * (e.pts || 0); f.pa += sign * (e.oppPts || 0); }
  if (e.kind === "sub") {
    if (sign > 0) {
      m.court = m.court.filter(x => x !== e.out && x !== e.in);
      if (e.in) m.court.push(e.in);
      m.rot.push({ id: e.id, q: e.q, el: e.el, court: [...m.court] });
    } else {
      if (e.in) m.court = m.court.filter(x => x !== e.in);
      if (e.out && !m.court.includes(e.out)) m.court.push(e.out);
      m.rot = m.rot.filter(r => r.id !== e.id);
    }
  }
}
function unlink(m, e) {
  if (!e.link) return;
  const p = m.log.find(x => x.id === e.link);
  if (p) delete p.link;
}
/* Retrouve, dans les 15 dernières secondes et sans point adverse entre deux, l'action à relier. */
function findBack(m, pred) {
  const t = now();
  for (let i = m.log.length - 1; i >= 0; i--) {
    const e = m.log[i];
    if (t - e.ts > 15000) return null;
    if (e.kind === "opp" && e.oppPts > 0) return null;
    if (pred(e)) return e;
  }
  return null;
}
function addDelta(e, pid, key, val) {
  let c = e.changes.find(x => x[0] === pid);
  if (!c) { c = [pid, {}]; e.changes.push(c); }
  c[1][key] = (c[1][key] || 0) + val;
}
function addPlusMinus(m, e, n) { m.court.forEach(pid => addDelta(e, pid, "pm", n)); }

/* Corrections (−) : on retire dans le quart-temps où la stat existe, en remontant depuis le quart-temps en cours. */
function quarterForRemoval(m, pid, delta) {
  const ok = q => Object.keys(delta).every(k => delta[k] >= 0 || m.stats[pid][q][k] > 0);
  for (let q = m.qi; q >= 0; q--) if (ok(q)) return q;
  for (let q = m.qi + 1; q < QS.length; q++) if (ok(q)) return q;
  return null;
}
function buildShot(m, pid, id, made, d, fastOn) {
  const s = SHOT[id], tot = playerTotal(m, pid);
  if (d < 0 && (made ? tot[s.m] : tot[s.a] - tot[s.m]) <= 0) return null;
  const delta = made ? { [s.m]: d, [s.a]: d } : { [s.a]: d };
  const q = d > 0 ? m.qi : quarterForRemoval(m, pid, delta);
  if (q === null) return null;
  const e = { kind: d > 0 ? "shot" : "corr", q, pid, shot: id, made, ft: id === "ft", d, changes: [[pid, { ...delta }]], pts: made ? d * s.p : 0 };
  if (made) addPlusMinus(m, e, d * s.p);
  if (d > 0 && made && !e.ft) {
    if (fastOn) addDelta(e, pid, "fbp", s.p);
    const src = findBack(m, x => (x.kind === "orb" || x.kind === "stl") && !x.link);
    if (src) { addDelta(e, pid, src.kind === "orb" ? "scp" : "ptov", s.p); e.link = src.id; e.linkFrom = src.id; }
  }
  return e;
}
function buildCounter(m, pid, k, d) {
  const tot = playerTotal(m, pid);
  if (d < 0 && (tot[k] <= 0 || (k === "reb" && tot.reb <= tot.orb))) return null;
  const delta = { [k]: d };
  if (k === "orb") delta.reb = d;
  const q = d > 0 ? m.qi : quarterForRemoval(m, pid, delta);
  if (q === null) return null;
  const e = { kind: d > 0 ? k : "corr", q, pid, stat: k, d, changes: [[pid, delta]] };
  if (d > 0 && (k === "orb" || k === "stl")) {
    const shot = findBack(m, x => x.kind === "shot" && x.made && !x.ft && !x.link);
    if (shot) { addDelta(e, shot.pid, k === "orb" ? "scp" : "ptov", shot.pts); e.link = shot.id; }
  }
  return e;
}
function buildOpp(m, n) {
  if (n < 0 && oppTotal(m) <= 0) return null;
  let q = m.qi;
  if (n < 0) { while (q > 0 && m.opp[q] <= 0) q--; if (m.opp[q] <= 0) return null; }
  const e = { kind: n > 0 ? "opp" : "corr", q, changes: [], oppPts: n };
  addPlusMinus(m, e, -n);
  return e;
}
function commit(m, e) {
  accrue(m);
  e.id = e.id || uid();
  e.ts = now();
  if (e.q === undefined) e.q = m.qi;
  e.clock = clockLabel(m);
  e.five = fiveKey(m);
  if (e.kind === "sub") e.el = elNow(m);
  applyEntry(m, e, 1);
  if (e.link) { const p = m.log.find(x => x.id === e.link); if (p) p.link = e.id; }
  m.log.push(e);
  return e;
}
function undoEntry(m) {
  const e = m.log.pop();
  if (!e) return null;
  accrue(m);
  applyEntry(m, e, -1);
  unlink(m, e);
  return e;
}
function deleteEntry(m, id) {
  const i = m.log.findIndex(e => e.id === id);
  if (i < 0) return false;
  const e = m.log[i];
  if (e.kind === "sub" && i !== m.log.length - 1) return false;
  applyEntry(m, e, -1);
  unlink(m, e);
  m.log.splice(i, 1);
  return true;
}
function startClock(m) {
  if (m.chrono === "none") return;
  if (elNow(m) === 0 && !m.rot.some(r => r.q === m.qi && r.el === 0)) m.rot.push({ id: uid(), q: m.qi, el: 0, court: [...m.court] });
  m.running = true;
  m.last = now();
}
function stopClock(m) { accrue(m); m.running = false; }
function closeQuarter(m) {
  if (m.running) stopClock(m);
  const q = m.qi;
  m.closed[q] = true;
  if (m.chrono === "guided" || m.chrono === "manual") m.clocks[q] = QLEN(q);
  if (m.chrono === "prop") propMinutes(m, q);
  if (q < 3) m.qi = q + 1;
  return q;
}
function adjustClock(m, n) {
  accrue(m);
  const q = m.qi, next = Math.min(QLEN(q), Math.max(0, m.clocks[q] - n)), change = next - m.clocks[q];
  m.clocks[q] = next;
  m.court.forEach(pid => { const v = m.stats[pid][q]; v.min = Math.max(0, v.min + change); });
  const k = fiveKey(m);
  if (k) { const f = fiveOf(m, k); f.t[q] = Math.max(0, f.t[q] + change); }
  fixMinutes(m);
}
/* Garde-fou : dans un quart-temps, la somme des minutes ne dépasse jamais 5 × le temps écoulé. */
function fixMinutes(m) {
  if (m.chrono === "prop" || m.chrono === "none") return false;
  let changed = false;
  QS.forEach((_, q) => {
    const cap = 5 * Math.min(QLEN(q), m.clocks[q] || 0);
    const sum = m.roster.reduce((s, r) => s + (m.stats[r.pid] && m.stats[r.pid][q] ? m.stats[r.pid][q].min : 0), 0);
    if (sum > cap + 1) { const f = sum ? cap / sum : 0; m.roster.forEach(r => { const v = m.stats[r.pid] && m.stats[r.pid][q]; if (v) v.min *= f; }); changed = true; }
  });
  return changed;
}

/* ---------- Cinq, duos, rotations ---------- */
function lineupRows(m) {
  return Object.entries(m.fives).map(([k, f]) => ({ ids: k.split("|"), sec: fiveSeconds(m, f), pf: f.pf, pa: f.pa }))
    .filter(r => r.sec >= 30 || r.pf + r.pa > 0);
}
function duoRows(rows) {
  const map = {};
  rows.forEach(r => {
    for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) {
      const k = [r.ids[i], r.ids[j]].sort().join("|");
      const d = map[k] = map[k] || { ids: k.split("|"), sec: 0, pf: 0, pa: 0 };
      d.sec += r.sec; d.pf += r.pf; d.pa += r.pa;
    }
  });
  return Object.values(map);
}
function seasonLineups(matches) {
  const map = {};
  matches.forEach(m => lineupRows(m).forEach(r => {
    const k = [...r.ids].sort().join("|");
    const x = map[k] = map[k] || { ids: [...r.ids].sort(), sec: 0, pf: 0, pa: 0, gp: 0 };
    x.sec += r.sec; x.pf += r.pf; x.pa += r.pa; x.gp++;
  }));
  return Object.values(map);
}
/* Intervalles sur le terrain, par joueur et par quart-temps, en fraction du quart-temps (0 à 1). */
function rotations(m) {
  if (!timed(m)) return null;
  const out = {};
  m.roster.forEach(r => { out[r.pid] = {}; });
  playedQuarters(m).forEach(q => {
    const recs = m.rot.filter(r => r.q === q).sort((a, b) => a.el - b.el);
    const end = m.chrono === "prop" ? m.real[q] : (m.closed[q] ? QLEN(q) : m.clocks[q]);
    if (!recs.length || end <= 0) return;
    recs.forEach((r, i) => {
      const a = r.el / end, b = (i + 1 < recs.length ? recs[i + 1].el : end) / end;
      if (b <= a) return;
      r.court.forEach(pid => { if (out[pid]) (out[pid][q] = out[pid][q] || []).push([Math.max(0, a), Math.min(1, b)]); });
    });
  });
  return out;
}

/* ---------- Fusion (Restaurer, Importer) ---------- */
function mergeData(db, raw) {
  const src = migrate(JSON.parse(JSON.stringify(raw)));
  const n = { teams: 0, players: 0, matches: 0 };
  const teamMap = {}, pidMap = {};
  src.players.forEach(sp => {
    let p = db.players.find(x => x.id === sp.id) || db.players.find(x => low(x.first) === low(sp.first) && low(x.last) === low(sp.last));
    if (!p) { p = { ...sp, id: db.players.some(x => x.id === sp.id) ? uid() : sp.id }; db.players.push(p); n.players++; }
    pidMap[sp.id] = p.id;
  });
  src.teams.forEach(st => {
    let t = db.teams.find(x => x.id === st.id) || db.teams.find(x => x.cat === st.cat && low(x.name) === low(st.name));
    if (!t) { t = { id: db.teams.some(x => x.id === st.id) ? uid() : st.id, name: st.name, cat: st.cat, seasons: {} }; db.teams.push(t); n.teams++; }
    teamMap[st.id] = t.id;
    Object.entries(st.seasons || {}).forEach(([se, v]) => {
      const cur = t.seasons[se] = t.seasons[se] || { level: v.level || "", players: [] };
      if (!cur.level && v.level) cur.level = v.level;
      (v.players || []).map(id => pidMap[id] || id).forEach(id => { if (!cur.players.includes(id)) cur.players.push(id); });
    });
  });
  src.matches.forEach(sm => {
    if (db.matches.some(x => x.id === sm.id) || !teamMap[sm.teamId]) return;
    const map = id => pidMap[id] || id;
    const m = JSON.parse(JSON.stringify(sm));
    m.teamId = teamMap[sm.teamId];
    m.roster.forEach(r => { r.pid = map(r.pid); });
    m.stats = Object.fromEntries(Object.entries(m.stats).map(([k, v]) => [map(k), v]));
    m.on = Object.fromEntries(Object.entries(m.on || {}).map(([k, v]) => [map(k), v]));
    m.court = m.court.map(map);
    m.log.forEach(e => { (e.changes || []).forEach(c => { c[0] = map(c[0]); }); if (e.pid) e.pid = map(e.pid); if (e.in) e.in = map(e.in); if (e.out) e.out = map(e.out); });
    m.fives = Object.fromEntries(Object.entries(m.fives || {}).map(([k, v]) => [k.split("|").map(map).sort().join("|"), v]));
    (m.rot || []).forEach(r => { r.court = r.court.map(map); });
    m.running = false; delete m.editor;
    db.matches.push(m);
    n.matches++;
  });
  return n;
}

/* ---------- Corbeille : rien n'est effacé tout de suite ---------- */
const TRASH_DAYS = 30;
function trashPut(kind, obj, extra) {
  const e = { id: obj.id, kind, obj, at: Date.now(), by: typeof myName === "function" ? myName() : "", teamId: kind === "match" ? obj.teamId : kind === "team" ? obj.id : "", ...(extra || {}) };
  db.trash = db.trash.filter(x => x.id !== e.id);
  db.trash.push(e);
  return e;
}
function trashMatch(m, withTeam) {
  db.matches = db.matches.filter(x => x !== m);
  trashPut("match", m, withTeam ? { withTeam } : null);
}
function trashTeam(tm) {
  db.matches.filter(m => m.teamId === tm.id).forEach(m => trashMatch(m, tm.id));
  db.teams = db.teams.filter(x => x !== tm);
  trashPut("team", tm);
}
function trashPlayer(p) {
  const rosters = [];
  db.teams.forEach(x => Object.entries(x.seasons || {}).forEach(([se, s]) => { if (s.players.includes(p.id)) { rosters.push([x.id, se]); s.players = s.players.filter(y => y !== p.id); } }));
  db.players = db.players.filter(x => x !== p);
  trashPut("player", p, { rosters });
}
function trashRestore(e) {
  if (e.kind === "match") {
    if (!db.teams.some(x => x.id === e.obj.teamId)) return "noteam";
    if (!db.matches.some(x => x.id === e.id)) db.matches.push(migrate({ teams: [], matches: [e.obj] }).matches[0]);
  } else if (e.kind === "team") {
    if (!db.teams.some(x => x.id === e.id)) db.teams.push(e.obj);
    db.trash.filter(x => x.kind === "match" && x.withTeam === e.id).forEach(x => { if (!db.matches.some(m => m.id === x.id)) db.matches.push(migrate({ teams: [], matches: [x.obj] }).matches[0]); });
    db.trash = db.trash.filter(x => !(x.kind === "match" && x.withTeam === e.id));
  } else if (e.kind === "player") {
    if (!db.players.some(x => x.id === e.id)) db.players.push(e.obj);
    (e.rosters || []).forEach(([tid, se]) => { const tm = db.teams.find(x => x.id === tid); if (tm && tm.seasons[se] && !tm.seasons[se].players.includes(e.id)) tm.seasons[se].players.push(e.id); });
  }
  db.trash = db.trash.filter(x => x.id !== e.id);
  return "ok";
}
function trashPurgeOld() {
  const lim = Date.now() - TRASH_DAYS * 864e5, before = db.trash.length;
  db.trash = db.trash.filter(x => x.at > lim);
  return before !== db.trash.length;
}
