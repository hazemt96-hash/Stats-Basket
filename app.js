"use strict";
/* Stats Basket : toutes les données restent sur le téléphone (localStorage), avec export Excel et sauvegarde. */

const QS = ["Q1", "Q2", "Q3", "Q4", "Prol."];
const QLEN = q => (q === 4 ? 300 : 600);
const KEYS = ["rm", "ra", "mm", "ma", "tm", "ta", "fm", "fa", "ast", "reb", "orb", "stl", "blk", "tov", "pf", "pm", "min"];
const SHOTS = [
  { id: "rim", label: "Raquette", m: "rm", a: "ra" },
  { id: "mid", label: "Mi-distance", m: "mm", a: "ma" },
  { id: "three", label: "3 pts", m: "tm", a: "ta" },
  { id: "ft", label: "LF", m: "fm", a: "fa" },
];
const COUNTERS = [["ast", "Passes"], ["reb", "Rebonds"], ["orb", "Rebonds off."], ["stl", "Interceptions"], ["blk", "Contres"], ["tov", "Balles perdues"], ["pf", "Fautes"]];
const LOCAL_KEY = "stats-basket-v1";

/* ---------- Données ---------- */
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const blank = () => Object.fromEntries(KEYS.map(k => [k, 0]));

function freshDb() {
  return { teams: [{ id: uid(), name: "Féminines", cat: "F", players: [] }, { id: uid(), name: "Masculins", cat: "M", players: [] }], matches: [] };
}
const CATS = [["F", "Féminines"], ["M", "Masculins"]];
function migrate(data) {
  data.teams.forEach(t => { if (!t.cat) t.cat = /masc/i.test(t.name) ? "M" : "F"; });
  return data;
}
function loadDb() {
  try { const raw = localStorage.getItem(LOCAL_KEY); if (raw) return migrate(JSON.parse(raw)); } catch (e) { /* données illisibles : on repart à vide */ }
  return freshDb();
}
let db = loadDb();
function save() {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(db)); }
  catch (e) { toast("Mémoire pleine : exporte une sauvegarde"); }
}
function savedLayout() {
  try { const v = localStorage.getItem("stats-basket-layout"); if (["complet-v", "compact-v", "complet-h", "compact-h"].includes(v)) return v; } catch (e) { /* valeur par défaut */ }
  return "complet-v";
}
const ui = { view: "home", cat: db.teams[0] ? db.teams[0].cat : "F", teamId: db.teams[0] ? db.teams[0].id : null, matchId: null, sel: null, qt: false, recap: "avg", confirm: null, edit: null, drawer: false, layout: savedLayout() };
const team = () => db.teams.find(t => t.id === ui.teamId);
const match = () => db.matches.find(m => m.id === ui.matchId);
const teamOf = m => db.teams.find(t => t.id === m.teamId);
const person = (m, pid) => teamOf(m).players.find(p => p.id === pid) || { first: "?", last: "" };
const rosterOf = (m, pid) => m.roster.find(r => r.pid === pid);
const fullName = p => `${p.first} ${p.last}`.trim();

