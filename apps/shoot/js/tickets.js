const API_URL = 'http://localhost:5000';

export function createTicketPool() {
  let restants = null;

  async function request(path, options) {
    const response = await fetch(`${API_URL}${path}`, options);
    const body = await response.json();
    if (!response.ok) {
      throw new Error(body.detail || body.title || `Erreur HTTP ${response.status}`);
    }
    return body;
  }

  return {
    get restants() { return restants; },
    async refresh() {
      const statistiques = await request('/statistiques');
      restants = statistiques.ticketsRestants;
      return restants;
    },
    async draw() {
      const tirage = await request('/tirages', { method: 'POST' });
      if (restants !== null) restants = Math.max(0, restants - 1);
      return tirage;
    },
    async reset() {
      const resultat = await request('/administration/reinitialisation', { method: 'POST' });
      restants = resultat.ticketsReinitialises;
      return restants;
    }
  };
}
