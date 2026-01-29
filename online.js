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
        <button class="btn secondary" type="button" data-open-id="${t.id}" data-open-name="${name}" data-open-code="${code}" data-open-owner="${t.ownerUid || ""}">Öppna</button>
      </div>
    `;
  }).join("");

  if (detailsEl) detailsEl.open = true;

  el.querySelectorAll("[data-open-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const docId = btn.getAttribute("data-open-id");
      const name = btn.getAttribute("data-open-name") || "Online-turnering";
      const code = btn.getAttribute("data-open-code") || "";
      const ownerUid = btn.getAttribute("data-open-owner") || "";
      if (typeof window.__onlineOpen === "function") {
        window.__onlineOpen({ docId, name, code, ownerUid });
      } else {
        alert("Saknar __onlineOpen. Ladda om sidan.");
      }
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


// ===== HYBRID: Öppna online-turnering som lokal/offline-kopia =====
// Skapar en "mirror" i localStorage och laddar den i appens befintliga state/render-flöde.
(function(){
  const ONLINE_LOCAL_PREFIX = "dart_online_mirror_v1_";

  function nowIso(){ return new Date().toISOString(); }
  function loadJson(key){ try{ return JSON.parse(localStorage.getItem(key) || "null"); }catch(e){ return null; } }
  function saveJson(key,obj){ try{ localStorage.setItem(key, JSON.stringify(obj)); }catch(e){} }

  // Minimal mall. Om din app exponerar en bättre mall globalt, används den.
  function getInitialTemplate(){
    try{
      if (window.INITIAL_STATE) return JSON.parse(JSON.stringify(window.INITIAL_STATE));
      if (window.defaultState) return JSON.parse(JSON.stringify(window.defaultState));
    } catch(e){}
    return {
      tournamentId: "",
      tournamentName: "",
      createdAt: null,
      updatedAt: null,
      step: 1,
      players: [],
      matches: [],
      groups: { A: [], B: [] },
      playoffs: { started:false, matches: [] },
      rules: { game:"301", inRule:"single", outRule:"single", legsMode:"single" },
      meta: { isSeriesEvent:false, seriesName:"", bonusProfile:"pulsi" }
    };
  }

  function tryCall(fnName){
    try{
      const fn = window[fnName];
      if (typeof fn === "function") fn();
    }catch(e){}
  }

  // payload: {docId, name, code, ownerUid}
  window.__onlineOpen = function(payload){
    try{
      const docId = payload?.docId;
      if(!docId){ alert("Saknar docId."); return; }

      const key = ONLINE_LOCAL_PREFIX + String(docId);
      let mirror = loadJson(key);

      if(!mirror || !mirror.state){
        const st = getInitialTemplate();
        st.tournamentId = "on_" + String(docId);
        st.tournamentName = payload?.name || "Online-turnering";
        st.createdAt = st.createdAt || nowIso();
        st.updatedAt = nowIso();

        st._online = {
          docId: String(docId),
          code: String(payload?.code || ""),
          ownerUid: String(payload?.ownerUid || "")
        };

        mirror = {
          id: st.tournamentId,
          name: st.tournamentName,
          createdAt: st.createdAt,
          updatedAt: st.updatedAt,
          state: st
        };

        saveJson(key, mirror);
      }

      // Ladda in i appen
      window.state = mirror.state;

      // Försök använda appens befintliga flöde om funktionerna finns
      tryCall("autosaveTournament");
      tryCall("saveState");
      tryCall("hideAll");
      tryCall("renderAll");

      // Om renderAll inte finns, visa info istället (så du ser att det gick)
      if (typeof window.renderAll !== "function") {
        alert("Online-turnering laddad lokalt (hybrid).\\n\\nNu behöver vi koppla den till din befintliga 'Öppna turnering'-vy i index.js.");
      }
    }catch(e){
      alert("Kunde inte öppna online-turnering: " + (e?.message || e));
    }
  };
})();


window.__online = {
  get user() { return currentUser; },
  get db() { return db; }
};