/* ---------- Calculs ---------- */
function derive(v) {
  const fgm = v.rm + v.mm + v.tm, fga = v.ra + v.ma + v.ta;
  return { ...v, fgm, fga, tpm: v.tm, tpa: v.ta, ftm: v.fm, fta: v.fa, pts: 2 * (v.rm + v.mm) + 3 * v.tm + v.fm };
}
const addInto = (into, v) => { KEYS.forEach(k => { into[k] += v[k] || 0; }); return into; };
const playerTotal = (m, pid) => m.stats[pid].reduce(addInto, blank());
const teamQuarter = (m, q) => m.roster.reduce((s, r) => addInto(s, m.stats[r.pid][q]), blank());
const teamTotal = m => m.roster.reduce((s, r) => addInto(s, playerTotal(m, r.pid)), blank());
const oppTotal = m => m.opp.reduce((a, b) => a + b, 0);
const possessions = d => d.fga + 0.44 * d.fta - d.orb + d.tov;
const safe = (a, b) => (b > 0 ? a / b : 0);
const eFG = d => safe(d.fgm + d.tpm / 2, d.fga);
const TS = d => safe(d.pts, 2 * (d.fga + 0.44 * d.fta));
const gameScore = d => d.pts + 0.4 * d.fgm - 0.7 * d.fga - 0.4 * (d.fta - d.ftm) + 0.7 * d.orb + 0.3 * (d.reb - d.orb) + d.stl + 0.7 * d.ast + 0.7 * d.blk - 0.4 * d.pf - d.tov;
function usage(d, t) {
  const teamUse = t.fga + 0.44 * t.fta + t.tov;
  return d.min > 0 && t.min > 0 && teamUse > 0 ? ((d.fga + 0.44 * d.fta + d.tov) * (t.min / 5)) / (d.min * teamUse) : 0;
}
function assistPct(d, t) {
  if (!(d.min > 0 && t.min > 0)) return 0;
  const others = (d.min / (t.min / 5)) * t.fgm - d.fgm;
  return others > 0 ? d.ast / others : 0;
}
const fmtClock = s => { const n = Math.floor(s || 0); return Math.floor(n / 60) + ":" + String(n % 60).padStart(2, "0"); };
const pctTxt = x => (x ? Math.round(x * 100) + "%" : "-");
const ratio = (m, a) => (a ? `${m}/${a} ${Math.round((100 * m) / a)}%` : `${m}/${a}`);
const signed = n => (n > 0 ? "+" + n : String(n));
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ---------- Chrono ---------- */
let tickTimer = null, ticks = 0, wakeLock = null;
const remain = m => Math.ceil(Math.max(0, QLEN(m.qi) - m.clocks[m.qi]));
function accrue(m) {
  if (!m.running) return;
  const now = Date.now(), dt = Math.min((now - m.last) / 1000, QLEN(m.qi) - m.clocks[m.qi]);
  m.last = now;
  if (dt <= 0) return;
  m.clocks[m.qi] += dt;
  m.court.forEach(pid => { m.stats[pid][m.qi].min += dt; });
}
async function keepAwake(on) {
  try {
    if (on && navigator.wakeLock && !wakeLock) wakeLock = await navigator.wakeLock.request("screen");
    if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch (e) { wakeLock = null; }
}
function stopTimer() { clearInterval(tickTimer); tickTimer = null; keepAwake(false); }
function startTimer() {
  clearInterval(tickTimer);
  ticks = 0;
  keepAwake(true);
  tickTimer = setInterval(() => {
    const m = match();
    if (!m || !m.running) { stopTimer(); return; }
    accrue(m);
    updateClocks();
    if (m.clocks[m.qi] >= QLEN(m.qi)) { m.running = false; stopTimer(); save(); render(); toast("Fin du " + QS[m.qi]); return; }
    if (++ticks % 5 === 0) save();
  }, 1000);
}
function updateClocks() {
  const m = match();
  if (!m) return;
  document.querySelectorAll("[data-min]").forEach(e => { e.textContent = fmtClock(playerTotal(m, e.dataset.min).min); });
  document.querySelectorAll("[data-clock]").forEach(c => { c.textContent = fmtClock(remain(m)); });
}
function resumeClock(m) {
  if (m.running && Date.now() - m.last > 600000) m.running = false;
  if (m.running) startTimer();
}

/* ---------- Saisie ---------- */
function addPlusMinus(m, entry, n) {
  m.court.forEach(pid => {
    let c = entry.changes.find(x => x[0] === pid);
    if (!c) { c = [pid, {}]; entry.changes.push(c); }
    c[1].pm = (c[1].pm || 0) + n;
  });
}
function applyEntry(m, e, sign) {
  e.changes.forEach(([pid, delta]) => {
    const v = m.stats[pid][e.q];
    Object.keys(delta).forEach(k => { v[k] = k === "pm" ? v[k] + sign * delta[k] : Math.max(0, v[k] + sign * delta[k]); });
  });
  if (e.opp) m.opp[e.q] = Math.max(0, m.opp[e.q] + sign * e.opp);
}
function record(m, entry) {
  accrue(m);
  Object.assign(entry, { id: uid(), clock: fmtClock(remain(m)) });
  applyEntry(m, entry, 1);
  m.log.push(entry);
  save();
  render();
}
/* Une correction (−) s'applique au quart-temps où la stat existe, en remontant depuis le quart-temps en cours. */
function quarterForRemoval(m, pid, delta) {
  for (let q = m.qi; q >= 0; q--) {
    const v = m.stats[pid][q];
    if (Object.keys(delta).every(k => delta[k] >= 0 || v[k] > 0)) return q;
  }
  for (let q = m.qi + 1; q < QS.length; q++) {
    const v = m.stats[pid][q];
    if (Object.keys(delta).every(k => delta[k] >= 0 || v[k] > 0)) return q;
  }
  return null;
}
function tapShot(id, kind, d) {
  const m = match(), pid = ui.sel, s = SHOTS.find(x => x.id === id), t = playerTotal(m, pid);
  if (d > 0 && !m.court.includes(pid)) return;
  if (d < 0 && (kind === "made" ? t[s.m] : t[s.a] - t[s.m]) <= 0) return;
  const delta = kind === "made" ? { [s.m]: d, [s.a]: d } : { [s.a]: d };
  const q = d > 0 ? m.qi : quarterForRemoval(m, pid, delta);
  if (q === null) return;
  const entry = { q, changes: [[pid, delta]], opp: 0, label: `N°${rosterOf(m, pid).no} ${s.label} ${kind === "made" ? "réussi" : "raté"}${d < 0 ? " (correction)" : ""}` };
  if (kind === "made") addPlusMinus(m, entry, d * (id === "three" ? 3 : id === "ft" ? 1 : 2));
  record(m, entry);
}
function tapCounter(k, d) {
  const m = match(), pid = ui.sel, t = playerTotal(m, pid);
  if (d > 0 && !m.court.includes(pid)) return;
  if (d < 0 && (t[k] <= 0 || (k === "reb" && t.reb <= t.orb))) return;
  const delta = { [k]: d };
  if (k === "orb") delta.reb = d;
  const q = d > 0 ? m.qi : quarterForRemoval(m, pid, delta);
  if (q === null) return;
  record(m, { q, changes: [[pid, delta]], opp: 0, label: `N°${rosterOf(m, pid).no} ${COUNTERS.find(c => c[0] === k)[1]}${d < 0 ? " (correction)" : ""}` });
  if (k === "pf" && d > 0 && t.pf + 1 >= 4) toast(`N°${rosterOf(m, pid).no} : ${t.pf + 1} fautes`);
}
function tapOpp(n) {
  const m = match();
  if (n < 0 && oppTotal(m) <= 0) return;
  let q = m.qi;
  if (n < 0) while (q > 0 && m.opp[q] <= 0) q--;
  if (n < 0 && m.opp[q] <= 0) return;
  const entry = { q, changes: [], opp: n, label: `Adversaire ${signed(n)}` };
  addPlusMinus(m, entry, -n);
  record(m, entry);
}
function undoLast() {
  const m = match(), e = m.log.pop();
  if (!e) return;
  applyEntry(m, e, -1);
  save(); render(); toast("Annulé : " + e.label);
}
function deleteLog(id) {
  const m = match(), i = m.log.findIndex(e => e.id === id);
  if (i < 0) return;
  applyEntry(m, m.log[i], -1);
  m.log.splice(i, 1);
  save(); render();
}
function toggleCourt(pid) {
  const m = match();
  accrue(m);
  if (m.court.includes(pid)) {
    m.court = m.court.filter(x => x !== pid);
    if (ui.sel === pid && m.court.length) ui.sel = m.court[0];
  }
  else if (m.court.length >= 5) { toast("5 joueurs déjà sur le terrain. Retires-en un."); return; }
  else m.court.push(pid);
  save(); render();
}
function toggleClock() {
  const m = match();
  if (m.running) { accrue(m); m.running = false; stopTimer(); }
  else {
    if (m.court.length !== 5) { toast("Il faut 5 joueurs sur le terrain"); return; }
    if (remain(m) <= 0) { toast("Quart-temps terminé. Choisis le suivant."); return; }
    m.running = true; m.last = Date.now(); startTimer();
  }
  save(); render();
}
function adjustClock(n) {
  const m = match();
  accrue(m);
  const next = Math.min(QLEN(m.qi), Math.max(0, m.clocks[m.qi] - n)), change = next - m.clocks[m.qi];
  m.clocks[m.qi] = next;
  m.court.forEach(pid => { const v = m.stats[pid][m.qi]; v.min = Math.max(0, v.min + change); });
  save(); updateClocks();
}
function askQuarter(n) {
  const m = match();
  if (n === m.qi) return;
  if (m.running) { toast("Arrête d'abord le chrono"); return; }
  ui.confirm = { text: `Passer de ${QS[m.qi]} à ${QS[n]} ?`, yes: () => { m.qi = n; save(); toast(`${QS[n]} validé : ${fmtClock(remain(m))} au chrono`); } };
  render();
}
function askClose() {
  const m = match();
  ui.confirm = { text: m.qi < 3 ? `Clore ${QS[m.qi]} et passer à ${QS[m.qi + 1]} ?` : `Clore ${QS[m.qi]} ?`, yes: () => {
    if (m.running) { accrue(m); m.running = false; stopTimer(); }
    const closed = QS[m.qi];
    m.clocks[m.qi] = QLEN(m.qi);
    if (m.qi < 3) m.qi++;
    save();
    toast(closed + " clos" + (QS[m.qi] !== closed ? " : place au " + QS[m.qi] : ""));
  } };
  render();
}

/* ---------- Équipes et matchs ---------- */
function addPlayer() {
  const first = document.getElementById("first").value.trim(), last = document.getElementById("last").value.trim();
  if (!first || !last) { toast("Indique le prénom et le nom"); return; }
  team().players.push({ id: uid(), first, last, archived: false });
  save(); render();
  document.getElementById("first").focus();
}
function selectCat(cat) {
  ui.cat = cat;
  const first = db.teams.find(t => t.cat === cat);
  ui.teamId = first ? first.id : null;
}
function addTeam() {
  const name = document.getElementById("tname").value.trim(), cat = document.getElementById("tcat").value;
  if (!name) { toast("Indique le nom de l'équipe"); return; }
  if (db.teams.some(t => t.cat === cat && t.name.toLowerCase() === name.toLowerCase())) { toast("Cette équipe existe déjà"); return; }
  const t = { id: uid(), name, cat, players: [] };
  db.teams.push(t);
  ui.cat = cat; ui.teamId = t.id; ui.view = "home";
  save(); render(); toast("Équipe créée");
}
function renameTeam(id) {
  const t = db.teams.find(x => x.id === id), name = document.getElementById("tn-" + id).value.trim();
  if (!name) { toast("Indique un nom"); return; }
  if (db.teams.some(x => x !== t && x.cat === t.cat && x.name.toLowerCase() === name.toLowerCase())) { toast("Cette équipe existe déjà"); return; }
  t.name = name;
  save(); render(); toast("Équipe renommée");
}
function askDeleteTeam(id) {
  const t = db.teams.find(x => x.id === id), n = db.matches.filter(m => m.teamId === id).length;
  ui.confirm = { text: `Supprimer ${t.name}, son effectif et ses ${n} match(s) ?`, yes: () => {
    db.teams = db.teams.filter(x => x !== t);
    db.matches = db.matches.filter(m => m.teamId !== id);
    if (ui.teamId === id) selectCat(ui.cat);
    save();
  } };
  render();
}
function saveMatchForm() {
  const t = team(), m = ui.edit ? db.matches.find(x => x.id === ui.edit) : null;
  const opponent = m ? m.opponent : document.getElementById("opp").value.trim();
  const date = m ? m.date : document.getElementById("date").value;
  if (!opponent || !date) { toast("Indique l'adversaire et la date"); return; }
  const roster = [];
  for (const p of t.players) {
    if (!document.getElementById("c-" + p.id)?.checked) continue;
    const no = document.getElementById("n-" + p.id).value.trim();
    if (!/^\d{1,3}$/.test(no)) { toast(`Numéro manquant pour ${fullName(p)}`); return; }
    roster.push({ pid: p.id, no: Number(no) });
  }
  if (roster.length < 5) { toast("Il faut au moins 5 joueurs présents"); return; }
  if (new Set(roster.map(r => r.no)).size !== roster.length) { toast("Deux joueurs ont le même numéro"); return; }
  if (m) {
    const removed = m.roster.filter(r => !roster.some(x => x.pid === r.pid));
    const hasStats = pid => m.stats[pid].some(v => KEYS.some(k => v[k]));
    if (removed.some(r => hasStats(r.pid))) { toast("Impossible de retirer un joueur qui a des stats"); return; }
    roster.forEach(r => { if (!m.stats[r.pid]) m.stats[r.pid] = QS.map(blank); });
    removed.forEach(r => { delete m.stats[r.pid]; m.court = m.court.filter(x => x !== r.pid); });
    m.roster = roster;
    save(); ui.edit = null; ui.view = "match"; ui.sel = roster[0].pid; render(); toast("Effectif du match enregistré");
    return;
  }
  const created = {
    id: uid(), teamId: t.id, opponent, date, roster, qi: 0, clocks: QS.map(() => 0), court: [], opp: QS.map(() => 0),
    stats: Object.fromEntries(roster.map(r => [r.pid, QS.map(blank)])), log: [], running: false, last: 0,
  };
  db.matches.push(created);
  save();
  openMatch(created.id);
}
function openMatch(id) {
  ui.matchId = id; ui.view = "match";
  const m = match();
  ui.teamId = m.teamId;
  ui.cat = teamOf(m).cat;
  ui.sel = m.roster[0].pid;
  resumeClock(m);
  render();
}
const leaveMatch = () => { const m = match(); if (m && m.running) { toast("Arrête d'abord le chrono"); return; } stopTimer(); ui.matchId = null; ui.view = "home"; render(); };

/* ---------- Récap saison ---------- */
function seasonRows(teamId) {
  const ms = db.matches.filter(m => m.teamId === teamId), t = db.teams.find(x => x.id === teamId);
  return t.players.map(p => {
    const played = ms.filter(m => m.stats[p.id]);
    const sum = played.reduce((s, m) => addInto(s, playerTotal(m, p.id)), blank());
    return { p, gp: played.length, d: derive(sum), pm: sum.pm };
  }).filter(r => r.gp > 0).sort((a, b) => b.d.pts / b.gp - a.d.pts / a.gp);
}
function seasonTeam(teamId) {
  const ms = db.matches.filter(m => m.teamId === teamId);
  let w = 0, l = 0, pf = 0, pa = 0;
  const sum = blank();
  ms.forEach(m => {
    const t = derive(teamTotal(m)), o = oppTotal(m);
    if (t.pts > o) w++; else if (t.pts < o) l++;
    pf += t.pts; pa += o; addInto(sum, teamTotal(m));
  });
  return { n: ms.length, w, l, pf, pa, d: derive(sum) };
}

/* ---------- Export ---------- */
async function deliver(blob, name) {
  const file = new File([blob], name, { type: blob.type });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name }); return; }
  } catch (e) { if (e.name === "AbortError") return; }
  const url = URL.createObjectURL(blob), a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
