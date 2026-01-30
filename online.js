// online.js (v78) – Firebase online (hybrid) via window.__FIREBASE (init sker i index.html)
//
// Viktigt:
// - initiera INTE Firebase här (så vi undviker dubbel-init och "initializeApp is not defined").
// - ta över knapparna i hubben och stoppa stub-listeners.

window.__FIREBASE_ONLINE_ACTIVE = true;

const $ = (id) => document.getElementById(id);

function setStatus(msg){
  const el = $("hubActionStatus");
  if(el) el.textContent = msg || "";
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

function ensureFirebaseReady(){
  const fb = window.__FIREBASE;
  if(!fb || !fb.enabled || !fb.auth || !fb.db){
    setStatus("Online: Firebase ej redo (laddar…)");
    return null;
  }
  return fb;
}

async function ensureSignedIn(fb){
  const { auth, signInAnonymously } = fb;
  if(auth.currentUser) return auth.currentUser;
  await signInAnonymously(auth);
  return auth.currentUser;
}

function renderRow(t, label){
  const name = escapeHtml(t.name || "Online-turnering");
  const code = escapeHtml(t.code || "");
  const id = escapeHtml(t.id || "");
  return `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 10px;border:1px solid rgba(17,24,39,.10);border-radius:14px;background:#fff;margin:8px 0;">
      <div style="min-width:0">
        <div style="font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">🌍 ${name}</div>
        <div class="small muted">Kod: <span style="font-weight:800">${code}</span> • ${label}</div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">
        <button class="btn secondary" type="button" data-copy="${code}">Kopiera kod</button>
        <button class="btn" type="button" data-open="${id}">Öppna</button>
      </div>
    </div>
  `;
}

function bindRowActions(container){
  if(!container) return;
  container.addEventListener("click", async (e)=>{
    const btnCopy = e.target?.closest?.("button[data-copy]");
    const btnOpen = e.target?.closest?.("button[data-open]");
    if(btnCopy){
      const code = btnCopy.getAttribute("data-copy") || "";
      const ok = await copyToClipboard(code);
      setStatus(ok ? "Kopierat ✅" : "Kunde inte kopiera (tillåt urklipp).");
    }
    if(btnOpen){
      const id = btnOpen.getAttribute("data-open");
      if(!id) return;
      // Hybrid: om det finns en funktion i din befintliga app, använd den. Annars visa info.
      if(typeof window.openOnlineTournament === "function"){
        try{ window.openOnlineTournament(id); }catch(err){ showErr("Kunde inte öppna online-turnering.", err); }
      }else{
        alert("Öppna online-turnering (viewer) kommer i nästa steg.\n\nID: " + id);
      }
    }
  });
}

let unsubOwned = null;
let unsubMember = null;

function stopListeners(){
  try{ if(unsubOwned) { unsubOwned(); unsubOwned=null; } }catch(e){}
  try{ if(unsubMember){ unsubMember();unsubMember=null; } }catch(e){}
}

function startLists(){
  const fb = ensureFirebaseReady();
  if(!fb) return;

  const { auth, db, collection, query, where, orderBy, onSnapshot } = fb;

  const ownedEl = $("hubOnlineOwned");
  const joinedEl = $("hubOnlineJoined");
  const ownedCountEl = $("hubOwnedCount");
  const joinedCountEl = $("hubJoinedCount");
  const ownedDetails = $("hubOwnedDetails");
  const joinedDetails = $("hubJoinedDetails");

  bindRowActions(ownedEl);
  bindRowActions(joinedEl);

  stopListeners();

  const user = auth.currentUser;
  if(!user){
    if(ownedEl) ownedEl.innerHTML = "<em>Logga in för att se dina online-turneringar.</em>";
    if(joinedEl) joinedEl.innerHTML = "<em>Logga in för att se dina online-turneringar.</em>";
    if(ownedCountEl) ownedCountEl.textContent = "0";
    if(joinedCountEl) joinedCountEl.textContent = "0";
    try{ if(ownedDetails) ownedDetails.open = false; }catch(e){}
    try{ if(joinedDetails) joinedDetails.open = false; }catch(e){}
    return;
  }

  const ownedQ = query(
    collection(db, "tournaments"),
    where("ownerUid", "==", user.uid),
    orderBy("createdAt", "desc")
  );

  unsubOwned = onSnapshot(ownedQ, (snap)=>{
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if(ownedEl) ownedEl.innerHTML = docs.length ? docs.map(t=>renderRow(t,"Ägare")).join("") : "<em>Inga online-turneringar ännu.</em>";
    if(ownedCountEl) ownedCountEl.textContent = String(docs.length);
    try{ if(ownedDetails) ownedDetails.open = docs.length > 0; }catch(e){}
  }, (err)=> showErr("Kunde inte läsa 'ägda' online-turneringar.", err));

  const joinedQ = query(
    collection(db, "tournaments"),
    where("memberUids", "array-contains", user.uid),
    orderBy("createdAt", "desc")
  );

  unsubMember = onSnapshot(joinedQ, (snap)=>{
    const docsAll = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const docs = docsAll.filter(t => (t.ownerUid||"") !== user.uid);
    if(joinedEl) joinedEl.innerHTML = docs.length ? docs.map(t=>renderRow(t,"Deltar")).join("") : "<em>Inga anslutna online-turneringar ännu.</em>";
    if(joinedCountEl) joinedCountEl.textContent = String(docs.length);
    try{ if(joinedDetails) joinedDetails.open = docs.length > 0; }catch(e){}
  }, (err)=> showErr("Kunde inte läsa 'anslutna' online-turneringar.", err));
}

async function createTournament(){
  const fb = ensureFirebaseReady();
  if(!fb) return;

  try{
    setStatus("Skapar online-turnering…");
    const user = await ensureSignedIn(fb);
    if(!user){
      setStatus("Kunde inte logga in.");
      return;
    }

    const name = (prompt("Namn på online-turneringen") || "").trim();
    if(!name){ setStatus(""); return; }

    const { db, collection, addDoc, serverTimestamp } = fb;

    const code = genCode6();
    const ref = await addDoc(collection(db, "tournaments"), {
      name,
      code,
      ownerUid: user.uid,
      memberUids: [user.uid],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    setStatus("Skapad ✅");
    const ok = await copyToClipboard(code);
    alert("Online-turnering skapad!\n\nKod: " + code + (ok ? " (kopierad ✅)" : "") + "\n\nID: " + ref.id);
  }catch(e){
    showErr("Kunde inte skapa online-turnering.", e);
    setStatus("Fel vid skapande.");
  }
}

function openJoinOverlay(){
  // Vi återanvänder befintlig overlay + joinOnlineByCode() om den finns.
  if(typeof window.openJoinOnlineOverlay === "function"){
    window.openJoinOnlineOverlay();
  }else{
    alert("Join-overlay saknas i HTML.");
  }
}

function wireHubButtons(){
  const btnCreate = $("btnCreateOnline");
  const btnJoin = $("btnJoinOnline");

  // Ta över före stubben (capture + stopImmediatePropagation)
  if(btnCreate){
    btnCreate.addEventListener("click", (e)=>{
      e.preventDefault();
      e.stopImmediatePropagation();
      createTournament();
    }, true);
  }
  if(btnJoin){
    btnJoin.addEventListener("click", (e)=>{
      e.preventDefault();
      e.stopImmediatePropagation();
      openJoinOverlay();
    }, true);
  }
}

function boot(){
  const fb = ensureFirebaseReady();
  if(!fb) return;

  wireHubButtons();

  // Starta listor när auth ändras
  try{
    fb.onAuthStateChanged(fb.auth, ()=>{
      try{ startLists(); }catch(e){}
    });
  }catch(e){}

  // Direktförsök (om user redan finns)
  try{ startLists(); }catch(e){}
  setStatus("Online redo.");
}

if(document.readyState === "loading"){
  document.addEventListener("DOMContentLoaded", boot);
}else{
  boot();
}
