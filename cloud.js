"use strict";
/* Synchronisation club via Firebase : comptes, rôles, équipes partagées, verrou de saisie. */

const FB_CONFIG = window.FIREBASE_CONFIG || {};
const CLOUD = !!(window.firebase && FB_CONFIG.apiKey && FB_CONFIG.apiKey !== "A_REMPLIR");
const STORE_KEY = CLOUD ? "stats-basket-cloud" : LOCAL_KEY;
const LOCK_MS = 30 * 60 * 1000;
const DEVICE = (() => {
  try { let d = localStorage.getItem("stats-basket-device"); if (!d) { d = uid(); localStorage.setItem("stats-basket-device", d); } return d; }
  catch (e) { return uid(); }
})();
const cloud = { requests: [], refused: {}, requested: false, ready: !CLOUD, user: null, member: false, role: "admin", teams: [], members: {}, adminEmail: "", unsubs: [], synced: {}, pushTimer: null };
let fbAuth = null, fs = null;

function loadDb() {
  try { const raw = localStorage.getItem(STORE_KEY); if (raw) return migrate(JSON.parse(raw)); } catch (e) { /* données illisibles */ }
  return freshDb();
}
let db = loadDb();
function saveLocal() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(db)); }
  catch (e) { toast(t("Mémoire pleine : exporte une sauvegarde")); }
}
function save() {
  const m = typeof match === "function" ? match() : null;
  if (CLOUD && m && !ui.readonly && m.editor && m.editor.device === DEVICE) m.editor.at = Date.now();
  saveLocal();
  schedulePush();
}

/* ---------- Rôles ---------- */
const role = () => (CLOUD ? cloud.role : "admin");
const isAdmin = () => role() === "admin";
const canEditTeam = tid => isAdmin() || (role() === "coach" && cloud.teams.includes(tid));
const myName = () => (cloud.user ? cloud.user.email.split("@")[0] : "");
function lockedByOther(m) { return CLOUD && !!m.editor && m.editor.device !== DEVICE && Date.now() - m.editor.at < LOCK_MS; }
function takeLock(m) { m.editor = { device: DEVICE, name: myName(), at: Date.now() }; }

/* ---------- Envoi ---------- */
function docsOf() {
  const out = {};
  db.teams.forEach(x => { out["teams/" + x.id] = { json: JSON.stringify(x), teamId: x.id }; });
  db.players.forEach(x => { out["players/" + x.id] = { json: JSON.stringify(x), teamId: "" }; });
  db.matches.forEach(m => { out["matches/" + m.id] = { json: JSON.stringify(m), teamId: m.teamId }; });
  db.trash.forEach(x => { out["trash/" + x.id] = { json: JSON.stringify(x), teamId: x.teamId || "" }; });
  return out;
}
function schedulePush() {
  if (!CLOUD || !cloud.member) return;
  clearTimeout(cloud.pushTimer);
  cloud.pushTimer = setTimeout(push, 1200);
}
function writable(k, teamId) {
  if (isAdmin()) return true;
  if (role() !== "coach") return false;
  if (k.startsWith("players/")) return true;
  if (k.startsWith("trash/")) return !!teamId && cloud.teams.includes(teamId);
  if (k.startsWith("teams/")) return cloud.teams.includes(teamId) && k in cloud.synced;
  return cloud.teams.includes(teamId);
}
function push() {
  if (!cloud.member) return;
  const cur = docsOf(), ops = [];
  Object.keys(cur).forEach(k => { if (cur[k].json !== cloud.synced[k] && writable(k, cur[k].teamId)) ops.push([k, cur[k]]); });
  Object.keys(cloud.synced).forEach(k => {
    if (k in cur) return;
    if (k.startsWith("players/") && !isAdmin()) return;
    const teamId = k.startsWith("teams/") ? k.slice(6) : k.startsWith("players/") ? "" : (JSON.parse(cloud.synced[k]).teamId);
    if (isAdmin() || ((k.startsWith("matches/") || k.startsWith("trash/")) && role() === "coach" && cloud.teams.includes(teamId))) ops.push([k, null]);
  });
  for (let i = 0; i < ops.length; i += 400) {
    const part = ops.slice(i, i + 400), batch = fs.batch();
    part.forEach(([k, d]) => {
      if (d === null) { batch.delete(fs.doc(k)); delete cloud.synced[k]; }
      else { batch.set(fs.doc(k), { json: d.json, teamId: d.teamId, by: cloud.user.email, at: firebase.firestore.FieldValue.serverTimestamp() }); cloud.synced[k] = d.json; }
    });
    batch.commit().catch(err => { part.forEach(([k]) => { delete cloud.synced[k]; }); syncError(err); });
  }
}
function syncError(err) {
  toast(err && err.code === "permission-denied" ? t("Accès refusé : tu n'as pas les droits pour cette équipe.") : t("Synchronisation impossible pour le moment."));
}