const P = x => ({ t: "n", v: Math.round(x * 1000) / 1000, z: "0.0%" });
const D = x => Math.round(x * 10) / 10;
const fileSafe = s => s.replace(/[^\p{L}\p{N}_-]+/gu, "_");
function downloadBook(sheets, name) {
  const wb = XLSX.utils.book_new();
  sheets.forEach(([title, rows]) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), title));
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return deliver(new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), name);
}
const statHead = ["Points", "Passes", "Rebonds", "Reb. off.", "Interceptions", "Contres", "Balles perdues", "Fautes", "Tirs réussis", "Tirs tentés", "% tirs", "Raquette réussis", "Raquette tentés", "% raquette", "Mi-dist. réussis", "Mi-dist. tentés", "% mi-dist.", "3 pts réussis", "3 pts tentés", "% 3 pts", "LF réussis", "LF tentés", "% LF", "eFG %", "TS %"];
const statCells = d => [d.pts, d.ast, d.reb, d.orb, d.stl, d.blk, d.tov, d.pf, d.fgm, d.fga, P(safe(d.fgm, d.fga)), d.rm, d.ra, P(safe(d.rm, d.ra)), d.mm, d.ma, P(safe(d.mm, d.ma)), d.tm, d.ta, P(safe(d.tm, d.ta)), d.fm, d.fa, P(safe(d.fm, d.fa)), P(eFG(d)), P(TS(d))];
function exportMatch(m) {
  const t = derive(teamTotal(m)), o = oppTotal(m), poss = possessions(t);
  const players = m.roster.map(r => ({ r, p: person(m, r.pid), d: derive(playerTotal(m, r.pid)) }));
  const main = [[`${teamOf(m).name} contre ${m.opponent}`], ["Date", m.date], ["Score", `${t.pts} - ${o}`], [], ["N°", "Joueur", "Minutes", "+/-", ...statHead]];
  players.forEach(({ r, p, d }) => main.push([r.no, fullName(p), fmtClock(d.min), d.pm, ...statCells(d)]));
  main.push(["", "Total équipe", fmtClock(t.min), "", ...statCells(t)]);
  const adv = [["N°", "Joueur", "USG %", "TOV %", "AST %", "AST/TO", "3PAr", "FTr", "Pts / 40 min", "+/- / 40 min", "Game Score"]];
  players.forEach(({ r, p, d }) => {
    const min = d.min / 60;
    adv.push([r.no, fullName(p), P(usage(d, t)), P(safe(d.tov, d.fga + 0.44 * d.fta + d.tov)), P(assistPct(d, t)), D(safe(d.ast, d.tov)), P(safe(d.tpa, d.fga)), P(safe(d.fta, d.fga)), D(safe(d.pts, min) * 40), D(safe(d.pm, min) * 40), D(gameScore(d))]);
  });
  adv.push([], ["Équipe"], ["Possessions", D(poss)], ["Off Rtg", D(safe(t.pts, poss) * 100)], ["Def Rtg", D(safe(o, poss) * 100)], ["Net Rtg", D(safe(t.pts - o, poss) * 100)], ["Pace (sur 40 min)", D(t.min > 0 ? (poss / (t.min / 60 / 5)) * 40 : poss)]);
  const quarters = [["QT", "Score", "Points adv.", ...statHead]];
  QS.forEach((q, i) => { const d = derive(teamQuarter(m, i)); quarters.push([q, `${d.pts}-${m.opp[i]}`, m.opp[i], ...statCells(d)]); });
  const detail = [["QT", "N°", "Joueur", "Minutes", "+/-", ...statHead]];
  QS.forEach((q, i) => players.forEach(({ r, p }) => { const d = derive(m.stats[r.pid][i]); detail.push([q, r.no, fullName(p), fmtClock(d.min), d.pm, ...statCells(d)]); }));
  const log = [["QT", "Chrono", "Action"], ...m.log.map(e => [QS[e.q], e.clock, e.label])];
  return downloadBook([["Match", main], ["Stats avancées", adv], ["Quarts-temps", quarters], ["Détail joueurs", detail], ["Journal", log]], `${fileSafe(teamOf(m).name)}_${fileSafe(m.opponent)}_${m.date}.xlsx`);
}
function exportSeason(teamId) {
  const t = db.teams.find(x => x.id === teamId), rows = seasonRows(teamId), s = seasonTeam(teamId);
  const totals = [["Joueur", "Matchs", "Minutes", "+/-", ...statHead]];
  rows.forEach(({ p, gp, d, pm }) => totals.push([fullName(p), gp, fmtClock(d.min), pm, ...statCells(d)]));
  const avgHead = ["Joueur", "Matchs", "Min/m", "Pts/m", "Pas/m", "Reb/m", "Int/m", "Ctr/m", "BP/m", "F/m", "% tirs", "% raquette", "% mi-dist.", "% 3 pts", "% LF", "eFG %", "TS %", "+/- /m"];
  const avg = [avgHead];
  rows.forEach(({ p, gp, d, pm }) => avg.push([fullName(p), gp, fmtClock(d.min / gp), D(d.pts / gp), D(d.ast / gp), D(d.reb / gp), D(d.stl / gp), D(d.blk / gp), D(d.tov / gp), D(d.pf / gp), P(safe(d.fgm, d.fga)), P(safe(d.rm, d.ra)), P(safe(d.mm, d.ma)), P(safe(d.tm, d.ta)), P(safe(d.fm, d.fa)), P(eFG(d)), P(TS(d)), D(pm / gp)]));
  const games = [["Date", "Adversaire", "Score", "Points", "Points adv.", "eFG %", "TS %"]];
  db.matches.filter(m => m.teamId === teamId).sort((a, b) => a.date.localeCompare(b.date)).forEach(m => { const d = derive(teamTotal(m)); games.push([m.date, m.opponent, `${d.pts}-${oppTotal(m)}`, d.pts, oppTotal(m), P(eFG(d)), P(TS(d))]); });
  games.push([], ["Bilan", `${s.w} V - ${s.l} D`]);
  return downloadBook([["Moyennes", avg], ["Totaux", totals], ["Matchs", games]], `Saison_${fileSafe(t.name)}.xlsx`);
}
function backup() { const d = new Date().toISOString().slice(0, 10); return deliver(new Blob([JSON.stringify(db)], { type: "application/json" }), `sauvegarde_stats_basket_${d}.json`); }
function restoreFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!Array.isArray(data.teams) || !Array.isArray(data.matches)) throw new Error("format");
      db = migrate(data); selectCat(db.teams[0] ? db.teams[0].cat : "F"); save(); render(); toast("Sauvegarde restaurée");
    } catch (e) { toast("Ce fichier n'est pas une sauvegarde valide"); }
  };
  reader.readAsText(file);
}

