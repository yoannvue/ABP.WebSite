export function createTicketPool() {
  const LOTS = ['Maillot du club', 'Ballon dédicacé', 'Place pour un match', 'Sweat du club', 'Bon d’achat 20 €', 'Panier garni'];
  const pool = { restants: [], gagnants: new Map() };

  function initPool() {
    pool.restants = Array.from({ length: 200 }, (_, i) => i + 1);
    pool.gagnants = new Map();
    const m = [...pool.restants];
    for (let i = m.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [m[i], m[j]] = [m[j], m[i]]; }
    m.slice(0, 24).forEach((n, i) => pool.gagnants.set(n, LOTS[i % LOTS.length]));
  }
  async function piocherTicket() {
    if (!pool.restants.length) return null;
    const i = Math.floor(Math.random() * pool.restants.length);
    const numero = pool.restants.splice(i, 1)[0];
    const lot = pool.gagnants.get(numero) || null;
    return { numero, gagnant: !!lot, lot };
  }

  return {
    get restants() { return pool.restants; },
    init: initPool,
    draw: piocherTicket
  };
}