/* ---------- Réception ---------- */
const QUIET_VIEWS = ["matchs", "saison", "effectif", "report", "player", "match", "log", "quick", "members"];
function listen(col) {
  let first = true;
  return fs.collection(col).onSnapshot(snap => {
    let changed = false, takenOver = false;
    const arr = col === "teams" ? db.teams : col === "players" ? db.players : col === "trash" ? db.trash : db.matches;
    if (first) {
      first = false;
      const ids = new Set(snap.docs.map(d => d.id));
      for (let i = arr.length - 1; i >= 0; i--) {
        if (!ids.has(arr[i].id) && !(col === "matches" && arr[i].id === ui.matchId && !ui.readonly)) { arr.splice(i, 1); changed = true; }
      }
    }
    snap.docChanges().forEach(ch => {
      const k = col + "/" + ch.doc.id, i = arr.findIndex(x => x.id === ch.doc.id);
      const localJson = i >= 0 ? JSON.stringify(arr[i]) : undefined;
      const editing = col === "matches" && ch.doc.id === ui.matchId && !ui.readonly;
      if (ch.type === "removed") {
        if (!editing && (localJson === undefined || localJson === cloud.synced[k])) { if (i >= 0) arr.splice(i, 1); delete cloud.synced[k]; changed = true; }
        return;
      }
      const remote = ch.doc.data().json;
      if (remote === localJson) { cloud.synced[k] = remote; return; }
      if (editing) {
        const r = JSON.parse(remote);
        if (r.editor && r.editor.device !== DEVICE && (!arr[i].editor || r.editor.at >= arr[i].editor.at)) {
          arr[i] = migrate({ teams: [], matches: [r] }).matches[0]; cloud.synced[k] = remote; ui.readonly = true; stopTimer(); changed = takenOver = true;
        }
        return;
      }
      if (localJson === undefined || localJson === cloud.synced[k] || ch.doc.metadata.hasPendingWrites === false) {
        const obj = JSON.parse(remote);
        const fixed = col === "trash" ? obj : col === "matches" ? migrate({ teams: [], matches: [obj] }).matches[0] : col === "teams" ? (obj.seasons ? obj : migrate({ teams: [obj], matches: [] }).teams[0]) : { pos: [], sex: "F", ...obj };
        if (i >= 0) arr[i] = fixed; else arr.push(fixed);
        cloud.synced[k] = remote; changed = true;
      }
    });
    if (!changed) return;
    saveLocal();
    if (ui.matchId && !match()) { stopTimer(); ui.matchId = null; ui.readonly = false; ui.view = "matchs"; }
    if (!team()) pickDefaultTeam();
    if (takenOver) toast(t("{n} a pris la main sur ce match", { n: match().editor.name }));
    if (QUIET_VIEWS.includes(ui.view) && !ui.confirm && !ui.sheet) render();
  }, err => syncError(err));
}
function readMembers(d) {
  const email = low(cloud.user.email);
  cloud.adminEmail = d.admin || "";
  cloud.members = d.members || {};
  cloud.refused = d.refused || {};
  const me = cloud.members[email];
  if (d.admin === email) { cloud.role = "admin"; cloud.teams = []; cloud.member = true; }
  else if (me) { cloud.role = me.role; cloud.teams = me.teams || []; cloud.member = true; }
  else { cloud.member = false; }
}
/* Le jeton de connexion garde l'ancien état « e-mail non vérifié » jusqu'à une heure :
   on en demande un neuf, sinon le serveur refuse l'accès alors que le compte est validé. */