/* ---------- Écrans ---------- */
function viewHome() {
  const t = team(), inCat = db.teams.filter(x => x.cat === ui.cat);
  const ms = t ? db.matches.filter(m => m.teamId === t.id).sort((a, b) => b.date.localeCompare(a.date)) : [];
  const backupCard = `<div class="card"><h2>Sauvegarde</h2><p class="muted">Tes données sont sur ce téléphone. Exporte une sauvegarde régulièrement.</p><div class="row"><button class="btn grow" data-a="backup">Sauvegarder</button><label class="btn grow" style="display:grid;place-items:center">Restaurer<input type="file" id="restore" accept=".json,application/json" hidden></label></div></div>`;
  const tabs = `<h1>Stats Basket</h1>
  <div class="tabs">${CATS.map(([c, n]) => `<button data-a="cat" data-n="${c}" aria-pressed="${c === ui.cat}">${n}</button>`).join("")}</div>
  ${inCat.length > 1 ? `<div class="tabs" style="grid-auto-flow:row;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));margin-top:6px">${inCat.map(x => `<button data-a="team" data-id="${x.id}" aria-pressed="${t && x.id === t.id}">${esc(x.name)}</button>`).join("")}</div>` : ""}`;
  if (!t) return `${tabs}<div class="card"><p class="muted">Aucune équipe dans cette catégorie.</p></div><button class="btn main block" data-a="teams">Gérer les équipes</button>${backupCard}`;
  return `${tabs}
  ${inCat.length === 1 ? `<p class="muted" style="margin:8px 2px 0">Équipe : ${esc(t.name)}</p>` : ""}
  <button class="btn main block" data-a="new">Nouveau match</button>
  <div class="row"><button class="btn block grow" data-a="roster">Effectif (${t.players.filter(p => !p.archived).length})</button><button class="btn block grow" data-a="recap">Récap saison</button></div>
  <button class="btn block" data-a="teams">Gérer les équipes</button>
  <div class="card"><h2>Matchs</h2>${ms.length ? ms.map(m => { const d = derive(teamTotal(m)); return `<div class="item"><button class="open" data-a="open" data-id="${m.id}"><b>${esc(m.opponent)}</b><span class="muted num">${m.date.split("-").reverse().join("/")} · ${d.pts}-${oppTotal(m)}</span></button><button class="btn small" data-a="xls" data-id="${m.id}">Excel</button><button class="btn small danger" data-a="delmatch" data-id="${m.id}">Suppr.</button></div>`; }).join("") : `<p class="muted">Aucun match pour le moment. Ajoute ton effectif, puis crée un match.</p>`}</div>
  ${backupCard}`;
}
function viewTeams() {
  return `<div class="top"><button class="btn small" data-a="home">Retour</button><strong>Gérer les équipes</strong></div>
  <div class="card"><h2>Nouvelle équipe</h2><label class="f" for="tname">Nom</label><input id="tname" type="text" autocomplete="off"><label class="f" for="tcat">Catégorie</label><select id="tcat" style="background:var(--bg);border:1px solid var(--line);border-radius:8px;height:44px;padding:0 10px;font-size:16px;width:100%">${CATS.map(([c, n]) => `<option value="${c}"${c === ui.cat ? " selected" : ""}>${n}</option>`).join("")}</select><button class="btn main block" data-a="addteam">Créer l'équipe</button></div>
  ${CATS.map(([c, n]) => { const list = db.teams.filter(t => t.cat === c); return `<div class="card"><h2>${n}</h2>${list.length ? list.map(t => `<div class="item"><input id="tn-${t.id}" class="grow" type="text" aria-label="Nom de l'équipe" value="${esc(t.name)}"><button class="btn small" data-a="renteam" data-id="${t.id}">OK</button><button class="btn small danger" data-a="delteam" data-id="${t.id}">Suppr.</button></div>`).join("") : `<p class="muted">Aucune équipe.</p>`}</div>`; }).join("")}`;
}
function viewRoster() {
  const t = team(), active = t.players.filter(p => !p.archived);
  return `<div class="top"><button class="btn small" data-a="home">Retour</button><strong>Effectif ${esc(t.name)}</strong></div>
  <div class="card"><label class="f" for="first">Prénom</label><input id="first" type="text" autocomplete="off"><label class="f" for="last">Nom</label><input id="last" type="text" autocomplete="off"><button class="btn main block" data-a="addplayer">Ajouter</button></div>
  <div class="card"><h2>${active.length} joueurs</h2>${active.map(p => `<div class="item"><span class="grow">${esc(fullName(p))}</span><button class="btn small danger" data-a="archive" data-id="${p.id}">Retirer</button></div>`).join("")}</div>
  <p class="muted">Un joueur retiré n'apparaît plus pour les nouveaux matchs, mais ses stats restent dans le récap.</p>`;
}
function viewMatchForm() {
  const t = team(), m = ui.edit ? db.matches.find(x => x.id === ui.edit) : null;
  const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const list = t.players.filter(p => !p.archived || (m && m.stats[p.id]));
  return `<div class="top"><button class="btn small" data-a="${m ? "backmatch" : "home"}">Retour</button><strong>${m ? "Numéros et présents" : "Nouveau match"} : ${esc(t.name)}</strong></div>
  ${m ? "" : `<div class="card"><label class="f" for="opp">Adversaire</label><input id="opp" type="text" autocomplete="off"><label class="f" for="date">Date</label><input id="date" type="date" value="${today}"></div>`}
  <div class="card"><h2>Coche les présents et entre leur numéro du jour</h2>${list.length ? list.map(p => { const r = m && rosterOf(m, p.id); return `<div class="check"><input type="checkbox" id="c-${p.id}" aria-label="${esc(fullName(p))} présent"${r ? " checked" : ""}><label for="c-${p.id}">${esc(fullName(p))}</label><input id="n-${p.id}" inputmode="numeric" maxlength="3" aria-label="Numéro de ${esc(fullName(p))}" value="${r ? r.no : ""}"></div>`; }).join("") : `<p class="muted">Ajoute d'abord tes joueurs dans Effectif.</p>`}</div>
  <button class="btn main block" data-a="savematch">${m ? "Enregistrer" : "Créer le match"}</button>`;
}
function stepper(act, value, cls, name, min, locked) {
  return `<div class="stepper"><button data-a="${act}" data-d="-1" aria-label="Retirer ${name}"${value <= (min || 0) ? " disabled" : ""}>−</button><output>${value}</output><button class="${cls}" data-a="${act}" data-d="1" aria-label="Ajouter ${name}"${locked ? " disabled" : ""}>+</button></div>`;
}
const LAYOUTS = [["complet-v", "Complet vertical"], ["compact-v", "Compact vertical"], ["complet-h", "Complet horizontal"], ["compact-h", "Compact horizontal"]];
const SHORT = { ast: "Passes", reb: "Rebonds", orb: "Reb. off.", stl: "Interc.", blk: "Contres", tov: "B. perdues", pf: "Fautes" };
function setLayout(id) {
  ui.layout = id;
  ui.drawer = false;
  try { localStorage.setItem("stats-basket-layout", id); } catch (e) { /* non bloquant */ }
  render();
  if (id.endsWith("-h") && window.innerWidth < window.innerHeight) toast("Tourne ton téléphone en largeur");
}
function viewMatch() {
  const m = match(), compact = ui.layout.startsWith("compact"), land = ui.layout.endsWith("-h");
  if (compact && !m.court.includes(ui.sel) && m.court.length) ui.sel = m.court[0];
  const sel = rosterOf(m, ui.sel) || m.roster[0];
  ui.sel = sel.pid;
  const bench = !m.court.includes(ui.sel);
  const v = derive(playerTotal(m, ui.sel)), q = derive(m.stats[ui.sel][m.qi]), t = derive(teamTotal(m)), o = oppTotal(m), poss = possessions(t), p = person(m, ui.sel);
  const item = (n, x) => `<span><b>${x}</b> ${n}</span>`;
  const score = `<div class="score grow">${t.pts} – ${o}<small>${esc(m.opponent)}</small></div>`;
  const buttons = `<button class="btn small" data-a="drawer">Menu</button><button class="btn small" data-a="undo"${m.log.length ? "" : " disabled"}>Annuler</button>`;
  const header = land
    ? `<div class="top"><button class="btn small" data-a="leave">Matchs</button>${buttons}</div>${score}`
    : `<div class="top"><button class="btn small" data-a="leave">Matchs</button>${score}${buttons}</div>`;
  const opp = `<div class="opprow"><span>Adversaire</span><button data-a="opp" data-n="-1" aria-label="Retirer 1 point adverse"${o > 0 ? "" : " disabled"}>−</button><button class="p" data-a="opp" data-n="1">+1</button><button class="p" data-a="opp" data-n="2">+2</button><button class="p" data-a="opp" data-n="3">+3</button></div>`;
  const chip = r => { const d = derive(playerTotal(m, r.pid)); return `<button class="player ${m.court.includes(r.pid) ? "on" : "off"}" data-a="sel" data-id="${r.pid}" aria-pressed="${r.pid === ui.sel}"><b>${r.no}</b><span>${esc(person(m, r.pid).first)}</span><span>${d.pts} pts · ${d.pf} f</span><span data-min="${r.pid}">${fmtClock(d.min)}</span></button>`; };
  const allChips = `<div class="players">${m.roster.map(chip).join("")}</div>`;
  const courtChips = `<div class="players five">${m.roster.filter(r => m.court.includes(r.pid)).map(chip).join("")}</div>`;
  const quarters = `<div class="qrow">${QS.map((qn, i) => `<button data-a="quarter" data-n="${i}" aria-pressed="${i === m.qi}">${qn}</button>`).join("")}</div>`;
  const startBtn = `<button class="${m.running ? "stop" : "start"}" data-a="clock">${m.running ? "Stop" : "Départ"}</button>`;
  const clock = `<div class="clockrow"><span class="clockval" data-clock>${fmtClock(remain(m))}</span>${startBtn}<button class="close" data-a="close">Clore ${QS[m.qi]}</button></div>`;
  const clockLine = `<div class="clockline"><button class="btn small" data-a="drawer">${QS[m.qi]}</button><span class="clockval" data-clock>${fmtClock(remain(m))}</span>${startBtn}</div>`;
  const adjust = `<div class="adjrow">${[[-60, "−1:00"], [-10, "−10 s"], [-1, "−1 s"], [1, "+1 s"], [10, "+10 s"], [60, "+1:00"]].map(([n, l]) => `<button data-a="adj" data-n="${n}">${l}</button>`).join("")}</div>`;
  const court = `<div class="courthead"><span>Sur le terrain <b>${m.court.length}/5</b></span>${m.court.length !== 5 ? "<em>Choisis 5 joueurs</em>" : ""}</div><div class="courtrow">${m.roster.map(r => `<button data-a="court" data-id="${r.pid}" aria-pressed="${m.court.includes(r.pid)}" aria-label="N° ${r.no} sur le terrain">${r.no}</button>`).join("")}</div>`;
  const who = `<div class="who"><strong>N° ${sel.no} ${esc(fullName(p))}</strong></div><div class="muted num">${v.pts} pts · +/- ${signed(v.pm)} · ${QS[m.qi]} : ${q.pts} pts</div>${bench ? `<div class="benchnote">${compact ? "Ouvre Menu pour choisir les 5 joueurs sur le terrain" : "Sur le banc : seules les corrections (−) sont possibles"}</div>` : ""}`;
  const shots = `<div class="card"><div class="shots"><div></div><div class="head">Réussi</div><div class="head">Raté</div>${SHOTS.map(s => `<div class="label">${s.label}</div>${stepper(`shot:${s.id}:made`, v[s.m], "made", s.label + " réussi", 0, bench)}${stepper(`shot:${s.id}:miss`, Math.max(0, v[s.a] - v[s.m]), "miss", s.label + " raté", 0, bench)}`).join("")}</div><div class="pct"><span>Tirs ${ratio(v.fgm, v.fga)}</span><span>3 pts ${ratio(v.tpm, v.tpa)}</span><span>LF ${ratio(v.ftm, v.fta)}</span><span>eFG ${pctTxt(eFG(v))}</span><span>TS ${pctTxt(TS(v))}</span></div></div>`;
  const counters = `<div class="others">${COUNTERS.map(([k, n]) => `<div class="card"><h2>${n}</h2>${stepper("stat:" + k, v[k], "count", n, k === "reb" ? v.orb : 0, bench)}</div>`).join("")}</div>`;
  const tapShots = `<div class="tapshots"><div></div><div class="head">Réussi</div><div class="head">Raté</div>${SHOTS.map(s => `<div class="label">${s.label}</div><button class="tap made" data-a="shot:${s.id}:made" data-d="1" aria-label="${s.label} réussi"${bench ? " disabled" : ""}>+ <b>${v[s.m]}</b></button><button class="tap miss" data-a="shot:${s.id}:miss" data-d="1" aria-label="${s.label} raté"${bench ? " disabled" : ""}>+ <b>${Math.max(0, v[s.a] - v[s.m])}</b></button>`).join("")}</div>`;
  const tapCounters = `<div class="tapcounters">${COUNTERS.map(([k, n]) => `<button class="tapc" data-a="stat:${k}" data-d="1" aria-label="Ajouter ${n}"${bench ? " disabled" : ""}><span>${SHORT[k]}</span><b>${v[k]}</b></button>`).join("")}</div>`;
  const totals = `<div class="card"><h2>Totaux équipe</h2><div class="teamline">${item("Pas", t.ast)}${item("Reb", t.reb)}${item("Int", t.stl)}${item("Ctr", t.blk)}${item("BP", t.tov)}${item("F", t.pf)}${item("Tirs", ratio(t.fgm, t.fga))}${item("3 pts", ratio(t.tpm, t.tpa))}${item("LF", ratio(t.ftm, t.fta))}${item("eFG", pctTxt(eFG(t)))}${item("TS", pctTxt(TS(t)))}${item("Off", poss > 0 ? (t.pts / poss * 100).toFixed(1) : "-")}${item("Def", poss > 0 ? (o / poss * 100).toFixed(1) : "-")}${item("Net", poss > 0 ? ((t.pts - o) / poss * 100).toFixed(1) : "-")}</div></div>`;
  const qRows = QS.map((qn, i) => { const d = derive(teamQuarter(m, i)); return d.pts || m.opp[i] || d.fga || d.fta || d.reb || d.ast || d.tov || i === m.qi ? `<tr><th>${qn}</th><td>${d.pts}-${m.opp[i]}</td><td>${d.fgm}/${d.fga}</td><td>${d.tpm}/${d.tpa}</td><td>${d.ftm}/${d.fta}</td><td>${d.reb}</td><td>${d.ast}</td><td>${d.tov}</td><td>${d.pf}</td></tr>` : ""; }).join("");
  const quarterTable = `<div class="card"><button class="toggle" data-a="qt">Par quart-temps ${ui.qt ? "▴" : "▾"}</button>${ui.qt ? `<div class="scroll"><table><thead><tr><th></th><th>Score</th><th>Tirs</th><th>3 pts</th><th>LF</th><th>Reb</th><th>Pas</th><th>BP</th><th>F</th></tr></thead><tbody>${qRows}</tbody></table></div>` : ""}</div>`;
  const footer = `<div class="row"><button class="btn block grow" data-a="log">Journal</button><button class="btn block grow" data-a="numbers">Numéros</button><button class="btn block grow" data-a="xls" data-id="${m.id}">Excel</button></div>`;
  const layoutPick = `<div class="card"><h2>Affichage</h2><div class="pick">${LAYOUTS.map(([id, n]) => `<button data-a="layout" data-n="${id}" aria-pressed="${id === ui.layout}">${n}</button>`).join("")}</div></div>`;
  const drawer = ui.drawer ? `<div class="drawer"><div class="drawerin"><div class="top"><strong class="grow">Menu du match</strong><button class="btn small" data-a="drawer">Fermer</button></div>${layoutPick}<div class="card"><h2>Chrono et quart-temps</h2>${quarters}${clock}${adjust}${court}</div>${totals}${quarterTable}${footer}</div></div>` : "";
  let body;
  if (ui.layout === "compact-v") body = header + opp + clockLine + courtChips + who + tapShots + tapCounters;
  else if (ui.layout === "complet-h") body = `<div class="land"><div class="col">${header}${opp}${quarters}${clock}${adjust}${totals}</div><div class="col">${court}${allChips}${footer}</div><div class="col">${who}${shots}${counters}${quarterTable}</div></div>`;
  else if (ui.layout === "compact-h") body = `<div class="land tight"><div class="col">${header}${opp}${clockLine}</div><div class="col">${courtChips}</div><div class="col">${who}${tapShots}${tapCounters}</div></div>`;
  else body = header + opp + allChips + quarters + clock + adjust + court + who + shots + counters + totals + quarterTable + footer;
  return body + drawer;
}
function viewLog() {
  const m = match(), list = [...m.log].reverse();
  return `<div class="top"><button class="btn small" data-a="backmatch">Retour</button><strong>Journal (${m.log.length})</strong></div>
  <div class="card">${list.length ? list.map(e => `<div class="log"><span>${QS[e.q]}</span><span class="num">${e.clock}</span><span>${esc(e.label)}</span><button data-a="dellog" data-id="${e.id}" aria-label="Supprimer cette action">✕</button></div>`).join("") : `<p class="muted">Aucune action pour le moment.</p>`}</div>`;
}
function viewRecap() {
  const t = team(), rows = seasonRows(t.id), s = seasonTeam(t.id), avg = ui.recap === "avg";
  const n = (x, gp) => (avg ? (x / gp).toFixed(1) : x);
  const poss = possessions(s.d);
  return `<div class="top"><button class="btn small" data-a="home">Retour</button><strong class="grow">Récap ${esc(t.name)}</strong><button class="btn small" data-a="xlsseason">Excel</button></div>
  <div class="card"><h2>Équipe : ${s.n} matchs</h2><div class="teamline"><span><b>${s.w}-${s.l}</b> bilan</span><span><b>${s.n ? (s.pf / s.n).toFixed(1) : "-"}</b> pts/m</span><span><b>${s.n ? (s.pa / s.n).toFixed(1) : "-"}</b> adv/m</span><span><b>${pctTxt(eFG(s.d))}</b> eFG</span><span><b>${pctTxt(TS(s.d))}</b> TS</span><span><b>${poss > 0 ? (s.d.pts / poss * 100).toFixed(1) : "-"}</b> Off</span><span><b>${poss > 0 ? (s.pa / poss * 100).toFixed(1) : "-"}</b> Def</span></div></div>
  <div class="tabs" style="margin-top:8px"><button data-a="recapmode" data-n="avg" aria-pressed="${avg}">Moyennes par match</button><button data-a="recapmode" data-n="tot" aria-pressed="${!avg}">Totaux</button></div>
  <div class="card"><div class="scroll"><table><thead><tr><th class="sticky">Joueur</th><th>MJ</th><th>Min</th><th>Pts</th><th>Reb</th><th>Pas</th><th>Int</th><th>Ctr</th><th>BP</th><th>F</th><th>% tirs</th><th>Raq.</th><th>Mi-d.</th><th>3 pts</th><th>LF</th><th>eFG</th><th>TS</th><th>+/-</th></tr></thead><tbody>
  ${rows.map(({ p, gp, d, pm }) => `<tr><th class="sticky">${esc(fullName(p))}</th><td>${gp}</td><td>${fmtClock(avg ? d.min / gp : d.min)}</td><td>${n(d.pts, gp)}</td><td>${n(d.reb, gp)}</td><td>${n(d.ast, gp)}</td><td>${n(d.stl, gp)}</td><td>${n(d.blk, gp)}</td><td>${n(d.tov, gp)}</td><td>${n(d.pf, gp)}</td><td>${pctTxt(safe(d.fgm, d.fga))}</td><td>${pctTxt(safe(d.rm, d.ra))}</td><td>${pctTxt(safe(d.mm, d.ma))}</td><td>${pctTxt(safe(d.tm, d.ta))}</td><td>${pctTxt(safe(d.fm, d.fa))}</td><td>${pctTxt(eFG(d))}</td><td>${pctTxt(TS(d))}</td><td>${avg ? (pm / gp).toFixed(1) : signed(pm)}</td></tr>`).join("") || `<tr><td colspan="18" class="muted">Pas encore de match.</td></tr>`}
  </tbody></table></div></div><p class="muted">Un joueur absent n'a pas de 0 : seuls ses matchs joués comptent. Les % sont calculés sur les totaux de la saison.</p>`;
}
function render() {
  const screens = { home: viewHome, teams: viewTeams, roster: viewRoster, form: viewMatchForm, match: viewMatch, log: viewLog, recap: viewRecap };
  const dialog = ui.confirm ? `<div class="overlay"><div class="card dialog"><p>${esc(ui.confirm.text)}</p><div class="row"><button class="btn grow" data-a="no">Annuler</button><button class="btn main grow" data-a="yes">Confirmer</button></div></div></div>` : "";
  document.body.classList.toggle("wide", ui.view === "match" && ui.layout.endsWith("-h"));
  document.getElementById("app").innerHTML = screens[ui.view]() + dialog;
}
let toastTimer = null;
function toast(text) {
  const t = document.getElementById("toast");
  t.textContent = text; t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2500);
}

