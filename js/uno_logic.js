
const COLORS = ['RED', 'GREEN', 'BLUE', 'YELLOW'];
const VALUES = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'SKIP', 'REVERSE', 'DRAW_2'];
const WILD_VALUES = ['WILD', 'WILD_DRAW_4'];

// Gera o baralho inicial de Uno
export function createDeck() {
    const deck = [];
    for (const color of COLORS) {
        for (const value of VALUES) {
            deck.push({ color, value });
            if (value !== '0') {
                deck.push({ color, value }); // Duas de cada, exceto '0'
            }
        }
    }
    for (const value of WILD_VALUES) {
        for (let i = 0; i < 4; i++) {
            deck.push({ color: 'WILD', value });
        }
    }
    return deck;
}

// Embaralha o baralho usando o algoritmo Fisher-Yates
export function shuffleDeck(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

// Lida com o início do jogo: embaralha, distribui e vira a primeira carta
export function dealInitialHands(playerIds) {
    const shuffledDeck = shuffleDeck(createDeck());
    const playerHands = {};
    
    playerIds.forEach(id => {
        playerHands[id] = shuffledDeck.splice(0, 7);
    });

    let firstCard = shuffledDeck.pop();
    // A primeira carta não pode ser um Curinga +4
    while (firstCard.value === 'WILD_DRAW_4') {
        shuffledDeck.push(firstCard);
        firstCard = shuffledDeck.pop();
    }
    
    return {
        drawPile: shuffledDeck,
        discardPile: [firstCard],
        playerHands,
    };
}

// Verifica se uma jogada é válida
export function isMoveValid(card, topDiscardCard, currentColor) {
    if (card.color === 'WILD') return true; // Curingas são sempre válidos
    if (card.color === currentColor) return true;
    if (card.value === topDiscardCard.value) return true;
    return false;
}

// Aplica o efeito de uma carta e determina o próximo jogador
export function getNextTurn(gameState, playedCard, wildColorChosen = null) {
    const { turn, direction, players } = gameState;
    let nextTurn = turn;
    let nextDirection = direction;
    
    const applyEffect = (card) => {
        switch (card.value) {
            case 'REVERSE':
                nextDirection *= -1;
                break;
            case 'SKIP':
                nextTurn = (nextTurn + nextDirection + players.length) % players.length;
                break;
        }
        nextTurn = (nextTurn + nextDirection + players.length) % players.length;
    };

    applyEffect(playedCard);
    
    let nextColor = playedCard.color === 'WILD' ? wildColorChosen : playedCard.color;

    return { 
        turn: nextTurn,
        direction: nextDirection,
        currentColor: nextColor,
        // Efeitos de compra de cartas serão tratados separadamente na lógica principal
    };
}