async function freshToken() {
  try { if (fbAuth.currentUser && navigator.onLine !== false) await fbAuth.currentUser.getIdToken(true); } catch (e) { /* hors ligne */ }
}
async function checkMember(retried) {
  const email = low(cloud.user.email);
  try {
    const ref = fs.doc("config/members"), snap = await ref.get();
    if (!snap.exists) {
      const d = { admin: email, members: { [email]: { role: "admin", teams: [] } } };
      await ref.set(d);
      readMembers(d);
    } else readMembers(snap.data());
  } catch (e) {
    if (!retried && e && e.code === "permission-denied") { await freshToken(); return checkMember(true); }
    cloud.member = false;
    try { const c = JSON.parse(localStorage.getItem("stats-basket-member") || "null"); if (c && c.email === email) { cloud.member = true; cloud.role = c.role; cloud.teams = c.teams; } } catch (x) { /* rien */ }
  }
  try { localStorage.setItem("stats-basket-member", JSON.stringify(cloud.member ? { email, role: cloud.role, teams: cloud.teams } : null)); } catch (e) { /* rien */ }
}
function startSync() {
  cloud.unsubs.forEach(u => u());
  cloud.synced = {};
  cloud.unsubs = [listen("players"), listen("teams"), listen("matches"), listen("trash"), fs.doc("config/members").onSnapshot(s => {
    if (!s.exists) return;
    const was = cloud.role + cloud.teams.join();
    readMembers(s.data());
    if (!cloud.member) { stopSync(); render(); return; }
    if (was !== cloud.role + cloud.teams.join() || ui.view === "members") render();
  }, () => {})];
  if (isAdmin()) cloud.unsubs.push(listenRequests());
}
/* Demandes d'accès : un compte vérifié absent de la liste dépose une demande que seul l'admin voit */
async function sendAccessRequest() {
  if (!cloud.user || !cloud.user.emailVerified || cloud.member) return;
  const email = low(cloud.user.email);
  try { await fs.doc("requests/" + email).set({ email, at: Date.now() }); cloud.requested = true; } catch (e) { cloud.requested = false; }
}
function listenRequests() {
  return fs.collection("requests").onSnapshot(snap => {
    const refused = (cloud.refused || {});
    cloud.requests = snap.docs.map(d => d.data()).filter(r => r && r.email && !cloud.members[r.email]);
    /* une demande d'un compte déjà ajouté ou refusé est nettoyée */
    snap.docs.forEach(d => { const r = d.data(); if (r && (cloud.members[r.email] || refused[r.email])) fs.doc("requests/" + d.id).delete().catch(() => {}); });
    cloud.requests = cloud.requests.filter(r => !refused[r.email]).sort((a, b) => b.at - a.at);
    if (cloud.requests.length && !cloud.reqToastShown) { cloud.reqToastShown = true; toast(t("{n} demande(s) d'accès en attente", { n: cloud.requests.length })); }
    render();
  }, () => {});
}
function stopSync() { cloud.unsubs.forEach(u => u()); cloud.unsubs = []; }
function initCloud() {
  if (!CLOUD) return;
  firebase.initializeApp(FB_CONFIG);
  fs = firebase.firestore();
  fs.enablePersistence({ synchronizeTabs: true }).catch(() => { /* hors ligne limité sur ce navigateur */ });
  fbAuth = firebase.auth();
  fbAuth.languageCode = S.lang;
  fbAuth.onAuthStateChanged(async u => {
    cloud.user = u; stopSync();
    if (u && !u.emailVerified && navigator.onLine !== false) { try { await u.reload(); u = fbAuth.currentUser; cloud.user = u; } catch (e) { /* hors ligne */ } }
    if (u && u.emailVerified) { await freshToken(); await checkMember(); if (cloud.member) startSync(); else await sendAccessRequest(); }
    else cloud.member = false;
    cloud.ready = true;
    if (!team()) pickDefaultTeam();
    render();
  });
}

/* ---------- Comptes ---------- */
const AUTH_ERRORS = {
  "auth/invalid-email": "Adresse e-mail invalide.",
  "auth/missing-password": "Indique un mot de passe.",
  "auth/weak-password": "Mot de passe trop court (6 caractères minimum).",
  "auth/email-already-in-use": "Un compte existe déjà avec cet e-mail : connecte-toi.",
  "auth/invalid-credential": "E-mail ou mot de passe incorrect.",
  "auth/wrong-password": "E-mail ou mot de passe incorrect.",
  "auth/user-not-found": "E-mail ou mot de passe incorrect.",
  "auth/too-many-requests": "Trop d'essais. Réessaie dans quelques minutes.",
  "auth/network-request-failed": "Pas de réseau. La première connexion demande du réseau.",
};
const authMsg = e => (AUTH_ERRORS[e && e.code] ? t(AUTH_ERRORS[e.code]) : t("Erreur : {m}", { m: (e && e.message) || "?" }));
async function doAuth(kind) {
  const email = val("aemail").trim(), pass = val("apass");
  try {
    if (kind === "reset") { await fbAuth.sendPasswordResetEmail(email); toast(t("E-mail de réinitialisation envoyé")); return; }
    if (kind === "signup") { const c = await fbAuth.createUserWithEmailAndPassword(email, pass); await c.user.sendEmailVerification(); }
    else await fbAuth.signInWithEmailAndPassword(email, pass);
  } catch (e) { toast(authMsg(e)); }
}
async function checkVerified() {
  try {
    await cloud.user.reload();
    if (!fbAuth.currentUser.emailVerified) { toast(t("E-mail pas encore vérifié")); return; }
    await fbAuth.currentUser.getIdToken(true);
    cloud.user = fbAuth.currentUser;
    await checkMember();
    if (cloud.member) startSync(); else await sendAccessRequest();
    render();
  } catch (e) { toast(authMsg(e)); }
}
async function writeMembers(mut) {
  const ref = fs.doc("config/members");
  const d = { admin: cloud.adminEmail, members: JSON.parse(JSON.stringify(cloud.members)), refused: JSON.parse(JSON.stringify(cloud.refused || {})) };
  mut(d.members, d.refused);
  Object.keys(d.members).forEach(e => { delete d.refused[e]; });
  try { await ref.set(d); readMembers(d); render(); return true; } catch (e) { syncError(e); return false; }
}
function localOnlyData() {
  try { const raw = localStorage.getItem(LOCAL_KEY); return raw ? migrate(JSON.parse(raw)) : null; } catch (e) { return null; }
}