/* ---------- Actions ---------- */
const actions = {
  team: b => { ui.teamId = b.dataset.id; render(); },
  cat: b => { selectCat(b.dataset.n); render(); },
  teams: () => { ui.view = "teams"; render(); },
  addteam: addTeam,
  renteam: b => renameTeam(b.dataset.id),
  delteam: b => askDeleteTeam(b.dataset.id),
  home: () => { ui.view = "home"; render(); },
  new: () => { ui.edit = null; ui.view = "form"; render(); },
  roster: () => { ui.view = "roster"; render(); },
  recap: () => { ui.view = "recap"; render(); },
  recapmode: b => { ui.recap = b.dataset.n; render(); },
  addplayer: addPlayer,
  archive: b => { const p = team().players.find(x => x.id === b.dataset.id); ui.confirm = { text: `Retirer ${fullName(p)} de l'effectif ?`, yes: () => { p.archived = true; save(); } }; render(); },
  savematch: saveMatchForm,
  open: b => openMatch(b.dataset.id),
  delmatch: b => { const m = db.matches.find(x => x.id === b.dataset.id); ui.confirm = { text: `Supprimer définitivement le match contre ${m.opponent} ?`, yes: () => { db.matches = db.matches.filter(x => x !== m); save(); } }; render(); },
  xls: b => exportMatch(db.matches.find(x => x.id === b.dataset.id)),
  xlsseason: () => exportSeason(ui.teamId),
  backup,
  leave: leaveMatch,
  backmatch: () => { ui.edit = null; ui.view = "match"; render(); },
  numbers: () => { const m = match(); if (m.running) { toast("Arrête d'abord le chrono"); return; } ui.drawer = false; ui.edit = m.id; ui.view = "form"; render(); },
  log: () => { ui.drawer = false; ui.view = "log"; render(); },
  drawer: () => { ui.drawer = !ui.drawer; render(); },
  layout: b => setLayout(b.dataset.n),
  dellog: b => { const e = match().log.find(x => x.id === b.dataset.id); ui.confirm = { text: `Supprimer « ${e.label} » ?`, yes: () => deleteLog(e.id) }; render(); },
  undo: undoLast,
  opp: b => tapOpp(+b.dataset.n),
  sel: b => { ui.sel = b.dataset.id; render(); },
  court: b => toggleCourt(b.dataset.id),
  quarter: b => askQuarter(+b.dataset.n),
  clock: toggleClock,
  close: askClose,
  adj: b => adjustClock(+b.dataset.n),
  qt: () => { ui.qt = !ui.qt; render(); },
  no: () => { ui.confirm = null; render(); },
  yes: () => { const c = ui.confirm; ui.confirm = null; c.yes(); render(); },
};
document.addEventListener("click", e => {
  const b = e.target.closest("[data-a]");
  if (!b || b.disabled) return;
  const a = b.dataset.a;
  if (a.startsWith("shot:")) { const [, id, kind] = a.split(":"); tapShot(id, kind, +b.dataset.d); return; }
  if (a.startsWith("stat:")) { tapCounter(a.split(":")[1], +b.dataset.d); return; }
  actions[a](b);
});
document.addEventListener("change", e => { if (e.target.id === "restore" && e.target.files[0]) restoreFile(e.target.files[0]); });
document.addEventListener("visibilitychange", () => {
  const m = match();
  if (!m) return;
  if (document.hidden) { accrue(m); save(); }
  else if (m.running) { keepAwake(true); accrue(m); updateClocks(); }
});

render();
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
