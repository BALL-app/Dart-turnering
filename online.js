// online.js – Online-turneringar (felsök-v1: utan orderBy + tydliga felkoder i alert)
// Byggd för mobilfelsökning utan DevTools.
// Kräver dessa ID:n i index.html:
// btnHubLogin, btnHubLogout, hubAccountStatus
// btnCreateOnline, btnJoinOnline
// hubOnlineOwned, hubOnlineJoined, hubOwnedCount, hubJoinedCount
// hubOwnedDetails, hubJoinedDetails

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
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
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

function renderSimpleList(containerId, countId, detailsId, items, emptyText) {
  const el = $(containerId);
  const countEl = $(countId);
  const detailsEl = $(detailsId);

  if (countEl) countEl.textContent = String(items.length);

  if (!el) return;

  if (!items.length) {
    el.innerHTML = `<em>${emptyText}</em>`;
    return;
  }

  el.innerHTML = items.map((t) => {
    const name = (t.name || "Online-turnering");
    const code = (t.code || "");
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px;border:1px solid rgba(17,24,39,.10);border-radius:14px;background:#fff;margin:8px 0;">
        <div style="min-width:0">
          <div style="font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">🌍 ${name}</div>
          <div class="small muted">Kod: <span style="font-weight:800">${code}</span></div>
        </div>
        <button class="btn secondary" type="button" data-open-id="${t.id}">Öppna</button>
      </div>
    `;
  }).join("");

  if (detailsEl) detailsEl.open = true;

  el.querySelectorAll("[data-open-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      alert("Online-turnering öppnas i nästa steg.\n\nJust nu testar vi skapa/join/listor.");
    });
  });
}

// Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let unsubOwned = null;
let unsubMember = null;

function stopRealtime() {
  if (unsubOwned) { unsubOwned(); unsubOwned = null; }
  if (unsubMember) { unsubMember(); unsubMember = null; }
}

function startRealtime(uid) {
  stopRealtime();
  const tRef = collection(db, "tournaments");

  // OBS: ingen orderBy => ingen index-krångel
  unsubOwned = onSnapshot(
    query(tRef, where("ownerUid", "==", uid)),
    (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderSimpleList("hubOnlineOwned", "hubOwnedCount", "hubOwnedDetails", items, "Inga online-turneringar ännu.");
    },
    (e) => showErr("[owned onSnapshot]", e)
  );

  unsubMember = onSnapshot(
    query(tRef, where("memberUids", "array-contains", uid)),
    (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderSimpleList("hubOnlineJoined", "hubJoinedCount", "hubJoinedDetails", items, "Inga anslutna online-turneringar ännu.");
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
  try {
    await ensureLoggedIn();
  } catch (e) {
    showErr("[login]", e);
  }
}

async function handleLogout() {
  try {
    await signOut(auth);
  } catch (e) {
    showErr("[logout]", e);
  }
}

async function handleCreateTournament() {
  try {
    const user = await ensureLoggedIn();
    const name = (prompt("Namn på online-turnering:", "Online-turnering") || "").trim() || "Online-turnering";

    // Generera unik kod (försök några gånger)
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

    if (snap.empty) {
      alert("Hittade ingen turnering med den koden.");
      return;
    }

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
  renderSimpleList("hubOnlineOwned", "hubOwnedCount", "hubOwnedDetails", [], "Inga online-turneringar ännu.");
  renderSimpleList("hubOnlineJoined", "hubJoinedCount", "hubJoinedDetails", [], "Inga anslutna online-turneringar ännu.");

  onAuthStateChanged(auth, (user) => {
    currentUser = user || null;
    setAccountUI(currentUser);
    if (currentUser) startRealtime(currentUser.uid);
    else stopRealtime();
  });

  // Auto-login så realtime/listor startar direkt
  ensureLoggedIn().catch(() => {});
});

window.__online = {
  get user() { return currentUser; },
  get db() { return db; }
};
