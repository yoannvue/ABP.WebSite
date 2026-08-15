import { shuffle } from "./memory-utils.js";

export class MemoryGame {
  /**
   * @param {object} options
   * @param {number} options.numPairs - nombre de paires à générer
   * @param {string[]} options.imagePool - liste d'images disponibles
   * @param {function} options.onWin - callback appelé à la victoire (elapsedSeconds, moves)
   */
  constructor({ numPairs, imagePool, onWin }) {
    if (imagePool.length < numPairs) {
      throw new Error(
        `Pas assez d'images (${imagePool.length}) pour ${numPairs} paires. ` +
        `Ajoute des images dans CONFIG.CARD_IMAGES ou réduis NUM_PAIRS.`
      );
    }

    this.numPairs = numPairs;
    this.onWin = onWin;

    this.moves = 0;
    this.matchedPairs = 0;
    this.flippedCards = [];
    this.locked = false; // empêche les clics pendant l'évaluation d'une paire

    this.startTime = null;
    this.elapsedSeconds = 0;
    this.timerInterval = null;

    this.cards = this._buildDeck(imagePool);
  }

  _buildDeck(imagePool) {
    const chosenImages = shuffle(imagePool).slice(0, this.numPairs);
    const deck = [];
    chosenImages.forEach((image, pairIndex) => {
      deck.push({ id: `${pairIndex}-a`, pairId: pairIndex, image, state: "hidden" });
      deck.push({ id: `${pairIndex}-b`, pairId: pairIndex, image, state: "hidden" });
    });
    return shuffle(deck);
  }

  startTimer(onTick) {
    this.startTime = Date.now();
    this.timerInterval = setInterval(() => {
      this.elapsedSeconds = Math.floor((Date.now() - this.startTime) / 1000);
      onTick(this.elapsedSeconds);
    }, 1000);
  }

  stopTimer() {
    clearInterval(this.timerInterval);
  }

  /**
   * Tente de retourner une carte. Retourne un descriptif de ce qu'il
   * s'est passé pour que l'UI puisse réagir (flip visuel, match, erreur...).
   */
  flipCard(cardId) {
    if (this.locked) return { action: "ignored" };

    const card = this.cards.find(c => c.id === cardId);
    if (!card || card.state !== "hidden") return { action: "ignored" };

    card.state = "flipped";
    this.flippedCards.push(card);

    if (this.flippedCards.length === 1) {
      return { action: "flip", card };
    }

    // Deuxième carte retournée : on évalue la paire
    this.moves++;
    const [first, second] = this.flippedCards;

    if (first.pairId === second.pairId) {
      first.state = "matched";
      second.state = "matched";
      this.matchedPairs++;
      this.flippedCards = [];

      const won = this.matchedPairs === this.numPairs;
      if (won) {
        this.stopTimer();
        this.onWin(this.elapsedSeconds, this.moves);
      }

      return { action: "match", cards: [first, second], moves: this.moves, won };
    }

    // Pas de match : on verrouille le temps que l'UI montre les 2 cartes
    this.locked = true;
    return { action: "mismatch", cards: [first, second], moves: this.moves };
  }

  /** À appeler par l'UI après le délai d'affichage d'une paire ratée. */
  resolveMismatch() {
    this.flippedCards.forEach(c => { c.state = "hidden"; });
    this.flippedCards = [];
    this.locked = false;
  }
}
