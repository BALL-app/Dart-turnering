// online.js (v70) – Firebase online + HYBRID öppna som lokal turnering i befintligt bibliotek
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInAnonymously, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  arrayUnion,
  serverTimestamp,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// Markera för index.html att firebase-online är aktivt (så gamla stubbar inte skriver över UI)
window.__FIREBASE_ONLINE_ACTIVE = true;

const firebaseConfig = {
  apiKey: "AIzaSyAE4zslKdFbgsjXVnWPzcc67OIbE8v1-X0",
  authDomain: "dart-turnering.firebaseapp.com",
  projectId: "dart-turnering",
  storageBucket: "dart-turnering.firebasestorage.app",
  messagingSenderId: "63007726766",
  appId: "1:63007726766:web:e1ba313924b72b1dd0613f"
};

const $ = (id) => document.getElementById(id);

function genCode6() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

async function copyToClipboard(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

function showErr(prefix, e) {
  const code = e?.code || "unknown";
  const msg = e?.message || String(e);
  console.error(prefix, e);
  alert(`${prefix}\n\n${code}\n${msg}`);
}

function setAccountUI(user) {
  const statusEl = $("hubAccountStatus");
  const btnLogin = $("btnHubLogin");
  const btnLogout = $("btnHubLogout");

  if (statusEl) statusEl.textContent = user ? `Inloggad (UID: ${user.uid.slice(0, 6)}…)` : "Inte inloggad.";
  if (btnLogin) btnLogin.style.display = user ? "none" : "inline-flex";
  if (btnLogout) btnLogout.style.display = user ? "inline-flex" : "none";
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (s) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[s]));
}

