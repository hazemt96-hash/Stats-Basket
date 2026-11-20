"use strict";
/* Stats Basket v2 : écrans et interactions. */

/* ---------- Outils d'affichage ---------- */
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const val = id => { const e = document.getElementById(id); return e ? e.value : ""; };
const dec = (x, n = 1) => (isFinite(x) ? x.toFixed(n) : "0").replace(".", S.lang === "en" ? "." : ",");
const pctTxt = x => (x ? Math.round(x * 100) + (S.lang === "en" ? "%" : " %") : "-");
const ratio = (m, a) => (a ? `${m}/${a}` : "0/0");
const signed = n => (n > 0 ? "+" + n : String(n));
const signedDec = n => (n > 0 ? "+" : "") + dec(n);
const fmtDate = d => (d ? d.split("-").reverse().join("/") : "");
const ICON = {
  matchs: '<path d="M4 5h16v14H4z"/><path d="M4 9h16M9 5v14"/>',
  saison: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  effectif: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><circle cx="17.5" cy="9" r="2.5"/><path d="M17 14.5c2.4.2 4 1.8 4.6 4.5"/>',
  reglages: '<circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
};
const PALETTES = {
  maillot: ["Maillot", ["#ffffff", "#0b0b0c", "#d7262f"], ["#09090a", "#f6f6f7", "#ff4d55"]],
  nuit: ["Nuit de match", ["#eef2f8", "#0f1d33", "#ff7a1a"], ["#0e1a30", "#f1f5fc", "#ff8a2b"]],
  parquet: ["Parquet", ["#f7f1e8", "#2b1d10", "#e06a1b"], ["#1d150e", "#f6ebdc", "#f08a3c"]],
  terrain: ["Vert terrain", ["#f2f5f4", "#13201c", "#0f6f8a"], ["#111715", "#eef4f2", "#3fb5d6"]],
};
const AV_COLORS = ["#c0392b", "#2c6e9b", "#7a5c99", "#3f8f6b", "#b07a2a", "#8e44ad", "#16808a", "#a0522d"];
const posLabel = n => (S.pos === "num" ? String(n) : POSITIONS[S.lang][n - 1][0]);
const posName = n => POSITIONS[S.lang][n - 1][1];

/* ---------- État ---------- */
const ui = { view: "matchs", stack: [], teamId: null, season: currentSeason(), matchId: null, sel: null, sub: null, fast: false, fastTimer: null, banner: false, bannerTimer: null,
  readonly: false, sheet: null, confirm: null, playerId: null, reportId: null, sort: "pts", statMode: "avg", range: "season", curve: "pts", ptab: "team",
  filters: { q: "", sex: "all", team: "all", season: currentSeason() }, edit: null, editPlayer: null, photo: undefined, prep: null, topic: null, memberEdit: null, pick: [], teamView: null };
const TABS = ["matchs", "saison", "effectif", "reglages"];
const team = () => db.teams.find(x => x.id === ui.teamId);
const match = () => db.matches.find(m => m.id === ui.matchId);
const playerById = id => db.players.find(p => p.id === id) || { id, first: "?", last: "", pos: [], sex: "F" };
const fullName = p => `${p.first} ${p.last}`.trim();
/* Nom court affiché : le prénom seul s'il est unique au club, sinon le prénom et le début du nom
   (Léa M., puis Léa Mar. si besoin). Un « nom affiché » choisi dans la fiche passe avant tout. */
function dispName(p, min) {
  if (!p) return "?";
  if (p.nick) return p.nick;
  const L = p.last || "", same = db.players.filter(x => x.id !== p.id && !x.nick && low(x.first) === low(p.first));
  if (!same.length) return min && L ? `${p.first} ${L[0]}.` : p.first;
  for (let k = Math.max(1, min || 0); k <= L.length; k++) {
    const pre = low(L.slice(0, k));
    if (!same.some(x => low(x.last || "").startsWith(pre))) return `${p.first} ${L.slice(0, k)}${k < L.length ? "." : ""}`;
  }
  return fullName(p);
}
const initials = p => ((p.first || "?")[0] + (p.last || "")[0] || "").toUpperCase();
function avatar(p, cls = "") {
  if (p.photo) return `<span class="av ${cls}"><img src="${p.photo}" alt=""></span>`;
  const c = AV_COLORS[[...(p.id || "x")].reduce((a, ch) => a + ch.charCodeAt(0), 0) % AV_COLORS.length];
  return `<span class="av ${cls}" style="background:${c}" aria-hidden="true">${esc(initials(p))}</span>`;
}
const posTags = p => (p.pos || []).map(n => `<span class="tag" title="${esc(posName(n))}">${posLabel(n)}</span>`).join("");
const teamSeason = (tm, se) => (tm && tm.seasons[se]) || { level: "", players: [] };
const roster = (tm, se) => teamSeason(tm, se).players.map(playerById);
const teamMatches = (tid, se) => db.matches.filter(m => m.teamId === tid && (!se || seasonOf(m.date) === se)).sort((a, b) => a.date.localeCompare(b.date) || a.created - b.created);
const rosterOf = (m, pid) => m.roster.find(r => r.pid === pid);
function allSeasons() {
  const set = new Set([currentSeason()]);
  db.matches.forEach(m => set.add(seasonOf(m.date)));
  db.teams.forEach(x => Object.keys(x.seasons).forEach(s => set.add(s)));
  return [...set].sort().reverse();
}
function pickDefaultTeam() {
  const mine = CLOUD && role() === "coach" ? db.teams.find(x => cloud.teams.includes(x.id)) : null;
  const tm = mine || db.teams[0];
  ui.teamId = tm ? tm.id : null;
}
function applyTheme() {
  const dark = S.mode === "dark" || (S.mode === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
  const r = document.documentElement;
  r.dataset.palette = S.palette; r.dataset.dark = dark ? "1" : "0"; r.lang = S.lang;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = PALETTES[S.palette][dark ? 2 : 1][0];
}

/* ---------- Navigation ---------- */
function go(view, extra) { Object.assign(ui, extra || {}); ui.stack.push(ui.view); ui.view = view; ui.sheet = null; window.scrollTo(0, 0); render(); }
function back() { ui.view = ui.stack.pop() || "matchs"; ui.sheet = null; render(); }
function tab(name) { ui.stack = []; ui.view = name; ui.sheet = null; window.scrollTo(0, 0); render(); }
let toastTimer = null;
function toast(text) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = text; el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 1600);
}
function confirmBox(text, yes, label, typed) { ui.confirm = { text, yes, label, typed }; render(); }

/* ---------- Statistiques de saison ---------- */
function seasonPlayerRows(tid, se, range) {
  let ms = teamMatches(tid, se);
  if (range === "last5") ms = ms.slice(-5);
  const ids = new Set(ms.flatMap(m => m.roster.map(r => r.pid)));
  return [...ids].map(id => {
    const played = ms.filter(m => playedIn(m, id));
    const sum = played.reduce((s, m) => addInto(s, playerTotal(m, id)), blank());
    const timedMin = played.filter(timed).reduce((s, m) => s + playerTotal(m, id).min, 0);
    return { p: playerById(id), gp: played.length, d: derive(sum), timedMin };
  }).filter(r => r.gp > 0);
}
function seasonTeamStats(tid, se, range, exclude) {
  let ms = teamMatches(tid, se).filter(m => m.id !== exclude && m.log.some(e => e.kind !== "sub"));
  if (range === "last5") ms = ms.slice(-5);
  let w = 0, l = 0, pf = 0, pa = 0;
  const sum = blank();
  ms.forEach(m => { const d = derive(teamTotal(m)), o = oppTotal(m); if (d.pts > o) w++; else if (d.pts < o) l++; pf += d.pts; pa += o; addInto(sum, teamTotal(m)); });
  return { n: ms.length, w, l, pf, pa, d: derive(sum), ms };
}
const avgOf = (s, f) => (s.n ? f(s) / s.n : 0);

/* ---------- Petits graphiques ---------- */
function spark(vals, labels) {
  if (vals.length < 2) return `<p class="muted small" style="margin:6px 0">${t("Pas encore assez de matchs pour une courbe.")}</p>`;
  const w = 340, h = 80, pad = 10, max = Math.max(...vals), min = Math.min(...vals);
  const pts = vals.map((v, i) => [pad + i * (w - 2 * pad) / (vals.length - 1), h - pad - (v - min) / (max - min || 1) * (h - 2 * pad - 10)]);
  const line = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const last = pts[pts.length - 1];
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(t("Évolution match par match"))}">
  <path d="${line} L${last[0]} ${h} L${pad} ${h} Z" fill="var(--text)" opacity=".07"/><path d="${line}" stroke="var(--text)" stroke-width="2.2" fill="none"/>
  ${pts.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="${i === pts.length - 1 ? 4.5 : 2.5}" fill="var(--text)"/>`).join("")}
  <text x="${last[0] - 4}" y="${Math.max(12, last[1] - 8)}" text-anchor="end" font-size="12" font-weight="700" fill="var(--text)">${esc(labels[labels.length - 1])}</text></svg>`;
}

