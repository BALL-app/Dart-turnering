// online.js (v78) – robust online-knappar
// - Event delegation: funkar även om UI renderas om
// - Kör Firebase-flöde om det finns, annars fallback till stub
// - Visar tydliga fel om varken Firebase eller stub finns

function _safeAlert(msg){
  try { alert(msg); } catch(e){ console.log(msg); }
}

function _call(fn, fallbackMsg){
  try{
    if(typeof fn === "function") return fn();
    _safeAlert(fallbackMsg);
  }catch(e){
    console.error(e);
    _safeAlert("Ett fel inträffade. Se konsolen för detaljer.");
  }
}

function _explainFirebaseError(err){
  const code = err && (err.code || err.name) ? String(err.code || err.name) : "";
  const msg = err && (err.message || err.toString) ? String(err.message || err) : "Okänt fel";
  // Vanliga Firebase-permissions
  if(code.includes("permission") || msg.toLowerCase().includes("permission") || msg.toLowerCase().includes("insufficient permissions")){
    return "Firebase blockerade åtgärden (rules/behörighet).\n\n" + msg;
  }
  return "Firebase-fel:\n\n" + msg;
}

async function _createOnlineFlow(){
  // Loggar som bevis
  console.log("[online] __FIREBASE =", window.__FIREBASE);
  console.log("[online] createOnlineTournamentStub typeof =", typeof window.createOnlineTournamentStub);

  // 1) Firebase-vägen om aktiv + funktion finns
  if(window.__FIREBASE?.enabled && typeof window.__FIREBASE.createTournament === "function"){
    try{
      return await window.__FIREBASE.createTournament();
    }catch(err){
      console.error(err);
      _safeAlert(_explainFirebaseError(err));
      // Fallback efter Firebase-fel (så det inte känns "dött")
      if(typeof window.createOnlineTournamentStub === "function"){
        return _call(window.createOnlineTournamentStub, "Stubben kunde inte köras efter Firebase-fel.");
      }
      return;
    }
  }

  // 2) Fallback stub
  if(typeof window.createOnlineTournamentStub === "function"){
    return _call(window.createOnlineTournamentStub, "Stubben kunde inte köras.");
  }

  // 3) Sista skyddsnät
  _safeAlert("Varken Firebase eller stubben är initierad.\n\nDet tyder oftast på att ett JS-fel i index.html stoppade init innan export-raderna kördes.");
}

function _joinOnlineFlow(){
  if(typeof window.openJoinOnlineOverlay === "function"){
    return _call(window.openJoinOnlineOverlay, "openJoinOnlineOverlay() kunde inte köras.");
  }
  _safeAlert("Join-overlay saknas (openJoinOnlineOverlay finns inte).");
}

// Event delegation: fångar alltid klick oavsett om knappen byts ut
document.addEventListener("click", (e) => {
  const createBtn = e.target?.closest?.("#btnCreateOnline");
  if(createBtn){
    _createOnlineFlow();
    return;
  }
  const joinBtn = e.target?.closest?.("#btnJoinOnline");
  if(joinBtn){
    _joinOnlineFlow();
    return;
  }
}, true);

console.log("[online.js v78] loaded", { href: location.href, module: true });