function renderList(containerId, countId, detailsId, items, emptyText) {
  const el = $(containerId);
  const countEl = $(countId);
  const detailsEl = $(detailsId);

  if (countEl) countEl.textContent = String(items.length);
  if (!el) return;

  if (!items.length) {
    el.innerHTML = `<em>${emptyText}</em>`;
    try { if (detailsEl) detailsEl.open = false; } catch {}
    return;
  }

  el.innerHTML = items.map((t) => {
    const name = escapeHtml(t.name || "Online-turnering");
    const code = escapeHtml(t.code || "");
    const ownerUid = escapeHtml(t.ownerUid || "");
    const id = escapeHtml(t.id || "");
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px;border:1px solid rgba(17,24,39,.10);border-radius:14px;background:#fff;margin:8px 0;">
        <div style="min-width:0">
          <div style="font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">🌍 ${name}</div>
          <div class="small muted">Kod: <span style="font-weight:800">${code}</span></div>
        </div>
        <button class="btn secondary" type="button"
          data-open-id="${id}"
          data-open-name="${name}"
          data-open-code="${code}"
          data-open-owner="${ownerUid}">Öppna</button>
      </div>
    `;
  }).join("");

  try { if (detailsEl) detailsEl.open = true; } catch {}
}

// ===== Hybrid: skapa/öppna lokal turnering i befintligt bibliotek =====
function loadJson(key){ try{ const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; }catch{ return null; } }
function saveJson(key,obj){ try{ localStorage.setItem(key, JSON.stringify(obj)); }catch{} }

window.__onlineOpen = function({ docId, name, code, ownerUid }) {
  try {
    if (!docId) { alert("Saknar docId."); return; }

    const id = "on_" + String(docId);
    const LIB_PREFIX = window.__LIB_PREFIX || "dart_tournament_v98_";
    const key = LIB_PREFIX + id;

    // om den redan finns i biblioteket: öppna som vanligt
    const existing = loadJson(key);
    if (existing && existing.state && typeof window.__hubOpen === "function") {
      window.__hubOpen(id);
      return;
    }

    // skapa ny wrapper
    const make = (typeof window.__makeBlankTournamentState === "function")
      ? window.__makeBlankTournamentState
      : ((n, i) => ({ tournamentId: i, tournamentName: n, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), step:1, players:[], matches:[], rules:{game:"301",inRule:"single",outRule:"single",legsMode:"single"} }));

    const st = make(name || "Online-turnering", id);
    st._online = { docId: String(docId), code: String(code || ""), ownerUid: String(ownerUid || "") };

    const wrap = {
      id: id,
      name: st.tournamentName || (name || "Online-turnering"),
      createdAt: st.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      state: st
    };

    saveJson(key, wrap);

    if (typeof window.__hubOpen === "function") {
      window.__hubOpen(id);
    } else {
      // fallback
      window.state = st;
      try { window.hideAll && window.hideAll(); } catch {}
      try { window.renderAll && window.renderAll(); } catch {}
      alert("Turnering skapad lokalt men kunde inte öppnas automatiskt (saknar __hubOpen).");
    }
  } catch (e) {
    alert("Kunde inte öppna: " + (e?.message || e));
  }
};

// Event delegation: funkar även om listorna renderas om
document.addEventListener("click", (e) => {
  const btn = e.target?.closest?.("button[data-open-id]");
  if (!btn) return;
  e.preventDefault();
  e.stopPropagation();
  window.__onlineOpen({
    docId: btn.getAttribute("data-open-id"),
    name: btn.getAttribute("data-open-name") || "Online-turnering",
    code: btn.getAttribute("data-open-code") || "",
    ownerUid: btn.getAttribute("data-open-owner") || ""
  });
}, true);

// ===== Firebase init =====
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let unsubOwned = null;
let unsubMember = null;

function stopRealtime() {
  if (unsubOwned) { unsubOwned(); unsubOwned = null; }
  if (unsubMember) { unsubMember(); unsubMember = null; }
}

function startRealtime(uid) {
  stopRealtime();
  const tRef = collection(db, "tournaments");

  unsubOwned = onSnapshot(
    query(tRef, where("ownerUid", "==", uid)),
    (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderList("hubOnlineOwned", "hubOwnedCount", "hubOwnedDetails", items, "Inga online-turneringar ännu.");
    },
    (e) => showErr("[owned onSnapshot]", e)
  );

  unsubMember = onSnapshot(
    query(tRef, where("memberUids", "array-contains", uid)),
    (snap) => {
      // filtrera bort ägda turneringar här om du vill: just nu visar vi allt där du är medlem
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderList("hubOnlineJoined", "hubJoinedCount", "hubJoinedDetails", items, "Inga anslutna online-turneringar ännu.");
    },
    (e) => showErr("[member onSnapshot]", e)
  );
}

async function ensureLoggedIn() {
  if (auth.currentUser) return auth.currentUser;
  const res = await signInAnonymously(auth);
  return res.user;
}

async function handleLogin() {
  try { await ensureLoggedIn(); } catch (e) { showErr("[login]", e); }
}
async function handleLogout() {
  try { await signOut(auth); } catch (e) { showErr("[logout]", e); }
}

async function handleCreateTournament() {
  try {
    const user = await ensureLoggedIn();
    const name = (prompt("Namn på online-turnering:", "Online-turnering") || "").trim() || "Online-turnering";

    let code = "";
    for (let i = 0; i < 5; i++) {
      code = genCode6();
      const q = query(collection(db, "tournaments"), where("code", "==", code));
      const snap = await getDocs(q);
      if (snap.empty) break;
    }

    const ref = await addDoc(collection(db, "tournaments"), {
      name,
      code,
      ownerUid: user.uid,
      memberUids: [user.uid],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    const copied = await copyToClipboard(code);
    alert(`Turnering skapad!\n\nKod: ${code}${copied ? " (kopierad)" : ""}\nDocId: ${ref.id}`);
  } catch (e) {
    showErr("[create tournament]", e);
  }
}

async function handleJoinByCode() {
  try {
    const user = await ensureLoggedIn();
    const codeIn = prompt("Skriv in turneringskoden (6 tecken):", "") || "";
    const code = codeIn.trim().toUpperCase();
    if (!code) return;

    const q = query(collection(db, "tournaments"), where("code", "==", code));
    const snap = await getDocs(q);
    if (snap.empty) { alert("Hittade ingen turnering med den koden."); return; }

    const docSnap = snap.docs[0];
    await updateDoc(doc(db, "tournaments", docSnap.id), {
      memberUids: arrayUnion(user.uid),
      updatedAt: serverTimestamp()
    });

    alert("Ansluten!");
  } catch (e) {
    showErr("[join]", e);
  }
}

function wireButtons() {
  $("btnHubLogin")?.addEventListener("click", handleLogin);
  $("btnHubLogout")?.addEventListener("click", handleLogout);
  $("btnCreateOnline")?.addEventListener("click", handleCreateTournament);
  $("btnJoinOnline")?.addEventListener("click", handleJoinByCode);
}

document.addEventListener("DOMContentLoaded", () => {
  wireButtons();
  onAuthStateChanged(auth, (user) => {
    setAccountUI(user || null);
    if (user) startRealtime(user.uid);
    else stopRealtime();
  });

  // Auto-login för realtime direkt
  ensureLoggedIn().catch(() => {});
});