/* ---------- Infos (ⓘ) ---------- */
const ib = (key, ctx) => `<button class="i" data-a="info" data-k="${key}" data-c="${esc(JSON.stringify(ctx || []))}" aria-label="${esc(t("Explication"))} ${esc(LEX[S.lang][key] ? LEX[S.lang][key].n : key)}">ⓘ</button>`;
const ih = key => `<button class="ih" data-a="info" data-k="${key}" data-c="[]" aria-label="${esc(t("Explication"))}">ⓘ</button>`;
function infoSheet(key, ctx) {
  const x = LEX[S.lang][key];
  if (!x) return "";
  const words = x.w || [t("À travailler"), t("Correct"), t("Très bon")];
  const cols = x.w ? ["#8a8a92", "#5a8dd6", "#1f9d55"] : ["#d7262f", "#c98a00", "#1f9d55"];
  return `<div class="grab"></div><h3>${esc(x.n)}<small>${esc(x.s)}</small></h3><p>${esc(x.d)}</p><div class="formula">${esc(x.f)}</div>
  ${ctx && ctx.length ? `<div class="yours">${ctx.map(([v, l]) => `<div><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join("")}</div>` : ""}
  ${x.sc ? `<div class="scale">${x.sc.map((s, i) => `<div style="background:${cols[i]}">${esc(words[i])}<br>${esc(s)}</div>`).join("")}</div><p class="muted small">${t("Repères indicatifs pour le basket amateur. Compare surtout avec la moyenne de ton équipe.")}</p>` : ""}
  <button class="link" data-a="lexique">${t("Voir le lexique complet")}</button><button class="btn main" data-a="closesheet">${t("Compris")}</button>`;
}

/* ================= ÉCRANS PRINCIPAUX ================= */
const clubLogo = cls => `<img class="${cls}" src="logo.png" alt="" onerror="this.style.visibility='hidden'">`;
function appbar() {
  const tm = team(), lvl = tm ? teamSeason(tm, ui.season).level : "";
  return `<header class="appbar"><span class="lefthead"><button class="teampick" data-a="teampick">${tm ? esc(tm.name) : t("Choisir une équipe")}</button></span><span class="mid">${esc(ui.season)}${lvl ? `<b>${esc(lvl)}</b>` : ""}</span>${clubLogo("clublogo")}</header>`;
}
function tabbar() {
  return `<nav class="tabbar">${TABS.map(k => `<button data-a="tab" data-n="${k}"${ui.view === k ? ' aria-current="page"' : ""}><svg viewBox="0 0 24 24" aria-hidden="true">${ICON[k]}</svg>${t(TAB_NAMES[k])}</button>`).join("")}</nav>`;
}
const TAB_NAMES = { matchs: "Matchs", saison: "Saison", effectif: "Effectif", reglages: "Réglages" };

function vMatchs() {
  const tm = team();
  if (!tm) return noTeam();
  const ms = teamMatches(tm.id, ui.season).reverse(), s = seasonTeamStats(tm.id, ui.season, "season");
  return `${canEditTeam(tm.id) ? `<button class="btn main big" data-a="newmatch">+ ${t("Nouveau match")}</button>` : ""}
  ${s.n ? `<button class="card row" data-a="tab" data-n="saison" style="border-top:1px solid var(--line)"><span class="grow"><b>${t("Bilan")} ${s.w} ${t("V")} – ${s.l} ${t("D")}</b><br><span class="muted small">${dec(avgOf(s, x => x.pf))} ${t("pts marqués")} · ${dec(avgOf(s, x => x.pa))} ${t("encaissés")}</span></span><span class="chev">›</span></button>` : ""}
  <div class="sec">${t("Matchs")} ${esc(ui.season)}</div>
  ${ms.length ? ms.map(m => { const d = derive(teamTotal(m)), r = result(m), live = !m.closed[3] && m.log.length && Date.now() - m.created < 6 * 3600e3;
    return `<button class="match" data-a="report" data-id="${m.id}"><span class="res ${r === "L" ? "l" : r === "N" ? "n" : ""}">${t(r === "W" ? "V" : r === "L" ? "D" : "N")}</span><span><b>${esc(m.opponent)}${live ? ` <span class="tag">${t("En cours")}</span>` : ""}</b><small>${fmtDate(m.date)}</small></span><span class="sc">${d.pts}-${oppTotal(m)}</span></button>`; }).join("")
  : `<p class="empty">${t("Aucun match cette saison.")}${canEditTeam(tm.id) ? "<br>" + t("Ajoute ton effectif, puis crée un match.") : ""}</p>`}`;
}
function noTeam() {
  return `<p class="empty">${t("Aucune équipe pour le moment.")}</p>${isAdmin() ? `<button class="btn main big" data-a="teams">${t("Créer une équipe")}</button>` : ""}`;
}
function seasonSelect() {
  return `<select class="inp" id="seasonsel" data-change="season" aria-label="${esc(t("Saison"))}">${allSeasons().map(s => `<option${s === ui.season ? " selected" : ""}>${s}</option>`).join("")}</select>`;
}
/* ---------- Analyses : balles perdues, fautes, tirs ---------- */
/* Rejoue le journal de chaque match pour savoir, à chaque action : le moment du quart-temps,
   l'écart au score, le cinq sur le terrain et depuis combien de temps chaque joueuse joue sans pause. */
function replayEvents(m) {
  const out = [], onSince = {}, qEntries = {};
  let us = 0, them = 0;
  const qReal = q => (m.real && m.real[q]) || 0;
  const scale = (q, el) => m.chrono === "prop" ? (qReal(q) > 0 ? el * QLEN(q) / qReal(q) : null) : el;
  const elOf = e => {
    if (m.chrono === "none" || !e.clock) return null;
    const [a, b] = String(e.clock).split(":").map(Number);
    if (isNaN(a) || isNaN(b)) return null;
    const s = a * 60 + b;
    return m.chrono === "prop" ? scale(e.q, s) : QLEN(e.q) - s;
  };
  const gameT = (q, el) => (el == null ? null : QS.slice(0, q).reduce((x, _, i) => x + QLEN(i), 0) + el);
  m.log.forEach(e => { (qEntries[e.q] = qEntries[e.q] || []).push(e); });
  m.log.forEach(e => {
    if (e.kind === "sub") {
      const el = scale(e.q, e.el), g = gameT(e.q, el);
      if (e.in) onSince[e.in] = g;
      if (e.out) delete onSince[e.out];
      return;
    }
    const el = elOf(e), list = qEntries[e.q] || [], idx = list.indexOf(e);
    const frac = el != null ? el / QLEN(e.q) : (list.length > 1 ? idx / (list.length - 1) : .5);
    const g = gameT(e.q, el), court = e.five ? e.five.split("|") : [];
    const stint = {};
    court.forEach(pid => { if (g != null && onSince[pid] != null) stint[pid] = (g - onSince[pid]) / 60; });
    if (e.shot || e.stat || e.oppPts) out.push({ e, q: e.q, frac, margin: us - them, court, stint, five: e.five || "" });
    us += e.pts || 0; them += e.oppPts || 0;
  });
  return out;
}
const PHASES = [["2 premières min", f => f < .2], ["Milieu", f => f >= .2 && f < .8], ["2 dernières min", f => f >= .8]];
const pc = v => (v == null ? "-" : Math.round(v * 100) + (S.lang === "en" ? "%" : " %"));
const SCORE_SIT = [["Mené de plus de 5", x => x < -5], ["Serré (±5)", x => x >= -5 && x <= 5], ["Devant de plus de 5", x => x > 5]];
const STINTS = [["0 à 3 min sans pause", x => x < 3], ["3 à 6 min", x => x >= 3 && x < 6], ["Plus de 6 min", x => x >= 6]];
const blankA = () => ({ fga: 0, fgm: 0, tpm: 0, fta: 0, ftm: 0, tov: 0, pf: 0, pts: 0, n: 0 });
function addEv(a, ev) {
  const e = ev.e, d = e.d || 1;
  if (e.shot) { if (e.shot === "ft") { a.fta += d; if (e.made) { a.ftm += d; a.pts += d; } } else { a.fga += d; if (e.made) { a.fgm += d; a.pts += d * SHOT[e.shot].p; if (e.shot === "three") a.tpm += d; } } }
  if (e.stat === "tov") a.tov += d;
  if (e.stat === "pf") a.pf += d;
  a.n++;
}
const possA = a => a.fga + .44 * a.fta + a.tov;
const tovRate = a => possA(a) > 0 ? a.tov / possA(a) : null;
const efgA = a => a.fga > 0 ? (a.fgm + .5 * a.tpm) / a.fga : null;
function bucketize(evs, groups, keyFn, filter) {
  const res = groups.map(([l]) => ({ l, a: blankA() }));
  evs.forEach(ev => { if (filter && !filter(ev)) return; const k = keyFn(ev); if (k == null) return; const i = groups.findIndex(([, f]) => f(k)); if (i >= 0) addEv(res[i].a, ev); });
  return res;
}
function anaData(tid, se, range) {
  const s = seasonTeamStats(tid, se, range);
  const ms = s.ms, evMatches = ms.filter(m => m.log.some(e => e.shot || e.stat));
  const evs = evMatches.flatMap(m => replayEvents(m).map(x => ({ ...x, m })));
  return { s, ms, evMatches, evs, timedEv: evMatches.filter(m => m.chrono === "guided" || m.chrono === "manual" || m.chrono === "prop") };
}
/* Barres horizontales : libellé, barre proportionnelle, valeur affichée */
function bars(rows, opts) {
  const o = opts || {}, vals = rows.map(r => r.v).filter(v => v != null), max = o.max || Math.max(...vals, 0.0001);
  return `<div class="bars${o.wrap ? " wrap" : ""}">${rows.map(r => `<div class="bar${r.v == null ? " na" : ""}"><span class="bl">${esc(r.l)}${r.sub ? `<small>${esc(r.sub)}</small>` : ""}</span><span class="bt"><i class="${r.cls || o.cls || ""}" style="width:${r.v == null ? 0 : Math.max(2, Math.round(100 * r.v / max))}%"></i></span><span class="bv">${r.v == null ? "-" : esc(r.txt != null ? r.txt : String(r.v))}</span></div>`).join("")}</div>`;
}
const pctOr = v => (v == null ? null : v);
function sampleNote(n, min) {
  return n < (min || 5) ? `<div class="box warn small" style="margin:0"><b>${t("Échantillon encore petit")}</b>${t("{n} match(s) analysé(s) : ce sont des pistes, pas encore des tendances. Elles deviennent fiables à partir de 5 ou 6 matchs.", { n })}</div>` : "";
}
function vAnalyses() {
  const tm = team();
  if (!tm) return noTeam();
  const A = anaData(tm.id, ui.season, ui.range), tab = ui.anaTab || "tov";
  const head = `<p class="title">${t("Analyses")}</p>
  <div class="seg">${[["tov", "Balles perdues"], ["pf", "Fautes"], ["shots", "Tirs"]].map(([k, l]) => `<button data-a="anatab" data-n="${k}" aria-pressed="${tab === k}">${t(l)}</button>`).join("")}</div>
  <div class="btns">${seasonSelect()}<div class="seg"><button data-a="range" data-n="season" aria-pressed="${ui.range !== "last5"}">${t("Saison")}</button><button data-a="range" data-n="last5" aria-pressed="${ui.range === "last5"}">${t("5 derniers")}</button></div></div>`;
  if (!A.ms.length) return head + `<p class="empty">${t("Pas encore de match sur cette saison.")}</p>`;
  const body = tab === "tov" ? anaTov(A) : tab === "pf" ? anaFouls(A) : anaShots(A);
  return head + sampleNote(A.ms.length) + body + (A.evMatches.length < A.ms.length ? `<p class="muted small">${t("{n} match(s) importé(s) de l'ancienne appli ne comptent que dans les analyses par quart-temps et par joueuse.", { n: A.ms.length - A.evMatches.length })}</p>` : "");
}
/* Qui : tableau par joueuse */
function anaPlayers(A) {
  return seasonPlayerRows(team().id, ui.season, ui.range).filter(r => r.gp > 0);
}
function lineupRates(A, rate, minPoss, fmt) {
  const by = {};
  A.evs.forEach(ev => { if (!ev.five) return; (by[ev.five] = by[ev.five] || blankA()); addEv(by[ev.five], ev); });
  const rows = Object.entries(by).map(([k, a]) => ({ ids: k.split("|"), a, v: rate(a), poss: possA(a) })).filter(r => r.v != null && r.poss >= minPoss);
  return rows;
}
const namesOf = ids => ids.map(id => dispName(playerById(id))).join(" · ");
function anaTov(A) {
  const d = A.s.d, team = tovRate({ ...blankA(), fga: d.fga, fta: d.fta, tov: d.tov });
  const qs = QS.map((q, i) => { const a = A.ms.reduce((x, m) => { const v = derive(teamQuarter(m, i)); x.fga += v.fga; x.fta += v.fta; x.tov += v.tov; return x; }, blankA()); return { l: q, a }; }).filter(r => possA(r.a) > 0);
  const toRow = r => ({ l: t(r.l), v: tovRate(r.a), txt: tovRate(r.a) == null ? "-" : `${pc(tovRate(r.a))} · ${r.a.tov} ${t("BP")}`, cls: "neg" });
  const ph = bucketize(A.evs, PHASES, ev => ev.frac), sc = bucketize(A.evs, SCORE_SIT, ev => ev.margin);
  const stint = A.evs.length ? bucketize(A.evs.flatMap(ev => ev.e.stat === "tov" || ev.e.shot ? [{ ...ev, k: ev.stint[ev.e.pid] }] : []), STINTS, ev => ev.k) : [];
  const players = anaPlayers(A).map(r => { const x = r.d; const p = x.fga + .44 * x.fta + x.tov; return { l: dispName(r.p), sub: `${x.tov} ${t("BP")} · ${t("{n} m.", { n: r.gp })}`, v: p >= 5 ? x.tov / p : null, txt: p >= 5 ? pc(x.tov / p) : "-", usg: r }; }).sort((a, b) => (b.v ?? -1) - (a.v ?? -1));
  const lus = lineupRates(A, tovRate, 8).sort((a, b) => b.v - a.v);
  return `<div class="card help"><p>${t("Taux de balles perdues : la part des attaques qui finissent par une perte de balle. Équipe : {p} sur la période.", { p: `<b>${pc(team)}</b>` })}</p></div>
  <div class="sec">${t("Quand ?")}</div>
  <div class="card"><div class="sub">${t("Par quart-temps")}</div>${bars(qs.map(toRow))}
  <div class="sub">${t("Moment du quart-temps")}</div>${bars(ph.map(toRow))}
  <div class="sub">${t("Selon le score")}</div>${bars(sc.map(toRow))}</div>
  <div class="sec">${t("Qui ?")}</div>
  <div class="card"><p class="muted small" style="margin:0 0 6px">${t("Part de ses attaques perdues. Une joueuse qui porte beaucoup le ballon en perd forcément plus : regarde aussi son USG dans le tableau de la saison.")}</p>${bars(players.slice(0, 10), { cls: "neg" })}</div>
  <div class="sec">${t("Avec quel cinq ?")}</div>
  <div class="card">${lus.length ? bars([...lus.slice(0, 3), ...(lus.length > 3 ? lus.slice(-2) : [])].map(r => ({ l: namesOf(r.ids), v: r.v, txt: `${pc(r.v)} · ${r.a.tov} ${t("BP")}`, cls: "neg" })), { wrap: true }) + `<p class="muted small" style="margin:6px 0 0">${t("Les 3 cinq qui perdent le plus de ballons, puis les 2 qui en perdent le moins (au moins 8 attaques ensemble).")}</p>` : `<p class="muted small">${t("Pas encore assez de temps de jeu ensemble.")}</p>`}</div>
  <div class="sec">${t("Fatigue")}</div>
  <div class="card">${A.timedEv.length ? bars(stint.map(r => ({ l: t(r.l), v: tovRate(r.a), txt: tovRate(r.a) == null ? "-" : `${pc(tovRate(r.a))} · ${r.a.tov} ${t("BP")}`, cls: "neg" }))) + `<p class="muted small" style="margin:6px 0 0">${t("Taux de balles perdues selon le temps que la joueuse a passé sur le terrain sans sortir.")}</p>` : `<p class="muted small">${t("Disponible pour les matchs saisis avec un chrono.")}</p>`}</div>`;
}
function anaFouls(A) {
  const pl = anaPlayers(A);
  const trouble = pl.map(r => {
    let early = 0, half = 0, out = 0;
    A.ms.forEach(m => { if (!m.stats[r.p.id] || !playedIn(m, r.p.id)) return; const f = i => (m.stats[r.p.id][i] || {}).pf || 0; if (f(0) >= 2) early++; if (f(0) + f(1) >= 3) half++; if (QS.reduce((s, _, i) => s + f(i), 0) >= 5) out++; });
    const p40 = r.timedMin > 0 ? r.d.pf / (r.timedMin / 60) * 40 : null;
    return { r, early, half, out, p40 };
  });
  const per40 = trouble.filter(x => x.r.d.pf > 0).sort((a, b) => (b.p40 ?? b.r.d.pf / b.r.gp) - (a.p40 ?? a.r.d.pf / a.r.gp)).slice(0, 10).map(x => ({ l: dispName(x.r.p), sub: `${x.r.d.pf} ${t("fautes")} · ${t("{n} m.", { n: x.r.gp })}`, v: x.p40 ?? x.r.d.pf / x.r.gp, txt: x.p40 != null ? t("{n} / 40 min", { n: dec(x.p40) }) : t("{n} / match", { n: dec(x.r.d.pf / x.r.gp) }), cls: "warn" }));
  const qs = QS.map((q, i) => { const n = A.ms.reduce((s, m) => s + derive(teamQuarter(m, i)).pf, 0); return { l: q, v: A.ms.length ? n / A.ms.length : 0, txt: t("{n} / match", { n: dec(A.ms.length ? n / A.ms.length : 0) }), cls: "warn", n }; }).filter(r => r.n > 0 || r.l !== "Prol.");
  /* Fautes commises alors que l'équipe en avait déjà 4 dans le quart-temps : elles donnent des lancers francs */
  let bonus = 0, totalPf = 0;
  A.evMatches.forEach(m => { const cnt = {}; m.log.forEach(e => { if (e.stat !== "pf") return; const d = e.d || 1; if (d > 0) { cnt[e.q] = (cnt[e.q] || 0); if (cnt[e.q] >= 4) bonus++; totalPf++; } cnt[e.q] = (cnt[e.q] || 0) + d; }); });
  const ph = bucketize(A.evs, PHASES, ev => ev.frac), sc = bucketize(A.evs, SCORE_SIT, ev => ev.margin);
  const perMatch = n => A.evMatches.length ? n / A.evMatches.length : 0;
  const pfRow = r => ({ l: t(r.l), v: r.a.pf, txt: `${r.a.pf} ${t("fautes")}`, cls: "warn" });
  const fd = pl.filter(r => r.d.fd > 0).sort((a, b) => b.d.fd - a.d.fd).slice(0, 8).map(r => ({ l: dispName(r.p), sub: `${r.d.fta} ${t("LF tentés")}`, v: r.d.fd, txt: `${r.d.fd}`, cls: "pos" }));
  const tr = trouble.filter(x => x.early || x.half || x.out).sort((a, b) => (b.out * 3 + b.half * 2 + b.early) - (a.out * 3 + a.half * 2 + a.early));
  return `<div class="sec">${t("Qui ?")}</div>
  <div class="card"><p class="muted small" style="margin:0 0 6px">${t("Fautes rapportées à 40 minutes de jeu : la mesure la plus juste pour comparer.")}</p>${per40.length ? bars(per40) : `<p class="muted small">-</p>`}</div>
  <div class="sec">${t("Joueuses en danger")}</div>
  <div class="card">${tr.length ? `<table class="lutable"><thead><tr><th>${t("Joueur")}</th><th>${t("2 f. au Q1")}</th><th>${t("3 f. à la mi-temps")}</th><th>${t("5 fautes")}</th></tr></thead><tbody>${tr.map(x => `<tr><td class="ids">${esc(dispName(x.r.p))}<small>${t("{n} m.", { n: x.r.gp })}</small></td><td>${x.early || "-"}</td><td>${x.half || "-"}</td><td class="${x.out ? "neg" : ""}">${x.out || "-"}</td></tr>`).join("")}</tbody></table><p class="muted small" style="margin:6px 0 0">${t("Nombre de matchs où c'est arrivé.")}</p>` : `<p class="muted small">${t("Aucune joueuse n'a eu d'ennuis de fautes.")}</p>`}</div>
  <div class="sec">${t("Quand ?")}</div>
  <div class="card"><div class="sub">${t("Par quart-temps")}</div>${bars(qs)}
  <div class="sub">${t("Moment du quart-temps")}</div>${bars(ph.map(pfRow))}
  <div class="sub">${t("Selon le score")}</div>${bars(sc.map(pfRow))}</div>
  <div class="sec">${t("Ce que ça coûte")}</div>
  <div class="kpis"><div class="kpi"><b>${dec(perMatch(bonus))}</b><span>${t("Fautes / match au-delà de 4 fautes d'équipe")}</span></div><div class="kpi"><b>${totalPf ? pc(bonus / totalPf) : "-"}</b><span>${t("Part des fautes qui donnent des LF")}</span></div><div class="kpi"><b>${dec(A.ms.length ? A.s.d.pf / A.ms.length : 0)}</b><span>${t("Fautes / match")}</span></div></div>
  <div class="sec">${t("Fautes provoquées")}</div>
  <div class="card">${fd.length ? bars(fd) : `<p class="muted small">${t("Aucune faute provoquée notée pour le moment.")}</p>`}</div>`;
}
function anaShots(A) {
  const d = A.s.d;
  const zones = [["Raquette", d.rm, d.ra, 2], ["Mi-distance", d.mm, d.ma, 2], ["3 pts", d.tm, d.ta, 3], ["Lancers francs", d.fm, d.fa, 1]].map(([l, m, a, p]) => ({ l: t(l), v: a ? m * p / a : null, txt: a ? `${dec(m * p / a, 2)} ${t("pt/tir")} · ${m}/${a}` : "-", sub: a ? pc(m / a) : "", cls: "pos" }));
  const pl = anaPlayers(A).filter(r => r.d.fga + r.d.fta > 0).sort((a, b) => b.d.pts - a.d.pts);
  const cell = (m, a, p) => a ? `<b>${dec(m * p / a, 1)}</b><small>${m}/${a}</small>` : "-";
  const qs = QS.map((q, i) => { const a = A.ms.reduce((x, m) => { const v = derive(teamQuarter(m, i)); x.fga += v.fga; x.fgm += v.fgm; x.tpm += v.tpm; return x; }, blankA()); return { l: q, a }; }).filter(r => r.a.fga > 0);
  const efgRow = r => ({ l: t(r.l), v: efgA(r.a), txt: efgA(r.a) == null ? "-" : `${pc(efgA(r.a))} · ${r.a.fgm}/${r.a.fga}`, cls: "pos" });
  const ph = bucketize(A.evs, PHASES, ev => ev.frac), sc = bucketize(A.evs, SCORE_SIT, ev => ev.margin);
  const stint = bucketize(A.evs.flatMap(ev => ev.e.shot ? [{ ...ev, k: ev.stint[ev.e.pid] }] : []), STINTS, ev => ev.k);
  const ftClutch = blankA(); A.evs.forEach(ev => { if (ev.e.shot === "ft" && ev.q >= 3 && ev.frac >= .8 && Math.abs(ev.margin) <= 5) addEv(ftClutch, ev); });
  const lus = lineupRates(A, efgA, 0, null).filter(r => r.a.fga >= 8).sort((a, b) => b.v - a.v);
  return `<div class="card help"><p>${t("Points par tir : ce que rapporte en moyenne un tir dans chaque zone. C'est le meilleur repère pour choisir ses tirs : un tir à 1,0 point vaut mieux qu'un tir à 0,7, même s'il rentre moins souvent.")}</p></div>
  <div class="sec">${t("Points par tir selon la zone")}</div>
  <div class="card">${bars(zones)}</div>
  <div class="sec">${t("Situations")}</div>
  <div class="kpis"><div class="kpi"><b>${d.fbp}</b><span>${t("Pts contre-attaque")}</span>${ib("fbp", [])}</div><div class="kpi"><b>${d.scp}</b><span>${t("Pts 2e chance")}</span>${ib("scp", [])}</div><div class="kpi"><b>${d.ptov}</b><span>${t("Pts après interc.")}</span>${ib("ptov", [])}</div></div>
  <div class="sec">${t("Qui tire où ?")}</div>
  <div class="card"><div class="tw"><table class="lutable"><thead><tr><th>${t("Joueur")}</th><th>${t("Raquette")}</th><th>${t("Mi-dist.")}</th><th>3 pts</th><th>${t("LF")}</th><th>eFG</th></tr></thead><tbody>${pl.map(r => { const x = r.d; return `<tr data-a="player" data-id="${r.p.id}"><td class="ids">${esc(dispName(r.p))}<small>${x.pts} pts</small></td><td>${cell(x.rm, x.ra, 2)}</td><td>${cell(x.mm, x.ma, 2)}</td><td>${cell(x.tm, x.ta, 3)}</td><td>${cell(x.fm, x.fa, 1)}</td><td>${x.fga ? pc(eFG(x)) : "-"}</td></tr>`; }).join("")}</tbody></table></div><p class="muted small" style="margin:6px 0 0">${t("En gros : points par tir. En petit : réussis / tentés.")}</p></div>
  <div class="sec">${t("Quand ?")}</div>
  <div class="card"><div class="sub">${t("Adresse (eFG) par quart-temps")}</div>${bars(qs.map(efgRow))}
  <div class="sub">${t("Moment du quart-temps")}</div>${bars(ph.map(efgRow))}
  <div class="sub">${t("Selon le score")}</div>${bars(sc.map(efgRow))}
  <div class="sub">${t("Lancers francs en fin de match serré")}</div>${bars([{ l: t("Q4 et prol., 2 dernières min, ±5"), v: ftClutch.fta ? ftClutch.ftm / ftClutch.fta : null, txt: ftClutch.fta ? `${pc(ftClutch.ftm / ftClutch.fta)} · ${ftClutch.ftm}/${ftClutch.fta}` : "-", cls: "pos" }, { l: t("Toute la saison"), v: d.fa ? d.fm / d.fa : null, txt: d.fa ? `${pc(d.fm / d.fa)} · ${d.fm}/${d.fa}` : "-", cls: "pos" }], { max: 1 })}</div>
  <div class="sec">${t("Fatigue")}</div>
  <div class="card">${A.timedEv.length ? bars(stint.map(efgRow)) + `<p class="muted small" style="margin:6px 0 0">${t("Adresse selon le temps passé sur le terrain sans sortir.")}</p>` : `<p class="muted small">${t("Disponible pour les matchs saisis avec un chrono.")}</p>`}</div>
  <div class="sec">${t("Avec quel cinq ?")}</div>
  <div class="card">${lus.length ? bars([...lus.slice(0, 3), ...(lus.length > 3 ? lus.slice(-2) : [])].map(r => ({ l: namesOf(r.ids), v: r.v, txt: `${pc(r.v)} · ${r.a.fgm}/${r.a.fga}`, cls: "pos" })), { max: 1, wrap: true }) + `<p class="muted small" style="margin:6px 0 0">${t("Les 3 cinq les plus adroits, puis les 2 les moins adroits (au moins 8 tirs ensemble).")}</p>` : `<p class="muted small">${t("Pas encore assez de temps de jeu ensemble.")}</p>`}</div>`;
}

function vSaison() {
  const tm = team();
  if (!tm) return noTeam();
  const s = seasonTeamStats(tm.id, ui.season, ui.range), d = s.d, poss = possessions(d);
  const timedMs = s.ms.filter(timed);
  const rows = seasonPlayerRows(tm.id, ui.season, ui.range);
  const mode = ui.statMode, per = r => mode === "avg" ? r.gp : mode === "p40" ? (r.timedMin / 60 / 40 || 0) : 1;
  const v = (r, x) => { const q = per(r); return q > 0 ? x / q : 0; };
  const COLS = [["min", "Min"], ["pts", "Pts"], ["reb", "Reb"], ["ast", "PD"], ["stl", "Int"], ["blk", "Ctr"], ["tov", "BP"], ["pf", "F"], ["pir", "PIR", "pir"], ["fgp", "% tir"], ["tpp", "3 pts"], ["ftp", "LF"], ["efg", "eFG", "efg"], ["ts", "TS", "ts"], ["usg", "USG", "usg"], ["pm", "+/-", "pm"]];
  const t5 = seasonTeamStats(tm.id, ui.season, "season");
  const cell = (r, k) => {
    const x = r.d;
    switch (k) {
      case "min": return r.timedMin ? fmtClock(mode === "tot" ? r.timedMin : r.timedMin / r.gp) : "-";
      case "fgp": return pctTxt(safe(x.fgm, x.fga));
      case "tpp": return pctTxt(safe(x.tpm, x.tpa));
      case "ftp": return pctTxt(safe(x.ftm, x.fta));
      case "efg": return pctTxt(eFG(x));
      case "ts": return pctTxt(TS(x));
      case "usg": return pctTxt(usage({ ...x, min: r.timedMin }, { ...t5.d, min: t5.ms.filter(timed).reduce((a, m) => a + teamTotal(m).min, 0) }));
      case "pm": return mode === "tot" ? signed(x.pm) : signedDec(v(r, x.pm));
      default: return mode === "tot" ? String(x[k]) : dec(v(r, x[k]));
    }
  };
  const sortVal = (r, k) => ({ min: r.timedMin / (mode === "tot" ? 1 : r.gp), fgp: safe(r.d.fgm, r.d.fga), tpp: safe(r.d.tpm, r.d.tpa), ftp: safe(r.d.ftm, r.d.fta), efg: eFG(r.d), ts: TS(r.d), usg: r.d.fga + r.d.fta + r.d.tov }[k] ?? v(r, r.d[k]));
  rows.sort((a, b) => sortVal(b, ui.sort) - sortVal(a, ui.sort));
  const curveDefs = { pts: [t("Points marqués"), m => derive(teamTotal(m)).pts, x => String(x)], opp: [t("Points encaissés"), m => oppTotal(m), x => String(x)], efg: ["eFG", m => eFG(derive(teamTotal(m))), x => pctTxt(x)], tov: [t("Balles perdues"), m => teamTotal(m).tov, x => String(x)] };
  const cd = curveDefs[ui.curve];
  const lus = seasonLineups(s.ms).filter(r => r.sec >= 120 || !timed(s.ms[0] || { chrono: "none" })).sort((a, b) => (b.pf - b.pa) - (a.pf - a.pa));
  const lvl = teamSeason(tm, ui.season).level;
  return `<div class="btns">${seasonSelect()}<div class="seg"><button data-a="range" data-n="season" aria-pressed="${ui.range === "season"}">${t("Saison")}</button><button data-a="range" data-n="last5" aria-pressed="${ui.range === "last5"}">${t("5 derniers")}</button></div></div>
  ${!s.n ? `<p class="empty">${t("Aucun match sur cette période.")}</p>` : `
  <div class="kpis">
    <div class="kpi"><b>${s.w}-${s.l}</b><span>${t("Bilan")}</span></div>
    <div class="kpi"><b>${dec(s.pf / s.n)}</b><span>${t("Pts / match")}</span></div>
    <div class="kpi"><b>${dec(s.pa / s.n)}</b><span>${t("Encaissés")}</span></div>
    <div class="kpi"><b>${pctTxt(eFG(d))}</b><span>eFG</span>${ib("efg", [[pctTxt(eFG(d)), t("Équipe")]])}</div>
    <div class="kpi"><b>${pctTxt(TS(d))}</b><span>TS</span>${ib("ts", [[pctTxt(TS(d)), t("Équipe")]])}</div>
    <div class="kpi"><b>${dec(d.tov / s.n)}</b><span>${t("BP / match")}</span>${ib("tovp", [[pctTxt(tovPct(d)), "TOV %"]])}</div>
    <div class="kpi"><b>${poss > 0 ? dec(d.pts / poss * 100) : "-"}</b><span>Off Rtg</span>${ib("ortg", [[poss > 0 ? dec(d.pts / poss * 100) : "-", t("Équipe")]])}</div>
    <div class="kpi"><b>${poss > 0 ? dec(s.pa / poss * 100) : "-"}</b><span>Def Rtg</span>${ib("drtg", [[poss > 0 ? dec(s.pa / poss * 100) : "-", t("Équipe")]])}</div>
    <div class="kpi"><b>${signedDec((s.pf - s.pa) / s.n)}</b><span>${t("Écart moyen")}</span></div>
  </div>
  <div class="card"><div class="seg" style="margin-bottom:6px">${Object.entries(curveDefs).map(([k, c]) => `<button data-a="curve" data-n="${k}" aria-pressed="${ui.curve === k}">${esc(c[0])}</button>`).join("")}</div>
  ${spark(s.ms.map(cd[1]), s.ms.map(m => cd[2](cd[1](m))))}</div>
  <div class="sec">${t("Joueurs")}</div>
  <div class="seg"><button data-a="statmode" data-n="avg" aria-pressed="${mode === "avg"}">${t("Moyennes")}</button><button data-a="statmode" data-n="tot" aria-pressed="${mode === "tot"}">${t("Totaux")}</button><button data-a="statmode" data-n="p40" aria-pressed="${mode === "p40"}"${timedMs.length ? "" : " disabled"}>${t("Sur 40 min")}</button></div>
  <div class="card"><div class="tw"><table><thead><tr><th>${t("Joueur")}</th><th>${t("MJ")}</th>${COLS.map(([k, n, info]) => `<th data-a="sort" data-n="${k}" class="${ui.sort === k ? "sorted" : ""}">${esc(t(n))}${ui.sort === k ? " ▾" : ""}${info ? ih(info) : ""}</th>`).join("")}</tr></thead>
  <tbody>${rows.map(r => `<tr data-a="player" data-id="${r.p.id}"${mode === "p40" && r.timedMin < LOW_MIN ? ' class="low"' : ""}><td><b>${esc(dispName(r.p, 1))}</b></td><td>${r.gp}</td>${COLS.map(([k]) => `<td>${cell(r, k)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>${mode === "p40" && rows.some(r => r.timedMin < LOW_MIN) ? `<p class="muted small" style="margin:6px 0 0">${t("En gris : moins de 40 minutes jouées, chiffres à prendre avec prudence.")}</p>` : ""}</div>
  <p class="muted small" style="margin:0">${t("Touche un titre pour trier, un joueur pour sa fiche. Un absent ne compte pas comme un 0.")}</p>
  <div class="row" style="padding:0;border:0"><span class="sec grow" style="margin:0">${t("Cinq et duos")}${ih("lineups")}</span><div class="seg" style="width:auto">${[["best", "Meilleurs"], ["worst", "Moins bons"]].map(([k, l]) => `<button class="${(ui.luSort || "best") === k ? "on" : ""}" data-a="lusort" data-n="${k}">${t(l)}</button>`).join("")}</div></div>
  <div class="sec">${t("Cinq")}</div>
  <div class="card">${lineupTable(luSorted(lus).slice(0, 5), id => dispName(playerById(id)), t("Pas encore assez de temps de jeu ensemble."))}</div>
  <div class="sec">${t("Duos")}${ih("duos")}</div>
  <div class="card">${lineupTable(luSorted(duoRows(lus.map(x => ({ ...x }))).filter(r => r.sec >= 300 || !timedMs.length)).slice(0, 5), id => dispName(playerById(id)), "-")}</div>`}
  <div class="sec">${t("Analyses")}</div>
  <div class="anabtns">${[["tov", "Balles perdues"], ["pf", "Fautes"], ["shots", "Tirs"]].map(([k, l]) => `<button class="btn" data-a="analyses" data-n="${k}">${t(l)}</button>`).join("")}</div>
  <div class="btns"><button class="btn" data-a="teamsheet" data-id="${tm.id}">${t("Historique de l'équipe")}</button><button class="btn" data-a="xlsseason">Excel</button></div>
  ${lvl ? "" : ""}`;
}
function luSorted(rows) {
  const k = r => r.pf - r.pa;
  return [...rows].sort((a, b) => ui.luSort === "worst" ? k(a) - k(b) || b.sec - a.sec : k(b) - k(a) || b.sec - a.sec);
}
function lineupTable(rows, name, empty) {
  if (!rows.length) return `<p class="muted small" style="margin:4px 0">${esc(empty)}</p>`;
  const withTime = rows.some(r => r.sec);
  return `<table class="lutable"><thead><tr><th>${t("Joueurs")}</th>${withTime ? `<th>${t("Temps")}</th>` : ""}<th>${t("Marqués")}</th><th>${t("Encaissés")}</th><th>+/-</th></tr></thead><tbody>${rows.map(r => { const d = r.pf - r.pa; return `<tr><td class="ids">${r.ids.map(id => esc(name(id))).join(" · ")}${r.gp ? `<small>${r.gp} ${t("matchs")}</small>` : ""}</td>${withTime ? `<td>${r.sec ? fmtClock(r.sec) : "-"}</td>` : ""}<td>${r.pf}</td><td>${r.pa}</td><td class="${d > 0 ? "pos" : d < 0 ? "neg" : ""}"><b>${signed(d)}</b></td></tr>`; }).join("")}</tbody></table>`;
}
function vEffectif() {
  const tm = team();
  if (!tm) return noTeam();
  const list = roster(tm, ui.season).sort((a, b) => a.first.localeCompare(b.first));
  const can = canEditTeam(tm.id);
  return `<div class="btns">${seasonSelect()}<span></span></div>
  ${can ? `<div class="btns"><button class="btn main" data-a="newplayer">+ ${t("Nouveau joueur")}</button><button class="btn" data-a="pickplayers">${t("Ajouter du club")}</button></div>` : ""}
  <div class="card">${list.length ? list.map(p => `<button class="row" data-a="player" data-id="${p.id}">${avatar(p)}<span class="grow"><b>${esc(fullName(p))}</b> ${posTags(p)}</span><span class="chev">›</span></button>`).join("") : `<p class="empty">${t("Effectif vide pour cette saison.")}</p>`}</div>
  <p class="muted small" style="margin:0">${t("Les numéros de maillot se choisissent à chaque match.")}</p>`;
}
function vReglages() {
  const dark = document.documentElement.dataset.dark === "1";
  return `<div class="sec">${t("Langue")}</div>
  <div class="seg">${[["fr", "Français"], ["en", "English"], ["es", "Español"]].map(([k, n]) => `<button data-a="set" data-k="lang" data-n="${k}" aria-pressed="${S.lang === k}">${n}</button>`).join("")}</div>
  <div class="sec">${t("Apparence")}</div>
  <div class="seg">${[["auto", "Comme le téléphone"], ["light", "Clair"], ["dark", "Sombre"]].map(([k, n]) => `<button data-a="set" data-k="mode" data-n="${k}" aria-pressed="${S.mode === k}">${t(n)}</button>`).join("")}</div>
  <div class="themes">${Object.entries(PALETTES).map(([k, [n, l, d]]) => `<button class="sw" data-a="set" data-k="palette" data-n="${k}" aria-pressed="${S.palette === k}"><div class="dots">${(dark ? d : l).map(c => `<i style="background:${c}"></i>`).join("")}</div>${esc(t(n))}</button>`).join("")}</div>
  <div class="sec">${t("Positions")}</div>
  <div class="seg"><button data-a="set" data-k="pos" data-n="num" aria-pressed="${S.pos === "num"}">${t("Numéros (1 à 5)")}</button><button data-a="set" data-k="pos" data-n="abbr" aria-pressed="${S.pos === "abbr"}">${t("Abréviations")}</button></div>
  <p class="muted small" style="margin:0">${POSITIONS[S.lang].map((x, i) => `${S.pos === "num" ? i + 1 : x[0]} = ${esc(x[1])}`).join(" · ")}</p>
  <div class="sec">${t("Saisie")}</div>
  <div class="card">
    <div class="row" style="flex-wrap:wrap"><span class="grow">${t("Saisie adverse")}<br><span class="muted small">${t("Par défaut pour les nouveaux matchs")}</span></span><div class="seg" style="width:100%">${OPP_MODES.map(k => `<button data-a="set" data-k="oppMode" data-n="${k}" aria-pressed="${(S.oppMode || "simple") === k}">${t(OPP_MODE_INFO[k][0])}</button>`).join("")}</div></div>
    <button class="row" data-a="chronoset"><span class="grow">${t("Mode de chrono")}<br><span class="muted small">${t(CHRONO_INFO[S.chrono][0])}</span></span><span class="chev">›</span></button>
    ${[["fast", "Bouton contre-attaque"], ["fd", "Bouton fautes provoquées"], ["ba", "Bouton contres subis"]].map(([k, n]) => `<div class="row"><span class="grow">${t(n)}</span><button class="switch" role="switch" data-a="toggle" data-k="${k}" aria-checked="${!!S[k]}" aria-label="${esc(t(n))}"></button></div>`).join("")}
    <div class="row"><span class="grow">${t("Affichage de la saisie")}<br><span class="muted small">${t("Vertical ou horizontal : l'écran suit la rotation de l'appareil.")}</span></span><select class="inp" style="width:auto" data-change="layout" aria-label="${esc(t("Affichage de la saisie"))}">${LAYOUTS.map(([k, n]) => `<option value="${k}"${S.layout === k ? " selected" : ""}>${esc(t(n))}</option>`).join("")}</select></div>
  </div>
  <div class="sec">${t("Club")}</div>
  <div class="card">
    <button class="row" data-a="teams"><span class="grow">${t("Équipes")}</span><span class="chev">›</span></button>
    <button class="row" data-a="clubplayers"><span class="grow">${t("Joueurs du club")}</span><span class="chev">›</span></button>
    ${isAdmin() ? `<button class="row" data-a="prepseason"><span class="grow">${t("Préparer la saison {s}", { s: nextSeasonToPrepare() })}</span><span class="chev">›</span></button>` : ""}
    ${CLOUD && isAdmin() ? `<button class="row" data-a="members"><span class="grow">${t("Membres et accès")}</span><span class="chev">›</span></button>` : ""}
    <button class="row" data-a="backupview"><span class="grow">${t("Sauvegarde et export")}</span><span class="chev">›</span></button>
    ${isAdmin() || role() === "coach" ? `<button class="row" data-a="trashview"><span class="grow">${t("Corbeille")}${trashVisible().length ? ` <span class="tag">${trashVisible().length}</span>` : ""}</span><span class="chev">›</span></button>` : ""}
    ${CLOUD ? `<button class="row" data-a="account"><span class="grow">${t("Compte")}<br><span class="muted small">${esc(cloud.user ? cloud.user.email : "")} · ${t(ROLE_NAMES[role()])}</span></span><span class="chev">›</span></button>` : ""}
  </div>
  <div class="card"><button class="row" data-a="help"><span class="grow"><b>${t("Aide")}</b><br><span class="muted small">${t("Comment ça marche, et ce que veulent dire les stats")}</span></span><span class="chev">›</span></button></div>
  <p class="muted small" style="text-align:center">Stats Basket 2.0</p>`;
}
const ROLE_NAMES = { admin: "Administrateur", coach: "Coach", reader: "Lecteur" };
const LAYOUTS = [["c", "Compact"], ["f", "Complet"]];
/* Le sens de l'écran suit l'appareil : horizontal dès que l'écran est plus large que haut. */
const isLand = () => window.innerWidth > window.innerHeight && window.innerWidth >= 560;
let lastLand = null;
window.addEventListener("resize", () => { const l = isLand(); if (l !== lastLand) { lastLand = l; if (ui.view === "match") render(); } });
const CHRONO_INFO = {
  guided: ["Chrono guidé", "Tu démarres et arrêtes le chrono à chaque coup de sifflet. Arrêté, il clignote en rouge, et un bandeau te rappelle de le relancer si tu notes une action de jeu."],
  manual: ["Chrono manuel", "Comme le guidé, avec le clignotement, mais sans aucun bandeau de rappel."],
  prop: ["Temps proportionnel", "Départ au début du quart-temps, Clore à la fin, sans gérer les arrêts. Les minutes sont estimées à partir du temps réel sur le terrain."],
  none: ["Sans chrono", "Seulement les stats. Le +/- reste exact, mais ni minutes, ni stats sur 40 min, ni USG."],
};
const CHRONO_SHORT = { guided: "Chrono officiel + rappel", manual: "Chrono officiel", prop: "Départ et Clore seulement", none: "Stats seulement" };

/* ================= SOUS-ÉCRANS ================= */
function vChronoSet() {
  return `<p class="title">${t("Mode de chrono")}</p><p class="muted small" style="margin:0">${t("Choix par défaut pour les nouveaux matchs. Tu peux le changer pour chaque match.")}</p>
  ${CHRONOS.map(k => `<button class="opt" role="radio" data-a="set" data-k="chrono" data-n="${k}" aria-checked="${S.chrono === k}"><span class="radio"></span><span><b>${t(CHRONO_INFO[k][0])}${k === "guided" ? ` <span class="tag">${t("Conseillé")}</span>` : k === "prop" ? ` <span class="tag">${t("Seul à la table")}</span>` : ""}</b><p>${t(CHRONO_INFO[k][1])}</p></span></button>`).join("")}
  <button class="link" data-a="topic" data-n="chrono">${t("En savoir plus sur les modes de chrono")}</button>`;
}
function vNewMatch() {
  const editing = ui.edit ? db.matches.find(x => x.id === ui.edit) : null;
  const tm = editing ? db.teams.find(x => x.id === editing.teamId) : team();
  const date = editing ? editing.date : (ui.form.date || todayISO());
  const se = seasonOf(date);
  const prev = teamMatches(tm.id).filter(m => m.id !== (editing && editing.id)).pop();
  const lastNo = {};
  teamMatches(tm.id).forEach(m => m.roster.forEach(r => { lastNo[r.pid] = r.no; }));
  let list = roster(tm, se);
  if (editing) editing.roster.forEach(r => { if (!list.some(p => p.id === r.pid)) list.push(playerById(r.pid)); });
  list = list.sort((a, b) => (lastNo[a.id] || 99) - (lastNo[b.id] || 99));
  const checked = id => editing ? !!rosterOf(editing, id) : (ui.form.checked ? ui.form.checked.includes(id) : (prev ? !!rosterOf(prev, id) : true));
  const chrono = editing ? editing.chrono : (ui.form.chrono || S.chrono);
  return `<p class="title">${editing ? t("Numéros et présents") : t("Nouveau match")}</p>
  ${editing ? "" : `<div class="field"><label for="opp">${t("Adversaire")}</label><input class="inp" id="opp" autocomplete="off" value="${esc(ui.form.opp || "")}"></div>
  <div class="field"><label for="date">${t("Date")}</label><input class="inp" id="date" type="date" value="${date}" data-change="date"></div>
  <div class="sec">${t("Chrono pour ce match")}</div>
  <div class="seg4">${CHRONOS.map(k => `<button data-a="formchrono" data-n="${k}" aria-pressed="${chrono === k}">${t(CHRONO_INFO[k][0].replace("Chrono ", "").replace(/^./, c => c.toUpperCase()))}<small>${t(CHRONO_SHORT[k])}</small></button>`).join("")}</div>
  <button class="link" data-a="topic" data-n="chrono">${t("C'est quoi la différence ?")}</button>
  <div class="sec">${t("Saisie adverse")}</div>
  <div class="seg">${OPP_MODES.map(k => `<button data-a="formoppmode" data-n="${k}" aria-pressed="${(ui.form.oppMode || S.oppMode || "simple") === k}">${t(OPP_MODE_INFO[k][0])}<small>${t(OPP_MODE_INFO[k][1])}</small></button>`).join("")}</div>`}
  <div class="sec">${t("Joueurs présents et numéros du jour")}</div>
  <div class="card">${list.length ? list.map(p => `<div class="check"><input type="checkbox" id="c-${p.id}" aria-label="${esc(fullName(p))}"${checked(p.id) ? " checked" : ""}><label for="c-${p.id}">${esc(fullName(p))} ${posTags(p)}</label><input class="inp" id="n-${p.id}" inputmode="numeric" maxlength="3" aria-label="${esc(t("Numéro de {n}", { n: fullName(p) }))}" value="${editing ? (rosterOf(editing, p.id) || {}).no ?? "" : lastNo[p.id] ?? ""}"></div>`).join("") : `<p class="empty">${t("Ajoute d'abord des joueurs à l'effectif de cette saison.")}</p>`}</div>
  <button class="btn main big" data-a="savematch">${editing ? t("Enregistrer") : t("Créer le match")}</button>`;
}
function pnav(n) {
  const edit = ui.view === "editplayer", cur = edit ? ui.editPlayer : ui.playerId;
  const l = ui.plist || [], i = l.indexOf(cur);
  if (l.length < 2 || i < 0) return;
  const next = l[(i + n + l.length) % l.length];
  const move = () => { ui.playerId = next; if (edit) { ui.editPlayer = next; ui.form = {}; ui.photo = undefined; } window.scrollTo(0, 0); render(); };
  if (edit && editDirty()) { confirmBox(t("Enregistrer les modifications avant de passer au joueur suivant ?"), () => { if (savePlayer(true)) move(); }, t("Enregistrer")); return; }
  move();
}
function editDirty() {
  keepForm();
  const p = playerById(ui.editPlayer), f = ui.form;
  if (!p) return false;
  return (f.first != null && f.first.trim() !== p.first) || (f.last != null && f.last.trim() !== p.last) || (f.nick != null && f.nick.trim() !== (p.nick || "")) || (f.sex && f.sex !== p.sex) || (f.pos && f.pos.join() !== (p.pos || []).join()) || ui.photo !== undefined;
}
/* Glisser à gauche ou à droite sur la fiche pour changer de joueur */
let swipe0 = null;
document.addEventListener("touchstart", e => { swipe0 = ui.view === "player" && e.touches.length === 1 && !e.target.closest(".tw") ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null; }, { passive: true });
document.addEventListener("touchend", e => {
  if (!swipe0 || ui.view !== "player" || ui.sheet || ui.confirm) return;
  const dx = e.changedTouches[0].clientX - swipe0.x, dy = e.changedTouches[0].clientY - swipe0.y;
  swipe0 = null;
  if (Math.abs(dx) > 70 && Math.abs(dy) < 45) pnav(dx < 0 ? 1 : -1);
}, { passive: true });
const LOW_MIN = 40 * 60;
function vPlayer() {
  const p = playerById(ui.playerId), tm = team();
  const teamsOf = db.teams.filter(x => db.matches.some(m => m.teamId === x.id && m.stats[p.id]) || Object.values(x.seasons).some(s => s.players.includes(p.id)));
  if (!teamsOf.some(x => x.id === ui.ptab) && ui.ptab !== "club") ui.ptab = teamsOf.some(x => x.id === (tm && tm.id)) ? tm.id : (teamsOf[0] ? teamsOf[0].id : "club");
  const ms = db.matches.filter(m => m.stats[p.id] && (ui.ptab === "club" || m.teamId === ui.ptab) && seasonOf(m.date) === ui.season).sort((a, b) => a.date.localeCompare(b.date));
  const played = ms.filter(m => playedIn(m, p.id));
  const sum = derive(played.reduce((s, m) => addInto(s, playerTotal(m, p.id)), blank())), gp = played.length || 1;
  const timedMin = played.filter(timed).reduce((s, m) => s + playerTotal(m, p.id).min, 0);
  const last5 = derive(played.slice(-5).reduce((s, m) => addInto(s, playerTotal(m, p.id)), blank())), g5 = Math.min(5, played.length) || 1;
  const career = {};
  db.matches.filter(m => playedIn(m, p.id)).forEach(m => {
    const k = seasonOf(m.date) + "|" + m.teamId;
    const c = career[k] = career[k] || { se: seasonOf(m.date), tm: db.teams.find(x => x.id === m.teamId), gp: 0, sum: blank() };
    c.gp++; addInto(c.sum, playerTotal(m, p.id));
  });
  const can = teamsOf.some(x => canEditTeam(x.id)) || isAdmin();
  return `<div class="phead">${avatar(p, "lg")}<div><p class="pname">${esc(fullName(p))}</p><p class="muted small" style="margin:4px 0 0">${(p.pos || []).map(posName).map(esc).join(", ") || t("Poste non renseigné")} · ${t(p.sex === "M" ? "Masculin" : "Féminin")}</p></div></div>
  <div class="seg">${teamsOf.map(x => `<button data-a="ptab" data-n="${x.id}" aria-pressed="${ui.ptab === x.id}">${esc(x.name)}</button>`).join("")}${teamsOf.length > 1 ? `<button data-a="ptab" data-n="club" aria-pressed="${ui.ptab === "club"}">${t("Total club")}</button>` : ""}</div>
  <div class="btns">${seasonSelect()}<span class="muted small" style="align-self:center">${played.length} ${t("matchs joués")}${timedMin ? " · " + fmtClock(timedMin / gp) + " " + t("min/m") : ""}</span></div>
  ${played.length ? `<div class="kpis">
    <div class="kpi"><b>${dec(sum.pts / gp)}</b><span>${t("Points")}</span></div><div class="kpi"><b>${dec(sum.reb / gp)}</b><span>${t("Rebonds")}</span></div><div class="kpi"><b>${dec(sum.ast / gp)}</b><span>${t("Passes décisives")}</span></div>
    <div class="kpi"><b>${dec(sum.stl / gp)}</b><span>${t("Interceptions")}</span></div><div class="kpi"><b>${dec(sum.pir / gp)}</b><span>PIR</span>${ib("pir", [[dec(sum.pir / gp), t("Saison")], [dec(last5.pir / g5), t("5 derniers")]])}</div><div class="kpi"><b>${pctTxt(TS(sum))}</b><span>TS</span>${ib("ts", [[pctTxt(TS(sum)), t("Saison")], [pctTxt(TS(last5)), t("5 derniers")]])}</div>
    <div class="kpi"><b>${dec(sum.tov / gp)}</b><span>${t("Balles perdues")}</span></div><div class="kpi"><b>${dec(sum.pf / gp)}</b><span>${t("Fautes")}</span></div><div class="kpi"><b>${signedDec(sum.pm / gp)}</b><span>+/-</span>${ib("pm", [])}</div>
    <div class="kpi"><b>${dec(sum.blk / gp)}</b><span>${t("Contres")}</span></div><div class="kpi"><b>${dec(sum.orb / gp)}</b><span>${t("Reb. off.")}</span></div><div class="kpi"><b>${dec(sum.fd / gp)}</b><span>${t("Fautes prov.")}</span></div>
  </div>
  ${timedMin ? (() => { const st = derive(played.filter(timed).reduce((a, m) => addInto(a, playerTotal(m, p.id)), blank())), k = 40 / (timedMin / 60), low = timedMin < LOW_MIN, cols = [["pts", "Pts"], ["reb", "Reb"], ["ast", t("PD")], ["stl", t("Int")], ["tov", t("BP")], ["pf", t("F")]];
    return `<div class="sec">${t("Par match et sur 40 min")}</div><div class="card"><table class="p40"><thead><tr><th></th>${cols.map(([, n]) => `<th>${n}</th>`).join("")}</tr></thead><tbody>
    <tr><td class="muted">${t("Par match")}</td>${cols.map(([c]) => `<td>${dec(sum[c] / gp)}</td>`).join("")}</tr>
    <tr class="${low ? "low" : "strong"}"><td>${t("Sur 40 min")}</td>${cols.map(([c]) => `<td>${dec(st[c] * k)}</td>`).join("")}</tr></tbody></table>
    ${low ? `<p class="warnline">⚠ ${t("Peu de minutes ({n} min au total) : à prendre avec prudence.", { n: Math.round(timedMin / 60) })}</p>` : ""}</div>`; })() : ""}
  <div class="sec">${t("Forme : 5 derniers matchs contre la saison")}</div>
  <div class="card"><table><thead><tr><th></th><th>Pts</th><th>Reb</th><th>${t("PD")}</th><th>PIR</th><th>TS</th></tr></thead><tbody>
    <tr><td>${t("Saison")}</td><td>${dec(sum.pts / gp)}</td><td>${dec(sum.reb / gp)}</td><td>${dec(sum.ast / gp)}</td><td>${dec(sum.pir / gp)}</td><td>${pctTxt(TS(sum))}</td></tr>
    <tr><td>${t("5 derniers")}</td>${[["pts"], ["reb"], ["ast"], ["pir"]].map(([k]) => { const a = last5[k] / g5, b = sum[k] / gp; return `<td class="${a > b + .5 ? "pos" : a < b - .5 ? "neg" : ""}">${dec(a)}</td>`; }).join("")}<td>${pctTxt(TS(last5))}</td></tr></tbody></table></div>
  <div class="sec">${t("Réussite par zone")}</div>
  <div class="zones">${SHOTS.map(s => { const x = safe(sum[s.m], sum[s.a]); return `<div class="zone"><b>${pctTxt(x)}</b><span>${t(s.l)} · ${sum[s.m]}/${sum[s.a]}</span><div class="bz"><i style="width:${Math.round(x * 100)}%"></i></div></div>`; }).join("")}</div>
  <div class="card"><div class="sec" style="margin:0 0 4px">${t("Points par match")}</div>${spark(played.map(m => derive(playerTotal(m, p.id)).pts), played.map(m => String(derive(playerTotal(m, p.id)).pts)))}</div>
  <div class="sec">${t("Ses matchs")}</div>
  <div class="card">${[...played].reverse().map(m => { const d = derive(playerTotal(m, p.id)); return `<button class="row" data-a="report" data-id="${m.id}"><span class="grow"><b>${esc(m.opponent)}</b> <span class="muted small">${fmtDate(m.date)}</span></span><span class="small">${d.pts} pts · ${d.reb} reb · ${d.ast} ${t("pd")} · PIR ${d.pir}</span></button>`; }).join("")}</div>`
  : `<p class="empty">${t("Pas encore de match sur cette saison.")}</p>`}
  <div class="sec">${t("Carrière au club")}</div>
  <div class="card"><div class="tw"><table><thead><tr><th>${t("Saison")}</th><th>${t("Équipe")}</th><th>${t("MJ")}</th><th>Pts</th><th>Reb</th><th>${t("PD")}</th><th>PIR</th></tr></thead><tbody>
  ${Object.values(career).sort((a, b) => b.se.localeCompare(a.se)).map(c => { const d = derive(c.sum), lv = c.tm ? teamSeason(c.tm, c.se).level : ""; return `<tr><td>${c.se}</td><td>${esc(c.tm ? c.tm.name : "?")}${lv ? " · " + esc(lv) : ""}</td><td>${c.gp}</td><td>${dec(d.pts / c.gp)}</td><td>${dec(d.reb / c.gp)}</td><td>${dec(d.ast / c.gp)}</td><td>${dec(d.pir / c.gp)}</td></tr>`; }).join("") || `<tr><td colspan="7" class="muted">-</td></tr>`}
  </tbody></table></div></div>
  <div class="btns">${can ? `<button class="btn" data-a="editplayer" data-id="${p.id}">${t("Modifier")}</button>` : "<span></span>"}<button class="btn" data-a="shareplayer" data-id="${p.id}">${t("Partager")}</button></div>
  ${tm && canEditTeam(tm.id) && teamSeason(tm, ui.season).players.includes(p.id) ? `<button class="btn danger" data-a="removefromteam" data-id="${p.id}">${t("Retirer de {t} ({s})", { t: tm.name, s: ui.season })}</button>` : ""}`;
}
function vEditPlayer() {
  const p = ui.editPlayer ? playerById(ui.editPlayer) : { first: "", last: "", pos: [], sex: (team() || {}).cat || "F", photo: "" };
  const pos = ui.form.pos || p.pos || [];
  const photo = ui.photo !== undefined ? ui.photo : p.photo;
  return `<p class="title">${ui.editPlayer ? t("Modifier le joueur") : t("Nouveau joueur")}</p>
  <div class="photo-edit">${avatar({ ...p, photo, first: ui.form.first ?? p.first, last: ui.form.last ?? p.last }, "lg")}<div style="display:grid;gap:6px"><label class="btn sm" style="display:grid;place-items:center">${t(photo ? "Changer la photo" : "Ajouter une photo")}<input type="file" id="photo" accept="image/*" hidden data-change="photo"></label>${photo ? `<button class="btn sm danger" data-a="nophoto">${t("Retirer la photo")}</button>` : ""}</div></div>
  <p class="muted small" style="margin:0">${t("Pour les mineurs, demande l'accord des parents avant d'ajouter une photo. Elle n'est visible que par les membres du club.")}</p>
  <div class="field"><label for="pf">${t("Prénom")}</label><input class="inp" id="pf" value="${esc(ui.form.first ?? p.first)}" autocomplete="off"></div>
  <div class="field"><label for="pl">${t("Nom")}</label><input class="inp" id="pl" value="${esc(ui.form.last ?? p.last)}" autocomplete="off"></div>
  <div class="field"><label for="pn">${t("Nom affiché (facultatif)")}</label><input class="inp" id="pn" value="${esc(ui.form.nick ?? p.nick ?? "")}" autocomplete="off" maxlength="16" placeholder="${esc(dispName({ ...p, nick: "", first: ui.form.first ?? p.first ?? "", last: ui.form.last ?? p.last ?? "" }) || t("ex. Léa B."))}"><p class="muted small" style="margin:4px 0 0">${t("Utile si deux joueurs ont le même prénom. Sinon l'appli les distingue toute seule : Léa M., Léa D.")}</p></div>
  <div class="field"><span class="lbl">${t("Catégorie")}</span><div class="seg">${CATS.map(c => `<button data-a="formsex" data-n="${c}" aria-pressed="${(ui.form.sex || p.sex) === c}">${t(c === "F" ? "Féminin" : "Masculin")}</button>`).join("")}</div></div>
  <div class="field"><span class="lbl">${t("Positions (de une à cinq)")}</span><div class="poschips">${[1, 2, 3, 4, 5].map(n => `<button data-a="formpos" data-n="${n}" aria-pressed="${pos.includes(n)}" title="${esc(posName(n))}">${posLabel(n)}</button>`).join("")}</div></div>
  <button class="btn main big" data-a="saveplayer">${t("Enregistrer")}</button>
  ${ui.editPlayer && isAdmin() && !db.matches.some(m => m.stats[ui.editPlayer]) ? `<button class="btn danger" data-a="deleteplayer">${t("Supprimer du club")}</button>` : ""}`;
}
function vPickPlayers() {
  const tm = team(), se = ui.season, inTeam = new Set(teamSeason(tm, se).players);
  const q = low(ui.form.q || "");
  const list = db.players.filter(p => !inTeam.has(p.id) && catOk(p, tm) && (!q || low(fullName(p)).includes(q))).sort((a, b) => a.first.localeCompare(b.first));
  return `<p class="title">${t("Ajouter du club")}</p><p class="muted small" style="margin:0">${esc(tm.name)} · ${se}</p>
  <input class="inp" id="pq" placeholder="${esc(t("Rechercher un nom"))}" value="${esc(ui.form.q || "")}" data-input="pq">
  <p class="muted small" style="margin:0">${t("Seuls les joueurs de catégorie {c} sont proposés.", { c: catName(tm.cat) })}</p>
  <div class="card">${list.length ? list.map(p => `<label class="check"><input type="checkbox" data-pick="${p.id}"${ui.pick.includes(p.id) ? " checked" : ""}>${avatar(p, "sm")}<span>${esc(fullName(p))} ${posTags(p)}<br><span class="muted small">${esc(playerTeamsLabel(p.id, se) || t("Sans équipe cette saison"))}</span></span></label>`).join("") : `<p class="empty">${t("Aucun joueur à ajouter.")}</p>`}</div>
  <button class="btn main big" data-a="addpicked">${t("Ajouter la sélection")}</button>`;
}
/* Catégorie : un joueur masculin ne joue que dans une équipe masculine, et une joueuse dans une équipe féminine */
const catOk = (p, tm) => !tm || !tm.cat || !p || !p.sex || p.sex === tm.cat;
const catName = c => t(c === "M" ? "masculine" : "féminine");
function teamsOfPlayer(pid) { return db.teams.filter(x => Object.values(x.seasons || {}).some(s => (s.players || []).includes(pid))); }
function playerTeamsLabel(pid, se) { return db.teams.filter(x => teamSeason(x, se).players.includes(pid)).map(x => x.name).join(" · "); }
function vClubPlayers() {
  const f = ui.filters, q = low(f.q);
  const list = db.players.filter(p => (f.sex === "all" || p.sex === f.sex) && (!q || low(fullName(p)).includes(q)) && (f.team === "all" || (f.team === "none" ? !playerTeamsLabel(p.id, f.season) : teamSeason(db.teams.find(x => x.id === f.team), f.season).players.includes(p.id))))
    .sort((a, b) => a.first.localeCompare(b.first));
  return `<p class="title">${t("Joueurs du club")} <span class="tag">${db.players.length}</span></p>
  <input class="inp" placeholder="${esc(t("Rechercher un nom"))}" value="${esc(f.q)}" data-input="fq" id="fq">
  <div class="seg">${[["all", "Tous"], ["F", "Féminin"], ["M", "Masculin"]].map(([k, n]) => `<button data-a="filter" data-k="sex" data-n="${k}" aria-pressed="${f.sex === k}">${t(n)}</button>`).join("")}</div>
  <div class="btns"><select class="inp" data-change="fteam" aria-label="${esc(t("Équipe"))}"><option value="all">${t("Toutes les équipes")}</option>${db.teams.map(x => `<option value="${x.id}"${f.team === x.id ? " selected" : ""}>${esc(x.name)}</option>`).join("")}<option value="none"${f.team === "none" ? " selected" : ""}>${t("Sans équipe cette saison")}</option></select>
  <select class="inp" data-change="fseason" aria-label="${esc(t("Saison"))}">${allSeasons().map(s => `<option${s === f.season ? " selected" : ""}>${s}</option>`).join("")}</select></div>
  <div class="sec">${list.length} ${t(list.length > 1 ? "joueurs" : "joueur")}</div>
  <div class="card">${list.map(p => { const tl = playerTeamsLabel(p.id, f.season); return `<button class="row" data-a="player" data-id="${p.id}">${avatar(p)}<span class="grow"><b>${esc(fullName(p))}</b><br><span class="small ${tl ? "muted" : "neg"}">${esc(tl || t("Sans équipe cette saison"))}</span></span>${posTags(p)}</button>`; }).join("") || `<p class="empty">${t("Aucun joueur ne correspond.")}</p>`}</div>
  ${isAdmin() || role() === "coach" ? `<button class="btn main big" data-a="newplayerclub">+ ${t("Nouveau joueur")}</button>` : ""}`;
}
function vTeams() {
  return `<p class="title">${t("Équipes")}</p>
  ${CATS.map(c => { const list = db.teams.filter(x => x.cat === c); return `<div class="sec">${t(c === "F" ? "Féminin" : "Masculin")}</div><div class="card">${list.map(x => { const lv = teamSeason(x, ui.season).level; return `<button class="row" data-a="teamsheet" data-id="${x.id}"><span class="grow"><b>${esc(x.name)}</b>${lv ? ` <span class="tag">${esc(lv)}</span>` : ""}<br><span class="muted small">${teamSeason(x, ui.season).players.length} ${t("joueurs")} · ${teamMatches(x.id, ui.season).length} ${t("matchs")}</span></span><span class="chev">›</span></button>`; }).join("") || `<p class="muted small" style="margin:6px 0">${t("Aucune équipe.")}</p>`}</div>`; }).join("")}
  ${isAdmin() ? `<div class="card" style="display:grid;gap:8px"><b>${t("Nouvelle équipe")}</b><input class="inp" id="tname" placeholder="${esc(t("Nom, par exemple Seniors F"))}"><div class="btns"><select class="inp" id="tcat">${CATS.map(c => `<option value="${c}">${t(c === "F" ? "Féminin" : "Masculin")}</option>`).join("")}</select><input class="inp" id="tlevel" placeholder="${esc(t("Division, ex. D2"))}"></div><button class="btn main" data-a="addteam">${t("Créer l'équipe")}</button></div>` : ""}`;
}
function vTeamSheet() {
  const x = db.teams.find(y => y.id === ui.teamView);
  if (!x) return `<p class="empty">-</p>`;
  const seasons = [...new Set([...Object.keys(x.seasons), ...db.matches.filter(m => m.teamId === x.id).map(m => seasonOf(m.date))])].sort().reverse();
  const arrow = st => st === "up" ? `<span class="pos">↑ ${t("promue")}</span>` : st === "down" ? `<span class="neg">↓ ${t("reléguée")}</span>` : "";
  return `<p class="title">${esc(x.name)}</p><p class="muted small" style="margin:0">${t(x.cat === "F" ? "Féminin" : "Masculin")}</p>
  <div class="sec">${t("Historique")}</div>
  <div class="card">${seasons.map(se => { const ts = teamSeason(x, se), s = seasonTeamStats(x.id, se, "season"); return `<div class="row"><b style="width:66px">${se}</b><span class="grow">${esc(ts.level || "-")} ${arrow(ts.status)}</span><span class="small">${ts.rank ? esc(ts.rank) + t("e") + " · " : ""}${s.n ? `${s.w}-${s.l}` : t("à venir")}</span></div>`; }).join("")}</div>
  <div class="sec">${t("D'une saison à l'autre")}</div>
  <div class="card"><div class="tw"><table><thead><tr><th>${t("Saison")}</th><th>${t("Niv.")}</th><th>${t("Pts/m")}</th><th>${t("Enc./m")}</th><th>eFG</th><th>${t("BP/m")}</th></tr></thead><tbody>
  ${seasons.map(se => { const s = seasonTeamStats(x.id, se, "season"); return s.n ? `<tr><td>${se}</td><td>${esc(teamSeason(x, se).level || "-")}</td><td>${dec(s.pf / s.n)}</td><td>${dec(s.pa / s.n)}</td><td>${pctTxt(eFG(s.d))}</td><td>${dec(s.d.tov / s.n)}</td></tr>` : ""; }).join("")}</tbody></table></div></div>
  ${isAdmin() ? `<div class="sec">${t("Modifier")}</div><div class="card" style="display:grid;gap:8px">
    <div class="field"><label for="tn">${t("Nom")}</label><input class="inp" id="tn" value="${esc(x.name)}"></div>
    <div class="btns"><div class="field"><label for="tl">${t("Division")} ${ui.season}</label><input class="inp" id="tl" value="${esc(teamSeason(x, ui.season).level || "")}"></div><div class="field"><label for="tr">${t("Classement final")}</label><input class="inp" id="tr" inputmode="numeric" value="${esc(teamSeason(x, ui.season).rank || "")}"></div></div>
    <button class="btn main" data-a="saveteam" data-id="${x.id}">${t("Enregistrer")}</button></div>
    <button class="btn danger" data-a="delteam" data-id="${x.id}">${t("Supprimer l'équipe")}</button>` : ""}`;
}
function nextSeasonToPrepare() {
  const all = db.teams.flatMap(x => Object.keys(x.seasons)).concat(currentSeason()).sort();
  return nextSeason(all[all.length - 1]);
}
function vPrepSeason() {
  const P = ui.prep;
  if (!P) return "";
  if (P.i >= P.teams.length) {
    return `<p class="title">${t("Saison {s} prête", { s: P.to })}</p><div class="card">${P.teams.map(id => { const x = db.teams.find(y => y.id === id), r = P.res[id]; return `<div class="row"><span class="grow"><b>${esc(x.name)}</b></span><span>${esc(r.level || "-")} ${r.status === "up" ? "↑" : r.status === "down" ? "↓" : "="}</span><span class="muted small">${r.players.length} ${t("joueurs")}</span></div>`; }).join("")}</div>
    <button class="btn main big" data-a="prepdone">${t("Valider la saison {s}", { s: P.to })}</button>`;
  }
  const x = db.teams.find(y => y.id === P.teams[P.i]), from = teamSeason(x, P.from), r = P.res[x.id];
  const others = db.players.filter(p => p.sex === x.cat && !from.players.includes(p.id)).sort((a, b) => a.first.localeCompare(b.first));
  return `<p class="muted small" style="margin:0">${t("Étape {a} sur {b}", { a: P.i + 1, b: P.teams.length })} · ${P.from} → ${P.to}</p>
  <p class="title">${esc(x.name)}</p><p class="muted small" style="margin:0">${t("En {s} : {l}", { s: P.from, l: from.level || "-" })}${from.rank ? ", " + esc(from.rank) + t("e") : ""}</p>
  <div class="sec">${t("Niveau en {s}", { s: P.to })}</div>
  <div class="seg">${[["up", "↑ Promue"], ["same", "= Maintenue"], ["down", "↓ Reléguée"]].map(([k, n]) => `<button data-a="prepstatus" data-n="${k}" aria-pressed="${r.status === k}">${t(n)}</button>`).join("")}</div>
  <div class="field"><label for="plevel">${t("Division")}</label><input class="inp" id="plevel" value="${esc(r.level)}"></div>
  <div class="sec">${t("Effectif : coche ceux qui restent")}</div>
  <div class="card">${from.players.map(playerById).map(p => `<label class="check"><input type="checkbox" data-prep="${p.id}"${r.players.includes(p.id) ? " checked" : ""}><span>${esc(fullName(p))}</span>${posTags(p)}</label>`).join("") || `<p class="muted small">-</p>`}</div>
  <details class="card"><summary>${t("Ajouter des joueurs du club")} (${others.length})</summary>${others.map(p => `<label class="check"><input type="checkbox" data-prep="${p.id}"${r.players.includes(p.id) ? " checked" : ""}><span>${esc(fullName(p))}<br><span class="muted small">${esc(playerTeamsLabel(p.id, P.from) || t("Sans équipe cette saison"))}</span></span>${posTags(p)}</label>`).join("")}</details>
  <div class="btns"><button class="btn" data-a="prepprev"${P.i === 0 ? " disabled" : ""}>${t("Précédente")}</button><button class="btn main" data-a="prepnext">${t("Suivante")} ›</button></div>`;
}
function vMembers() {
  const list = Object.entries(cloud.members).sort((a, b) => a[0].localeCompare(b[0]));
  return `<p class="title">${t("Membres et accès")}</p>
  <div class="card">${list.map(([e, m]) => `<button class="row" data-a="memberedit" data-n="${esc(e)}"><span class="grow"><b>${esc(e)}</b><br><span class="muted small">${t(ROLE_NAMES[m.role])}${m.role === "coach" ? " · " + (m.teams || []).map(id => (db.teams.find(x => x.id === id) || { name: "?" }).name).map(esc).join(", ") : ""}</span></span><span class="chev">›</span></button>`).join("")}</div>
  <button class="btn main big" data-a="memberedit" data-n="">+ ${t("Ajouter un membre")}</button>
  <div class="card help"><p><b>${t("Rôles")}</b></p><ul><li>${t("Administrateur : tout, y compris les membres et les équipes.")}</li><li>${t("Coach : saisit et modifie seulement les équipes que tu lui attribues. Voit les autres en lecture seule.")}</li><li>${t("Lecteur : consulte les stats sans rien modifier.")}</li></ul></div>`;
}
function vMemberEdit() {
  const e = ui.memberEdit, m = e ? cloud.members[e] : null, me = low(cloud.user ? cloud.user.email : "");
  const r = ui.form.role || (m ? m.role : "coach"), teams = ui.form.teams || (m ? m.teams || [] : []);
  return `<p class="title">${e ? esc(e) : t("Ajouter un membre")}</p>
  ${e ? "" : `<div class="field"><label for="memail">${t("E-mail")}</label><input class="inp" id="memail" type="email" inputmode="email" autocomplete="off"></div>`}
  <div class="field"><span class="lbl">${t("Rôle")}</span><div class="seg">${["admin", "coach", "reader"].map(k => `<button data-a="formrole" data-n="${k}" aria-pressed="${r === k}"${e === me ? " disabled" : ""}>${t(ROLE_NAMES[k])}</button>`).join("")}</div></div>
  ${r === "coach" ? `<div class="sec">${t("Équipes qu'il peut saisir")}</div><div class="card">${db.teams.map(x => `<label class="check"><input type="checkbox" data-mteam="${x.id}"${teams.includes(x.id) ? " checked" : ""}><span>${esc(x.name)}</span><span></span></label>`).join("")}</div>` : ""}
  <button class="btn main big" data-a="savemember">${t("Enregistrer")}</button>
  ${e && e !== me ? `<button class="btn danger" data-a="delmember">${t("Retirer l'accès")}</button>` : ""}`;
}
function trashVisible() { return db.trash.filter(x => isAdmin() || (x.teamId && canEditTeam(x.teamId))).sort((a, b) => b.at - a.at); }
function trashLabel(x) {
  if (x.kind === "match") { const d = derive(teamTotal(x.obj)), tm = db.teams.find(y => y.id === x.obj.teamId) || (db.trash.find(y => y.id === x.obj.teamId) || {}).obj; return [t("Match"), `${tm ? tm.name + " " : ""}${t("contre")} ${x.obj.opponent} · ${fmtDate(x.obj.date)} · ${d.pts}-${oppTotal(x.obj)}`]; }
  if (x.kind === "team") return [t("Équipe"), x.obj.name];
  return [t("Joueur"), fullName(x.obj)];
}
function vTrash() {
  if (isAdmin() && trashPurgeOld()) save();
  const list = trashVisible();
  return `<p class="title">${t("Corbeille")}</p>
  <div class="card help"><p>${t("Ce qui est supprimé reste ici {n} jours, puis disparaît. Tu peux le restaurer à tout moment avant.", { n: TRASH_DAYS })}</p></div>
  <div class="card">${list.map(x => { const [k, l] = trashLabel(x), left = Math.max(0, Math.ceil((x.at + TRASH_DAYS * 864e5 - Date.now()) / 864e5)); return `<div class="row" style="flex-wrap:wrap"><span class="grow"><span class="muted small">${esc(k)}${x.withTeam ? " · " + t("avec l'équipe") : ""}</span><br><b>${esc(l)}</b><br><span class="muted small">${t("Supprimé le {d}{b} · encore {n} j", { d: fmtDate(new Date(x.at).toISOString().slice(0, 10)), b: x.by ? " " + t("par {n}", { n: x.by }) : "", n: left })}</span></span>
    ${x.withTeam ? "" : `<button class="btn" data-a="trashrestore" data-id="${x.id}">${t("Restaurer")}</button>`}${isAdmin() && !x.withTeam ? `<button class="btn danger" data-a="trashpurge" data-id="${x.id}">${t("Supprimer définitivement")}</button>` : ""}</div>`; }).join("") || `<p class="empty">${t("La corbeille est vide.")}</p>`}</div>`;
}

/* ---------- Importer l'Excel d'un match de l'ancienne appli ---------- */
const normName = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
function findClubPlayer(name) {
  const n = normName(name);
  return db.players.find(p => normName(p.first + " " + p.last) === n || normName(p.last + " " + p.first) === n) || null;
}
function parseOldExcel(buf) {
  const wb = XLSX.read(buf, { type: "array" });
  const rows = name => wb.Sheets[name] ? XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: null }) : null;
  const mt = rows("Match"), det = rows("Détail joueurs"), qt = rows("Quarts-temps"), jr = rows("Journal");
  if (!mt || !det || !qt) throw new Error("format");
  const title = String((mt[0] || [])[0] || ""), cut = title.lastIndexOf(" contre ");
  const teamName = cut > 0 ? title.slice(0, cut).trim() : "", opponent = cut > 0 ? title.slice(cut + 8).trim() : title;
  const dateRow = mt.find(r => r && r[0] === "Date");
  let date = dateRow ? dateRow[1] : "";
  if (typeof date === "number") date = new Date(Math.round((date - 25569) * 864e5)).toISOString().slice(0, 10);
  date = String(date || todayISO()).slice(0, 10);
  const H = det[0], col = name => H.indexOf(name);
  const MAP = { "+/-": "pm", Passes: "ast", Rebonds: "reb", "Reb. off.": "orb", Interceptions: "stl", Contres: "blk", "Balles perdues": "tov", Fautes: "pf", "Raquette réussis": "rm", "Raquette tentés": "ra", "Mi-dist. réussis": "mm", "Mi-dist. tentés": "ma", "3 pts réussis": "tm", "3 pts tentés": "ta", "LF réussis": "fm", "LF tentés": "fa" };
  const players = {}, order = [];
  det.slice(1).forEach(r => {
    if (!r || !r[col("Joueur")]) return;
    const q = QS.indexOf(String(r[col("QT")])), name = String(r[col("Joueur")]).trim(), no = Number(r[col("N°")]);
    if (q < 0) return;
    if (!players[name]) { players[name] = { name, no, q: QS.map(blank) }; order.push(name); }
    const v = players[name].q[q], mn = String(r[col("Minutes")] || "0:00").split(":").map(Number);
    v.min = (mn[0] || 0) * 60 + (mn[1] || 0);
    Object.entries(MAP).forEach(([h, k]) => { const i = col(h); if (i >= 0) v[k] = Number(r[i]) || 0; });
  });
  const qH = qt[0], opp = QS.map(() => 0), played = QS.map(() => false);
  qt.slice(1).forEach(r => { const q = QS.indexOf(String(r && r[0])); if (q >= 0) { opp[q] = Number(r[qH.indexOf("Points adv.")]) || 0; played[q] = true; } });
  const log = (jr || []).slice(1).filter(r => r && r[2]).map((r, i) => ({ id: "x" + i, kind: "old", q: Math.max(0, QS.indexOf(String(r[0]))), clock: String(r[1] || ""), text: String(r[2]), changes: [], ts: 0 }));
  return { teamName, opponent, date, opp, played, log, players: order.map(n => players[n]) };
}
function readOldExcel(file) {
  const fr = new FileReader();
  fr.onload = () => {
    let x;
    try { x = parseOldExcel(new Uint8Array(fr.result)); } catch (e) { toast(t("Ce fichier n'est pas un Excel de match de l'ancienne appli")); return; }
    const tm = db.teams.find(y => normName(y.name) === normName(x.teamName) && canEditTeam(y.id)) || (canEditTeam(ui.teamId) ? team() : db.teams.find(y => canEditTeam(y.id)));
    x.teamId = tm ? tm.id : (isAdmin() ? "new" : "");
    x.newCat = /masc|\bm\b|garçon|homme|seniors? m/i.test(x.teamName) ? "M" : "F";
    x.players.forEach(p => {
      const found = findClubPlayer(p.name);
      p.pid = found ? found.id : null;
      const parts = p.name.split(" ");
      p.first = parts[0]; p.last = parts.slice(1).join(" ");
    });
    ui.imp = x; go("importxl");
  };
  fr.readAsArrayBuffer(file);
}
function impCat(x) { return x.teamId === "new" ? x.newCat : ((db.teams.find(y => y.id === x.teamId) || {}).cat || ""); }
function impResolve(x) {
  const cat = impCat(x);
  x.players.forEach(p => {
    const found = findClubPlayer(p.name) || findClubPlayer(p.first + " " + p.last);
    p.pid = found && catOk(found, { cat }) ? found.id : null;
    p.conflict = found && !catOk(found, { cat }) ? found : null;
  });
  return x.players.filter(p => p.conflict);
}
function vImportXl() {
  const x = ui.imp;
  if (!x) return `<p class="empty">-</p>`;
  const conflicts = impResolve(x);
  const teams = db.teams.filter(y => canEditTeam(y.id));
  const us = x.players.reduce((s, p) => s + p.q.reduce((a, v) => a + 2 * (v.rm + v.mm) + 3 * v.tm + v.fm, 0), 0), them = x.opp.reduce((a, b) => a + b, 0);
  const dup = db.matches.some(m => m.teamId === x.teamId && m.date === x.date && normName(m.opponent) === normName(x.opponent));
  return `<p class="title">${t("Importer un match")}</p>
  <div class="card help"><p>${t("Vérifie les informations, puis touche Importer. Le match, et les joueurs qui n'existent pas encore, sont ajoutés au club.")}</p></div>
  <div class="card"><div class="field"><label>${t("Équipe")}</label><select class="inp" data-change="impteam">${teams.map(y => `<option value="${y.id}"${y.id === x.teamId ? " selected" : ""}>${esc(y.name)}</option>`).join("")}${isAdmin() ? `<option value="new"${x.teamId === "new" ? " selected" : ""}>${t("Nouvelle équipe")} : ${esc(x.teamName || "?")}</option>` : ""}</select></div>
  ${x.teamId === "new" ? `<div class="field"><span class="lbl">${t("Catégorie")}</span><div class="seg">${CATS.map(c => `<button data-a="impcat" data-n="${c}" aria-pressed="${x.newCat === c}">${t(c === "F" ? "Féminin" : "Masculin")}</button>`).join("")}</div></div>` : ""}
  <div class="field"><label for="impopp">${t("Adversaire")}</label><input class="inp" id="impopp" value="${esc(x.opponent)}" data-input="impopp"></div>
  <div class="field"><label for="impdate">${t("Date")}</label><input class="inp" id="impdate" type="date" value="${esc(x.date)}" data-change="impdate"></div>
  <div class="row"><span class="grow">${t("Score")}</span><b>${us} - ${them}</b></div></div>
  ${dup ? `<div class="box warn"><b>${t("Déjà importé ?")}</b>${t("Un match contre {o} le {d} existe déjà dans cette équipe.", { o: x.opponent, d: fmtDate(x.date) })}</div>` : ""}
  <div class="sec">${t("Joueurs")}</div>
  <div class="card">${x.players.map((p, i) => `<div class="row"><span class="grow"><b>${t("N°")}${p.no} ${esc(p.pid ? fullName(playerById(p.pid)) : `${p.first} ${p.last}`)}</b><br><span class="${p.conflict ? "neg small" : "muted small"}">${p.conflict ? t("Déjà dans le club en catégorie {c} : impossible dans cette équipe", { c: catName(p.conflict.sex) }) : p.pid ? t("Déjà dans le club") : t("Nouveau joueur")}</span></span>${p.pid ? "" : `<button class="btn" data-a="impswap" data-n="${i}" title="${esc(t("Inverser prénom et nom"))}">${t("Prénom ⇄ Nom")}</button>`}</div>`).join("")}</div>
  <p class="muted small">${t("Si un nom est inversé (« Bidart Louise »), touche Prénom ⇄ Nom.")}</p>
  ${conflicts.length ? `<div class="box warn"><b>${t("Catégorie différente")}</b>${t("Un joueur masculin ne peut jouer que dans une équipe masculine, et une joueuse que dans une équipe féminine. Choisis la bonne équipe.")}</div>` : ""}
  <button class="btn main big" data-a="impdo"${x.teamId && !conflicts.length ? "" : " disabled"}>${t("Importer")}</button>`;
}
function doImportXl() {
  const x = ui.imp;
  if (impResolve(x).length) { render(); return; }
  const opp = (document.getElementById("impopp") || {}).value;
  if (opp != null) x.opponent = opp.trim() || x.opponent;
  let tm;
  if (x.teamId === "new") {
    if (!isAdmin()) return;
    tm = { id: uid(), name: x.teamName || t("Équipe"), cat: x.newCat || "F", seasons: {} };
    db.teams.push(tm);
  } else tm = db.teams.find(y => y.id === x.teamId);
  if (!tm || !canEditTeam(tm.id)) { toast(t("Accès refusé : tu n'as pas les droits pour cette équipe.")); return; }
  const se = seasonOf(x.date);
  tm.seasons[se] = tm.seasons[se] || { level: "", players: [] };
  const roster = x.players.map(p => {
    let pid = p.pid;
    if (!pid) { const np = { id: uid(), first: p.first, last: p.last, sex: tm.cat === "M" ? "M" : tm.cat === "F" ? "F" : "", pos: [], photo: "" }; db.players.push(np); pid = np.id; }
    if (!tm.seasons[se].players.includes(pid)) tm.seasons[se].players.push(pid);
    return { pid, no: p.no, q: p.q };
  });
  const m = {
    id: uid(), teamId: tm.id, opponent: x.opponent, date: x.date, chrono: "guided", roster: roster.map(r => ({ pid: r.pid, no: r.no })),
    qi: x.played.lastIndexOf(true) >= 0 ? x.played.lastIndexOf(true) : 3, created: Date.now(),
    clocks: QS.map((_, q) => (x.played[q] ? QLEN(q) : 0)), real: QS.map(() => 0), closed: x.played.slice(), court: [], opp: x.opp,
    stats: Object.fromEntries(roster.map(r => [r.pid, r.q])), on: Object.fromEntries(roster.map(r => [r.pid, QS.map(() => 0)])),
    fives: {}, rot: [], log: x.log, running: false, last: 0, imported: true,
  };
  db.matches.push(migrate({ teams: [], matches: [m] }).matches[0]);
  save();
  ui.imp = null; ui.teamId = tm.id; ui.season = se;
  ui.stack = []; tab("matchs");
  toast(t("Match importé"));
}
function vBackup() {
  const local = CLOUD ? localOnlyData() : null;
  const canImport = local && (local.matches.length || local.players.length);
  return `<p class="title">${t("Sauvegarde et export")}</p>
  <div class="card help"><p>${CLOUD ? t("Tes données sont enregistrées en ligne pour tout le club. Une sauvegarde reste utile en cas de souci.") : t("Tes données sont sur ce téléphone. Exporte une sauvegarde après chaque match et garde le fichier dans Fichiers ou iCloud.")}</p></div>
  <div class="btns"><button class="btn" data-a="backup">${t("Sauvegarder")}</button><label class="btn" style="display:grid;place-items:center">${t("Restaurer")}<input type="file" id="restore" accept=".json,application/json" hidden data-change="restore"></label></div>
  <p class="muted small" style="margin:0">${t("Restaurer ajoute les équipes, joueurs et matchs du fichier sans rien effacer.")}</p>
  ${isAdmin() || role() === "coach" || !CLOUD ? `<label class="btn" style="display:grid;place-items:center">${t("Importer l'Excel d'un match")}<input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden data-change="impxl"></label>` : ""}
  ${team() ? `<button class="btn" data-a="xlsseason">${t("Excel de la saison")} : ${esc(team().name)}</button>` : ""}
  ${canImport ? `<button class="btn main" data-a="importlocal">${t("Envoyer au club les données de ce téléphone")}</button>` : ""}`;
}
function vAccount() {
  return `<p class="title">${t("Compte")}</p><div class="card"><div class="row"><span class="grow">${esc(cloud.user.email)}<br><span class="muted small">${t(ROLE_NAMES[role()])}</span></span></div></div>
  <button class="btn danger" data-a="signout">${t("Se déconnecter")}</button>`;
}
function vHelp() {
  return `<p class="title">${t("Aide")}</p><div class="sec">${t("Comment ça marche")}</div>
  <div class="card">${HELP[S.lang].map(h => `<button class="row" data-a="topic" data-n="${h.id}"><span class="grow">${esc(h.title)}</span><span class="chev">›</span></button>`).join("")}</div>
  <div class="sec">${t("Les stats")}</div><div class="card"><button class="row" data-a="lexique"><span class="grow">${t("Lexique des stats")}</span><span class="chev">›</span></button></div>`;
}
function vTopic() {
  const h = HELP[S.lang].find(x => x.id === ui.topic) || HELP[S.lang][0];
  return `<div class="help"><p class="title">${esc(h.title)}</p>${h.html}</div>`;
}
function vLexique() {
  return `<p class="title">${t("Lexique des stats")}</p><div class="card">${Object.entries(LEX[S.lang]).map(([k, x]) => `<button class="row" data-a="info" data-k="${k}" data-c="[]"><span class="grow"><b>${esc(x.n)}</b><br><span class="muted small">${esc(x.s)}</span></span><span class="chev">ⓘ</span></button>`).join("")}</div>`;
}

/* ================= RAPPORT DE MATCH ================= */
function reportData(m) {
  const d = derive(teamTotal(m)), o = oppTotal(m), poss = possessions(d);
  const base = seasonTeamStats(m.teamId, seasonOf(m.date), "season", m.id);
  const players = m.roster.map(r => ({ r, p: playerById(r.pid), d: derive(playerTotal(m, r.pid)) })).sort((a, b) => a.r.no - b.r.no);
  return { d, o, poss, base, players };
}
function factor(label, value, txt, avg, avgTxt, higherIsBetter, tol, key, ctx) {
  let cls = "";
  if (avg !== null) { const diff = (value - avg) * (higherIsBetter ? 1 : -1); cls = diff > tol ? "good" : diff < -tol ? "bad" : "mid"; }
  return `<div class="kpi st ${cls}"><b>${txt}</b><span>${esc(label)}</span>${avg !== null ? `<em>${t("moy.")} ${avgTxt}</em>` : `<em>${t("pas de référence")}</em>`}${key ? ib(key, ctx) : ""}</div>`;
}
function reportNotes(m, R) {
  const good = [], bad = [], b = R.base, d = R.d;
  const ftp = safe(d.ftm, d.fta), bft = b.n ? safe(b.d.ftm, b.d.fta) : null;
  if (d.fta >= 4 && (ftp < .6 || (bft !== null && ftp < bft - .08))) bad.push(t("Lancers francs : {a}/{b} ({p})", { a: d.ftm, b: d.fta, p: pctTxt(ftp) }));
  const tovAvg = b.n ? b.d.tov / b.n : null;
  if (tovAvg !== null && d.tov >= tovAvg + 3) { const worst = playedQuarters(m).sort((x, y) => teamQuarter(m, y).tov - teamQuarter(m, x).tov)[0]; bad.push(t("{n} balles perdues, au-dessus de la moyenne ({a}), dont {q} au {Q}", { n: d.tov, a: dec(tovAvg), q: teamQuarter(m, worst).tov, Q: QS[worst] })); }
  else if (tovAvg !== null && d.tov <= tovAvg - 3) good.push(t("Seulement {n} balles perdues (moyenne {a})", { n: d.tov, a: dec(tovAvg) }));
  if (b.n && d.fga >= 10) { const e = eFG(d), be = eFG(b.d); if (e < be - .05) bad.push(t("Adresse en baisse : eFG {a} contre {b} en moyenne", { a: pctTxt(e), b: pctTxt(be) })); else if (e > be + .05) good.push(t("Belle adresse : eFG {a} contre {b} en moyenne", { a: pctTxt(e), b: pctTxt(be) })); }
  const qs = playedQuarters(m).map(q => ({ q, diff: derive(teamQuarter(m, q)).pts - m.opp[q], a: derive(teamQuarter(m, q)).pts, o: m.opp[q] })).filter(x => x.a + x.o > 0);
  if (qs.length > 1) {
    const w = [...qs].sort((x, y) => x.diff - y.diff)[0], best = [...qs].sort((x, y) => y.diff - x.diff)[0];
    if (w.diff < 0) bad.push(t("{Q} perdu {a}-{o}", { Q: QS[w.q], a: w.a, o: w.o }));
    if (best.diff > 0) good.push(t("{Q} gagné {a}-{o}", { Q: QS[best.q], a: best.a, o: best.o }));
  }
  R.players.filter(x => x.d.pf >= 4).forEach(x => bad.push(t("N°{n} {p} : {f} fautes", { n: x.r.no, p: dispName(x.p), f: x.d.pf })));
  if (d.stl >= 10) good.push(t("{n} interceptions", { n: d.stl }));
  return { good: good.slice(0, 3), bad: bad.slice(0, 3) };
}
function oppCard(m, d) {
  const o = oppDetail(m), ours = d.fga + .44 * d.fta - d.orb + d.tov, drb = Math.max(0, d.reb - d.orb);
  const pc = v => (v == null ? "-" : Math.round(v * 100) + " %");
  const row = (l, a, b) => `<tr><td class="muted">${l}</td><td>${a}</td><td>${b}</td></tr>`;
  return `<div class="sec">${t("Nous et l'adversaire")}</div><div class="card"><table class="p40"><thead><tr><th></th><th>${t("Nous")}</th><th>${esc(m.opponent)}</th></tr></thead><tbody>
  ${row(t("Possessions"), Math.round(ours), Math.round(o.poss))}
  ${row(t("Adresse (eFG)"), pc(eFG(d)), pc(o.efg))}
  ${row(t("Tirs"), `${d.fgm}/${d.fga}`, `${o.fgm}/${o.fga}`)}
  ${row(t("Lancers francs"), `${d.fm}/${d.fta}`, `${o.ftm}/${o.fta}`)}
  ${row(t("Balles perdues"), d.tov, o.tov)}
  ${row(t("Rebonds off."), d.orb, o.orb)}
  </tbody></table><p class="muted small" style="margin:6px 0 0">${t("Rebonds défensifs : {p} des tirs ratés adverses récupérés.", { p: `<b>${pc(drb + o.orb ? drb / (drb + o.orb) : null)}</b>` })}</p></div>`;
}
function vReport() {
  const m = db.matches.find(x => x.id === ui.reportId);
  if (!m) return `<p class="empty">-</p>`;
  const tm = db.teams.find(x => x.id === m.teamId), R = reportData(m), d = R.d, b = R.base, res = result(m);
  const bd = b.n ? b.d : null, n = b.n || 1;
  const lead = (k, label, f) => { const best = [...R.players].sort((x, y) => f(y.d) - f(x.d))[0]; return best && f(best.d) > 0 ? `<div class="leader">${avatar(best.p, "sm")}<span class="n">${k === "pm" ? signed(f(best.d)) : f(best.d)}</span><span class="who">${t("N°")}${best.r.no} ${esc(dispName(best.p))}</span><span class="what">${esc(label)}</span></div>` : ""; };
  const notes = reportNotes(m, R), rows = lineupRows(m), rot = rotations(m), qsP = playedQuarters(m);
  const can = canEditTeam(m.teamId);
  return `<div id="sharecard" style="display:grid;gap:10px">
  <div class="hero"><div class="meta"><span>${esc(tm ? tm.name : "")} · ${fmtDate(m.date)}</span><span>${t("contre")} ${esc(m.opponent)}</span></div>
  <div class="score-big">${d.pts} – ${R.o} <span class="wl ${res === "L" ? "l" : res === "N" ? "n" : ""}">${t(res === "W" ? "Victoire" : res === "L" ? "Défaite" : "Nul")}</span></div>
  <div class="qstrip">${qsP.map(q => `<div>${QS[q]}<b>${derive(teamQuarter(m, q)).pts}-${m.opp[q]}</b></div>`).join("")}</div></div>
  ${m.oppMode === "mod" || m.oppMode === "adv" ? oppCard(m, d) : ""}
  ${m.oppMode === "adv" && oppPlayers(m).length ? `<div class="sec">${t("Joueuses adverses")}</div><div class="card"><div class="tw"><table class="lutable"><thead><tr><th>${t("N°")}</th><th>Pts</th><th>${t("Tirs")}</th><th>3 pts</th><th>${t("LF")}</th><th>${t("BP")}</th><th>${t("Reb. off.")}</th><th>${t("F")}</th></tr></thead><tbody>${oppPlayers(m).map(x => `<tr><td class="ids">${x.no}</td><td><b>${x.pts}</b></td><td>${x.fgm}/${x.fga}</td><td>${x.tpm}</td><td>${x.ftm}/${x.fta}</td><td>${x.tov}</td><td>${x.orb}</td><td class="${x.pf >= 5 ? "neg" : ""}">${x.pf}</td></tr>`).join("")}</tbody></table></div><p class="muted small" style="margin:6px 0 0">${t("Seulement les actions où un numéro a été noté.")}</p></div>` : ""}
  <div class="sec">${t("Les 4 facteurs")}${ih("factors")}</div>
  <div class="kpis" style="grid-template-columns:1fr 1fr">
    ${factor("eFG", eFG(d), pctTxt(eFG(d)), bd ? eFG(bd) : null, bd ? pctTxt(eFG(bd)) : "", true, .02, "efg", [[pctTxt(eFG(d)), t("Ce match")], [bd ? pctTxt(eFG(bd)) : "-", t("Moyenne saison")]])}
    ${factor(t("Balles perdues"), d.tov, String(d.tov), bd ? bd.tov / n : null, bd ? dec(bd.tov / n) : "", false, 2, "tovp", [[pctTxt(tovPct(d)), "TOV % " + t("ce match")], [bd ? pctTxt(tovPct(bd)) : "-", t("Moyenne saison")]])}
    ${factor(t("Rebonds off."), d.orb, String(d.orb), bd ? bd.orb / n : null, bd ? dec(bd.orb / n) : "", true, 2, "", [])}
    ${factor(t("Lancers francs"), safe(d.ftm, d.fta), `${d.ftm}/${d.fta}`, bd && bd.fta ? safe(bd.ftm, bd.fta) : null, bd ? pctTxt(safe(bd.ftm, bd.fta)) : "", true, .05, "", [])}
  </div>
  <div class="sec">${t("Leaders")}</div>
  <div class="leaders">${lead("pts", t("points"), x => x.pts)}${lead("reb", t("rebonds"), x => x.reb)}${lead("ast", t("passes décisives"), x => x.ast)}${lead("pir", "PIR", x => x.pir)}${lead("pm", "+/-", x => x.pm)}${lead("stl", t("interceptions"), x => x.stl)}</div>
  ${notes.good.length ? `<div class="note good"><b>${t("Points forts")}</b><ul>${notes.good.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}
  ${notes.bad.length ? `<div class="note bad"><b>${t("À travailler")}</b><ul>${notes.bad.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}
  </div>
  <div class="sec">${t("Équipe")}</div>
  <div class="kpis">
    <div class="kpi"><b>${pctTxt(TS(d))}</b><span>TS</span>${ib("ts", [[pctTxt(TS(d)), t("Ce match")]])}</div>
    <div class="kpi"><b>${R.poss > 0 ? dec(d.pts / R.poss * 100) : "-"}</b><span>Off Rtg</span>${ib("ortg", [])}</div>
    <div class="kpi"><b>${R.poss > 0 ? dec(R.o / R.poss * 100) : "-"}</b><span>Def Rtg</span>${ib("drtg", [])}</div>
    <div class="kpi"><b>${d.scp}</b><span>${t("Pts 2e chance")}</span>${ib("scp", [])}</div>
    <div class="kpi"><b>${d.ptov}</b><span>${t("Pts après interc.")}</span>${ib("ptov", [])}</div>
    <div class="kpi"><b>${d.fbp}</b><span>${t("Pts contre-attaque")}</span>${ib("fbp", [])}</div>
    <div class="kpi"><b>${ratio(d.fgm, d.fga)}</b><span>${t("Tirs")} ${pctTxt(safe(d.fgm, d.fga))}</span></div>
    <div class="kpi"><b>${ratio(d.tpm, d.tpa)}</b><span>3 pts ${pctTxt(safe(d.tpm, d.tpa))}</span></div>
    <div class="kpi"><b>${d.reb}</b><span>${t("Rebonds")}</span></div>
  </div>
  <div class="sec">${t("Joueurs")}</div>
  <div class="card"><div class="tw"><table><thead><tr><th>${t("Joueur")}</th>${timed(m) ? "<th>Min</th>" : ""}<th>Pts</th><th>Reb</th><th>${t("PD")}</th><th>${t("Int")}</th><th>${t("BP")}</th><th>${t("F")}</th><th>${t("Tirs")}</th><th>${t("3 pts")}</th><th>${t("LF")}</th><th>+/-</th><th>PIR${ih("pir")}</th></tr></thead><tbody>
  ${R.players.map(({ r, p, d: x }) => `<tr data-a="player" data-id="${p.id}"><td><b>${r.no}</b> ${esc(dispName(p))}</td>${timed(m) ? `<td>${fmtClock(x.min)}</td>` : ""}<td>${x.pts}</td><td>${x.reb}</td><td>${x.ast}</td><td>${x.stl}</td><td>${x.tov}</td><td class="${x.pf >= 4 ? "neg" : ""}">${x.pf}</td><td>${ratio(x.fgm, x.fga)}</td><td>${ratio(x.tpm, x.tpa)}</td><td>${ratio(x.ftm, x.fta)}</td><td class="${x.pm > 0 ? "pos" : x.pm < 0 ? "neg" : ""}">${signed(x.pm)}</td><td>${x.pir}</td></tr>`).join("")}</tbody></table></div></div>
  <div class="sec">${t("Cinq sur le terrain")}${ih("lineups")}</div>
  <div class="card">${lineupTable(rows.sort((a, b) => (b.pf - b.pa) - (a.pf - a.pa) || b.sec - a.sec).slice(0, 8), id => dispName(playerById(id)), "-")}</div>
  ${rot ? `<div class="sec">${t("Rotations")}</div><div class="card frise">${R.players.map(({ r, p }) => `<div class="fr"><span>${r.no} ${esc(dispName(p))}</span><span class="track">${qsP.map((q, i) => (rot[r.pid][q] || []).map(([a, b2]) => `<i style="left:${(i + a) / qsP.length * 100}%;width:${(b2 - a) / qsP.length * 100}%"></i>`).join("") + (i ? `<s style="left:${i / qsP.length * 100}%"></s>` : "")).join("")}</span></div>`).join("")}<div class="ax"><span></span><span>${qsP.map(q => `<span>${QS[q]}</span>`).join("")}</span></div></div>` : ""}
  <div class="btns">${can ? `<button class="btn main" data-a="open" data-id="${m.id}">${t("Saisie")}</button>` : `<button class="btn" data-a="open" data-id="${m.id}">${t("Suivre en direct")}</button>`}<button class="btn" data-a="sharereport" data-id="${m.id}">${t("Partager")}</button></div>
  <div class="btns"><button class="btn" data-a="xls" data-id="${m.id}">Excel</button>${can ? `<button class="btn danger" data-a="delmatch" data-id="${m.id}">${t("Supprimer")}</button>` : "<span></span>"}</div>`;
}
function vQuick() {
  const m = match();
  if (!m) return "";
  const R = reportData(m), q = m.qi;
  return `<p class="title">${t("Rapport rapide")}</p>
  <div class="hero"><div class="score-big" style="font-size:38px">${R.d.pts} – ${R.o}</div><div class="qstrip">${playedQuarters(m).map(x => `<div>${QS[x]}<b>${derive(teamQuarter(m, x)).pts}-${m.opp[x]}</b></div>`).join("")}</div>
  <p class="small muted" style="margin:6px 0 0">${t("Fautes d'équipe au {Q} : {n}", { Q: QS[q], n: teamFoulsQ(m, q) })}</p></div>
  <div class="card"><div class="tw"><table><thead><tr><th>${t("Joueur")}</th>${timed(m) ? "<th>Min</th>" : ""}<th>Pts</th><th>${t("F")}</th><th>${t("Tirs")}</th><th>${t("BP")}</th><th>+/-</th><th>PIR</th></tr></thead><tbody>
  ${R.players.map(({ r, p, d: x }) => `<tr><td><b>${r.no}</b> ${esc(dispName(p))}${m.court.includes(r.pid) ? " ●" : ""}</td>${timed(m) ? `<td>${fmtClock(x.min)}</td>` : ""}<td>${x.pts}</td><td class="${x.pf >= 4 ? "neg" : x.pf === 3 ? "" : ""}" style="${x.pf >= 3 ? "font-weight:700;color:" + (x.pf >= 4 ? "var(--neg)" : "var(--warn)") : ""}">${x.pf}</td><td>${ratio(x.fgm, x.fga)}</td><td>${x.tov}</td><td>${signed(x.pm)}</td><td>${x.pir}</td></tr>`).join("")}</tbody></table></div></div>
  <div class="kpis"><div class="kpi"><b>${pctTxt(eFG(R.d))}</b><span>eFG</span></div><div class="kpi"><b>${R.d.tov}</b><span>${t("Balles perdues")}</span></div><div class="kpi"><b>${R.d.orb}</b><span>${t("Reb. off.")}</span></div></div>`;
}
function vLog() {
  const m = match(), list = [...m.log].reverse();
  return `<p class="title">${t("Journal")} <span class="tag">${m.log.length}</span></p>
  <div class="card">${list.map(e => `<div class="row"><span class="small muted" style="width:62px">${QS[e.q]} ${esc(e.clock || "")}</span><span class="grow small">${esc(logLabel(m, e))}</span>${ui.readonly ? "" : `<button class="btn sm danger" data-a="dellog" data-id="${e.id}" aria-label="${esc(t("Supprimer cette action"))}">✕</button>`}</div>`).join("") || `<p class="empty">${t("Aucune action pour le moment.")}</p>`}</div>`;
}
const OPP_MODE_INFO = { simple: ["Simplifiée", "+1 +2 +3"], mod: ["Modérée", "+ tirs ratés, BP, reb. off."], adv: ["Avancée", "+ n° de la joueuse"] };
/* Ligne sous le chrono : nos fautes d'équipe et celles de l'adversaire, avec l'alerte « bonus » */
function foulsLine(m, q) {
  const us = teamFoulsQ(m, q), them = oppFoulsQ(m, q), cls = n => (n >= 5 ? "fneg" : n >= 4 ? "fwarn" : "");
  return `<span class="${cls(us)}">${t("Fautes éq. {n}", { n: us })}</span> · <span class="${cls(them)}">${t("adv. {n}", { n: them })}${them >= 5 ? " · " + t("Bonus") : ""}</span>`;
}
function logLabel(m, e) {
  const no = pid => (rosterOf(m, pid) || {}).no ?? "?";
  if (e.text) return e.text;
  const corr = e.kind === "corr" ? " (" + t("correction") + ")" : "";
  if (e.kind === "sub") return !e.in ? t("N°{a} sort du terrain", { a: no(e.out) }) : e.out ? t("Changement : N°{a} entre, N°{b} sort", { a: no(e.in), b: no(e.out) }) : t("N°{a} entre sur le terrain", { a: no(e.in) });
  if (e.oppPts) return t("Adversaire {n}", { n: signed(e.oppPts) }) + corr;
  if (e.ox) { const k = OX_KEYS.find(x => x[0] === e.ox); return `${t("Adversaire")} : ${t(k ? k[1] : e.ox)}`; }
  if (e.shot) { let s = `${t("N°")}${no(e.pid)} ${t(SHOT[e.shot].l)} ${t(e.made ? "réussi" : "raté")}${corr}`; const c = (e.changes.find(x => x[0] === e.pid) || [0, {}])[1]; if (c.fbp) s += " · " + t("contre-attaque"); if (c.scp) s += " · " + t("2e chance"); if (c.ptov) s += " · " + t("après interception"); return s; }
  if (e.stat) { const n = [...POS_STATS, ...NEG_STATS].find(x => x[0] === e.stat); return `${t("N°")}${no(e.pid)} ${t(n ? n[1] : e.stat)}${corr}`; }
  return "-";
}

/* ================= SAISIE ================= */
function canInput() { return !ui.readonly; }
function vMatchScreen() {
  const m = match(), land = isLand(), full = S.layout.startsWith("f");
  const t0 = derive(teamTotal(m)), o = oppTotal(m);
  if (ui.sel && !m.court.includes(ui.sel) && m.court.length) ui.sel = m.court[0];
  if (!ui.sel && m.court.length) ui.sel = m.court[0];
  const sel = ui.sel ? rosterOf(m, ui.sel) : null, p = sel ? playerById(sel.pid) : null, v = sel ? derive(playerTotal(m, sel.pid)) : derive(blank());
  const ro = ui.readonly, locked = ro || !sel;
  const top = `<div class="mt-top"><button class="ic" data-a="leave">${t("Matchs")}</button><div class="mscore">${t0.pts} – ${o}<small>${esc(m.opponent)}</small></div><button class="ic" data-a="undo"${m.log.length && !ro ? "" : " disabled"}>${t("Annuler")}</button><button class="ic" data-a="menu" aria-label="${esc(t("Menu du match"))}">☰</button></div>`;
  const roBar = ro ? `<div class="ro"><span>${CLOUD && m.editor && lockedByOther(m) ? t("Saisie en cours par {n} : lecture seule.", { n: m.editor.name }) : t("Lecture seule.")}</span>${canEditTeam(m.teamId) ? `<button class="btn sm" data-a="takeover">${t("Prendre la main")}</button>` : ""}</div>` : "";
  const opp = `<div class="opp"><span>${t("Adversaire")}</span><button class="m" data-a="opp" data-n="-1" aria-label="${esc(t("Retirer 1 point adverse"))}"${o > 0 && !ro ? "" : " disabled"}>−</button>${[1, 2, 3].map(n => `<button data-a="opp" data-n="${n}"${ro ? " disabled" : ""}>+${n}</button>`).join("")}</div>`;
  const oxTot = k => (m.ox || []).reduce((s, x) => s + ((x && x[k]) || 0), 0);
  const oxRow = m.oppMode === "mod" || m.oppMode === "adv" ? `<div class="ox">${OX_KEYS.map(([k, l]) => `<button data-a="ox" data-n="${k}"${ro ? " disabled" : ""}><span>${t(l)}</span><b>${oxTot(k)}</b></button>`).join("")}</div>` : "";
  const q = m.qi, closedQ = m.closed[q];
  let clock;
  if (m.chrono === "none") clock = `<div class="clock"><button class="q" data-a="quarters">${QS[q]}</button><span class="time" style="font-size:18px">${t("Sans chrono")}<small>${foulsLine(m, q)}</small></span><button class="go close" data-a="closeq"${ro ? " disabled" : ""}>${t("Clore")} ${QS[q]}</button></div>`;
  else if (m.chrono === "prop") {
    const started = m.real[q] > 0 || m.running;
    clock = `<div class="clock${!started && !closedQ && !ro ? " stopped" : ""}"><button class="q" data-a="quarters">${QS[q]}</button><span class="time"><span data-clock>${fmtClock(realElapsed(m))}</span><small>${t("temps réel")} · ${foulsLine(m, q)}</small></span>${started ? `<button class="go close" data-a="closeq"${ro ? " disabled" : ""}>${t("Clore")} ${QS[q]}</button>` : `<button class="go start" data-a="clock"${ro || closedQ ? " disabled" : ""}>${t("Départ")}</button>`}</div>`;
  } else {
    const stopped = !m.running && remain(m) > 0 && !closedQ && !ro;
    clock = `<div class="clock three${stopped ? " stopped" : ""}"><button class="q" data-a="quarters">${QS[q]}</button><span class="time"><span data-clock>${fmtClock(remain(m))}</span><small>${foulsLine(m, q)}</small></span><button class="go ${m.running ? "stop" : "start"}" data-a="clock"${ro ? " disabled" : ""}>${t(m.running ? "Stop" : "Départ")}</button><button class="go close" data-a="closeq"${ro ? " disabled" : ""}>${t("Clore")}</button></div>`;
  }
  const adj = (m.chrono === "guided" || m.chrono === "manual") && !ro ? `<div class="adj">${[[-60, "−1:00"], [-10, "−10 s"], [-1, "−1 s"], [1, "+1 s"], [10, "+10 s"], [60, "+1:00"]].map(([n, l]) => `<button data-a="adj" data-n="${n}">${l}</button>`).join("")}</div>` : "";
  const byNo = [...m.roster].sort((a, b) => a.no - b.no);
  const fb = pid => { const f = playerTotal(m, pid).pf; return f >= 3 ? `<span class="fb ${f >= 4 ? "f4" : "f3"}">${f}</span>` : ""; };
  const courtList = byNo.filter(r => m.court.includes(r.pid));
  const five = `<div class="five${ui.sub ? " swapping" : ""}">${courtList.map(r => { const pl = playerById(r.pid); return `<button class="pl" data-a="court" data-id="${r.pid}" aria-pressed="${r.pid === ui.sel}">${fb(r.pid)}<b>${r.no}</b><span>${esc(dispName(pl))}</span><span>${derive(playerTotal(m, r.pid)).pts} pts</span></button>`; }).join("")}${Array.from({ length: 5 - courtList.length }, () => `<div class="pl empty-slot"><b>?</b><span>${t("libre")}</span></div>`).join("")}</div>`;
  const benchList = byNo.filter(r => !m.court.includes(r.pid));
  const bench = `<div class="bench"><span>${t("Banc")}</span>${benchList.map(r => `<button class="bc" data-a="bench" data-id="${r.pid}" aria-pressed="${ui.sub === r.pid}"${ro ? " disabled" : ""}>${fb(r.pid)}<b>${r.no}</b> ${esc(dispName(playerById(r.pid)))}</button>`).join("")}</div>
  ${ui.sub ? `<div class="subhint">${t("N°{n} entre : touche le joueur qui sort", { n: rosterOf(m, ui.sub).no })}</div>` : m.court.length < 5 && !ro ? `<div class="subhint">${t("Touche le banc pour placer {n} joueur(s) sur le terrain", { n: 5 - m.court.length })}</div>` : ""}`;
  const who = `<div class="who"><b>${p ? `${t("N°")}${sel.no} ${esc(dispName(p))}` : t("Choisis un joueur")}</b><span>${v.pts} pts · ${v.pf} f · +/- ${signed(v.pm)} · PIR ${v.pir}</span></div>`;
  const fast = S.fast && !ro ? `<div class="fast">${t("Contre-attaque")}<button class="switch" role="switch" data-a="fast" aria-checked="${ui.fast}" aria-label="${esc(t("Contre-attaque"))}"></button></div>` : "";
  const pair = (act, value, cls, name, min) => `<div class="pair"><button class="mn" data-a="${act}" data-d="-1" aria-label="${esc(t("Retirer"))} ${esc(name)}"${locked || value <= (min || 0) ? " disabled" : ""}>−</button><button class="t ${cls}" data-a="${act}" data-d="1" aria-label="${esc(t("Ajouter"))} ${esc(name)}"${locked ? " disabled" : ""}>+ <b>${value}</b></button></div>`;
  const shots = `<div class="shots"><span></span><span class="h">${t("Réussi")}</span><span class="h">${t("Raté")}</span>${SHOTS.map(s => `<span class="l">${t(s.id === "mid" ? "Mi-dist." : s.l)}</span>${pair(`shot:${s.id}:1`, v[s.m], "ok", t(s.l) + " " + t("réussi"))}${pair(`shot:${s.id}:0`, Math.max(0, v[s.a] - v[s.m]), "ko", t(s.l) + " " + t("raté"))}`).join("")}</div>`;
  const posC = POS_STATS.filter(([k]) => k !== "fd" || S.fd), negC = NEG_STATS.filter(([k]) => k !== "ba" || S.ba);
  const counters = `<div class="grp">${t("Positif")}</div><div class="counters">${posC.map(([k, n]) => `<div class="cnt"><span>${t(n)}</span>${pair("stat:" + k, v[k], "p", t(n), k === "reb" ? v.orb : 0)}</div>`).join("")}</div>
  <div class="grp">${t("Négatif")}</div><div class="counters">${negC.map(([k, n]) => `<div class="cnt"><span>${t(n)}</span>${pair("stat:" + k, v[k], "n", t(n))}</div>`).join("")}</div>`;
  const countersLand = `<div class="counters all">${posC.map(([k, n]) => `<div class="cnt"><span>${t(n)}</span>${pair("stat:" + k, v[k], "p", t(n), k === "reb" ? v.orb : 0)}</div>`).join("")}${negC.map(([k, n]) => `<div class="cnt neg"><span>${t(n)}</span>${pair("stat:" + k, v[k], "n", t(n))}</div>`).join("")}</div>`;
  const extraBlock = full ? `<div class="extra"><div class="card"><div class="sec" style="margin:0 0 4px">${t("Totaux équipe")}</div><div class="teamline"><span><b>${ratio(t0.fgm, t0.fga)}</b> ${t("tirs")}</span><span><b>${ratio(t0.tpm, t0.tpa)}</b> 3 pts</span><span><b>${ratio(t0.ftm, t0.fta)}</b> LF</span><span><b>${t0.reb}</b> reb</span><span><b>${t0.ast}</b> pas</span><span><b>${t0.tov}</b> BP</span><span><b>${pctTxt(eFG(t0))}</b> eFG</span></div></div>
    <div class="card"><div class="sec" style="margin:0 0 4px">${t("Dernières actions")}</div>${[...m.log].reverse().slice(0, 5).map(e => `<div class="small" style="padding:3px 0">${QS[e.q]} ${esc(e.clock || "")} · ${esc(logLabel(m, e))}</div>`).join("") || `<span class="muted small">-</span>`}</div></div>` : "";
  const banner = ui.banner ? `<div class="banner" role="status"><span>${t("Chrono arrêté : action notée quand même")}</span><button data-a="relaunch">${t("Relancer")}</button></div>` : "";
  if (land) return `<div class="mt land"><div class="col">${top}${roBar}${opp}${oxRow}${clock}${adj}${full ? extraBlock : ""}</div><div class="col">${five}${bench}</div><div class="col">${fast ? `<div class="whorow">${who}${fast}</div>` : who}${shots}${countersLand}</div></div>${banner}`;
  return `<div class="mt">${top}${roBar}${opp}${oxRow}${clock}${adj}${five}${bench}${who}${fast}${shots}${counters}${extraBlock}</div>${banner}`;
}
function menuSheet() {
  const m = match();
  return `<div class="grab"></div><h3>${t("Menu du match")}</h3>
  <div class="menu-grid">
    <button data-a="quick">${t("Rapport rapide")}</button><button data-a="report" data-id="${m.id}">${t("Rapport complet")}</button>
    <button data-a="log">${t("Journal")}</button><button data-a="numbers"${ui.readonly ? " disabled" : ""}>${t("Numéros et présents")}</button>
    <button data-a="xls" data-id="${m.id}">Excel</button><button data-a="topic" data-n="chrono">${t("Aide chrono")}</button>
  </div>
  ${!ui.readonly && m.court.length ? `<div class="sec">${t("Sortir du terrain sans remplaçant")}</div><div class="menu-grid">${m.court.map(pid => `<button data-a="benchout" data-id="${pid}">${t("N°")}${rosterOf(m, pid).no} ${esc(dispName(playerById(pid)))}</button>`).join("")}</div>` : ""}
  <div class="sec">${t("Affichage")}</div>
  <div class="seg">${LAYOUTS.map(([k, n]) => `<button data-a="layout" data-n="${k}" aria-pressed="${S.layout === k}">${esc(t(n))}</button>`).join("")}</div>
  <button class="btn" data-a="closesheet">${t("Fermer")}</button>`;
}
function quartersSheet() {
  const m = match();
  return `<div class="grab"></div><h3>${t("Quart-temps")}</h3><div class="menu-grid">${QS.map((qn, i) => `<button data-a="setq" data-n="${i}"${i === m.qi || ui.readonly ? " disabled" : ""}>${qn}${m.closed[i] ? " ✓" : ""}</button>`).join("")}</div><button class="btn" data-a="closesheet">${t("Fermer")}</button>`;
}
function teamPickSheet() {
  return `<div class="grab"></div><h3>${t("Équipe")}</h3>${CATS.map(c => { const list = db.teams.filter(x => x.cat === c); return list.length ? `<div class="sec">${t(c === "F" ? "Féminin" : "Masculin")}</div><div class="card">${list.map(x => `<button class="row" data-a="pickteam" data-id="${x.id}"><span class="grow"><b>${esc(x.name)}</b> ${teamSeason(x, ui.season).level ? `<span class="tag">${esc(teamSeason(x, ui.season).level)}</span>` : ""}</span>${canEditTeam(x.id) ? "" : `<span class="muted small">${t("lecture")}</span>`}${x.id === ui.teamId ? "✓" : ""}</button>`).join("")}</div>` : ""; }).join("")}
  ${isAdmin() ? `<button class="btn" data-a="teams">${t("Gérer les équipes")}</button>` : ""}`;
}

/* ---------- Actions de saisie ---------- */
function askOppNo(m, e) {
  if (m.oppMode !== "adv" || !e || !e.id) return;
  const isOpp = (e.kind === "opp" && e.oppPts > 0) || e.ox || (e.stat === "fd" && e.d > 0);
  if (isOpp) { ui.sheet = { type: "oppno", eid: e.id }; ui.oppNoInput = false; }
}
function oppNoLabel(m, e) {
  if (e.oppPts) return t("Adversaire {n}", { n: signed(e.oppPts) });
  if (e.ox) { const k = OX_KEYS.find(x => x[0] === e.ox); return t(k ? k[1] : e.ox); }
  return t("Faute adverse");
}
function oppNoSheet() {
  const m = match(), e = m && m.log.find(x => x.id === ui.sheet.eid);
  if (!e) return "";
  const nos = [...new Set([...(m.oppNos || []), ...m.log.filter(x => x.on != null).map(x => x.on)])].sort((a, b) => a - b);
  const fouls = n => m.log.filter(x => x.on === n && x.stat === "fd" && (x.d || 1) > 0).length;
  return `<div class="grab"></div><h3>${t("{x} : quel numéro ?", { x: oppNoLabel(m, e) })}</h3>
  <div class="nopad">${nos.map(n => { const f = fouls(n); return `<button data-a="oppno" data-n="${n}">${n}${f ? `<small class="${f >= 4 ? "fneg" : f >= 3 ? "fwarn" : ""}">${f} f</small>` : ""}</button>`; }).join("")}
  ${ui.oppNoInput ? "" : `<button class="add" data-a="oppnoadd">+ n°</button>`}<button class="skip" data-a="oppnoskip">${t("Passer")}</button></div>
  ${ui.oppNoInput ? `<div class="btns" style="margin-top:8px"><input class="inp" id="oppnoin" inputmode="numeric" maxlength="3" placeholder="${esc(t("Numéro"))}" autofocus><button class="btn main" data-a="oppnook">OK</button></div>` : ""}
  <p class="muted small" style="margin:8px 0 0">${t("Les numéros déjà vus restent proposés. « Passer » enregistre sans numéro.")}</p>`;
}
function setOppNo(n) {
  const m = match(), e = m && ui.sheet && m.log.find(x => x.id === ui.sheet.eid);
  if (!e) { ui.sheet = null; render(); return; }
  if (n != null) { e.on = n; m.oppNos = [...new Set([...(m.oppNos || []), n])]; }
  ui.sheet = null; ui.oppNoInput = false;
  if (e.stat === "fd" && n != null) { const f = m.log.filter(x => x.on === n && x.stat === "fd" && (x.d || 1) > 0).length; if (f >= 3) toast(t("N°{n} adverse : {f} fautes", { n, f })); }
  save(); render();
}
function afterCommit(m, e, live) {
  askOppNo(m, e);
  if (e.stat === "fd" && e.d > 0 && oppFoulsQ(m, e.q) === 5) toast(t("Adversaire à 5 fautes : lancers francs à chaque faute"));
  if (e.kind === "shot") { ui.fast = false; clearTimeout(ui.fastTimer); }
  if (live && m.chrono === "guided" && !m.running && remain(m) > 0 && !m.closed[m.qi]) {
    ui.banner = true; clearTimeout(ui.bannerTimer);
    ui.bannerTimer = setTimeout(() => { ui.banner = false; if (ui.view === "match") render(); }, 6000);
  }
  if (e.stat === "pf" && e.d > 0) { const f = playerTotal(m, e.pid).pf; if (f >= 3) toast(t("N°{n} : {f} fautes", { n: rosterOf(m, e.pid).no, f })); }
  save(); render();
}
function doShot(id, made, d) {
  const m = match();
  if (!m || ui.readonly || !ui.sel) return;
  if (d > 0 && !m.court.includes(ui.sel)) return;
  const e = buildShot(m, ui.sel, id, made, d, S.fast && ui.fast);
  if (!e) return;
  commit(m, e);
  afterCommit(m, e, d > 0 && LIVE.has(id));
}
function doCounter(k, d) {
  const m = match();
  if (!m || ui.readonly || !ui.sel) return;
  if (d > 0 && !m.court.includes(ui.sel)) return;
  const e = buildCounter(m, ui.sel, k, d);
  if (!e) return;
  commit(m, e);
  afterCommit(m, e, d > 0 && LIVE.has(k));
}
function doOpp(n) {
  const m = match();
  if (!m || ui.readonly) return;
  const e = buildOpp(m, n);
  if (!e) return;
  commit(m, e);
  afterCommit(m, e, false);
}
function doSub(inId, outId) {
  const m = match();
  commit(m, { kind: "sub", in: inId, out: outId || null, changes: [] });
  ui.sub = null;
  if (outId && ui.sel === outId) ui.sel = inId;
  if (!ui.sel) ui.sel = inId;
  save(); render();
}

/* ---------- Chrono ---------- */
let tickTimer = null, ticks = 0, wakeLock = null;
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
    if (!m || !m.running || ui.readonly) { stopTimer(); return; }
    accrue(m);
    updateClocks();
    if ((m.chrono === "guided" || m.chrono === "manual") && m.clocks[m.qi] >= QLEN(m.qi)) { m.running = false; stopTimer(); save(); render(); toast(t("Fin du {Q}", { Q: QS[m.qi] })); return; }
    ++ticks;
    if (ticks % 15 === 0) save(); else if (ticks % 5 === 0) saveLocal();
  }, 1000);
}
function updateClocks() {
  const m = match();
  if (!m) return;
  document.querySelectorAll("[data-clock]").forEach(c => { c.textContent = m.chrono === "prop" ? fmtClock(realElapsed(m)) : fmtClock(remain(m)); });
}
function resumeClock(m) {
  if (ui.readonly) return;
  if (m.running && Date.now() - m.last > 600000) m.running = false;
  if (m.running) startTimer();
}
function toggleClock() {
  const m = match();
  if (ui.readonly) return;
  if (m.running) { stopClock(m); stopTimer(); }
  else {
    if (m.court.length !== 5) { toast(t("Il faut 5 joueurs sur le terrain")); return; }
    if (m.closed[m.qi] || (m.chrono !== "prop" && remain(m) <= 0)) { toast(t("Quart-temps terminé. Choisis le suivant.")); return; }
    startClock(m); startTimer();
    ui.banner = false;
  }
  save(); render();
}

/* ---------- Ouverture d'un match ---------- */
function openMatch(id) {
  const m = db.matches.find(x => x.id === id);
  if (!m) return;
  ui.matchId = id; ui.teamId = m.teamId; ui.sub = null; ui.fast = false; ui.banner = false;
  ui.sel = m.court[0] || null;
  ui.readonly = !canEditTeam(m.teamId) || lockedByOther(m);
  if (CLOUD && !ui.readonly) { takeLock(m); save(); }
  ui.stack.push(ui.view); ui.view = "match"; ui.sheet = null;
  resumeClock(m);
  render();
}
function leaveMatch() {
  const m = match();
  if (m && m.running && !ui.readonly && m.chrono !== "prop") { toast(t("Arrête d'abord le chrono")); return; }
  if (m && m.running && m.chrono === "prop") { accrue(m); }
  stopTimer();
  if (CLOUD && m && !ui.readonly && m.editor && m.editor.device === DEVICE) { delete m.editor; }
  if (m) save();
  const id = ui.matchId;
  ui.matchId = null; ui.readonly = false; ui.banner = false;
  ui.stack = []; ui.view = "matchs";
  if (m) { ui.reportId = id; ui.stack.push("matchs"); ui.view = "report"; }
  render();
}

/* ---------- Formulaires ---------- */
function saveMatchForm() {
  const editing = ui.edit ? db.matches.find(x => x.id === ui.edit) : null;
  const tm = editing ? db.teams.find(x => x.id === editing.teamId) : team();
  const opponent = editing ? editing.opponent : val("opp").trim(), date = editing ? editing.date : val("date");
  if (!opponent || !date) { toast(t("Indique l'adversaire et la date")); return; }
  const rows = [];
  document.querySelectorAll('input[type=checkbox][id^="c-"]').forEach(c => {
    if (!c.checked) return;
    const pid = c.id.slice(2), no = val("n-" + pid).trim();
    rows.push({ pid, no });
  });
  for (const r of rows) if (!/^\d{1,3}$/.test(r.no)) { toast(t("Numéro manquant pour {n}", { n: fullName(playerById(r.pid)) })); return; }
  const roster2 = rows.map(r => ({ pid: r.pid, no: Number(r.no) }));
  if (roster2.length < 5) { toast(t("Il faut au moins 5 joueurs présents")); return; }
  if (new Set(roster2.map(r => r.no)).size !== roster2.length) { toast(t("Deux joueurs ont le même numéro")); return; }
  if (editing) {
    const removed = editing.roster.filter(r => !roster2.some(x => x.pid === r.pid));
    if (removed.some(r => editing.stats[r.pid].some(v => KEYS.some(k => v[k])))) { toast(t("Impossible de retirer un joueur qui a des stats")); return; }
    roster2.forEach(r => { if (!editing.stats[r.pid]) { editing.stats[r.pid] = QS.map(blank); editing.on[r.pid] = QS.map(() => 0); } });
    removed.forEach(r => { delete editing.stats[r.pid]; delete editing.on[r.pid]; editing.court = editing.court.filter(x => x !== r.pid); });
    editing.roster = roster2;
    ui.edit = null; save(); back(); toast(t("Effectif du match enregistré"));
    return;
  }
  const se = seasonOf(date), ts = tm.seasons[se] = tm.seasons[se] || { level: "", players: [] };
  roster2.forEach(r => { if (!ts.players.includes(r.pid)) ts.players.push(r.pid); });
  const m = newMatch(tm.id, opponent, date, roster2, ui.form.chrono || S.chrono);
  m.oppMode = ui.form.oppMode || S.oppMode || "simple"; m.ox = QS.map(blankOx);
  db.matches.push(m);
  ui.form = {}; save();
  ui.stack = ["matchs"]; ui.view = "matchs";
  openMatch(m.id);
}
function readPhoto(file) {
  const img = new Image(), url = URL.createObjectURL(file);
  img.onload = () => {
    const size = 256, c = document.createElement("canvas"), s = Math.min(img.width, img.height);
    c.width = c.height = size;
    c.getContext("2d").drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
    ui.photo = c.toDataURL("image/jpeg", 0.8);
    URL.revokeObjectURL(url);
    keepForm(); render();
  };
  img.onerror = () => toast(t("Cette image n'a pas pu être lue"));
  img.src = url;
}
function keepForm() {
  [["pf", "first"], ["pl", "last"], ["pn", "nick"]].forEach(([id, k]) => { const e = document.getElementById(id); if (e) ui.form[k] = e.value; });
}
function savePlayer(stay) {
  if (stay !== true) stay = false;
  keepForm();
  const first = (ui.form.first || "").trim(), last = (ui.form.last || "").trim();
  if (!first || !last) { toast(t("Indique le prénom et le nom")); return false; }
  let p = ui.editPlayer ? db.players.find(x => x.id === ui.editPlayer) : null;
  if (!p && db.players.some(x => low(x.first) === low(first) && low(x.last) === low(last))) { toast(t("Ce joueur existe déjà dans le club : ajoute-le depuis « Ajouter du club »")); return false; }
  const newSex = ui.form.sex || (p && p.sex) || (team() || {}).cat || "F";
  if (!ui.editPlayer && ui.form.toTeam && team() && team().cat && newSex !== team().cat) { toast(t("{t} est une équipe {c} : choisis la bonne catégorie.", { t: team().name, c: catName(team().cat) })); return false; }
  if (p) { const bad = teamsOfPlayer(p.id).find(x => x.cat && x.cat !== newSex); if (bad) { toast(t("Impossible : {n} joue dans {t}, une équipe {c}.", { n: p.first, t: bad.name, c: catName(bad.cat) })); return false; } }
  if (!p) { p = { id: uid(), first, last, pos: [], sex: "F", photo: "" }; db.players.push(p); }
  p.first = first; p.last = last;
  const nick = (ui.form.nick ?? p.nick ?? "").trim();
  if (nick) p.nick = nick; else delete p.nick;
  p.sex = ui.form.sex || p.sex || (team() || {}).cat || "F";
  p.pos = ui.form.pos || p.pos || [];
  if (ui.photo !== undefined) p.photo = ui.photo || "";
  if (!ui.editPlayer && ui.form.toTeam && team()) {
    const ts = team().seasons[ui.season] = team().seasons[ui.season] || { level: "", players: [] };
    if (!ts.players.includes(p.id)) ts.players.push(p.id);
  }
  ui.form = {}; ui.photo = undefined;
  save(); toast(t("Joueur enregistré"));
  if (stay) return true;
  back(); return true;
}

/* ---------- Préparer la saison ---------- */
function startPrep() {
  const from = [...new Set(db.teams.flatMap(x => Object.keys(x.seasons)).concat(currentSeason()))].sort().pop();
  const to = nextSeason(from);
  const teams = db.teams.filter(x => x.seasons[from]).map(x => x.id);
  if (!teams.length) { toast(t("Aucune équipe à reprendre")); return; }
  const res = {};
  teams.forEach(id => { const x = db.teams.find(y => y.id === id), f = teamSeason(x, from); res[id] = { status: "same", level: f.level || "", players: [...f.players] }; });
  ui.prep = { from, to, teams, i: 0, res };
  go("prepseason");
}
function prepKeep() {
  const P = ui.prep;
  if (!P || P.i >= P.teams.length) return;
  const r = P.res[P.teams[P.i]];
  const lv = document.getElementById("plevel");
  if (lv) r.level = lv.value.trim();
  const sel = [...document.querySelectorAll("[data-prep]")];
  if (sel.length) r.players = [...new Set(sel.filter(c => c.checked).map(c => c.dataset.prep))];
}
function prepDone() {
  const P = ui.prep;
  P.teams.forEach(id => { const x = db.teams.find(y => y.id === id), r = P.res[id]; x.seasons[P.to] = { level: r.level, status: r.status, players: r.players }; });
  ui.season = P.to; ui.prep = null; save();
  ui.stack = []; ui.view = "reglages"; render();
  toast(t("Saison {s} prête", { s: P.to }));
}

/* ---------- Partage d'images ---------- */
async function deliver(blob, name) {
  const file = new File([blob], name, { type: blob.type });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name }); return; }
  } catch (e) { if (e.name === "AbortError") return; }
  try {
    const url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  } catch (e) { toast(t("Le partage n'est pas disponible ici")); }
}
async function shareNode(node, name) {
  if (!window.html2canvas) { toast(t("Le partage n'est pas disponible ici")); return; }
  const holder = document.createElement("div");
  holder.style.cssText = "position:fixed;left:-10000px;top:0;width:400px;padding:16px;background:var(--bg);color:var(--text);display:grid;gap:10px;font-family:var(--body)";
  holder.appendChild(node);
  const foot = document.createElement("p");
  foot.className = "muted small"; foot.style.margin = "0"; foot.textContent = "Stats Basket";
  holder.appendChild(foot);
  document.body.appendChild(holder);
  try {
    const canvas = await html2canvas(holder, { backgroundColor: getComputedStyle(document.body).backgroundColor, scale: 3, useCORS: true, logging: false });
    canvas.toBlob(b => { if (b) deliver(b, name); }, "image/png");
  } catch (e) { toast(t("Le partage n'est pas disponible ici")); }
  holder.remove();
}
function shareReport(id) {
  const src = document.getElementById("sharecard");
  if (!src) return;
  const m = db.matches.find(x => x.id === id);
  shareNode(src.cloneNode(true), `${fileSafe(m.opponent)}_${m.date}.png`);
}
function sharePlayer(pid) {
  const p = playerById(pid), node = document.createElement("div");
  node.style.cssText = "display:grid;gap:10px";
  const head = document.querySelector(".phead"), kp = document.querySelector(".kpis"), zones = document.querySelector(".zones");
  [head, kp, zones].forEach(x => { if (x) node.appendChild(x.cloneNode(true)); });
  node.querySelectorAll(".i").forEach(x => x.remove());
  shareNode(node, `${fileSafe(fullName(p))}_${ui.season}.png`);
}

/* ---------- Export Excel ---------- */
const P100 = x => ({ t: "n", v: Math.round(x * 1000) / 1000, z: "0.0%" });
const D1 = x => Math.round(x * 10) / 10;
const fileSafe = s => String(s).replace(/[^\p{L}\p{N}_-]+/gu, "_");
function downloadBook(sheets, name) {
  if (!window.XLSX) { toast(t("Le partage n'est pas disponible ici")); return; }
  const wb = XLSX.utils.book_new();
  sheets.forEach(([title, rows]) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), title.slice(0, 31)));
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  deliver(new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), name);
}
const statHead = () => [t("Points"), t("Passes décisives"), t("Rebonds"), t("Reb. off."), t("Interceptions"), t("Contres"), t("Balles perdues"), t("Fautes"), t("Fautes prov."), t("Contres subis"), t("Tirs réussis"), t("Tirs tentés"), "% " + t("tirs"), t("Raquette"), "", "%", t("Mi-distance"), "", "%", "3 pts", "", "%", "LF", "", "%", "eFG", "TS", "PIR", t("Pts 2e chance"), t("Pts après interc."), t("Pts contre-attaque")];
const statCells = d => [d.pts, d.ast, d.reb, d.orb, d.stl, d.blk, d.tov, d.pf, d.fd, d.ba, d.fgm, d.fga, P100(safe(d.fgm, d.fga)), d.rm, d.ra, P100(safe(d.rm, d.ra)), d.mm, d.ma, P100(safe(d.mm, d.ma)), d.tm, d.ta, P100(safe(d.tm, d.ta)), d.fm, d.fa, P100(safe(d.fm, d.fa)), P100(eFG(d)), P100(TS(d)), d.pir, d.scp, d.ptov, d.fbp];
function exportMatch(m) {
  const tm = db.teams.find(x => x.id === m.teamId), R = reportData(m), d = R.d;
  const main = [[`${tm ? tm.name : ""} - ${m.opponent}`], [t("Date"), m.date], [t("Score"), `${d.pts} - ${R.o}`], [t("Mode de chrono"), t(CHRONO_INFO[m.chrono][0])], [], ["N°", t("Joueur"), "Min", "+/-", ...statHead()]];
  R.players.forEach(({ r, p, d: x }) => main.push([r.no, fullName(p), timed(m) ? fmtClock(x.min) : "", x.pm, ...statCells(x)]));
  main.push(["", t("Total équipe"), timed(m) ? fmtClock(d.min) : "", "", ...statCells(d)]);
  const adv = [["N°", t("Joueur"), "USG %", "TOV %", "AST %", "AST/TO", "3PAr", "FTr"]];
  R.players.forEach(({ r, p, d: x }) => adv.push([r.no, fullName(p), P100(usage(x, d)), P100(tovPct(x)), P100(assistPct(x, d)), D1(safe(x.ast, x.tov)), P100(safe(x.tpa, x.fga)), P100(safe(x.fta, x.fga))]));
  adv.push([], [t("Possessions"), D1(R.poss)], ["Off Rtg", D1(safe(d.pts, R.poss) * 100)], ["Def Rtg", D1(safe(R.o, R.poss) * 100)], ["Net Rtg", D1(safe(d.pts - R.o, R.poss) * 100)]);
  const quarters = [["QT", t("Score"), ...statHead()]];
  playedQuarters(m).forEach(q => { const x = derive(teamQuarter(m, q)); quarters.push([QS[q], `${x.pts}-${m.opp[q]}`, ...statCells(x)]); });
  const detail = [["QT", "N°", t("Joueur"), "Min", "+/-", ...statHead()]];
  playedQuarters(m).forEach(q => R.players.forEach(({ r, p }) => { const x = derive(m.stats[r.pid][q]); detail.push([QS[q], r.no, fullName(p), timed(m) ? fmtClock(x.min) : "", x.pm, ...statCells(x)]); }));
  const fives = [[t("Cinq"), "Min", t("Pour"), t("Contre"), t("Écart")], ...lineupRows(m).sort((a, b) => (b.pf - b.pa) - (a.pf - a.pa)).map(r => [r.ids.map(id => dispName(playerById(id))).join(", "), fmtClock(r.sec), r.pf, r.pa, r.pf - r.pa])];
  const log = [["QT", t("Chrono"), t("Action")], ...m.log.map(e => [QS[e.q], e.clock || "", logLabel(m, e)])];
  downloadBook([[t("Match"), main], [t("Avancées"), adv], [t("Quarts-temps"), quarters], [t("Détail"), detail], [t("Cinq"), fives], [t("Journal"), log]], `${fileSafe(tm ? tm.name : "")}_${fileSafe(m.opponent)}_${m.date}.xlsx`);
}
function exportSeason(tid) {
  const tm = db.teams.find(x => x.id === tid), rows = seasonPlayerRows(tid, ui.season, "season"), s = seasonTeamStats(tid, ui.season, "season");
  const totals = [[t("Joueur"), t("MJ"), "Min", "+/-", ...statHead()]];
  rows.forEach(r => totals.push([fullName(r.p), r.gp, fmtClock(r.timedMin), r.d.pm, ...statCells(r.d)]));
  const avg = [[t("Joueur"), t("MJ"), "Min/m", "Pts", "Reb", t("PD"), t("Int"), t("Ctr"), t("BP"), t("F"), "PIR", "% " + t("tirs"), "3 pts", "LF", "eFG", "TS", "+/-"]];
  rows.forEach(r => { const g = r.gp, d = r.d; avg.push([fullName(r.p), g, fmtClock(r.timedMin / g), D1(d.pts / g), D1(d.reb / g), D1(d.ast / g), D1(d.stl / g), D1(d.blk / g), D1(d.tov / g), D1(d.pf / g), D1(d.pir / g), P100(safe(d.fgm, d.fga)), P100(safe(d.tpm, d.tpa)), P100(safe(d.ftm, d.fta)), P100(eFG(d)), P100(TS(d)), D1(d.pm / g)]); });
  const games = [[t("Date"), t("Adversaire"), t("Score"), "eFG", "TS", t("Balles perdues")], ...s.ms.map(m => { const d = derive(teamTotal(m)); return [m.date, m.opponent, `${d.pts}-${oppTotal(m)}`, P100(eFG(d)), P100(TS(d)), d.tov]; }), [], [t("Bilan"), `${s.w} - ${s.l}`]];
  const fives = [[t("Cinq"), t("MJ"), "Min", t("Pour"), t("Contre"), t("Écart")], ...seasonLineups(s.ms).sort((a, b) => (b.pf - b.pa) - (a.pf - a.pa)).map(r => [r.ids.map(id => fullName(playerById(id))).join(", "), r.gp, fmtClock(r.sec), r.pf, r.pa, r.pf - r.pa])];
  downloadBook([[t("Moyennes"), avg], [t("Totaux"), totals], [t("Matchs"), games], [t("Cinq"), fives]], `${fileSafe(tm.name)}_${ui.season}.xlsx`);
}
function backupFile() { deliver(new Blob([JSON.stringify(db)], { type: "application/json" }), `sauvegarde_stats_basket_${todayISO()}.json`); }
function restoreFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!Array.isArray(data.teams) || !Array.isArray(data.matches)) throw new Error("format");
      const n = mergeData(db, data);
      if (!team()) pickDefaultTeam();
      save(); render();
      toast(t("Ajouté : {a} équipe(s), {b} joueur(s), {c} match(s)", { a: n.teams, b: n.players, c: n.matches }));
    } catch (e) { toast(t("Ce fichier n'est pas une sauvegarde valide")); }
  };
  reader.readAsText(file);
}

/* ================= RENDU ================= */
function gateView() {
  if (!CLOUD) return null;
  if (!cloud.ready) return `<div class="screen">${clubLogo("gatelogo")}<p class="title">Stats Basket</p><p class="muted">${t("Connexion au club…")}</p></div>`;
  if (!cloud.user) return `<div class="screen">${clubLogo("gatelogo")}<p class="title">Stats Basket</p><div class="card" style="display:grid;gap:8px"><b>${t("Connexion au club")}</b>
    <div class="field"><label for="aemail">${t("E-mail")}</label><input class="inp" id="aemail" type="email" autocomplete="username" inputmode="email"></div>
    <div class="field"><label for="apass">${t("Mot de passe")}</label><input class="inp" id="apass" type="password" autocomplete="current-password"></div>
    <button class="btn main" data-a="signin">${t("Se connecter")}</button><div class="btns"><button class="btn" data-a="signup">${t("Créer un compte")}</button><button class="btn" data-a="reset">${t("Mot de passe oublié")}</button></div></div>
    <p class="muted small">${t("Ton compte doit être autorisé par l'administrateur du club. La première connexion demande du réseau, ensuite l'appli marche aussi hors ligne.")}</p></div>`;
  if (!cloud.user.emailVerified) return `<div class="screen"><p class="title">${t("Vérifie ton e-mail")}</p><div class="card help"><p>${t("Un lien a été envoyé à {e}. Ouvre-le (regarde aussi les spams), puis reviens ici.", { e: esc(cloud.user.email) })}</p><p><b>${t("Si l'e-mail n'arrive pas, attends quelques minutes et regarde dans les spams.")}</b></p></div>
    <button class="btn main big" data-a="verified">${t("J'ai vérifié")}</button><div class="btns"><button class="btn" data-a="resend">${t("Renvoyer l'e-mail")}</button><button class="btn" data-a="signout">${t("Se déconnecter")}</button></div></div>`;
  if (!cloud.member) return `<div class="screen"><p class="title">${t("Compte pas encore autorisé")}</p><div class="card help"><p>${t("Demande à l'administrateur du club d'ajouter {e}, puis touche Réessayer.", { e: "<b>" + esc(cloud.user.email) + "</b>" })}</p></div>
    <button class="btn main big" data-a="askaccess">${t("Envoyer ma demande")}</button><div class="btns"><button class="btn" data-a="recheck">${t("Réessayer")}</button><button class="btn" data-a="signout">${t("Se déconnecter")}</button></div></div>`;
  return null;
}
const SUBVIEWS = { chronoset: vChronoSet, newmatch: vNewMatch, player: vPlayer, editplayer: vEditPlayer, pickplayers: vPickPlayers, clubplayers: vClubPlayers, teams: vTeams, teamsheet: vTeamSheet, prepseason: vPrepSeason, members: vMembers, memberedit: vMemberEdit, backupview: vBackup, trashview: vTrash, importxl: vImportXl, analyses: vAnalyses, account: vAccount, help: vHelp, topic: vTopic, lexique: vLexique, report: vReport, quick: vQuick, log: vLog };
function render() {
  applyTheme();
  const app = document.getElementById("app");
  const gate = gateView();
  let html;
  if (gate) html = `<div class="app" style="grid-template-rows:1fr">${gate}</div>`;
  else if (ui.view === "match" && match()) html = vMatchScreen();
  else if (TABS.includes(ui.view)) {
    if (!team() && db.teams.length) pickDefaultTeam();
    const body = { matchs: vMatchs, saison: vSaison, effectif: vEffectif, reglages: vReglages }[ui.view]();
    html = `<div class="app">${ui.view === "reglages" ? `<header class="appbar"><span class="lefthead"><span class="teampick" style="pointer-events:none">${t("Réglages")}</span></span><span class="mid"></span>${clubLogo("clublogo")}</header>` : appbar()}<main class="screen">${body}</main>${tabbar()}</div>`;
  } else {
    const fn = SUBVIEWS[ui.view] || vMatchs;
    html = `<div class="app" style="grid-template-rows:auto 1fr"><header class="subbar"><button class="back" data-a="back">‹ ${t("Retour")}</button>${(ui.view === "player" || (ui.view === "editplayer" && ui.editPlayer && (ui.plist || []).includes(ui.editPlayer))) && (ui.plist || []).length > 1 ? `<span class="pnav"><button data-a="pnav" data-n="-1" aria-label="${t("Joueur précédent")}">‹</button><span>${ui.plist.indexOf(ui.view === "player" ? ui.playerId : ui.editPlayer) + 1}/${ui.plist.length}</span><button data-a="pnav" data-n="1" aria-label="${t("Joueur suivant")}">›</button></span>` : ""}</header><main class="screen">${fn()}</main></div>`;
  }
  if (ui.sheet) {
    const inner = ui.sheet.type === "info" ? infoSheet(ui.sheet.key, ui.sheet.ctx) : ui.sheet.type === "menu" ? menuSheet() : ui.sheet.type === "quarters" ? quartersSheet() : ui.sheet.type === "teampick" ? teamPickSheet() : ui.sheet.type === "oppno" ? oppNoSheet() : "";
    html += `<div class="scrim" data-a="closesheet"></div><div class="sheet" role="dialog">${inner}</div>`;
  }
  if (ui.confirm) html += `<div class="dialog-wrap"><div class="dialog" role="alertdialog"><p>${esc(ui.confirm.text)}</p>${ui.confirm.typed ? `<div class="field"><label for="ctyped">${esc(t("Pour confirmer, écris : {w}", { w: "§" })).replace("§", `<b>${esc(ui.confirm.typed)}</b>`)}</label><input class="inp" id="ctyped" autocomplete="off" autocapitalize="off"></div>` : ""}<div class="btns"><button class="btn" data-a="no">${t("Annuler")}</button><button class="btn main" data-a="yes">${esc(ui.confirm.label || t("Confirmer"))}</button></div></div></div>`;
  lastLand = isLand();
  document.body.classList.toggle("wide", ui.view === "match" && lastLand);
  app.innerHTML = html;
}

/* ================= ACTIONS ================= */
const A = {
  tab: b => tab(b.dataset.n),
  back: () => { if (ui.view === "prepseason" && ui.prep && ui.prep.i > 0) { prepKeep(); ui.prep.i--; render(); return; } back(); },
  teampick: () => { ui.sheet = { type: "teampick" }; render(); },
  pickteam: b => { ui.teamId = b.dataset.id; ui.sheet = null; render(); },
  closesheet: () => { ui.sheet = null; render(); },
  info: b => { ui.sheet = { type: "info", key: b.dataset.k, ctx: JSON.parse(b.dataset.c || "[]") }; render(); },
  lexique: () => go("lexique"),
  help: () => go("help"),
  topic: b => go("topic", { topic: b.dataset.n }),
  set: b => { S[b.dataset.k] = b.dataset.n; saveSettings(); if (b.dataset.k === "lang" && fbAuth) fbAuth.languageCode = S.lang; render(); },
  toggle: b => { S[b.dataset.k] = !S[b.dataset.k]; saveSettings(); render(); },
  chronoset: () => go("chronoset"),
  range: b => { ui.range = b.dataset.n; render(); },
  curve: b => { ui.curve = b.dataset.n; render(); },
  statmode: b => { ui.statMode = b.dataset.n; render(); },
  sort: b => { ui.sort = b.dataset.n; render(); },
  ptab: b => { ui.ptab = b.dataset.n; render(); },
  player: b => {
    const box = b.closest(".card, table, .leaders, main") || document;
    const list = [...new Set([...box.querySelectorAll("[data-a=player]")].map(e => e.dataset.id))];
    go("player", { playerId: b.dataset.id, plist: list.includes(b.dataset.id) ? list : [b.dataset.id] });
  },
  pnav: b => pnav(+b.dataset.n),
  newmatch: () => go("newmatch", { edit: null, form: {} }),
  formchrono: b => { keepMatchForm(); ui.form.chrono = b.dataset.n; render(); },
  oppno: b => setOppNo(+b.dataset.n),
  oppnoskip: () => setOppNo(null),
  oppnoadd: () => { ui.oppNoInput = true; render(); setTimeout(() => { const i = document.getElementById("oppnoin"); if (i) i.focus(); }, 30); },
  oppnook: () => { const v = val("oppnoin").trim(); if (!/^\d{1,3}$/.test(v)) { toast(t("Numéro")); return; } setOppNo(+v); },
  formoppmode: b => { keepMatchForm(); ui.form.oppMode = b.dataset.n; render(); },
  ox: b => { const m = match(); if (!m || ui.readonly) return; const e = { kind: "ox", q: m.qi, ox: b.dataset.n, changes: [] }; commit(m, e); afterCommit(m, e, true); },
  savematch: saveMatchForm,
  report: b => go("report", { reportId: b.dataset.id }),
  impswap: b => { const p = ui.imp.players[+b.dataset.n], parts = (p.first + " " + p.last).trim().split(" "); p.first = parts[parts.length - 1]; p.last = parts.slice(0, -1).join(" "); render(); },
  impcat: b => { ui.imp.newCat = b.dataset.n; render(); },
  impdo: () => doImportXl(),
  analyses: b => go("analyses", { anaTab: b.dataset.n }),
  anatab: b => { ui.anaTab = b.dataset.n; window.scrollTo(0, 0); render(); },
  lusort: b => { ui.luSort = b.dataset.n; render(); },
  open: b => openMatch(b.dataset.id),
  newplayer: () => go("editplayer", { editPlayer: null, form: { toTeam: true, sex: (team() || {}).cat }, photo: undefined }),
  newplayerclub: () => go("editplayer", { editPlayer: null, form: { toTeam: false }, photo: undefined }),
  editplayer: b => go("editplayer", { editPlayer: b.dataset.id, form: {}, photo: undefined }),
  formsex: b => { keepForm(); ui.form.sex = b.dataset.n; render(); },
  formpos: b => { keepForm(); const p = ui.editPlayer ? playerById(ui.editPlayer) : { pos: [] }; let pos = [...(ui.form.pos || p.pos || [])]; const n = +b.dataset.n; if (pos.includes(n)) pos = pos.filter(x => x !== n); else if (pos.length < 5) pos.push(n); else toast(t("Deux positions au maximum")); ui.form.pos = pos; render(); },
  nophoto: () => { keepForm(); ui.photo = ""; render(); },
  saveplayer: savePlayer,
  deleteplayer: () => {
    const p = db.players.find(x => x.id === ui.editPlayer), n = db.matches.filter(m => m.roster.some(r => r.pid === p.id)).length;
    if (n) { toast(t("{p} a joué {n} match(s) : retire-la de l'effectif plutôt que de la supprimer.", { p: dispName(p), n })); return; }
    confirmBox(t("Mettre {p} à la corbeille ? Restauration possible pendant {d} jours.", { p: fullName(p), d: TRASH_DAYS }), () => { trashPlayer(p); save(); ui.stack.pop(); back(); }, t("Mettre à la corbeille"));
  },
  trashview: () => go("trashview"),
  trashrestore: b => { const e = db.trash.find(x => x.id === b.dataset.id); const r = trashRestore(e); if (r === "noteam") { toast(t("Restaure d'abord son équipe")); return; } save(); render(); toast(t("Restauré")); },
  trashpurge: b => { const e = db.trash.find(x => x.id === b.dataset.id), [k, l] = trashLabel(e); confirmBox(t("Supprimer définitivement « {x} » ? Impossible à annuler.", { x: l }), () => { db.trash = db.trash.filter(x => x.id !== e.id && x.withTeam !== e.id); save(); }, t("Supprimer définitivement"), "SUPPRIMER"); },
  removefromteam: b => confirmBox(t("Retirer ce joueur de l'effectif de cette saison ? Ses stats sont conservées."), () => { const ts = team().seasons[ui.season]; ts.players = ts.players.filter(x => x !== b.dataset.id); save(); back(); }),
  pickplayers: () => go("pickplayers", { form: {}, pick: [] }),
  pickall: () => { ui.form.allsex = !ui.form.allsex; render(); },
  addpicked: () => { const tm = team(), ts = tm.seasons[ui.season] = tm.seasons[ui.season] || { level: "", players: [] }; ui.pick = ui.pick.filter(id => catOk(playerById(id), tm)); ui.pick.forEach(id => { const p = playerById(id); if (p && !p.sex) p.sex = tm.cat; if (!ts.players.includes(id)) ts.players.push(id); }); const n = ui.pick.length; ui.pick = []; save(); back(); toast(t("{n} joueur(s) ajouté(s)", { n })); },
  clubplayers: () => go("clubplayers"),
  filter: b => { ui.filters[b.dataset.k] = b.dataset.n; render(); },
  teams: () => go("teams"),
  teamsheet: b => go("teamsheet", { teamView: b.dataset.id }),
  addteam: () => { const name = val("tname").trim(), cat = val("tcat"), level = val("tlevel").trim(); if (!name) { toast(t("Indique le nom de l'équipe")); return; } const x = { id: uid(), name, cat, seasons: { [ui.season]: { level, players: [] } } }; db.teams.push(x); ui.teamId = x.id; save(); render(); toast(t("Équipe créée")); },
  saveteam: b => { const x = db.teams.find(y => y.id === b.dataset.id); const name = val("tn").trim(); if (!name) return; x.name = name; const ts = x.seasons[ui.season] = x.seasons[ui.season] || { level: "", players: [] }; ts.level = val("tl").trim(); ts.rank = val("tr").trim(); save(); render(); toast(t("Équipe enregistrée")); },
  delteam: b => { const x = db.teams.find(y => y.id === b.dataset.id), n = db.matches.filter(m => m.teamId === x.id).length; confirmBox(t("Mettre {t} et ses {n} match(s) à la corbeille ? Les joueurs restent dans le club. Restauration possible pendant {d} jours.", { t: x.name, n, d: TRASH_DAYS }), () => { trashTeam(x); if (ui.teamId === x.id) pickDefaultTeam(); save(); back(); toast(t("Équipe mise à la corbeille")); }, t("Mettre à la corbeille"), x.name); },
  prepseason: startPrep,
  prepstatus: b => { prepKeep(); const r = ui.prep.res[ui.prep.teams[ui.prep.i]]; r.status = b.dataset.n; render(); },
  prepnext: () => { prepKeep(); ui.prep.i++; window.scrollTo(0, 0); render(); },
  prepprev: () => { prepKeep(); ui.prep.i--; render(); },
  prepdone: () => confirmBox(t("Créer la saison {s} avec ces effectifs ?", { s: ui.prep.to }), prepDone),
  members: () => go("members"),
  memberedit: b => go("memberedit", { memberEdit: b.dataset.n || null, form: {} }),
  formrole: b => { keepMemberForm(); ui.form.role = b.dataset.n; render(); },
  savemember: async () => {
    keepMemberForm();
    const e = ui.memberEdit || low(val("memail") || ui.form.email || "");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) { toast(t("Adresse e-mail invalide")); return; }
    const m = cloud.members[e] || {}, r = ui.form.role || m.role || "coach", teams = r === "coach" ? (ui.form.teams || m.teams || []) : [];
    if (await writeMembers(ms => { ms[e] = { role: r, teams }; })) { toast(t("Accès enregistré")); back(); }
  },
  delmember: () => confirmBox(t("Retirer l'accès de {e} ?", { e: ui.memberEdit }), async () => { if (await writeMembers(ms => { delete ms[ui.memberEdit]; })) back(); }),
  backupview: () => go("backupview"),
  backup: backupFile,
  importlocal: () => confirmBox(t("Envoyer au club les équipes, joueurs et matchs de ce téléphone ?"), () => { const n = mergeData(db, localOnlyData()); if (!team()) pickDefaultTeam(); save(); render(); toast(t("Ajouté : {a} équipe(s), {b} joueur(s), {c} match(s)", { a: n.teams, b: n.players, c: n.matches })); }),
  account: () => go("account"),
  xls: b => exportMatch(db.matches.find(x => x.id === b.dataset.id)),
  xlsseason: () => team() && exportSeason(team().id),
  sharereport: b => shareReport(b.dataset.id),
  shareplayer: b => sharePlayer(b.dataset.id),
  delmatch: b => {
    const m = db.matches.find(x => x.id === b.dataset.id);
    if (lockedByOther(m)) { toast(t("Saisie en cours par {n} : lecture seule.", { n: m.editor.name })); return; }
    const d = derive(teamTotal(m)), live = m.log.length > 0;
    confirmBox(t("Mettre le match contre {o} ({s}) à la corbeille ? Tu pourras le restaurer pendant {n} jours.", { o: m.opponent, s: `${d.pts}-${oppTotal(m)}`, n: TRASH_DAYS }), () => { trashMatch(m); save(); ui.stack = []; tab("matchs"); toast(t("Match mis à la corbeille")); }, t("Mettre à la corbeille"), live ? m.opponent : null);
  },
  /* Saisie */
  leave: leaveMatch,
  undo: () => { const m = match(); const e = undoEntry(m); if (e) { if (e.kind === "sub" && ui.sel === e.in) ui.sel = e.out || m.court[0] || null; save(); render(); toast(t("Annulé : {x}", { x: logLabel(m, e) })); } },
  menu: () => { ui.sheet = { type: "menu" }; render(); },
  quarters: () => { ui.sheet = { type: "quarters" }; render(); },
  setq: b => { const m = match(), n = +b.dataset.n; if (m.running) { toast(t("Arrête d'abord le chrono")); return; } ui.sheet = null; confirmBox(t("Passer de {a} à {b} ?", { a: QS[m.qi], b: QS[n] }), () => { m.qi = n; save(); toast(t("{Q} sélectionné", { Q: QS[n] })); }); },
  closeq: () => { const m = match(); confirmBox(m.qi < 3 ? t("Clore {a} et passer à {b} ?", { a: QS[m.qi], b: QS[m.qi + 1] }) : t("Clore {a} ?", { a: QS[m.qi] }), () => { stopTimer(); const q = closeQuarter(m); ui.banner = false; save(); toast(t("{Q} clos", { Q: QS[q] })); }); },
  clock: toggleClock,
  relaunch: () => { ui.banner = false; toggleClock(); },
  adj: b => { const m = match(); adjustClock(m, +b.dataset.n); save(); updateClocks(); },
  opp: b => doOpp(+b.dataset.n),
  court: b => { const m = match(), pid = b.dataset.id; if (ui.sub && !ui.readonly) doSub(ui.sub, pid); else { ui.sel = pid; render(); } },
  bench: b => { const m = match(), pid = b.dataset.id; if (ui.readonly) return; if (m.court.length < 5) { doSub(pid, null); return; } ui.sub = ui.sub === pid ? null : pid; render(); },
  benchout: b => { const m = match(); ui.sheet = null; commit(m, { kind: "sub", in: null, out: b.dataset.id, changes: [] }); if (ui.sel === b.dataset.id) ui.sel = m.court[0] || null; save(); render(); },
  fast: () => { ui.fast = !ui.fast; clearTimeout(ui.fastTimer); if (ui.fast) ui.fastTimer = setTimeout(() => { ui.fast = false; if (ui.view === "match") render(); }, 20000); render(); },
  takeover: () => confirmBox(t("Prendre la main ? L'autre appareil passera en lecture seule."), () => { const m = match(); ui.readonly = false; takeLock(m); save(); resumeClock(m); }),
  quick: () => go("quick"),
  log: () => go("log"),
  numbers: () => { const m = match(); if (m.running && m.chrono !== "prop") { toast(t("Arrête d'abord le chrono")); return; } go("newmatch", { edit: m.id, form: {} }); },
  dellog: b => { const m = match(), e = m.log.find(x => x.id === b.dataset.id); confirmBox(t("Supprimer « {x} » ?", { x: logLabel(m, e) }), () => { if (!deleteEntry(m, e.id)) toast(t("Pour un changement, utilise Annuler dans l'ordre inverse")); save(); }); },
  layout: b => { S.layout = b.dataset.n; saveSettings(); ui.sheet = null; render(); },
  /* Compte */
  signin: () => doAuth("signin"),
  signup: () => doAuth("signup"),
  reset: () => doAuth("reset"),
  verified: checkVerified,
  resend: () => cloud.user.sendEmailVerification().then(() => toast(t("E-mail renvoyé")), e => toast(authMsg(e))),
  recheck: async () => {
    try { await fbAuth.currentUser.reload(); cloud.user = fbAuth.currentUser; } catch (e) { /* hors ligne */ }
    await freshToken(); await checkMember(); if (cloud.member) startSync(); else toast(t("Toujours pas autorisé : vérifie avec l'administrateur l'adresse e-mail exacte.")); render();
  },
  askaccess: async () => {
    const text = t("Bonjour, peux-tu me donner accès à Stats Basket ? Mon e-mail : {e}", { e: cloud.user.email });
    try { if (navigator.share) { await navigator.share({ text }); return; } } catch (e) { if (e.name === "AbortError") return; }
    try { await navigator.clipboard.writeText(text); toast(t("Message copié : colle-le dans WhatsApp ou un SMS")); } catch (e) { toast(text); }
  },
  signout: () => confirmBox(t("Se déconnecter du club ?"), () => { stopTimer(); stopSync(); ui.matchId = null; ui.stack = []; ui.view = "matchs"; fbAuth.signOut(); }),
  no: () => { ui.confirm = null; render(); },
  yes: () => { const c = ui.confirm; if (c.typed && low(val("ctyped").trim()) !== low(c.typed)) { toast(t("Le texte ne correspond pas")); return; } ui.confirm = null; c.yes(); render(); },
};
function keepMatchForm() { const o = document.getElementById("opp"), d = document.getElementById("date"); if (o) ui.form.opp = o.value; if (d) ui.form.date = d.value; const checked = [...document.querySelectorAll('input[type=checkbox][id^="c-"]')]; if (checked.length) ui.form.checked = checked.filter(c => c.checked).map(c => c.id.slice(2)); }
function keepMemberForm() { const e = document.getElementById("memail"); if (e) ui.form.email = e.value; const boxes = [...document.querySelectorAll("[data-mteam]")]; if (boxes.length) ui.form.teams = boxes.filter(c => c.checked).map(c => c.dataset.mteam); }
const READONLY_OK = new Set(["leave", "menu", "quarters", "closesheet", "court", "quick", "log", "report", "xls", "takeover", "layout", "topic", "no", "yes", "back", "info", "lexique", "player"]);

document.addEventListener("click", e => {
  const b = e.target.closest("[data-a]");
  if (!b || b.disabled) return;
  const a = b.dataset.a;
  if (ui.readonly && ui.view === "match" && !READONLY_OK.has(a)) { toast(t("Lecture seule")); return; }
  if (a.startsWith("shot:")) { const [, id, made] = a.split(":"); doShot(id, made === "1", +b.dataset.d); return; }
  if (a.startsWith("stat:")) { doCounter(a.split(":")[1], +b.dataset.d); return; }
  if (A[a]) A[a](b);
});
document.addEventListener("change", e => {
  const el = e.target, k = el.dataset.change;
  if (el.dataset.pick !== undefined) { ui.pick = el.checked ? [...new Set([...ui.pick, el.dataset.pick])] : ui.pick.filter(x => x !== el.dataset.pick); return; }
  if (!k) return;
  if (k === "season") { ui.season = el.value; render(); }
  else if (k === "layout") { S.layout = el.value; saveSettings(); }
  else if (k === "fteam") { ui.filters.team = el.value; render(); }
  else if (k === "fseason") { ui.filters.season = el.value; render(); }
  else if (k === "date") { keepMatchForm(); ui.form.date = el.value; render(); }
  else if (k === "photo" && el.files[0]) { keepForm(); readPhoto(el.files[0]); }
  else if (k === "restore" && el.files[0]) restoreFile(el.files[0]);
  else if (k === "impxl" && el.files[0]) { readOldExcel(el.files[0]); el.value = ""; }
  else if (k === "impteam") { ui.imp.teamId = el.value; render(); }
  else if (k === "impdate") { ui.imp.date = el.value; render(); }
});
document.addEventListener("input", e => {
  const k = e.target.dataset.input;
  if (!k) return;
  if (k === "impopp") { ui.imp.opponent = e.target.value; return; }
  if (k === "fq") ui.filters.q = e.target.value;
  if (k === "pq") ui.form.q = e.target.value;
  const pos = e.target.selectionStart;
  render();
  const el = document.querySelector(`[data-input="${k}"]`);
  if (el) { el.focus(); try { el.setSelectionRange(pos, pos); } catch (x) { /* rien */ } }
});
document.addEventListener("visibilitychange", () => {
  const m = match();
  if (!m || ui.readonly) return;
  if (document.hidden) { accrue(m); save(); }
  else if (m.running) { keepAwake(true); accrue(m); updateClocks(); }
});
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { if (S.mode === "auto") render(); });
setInterval(() => { if (ui.view === "match" && ui.readonly) updateClocks(); }, 1000);
window.addEventListener("online", () => { if (CLOUD && cloud.member) push(); });

/* Ouverture : le logo du club s'affiche au centre, puis glisse et rétrécit jusqu'au coin en haut à droite.
   On attend que l'écran principal soit affiché (connexion au club comprise) pour viser la bonne place. */
function splashOut() {
  const sp = document.getElementById("splash");
  if (!sp) return;
  const t0 = Date.now(), reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const end = () => { document.body.classList.remove("splashing"); sp.remove(); };
  const fade = () => { sp.classList.add("out"); setTimeout(end, 450); };
  const tryFly = () => {
    const img = sp.querySelector("img"), target = document.querySelector(".appbar .clublogo");
    const ready = img && img.complete && target && target.complete && target.offsetHeight;
    const gate = !document.querySelector(".appbar") && (!CLOUD || cloud.ready);
    if (!ready) { if (!gate && Date.now() - t0 < 3500) return setTimeout(tryFly, 120); return fade(); }
    if (reduce) return fade();
    const a = img.getBoundingClientRect(), b = target.getBoundingClientRect();
    const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2), k = b.height / a.height;
    sp.classList.add("fly");
    const anim = img.animate([{ transform: "translate(0, 0) scale(1)" }, { transform: `translate(${dx}px, ${dy}px) scale(${k})` }], { duration: 750, easing: "cubic-bezier(.6, 0, .2, 1)", fill: "forwards" });
    anim.onfinish = end;
    setTimeout(end, 1200);
  };
  tryFly();
}
function boot() {
  document.body.classList.add("splashing");
  setTimeout(splashOut, 1000);
  pickDefaultTeam();
  initCloud();
  render();
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  if ("serviceWorker" in navigator && location.protocol.startsWith("http") && !window.NO_SW) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
    // Nouvelle version installée : on recharge une fois pour l'afficher (sauf pendant une saisie)
    navigator.serviceWorker.addEventListener("message", ev => { if (ev.data === "sb2-updated" && ui.view !== "match" && !sessionStorage.getItem("sb2-reloaded")) { sessionStorage.setItem("sb2-reloaded", "1"); location.reload(); } });
  }
}
