// online.js (robust)
// - Funkar även om knappar renderas om (event delegation)
// - Kör Firebase om det finns, annars fallback till stub
// - Inga antaganden om att knappar finns vid DOMContentLoaded

function safeAlert(msg) {
  try { alert(msg); } catch (e) { console.log(msg); }
}

function callIfFn(fn, fallbackMsg) {
  try {
    if (typeof fn === "function") return fn();
    safeAlert(fallbackMsg);
  } catch (e) {
    console.error(e);
    safeAlert("Ett fel inträffade. Se konsolen för detaljer.");
  }
}

function createOnlineFlow() {
  // 1) Firebase-path om den finns och är komplett
  if (window.__FIREBASE?.enabled) {
    if (typeof window.__FIREBASE.createTournament === "function") {
      return callIfFn(() => window.__FIREBASE.createTournament(),
        "Firebase är aktivt men createTournament() saknas.");
    }
    // Firebase enabled men saknar create -> fall back
    // (detta är viktig: annars “händer ingenting”)
  }

  // 2) Fallback till stub i index.html (som ni redan exponerar globalt)
  if (typeof window.createOnlineTournamentStub === "function") {
    return callIfFn(window.createOnlineTournamentStub,
      "Stub för createOnlineTournamentStub() kunde inte köras.");
  }

  // 3) Sista skyddsnät
  safeAlert("Online-funktionen är inte korrekt initierad (varken Firebase eller stub finns).");
}

function joinOnlineFlow() {
  if (typeof window.openJoinOnlineOverlay === "function") {
    return callIfFn(window.openJoinOnlineOverlay,
      "openJoinOnlineOverlay() kunde inte köras.");
  }
  safeAlert("Join-overlay saknas (openJoinOnlineOverlay finns inte).");
}

// Event delegation: överlever DOM-omrenderingar
document.addEventListener("click", (e) => {
  const createBtn = e.target?.closest?.("#btnCreateOnline");
  if (createBtn) {
    // Valfritt: förhindra dubbelhantering om ni också har onclick
    // e.preventDefault();
    // e.stopPropagation();
    createOnlineFlow();
    return;
  }

  const joinBtn = e.target?.closest?.("#btnJoinOnline");
  if (joinBtn) {
    // e.preventDefault();
    // e.stopPropagation();
    joinOnlineFlow();
    return;
  }
}, true); // capture=true gör att vi fångar även om andra handlers bråkar

console.log("[online.js] loaded", { href: location.href, module: true });
