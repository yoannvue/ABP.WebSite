const API_URL = "http://localhost:5000";

const drawButton = document.querySelector("#draw-button");
const resetButton = document.querySelector("#reset-button");
const refreshButton = document.querySelector("#refresh-button");
const drawResult = document.querySelector("#draw-result");
const resetResult = document.querySelector("#reset-result");
const statisticsResult = document.querySelector("#statistics-result");
const ticketsRemaining = document.querySelector("#tickets-remaining");
const winningTicketsRemaining = document.querySelector("#winning-tickets-remaining");
const prizesList = document.querySelector("#prizes-list");

document.querySelector("#api-url").textContent = API_URL;

async function request(path, options) {
  const response = await fetch(`${API_URL}${path}`, options);
  const body = await response.json();

  if (!response.ok) {
    throw new Error(body.detail || body.title || `Erreur HTTP ${response.status}`);
  }

  return body;
}

function showError(element, error) {
  element.textContent = `Erreur : ${error.message}`;
}

function setBusy(isBusy) {
  drawButton.disabled = isBusy;
  resetButton.disabled = isBusy;
  refreshButton.disabled = isBusy;
}

async function refreshStatistics() {
  statisticsResult.textContent = "Chargement…";

  try {
    const statistics = await request("/statistiques");
    ticketsRemaining.textContent = statistics.ticketsRestants;
    winningTicketsRemaining.textContent = statistics.ticketsGagnantsRestants;
    prizesList.replaceChildren();

    for (const prize of statistics.lots) {
      const item = document.createElement("li");
      item.textContent = `${prize.nom} : ${prize.restants} restant(s) sur ${prize.quantite}`;
      prizesList.append(item);
    }

    statisticsResult.textContent = "";
  } catch (error) {
    showError(statisticsResult, error);
  }
}

drawButton.addEventListener("click", async () => {
  setBusy(true);
  drawResult.textContent = "Tirage en cours…";
  resetResult.textContent = "";

  try {
    const draw = await request("/tirages", { method: "POST" });
    drawResult.textContent = draw.gagnant
      ? `Ticket ${draw.numero} gagnant : ${draw.lot}.`
      : `Ticket ${draw.numero} perdant.`;
    await refreshStatistics();
  } catch (error) {
    showError(drawResult, error);
  } finally {
    setBusy(false);
  }
});

resetButton.addEventListener("click", async () => {
  if (!window.confirm("Réinitialiser tous les tickets ?")) {
    return;
  }

  setBusy(true);
  resetResult.textContent = "Réinitialisation en cours…";
  drawResult.textContent = "Aucun tirage effectué.";

  try {
    const result = await request("/administration/reinitialisation", { method: "POST" });
    resetResult.textContent = `${result.ticketsReinitialises} ticket(s) réinitialisé(s).`;
    await refreshStatistics();
  } catch (error) {
    showError(resetResult, error);
  } finally {
    setBusy(false);
  }
});

refreshButton.addEventListener("click", refreshStatistics);

refreshStatistics();
