export function createAudio() {
  let AC = null, sonActif = true;

  function initAudio() {
    if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { AC = null; } }
    if (AC && AC.state === 'suspended') AC.resume();
  }
  function bip(freq, dur, type = 'sine', vol = .15, vers = null, delai = 0) {
    if (!AC) return;
    const t0 = AC.currentTime + delai;
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (vers) o.frequency.exponentialRampToValueAtTime(vers, t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
    o.connect(g).connect(AC.destination);
    o.start(t0); o.stop(t0 + dur + .02);
  }
  function bruit(dur, vol, fHaut) {
    if (!AC) return;
    const n = Math.floor(AC.sampleRate * dur);
    const buf = AC.createBuffer(1, n, AC.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const s = AC.createBufferSource(); s.buffer = buf;
    const f = AC.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = fHaut;
    const g = AC.createGain(); const t0 = AC.currentTime;
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
    s.connect(f).connect(g).connect(AC.destination); s.start(t0);
  }
  function applaudissements() {
    if (!AC || !sonActif) return;
    const debut = AC.currentTime;
    for (let i = 0; i < 32; i++) {
      const duree = .035 + Math.random() * .055;
      const taille = Math.floor(AC.sampleRate * duree);
      const buffer = AC.createBuffer(1, taille, AC.sampleRate);
      const donnees = buffer.getChannelData(0);
      for (let j = 0; j < taille; j++) {
        const enveloppe = Math.sin(Math.PI * j / taille) ** 1.5;
        donnees[j] = (Math.random() * 2 - 1) * enveloppe;
      }

      const source = AC.createBufferSource();
      source.buffer = buffer;
      const filtre = AC.createBiquadFilter();
      filtre.type = 'bandpass';
      filtre.frequency.value = 900 + Math.random() * 1600;
      filtre.Q.value = .8 + Math.random() * 1.2;
      const gain = AC.createGain();
      gain.gain.value = .025 + Math.random() * .045;
      source.connect(filtre).connect(gain).connect(AC.destination);
      source.start(debut + Math.random() * .92);
    }
  }
  function son(nom) {
    if (!AC || !sonActif) return;
    switch (nom) {
      case 'lancer': bip(300, .3, 'sine', .1, 800); break;
      case 'dribble': bip(150, .09, 'sine', .16, 70); break;
      case 'rim':    bip(1250, .35, 'sine', .16); bip(1870, .22, 'sine', .07); break;
      case 'board':  bip(190, .22, 'triangle', .3, 80); bruit(.08, .12, 1500); break;
      case 'filet':  bruit(.4, .2, 3500); break;
      case 'applaudissements': applaudissements(); break;
      case 'gagne':  [523, 659, 784, 1047].forEach((f, i) => bip(f, .35, 'triangle', .16, null, i * .12)); break;
      case 'neutre': bip(392, .3, 'triangle', .12); bip(330, .4, 'triangle', .12, null, .15); break;
      case 'rate':   bip(240, .4, 'sawtooth', .07, 130); break;
    }
  }

  function toggle() { sonActif = !sonActif; }
  return { initAudio, son, toggle };
}
