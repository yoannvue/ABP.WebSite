export function installerEntrees({ buzzer, annuler, reinitialiser, initAudio, toggleSound }) {
  function basculerPleinEcran() {
    if (document.fullscreenElement) { document.exitFullscreen(); return; }
    const r = document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
    // en plein écran, on garde Échap pour annuler : pour quitter le plein écran il faut alors la maintenir enfoncée
    if (r && r.then) r.then(() => { if (navigator.keyboard && navigator.keyboard.lock) navigator.keyboard.lock(['Escape']).catch(() => {}); }).catch(() => {});
  }
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && navigator.keyboard && navigator.keyboard.unlock) navigator.keyboard.unlock();
  });
  window.addEventListener('keydown', e => {
    if (e.code === 'Enter' || e.code === 'NumpadEnter') { e.preventDefault(); if (!e.repeat) buzzer(); return; }
    if (e.code === 'Escape') { e.preventDefault(); if (!e.repeat) annuler(); return; }
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    const k = e.key.toLowerCase();
    if (k === 's') toggleSound();
    else if (k === 'r') reinitialiser();
    else if (k === 'f') basculerPleinEcran();
  });
  /* Toucher l'écran (téléphone, tablette, écran tactile) ou cliquer = même effet que ENTRÉE */
  window.addEventListener('pointerdown', e => { e.preventDefault(); buzzer(); }, { passive: false });
}
