import * as db from './firestore.js';
import * as uno from './uno_logic.js';

// ---- VALIDAÇÃO E INICIALIZAÇÃO ----
const currentUserId = localStorage.getItem('currentUserId');
const sessionId = new URLSearchParams(window.location.search).get('id');
let currentUser = null;
let currentGameSession = null;
let unsubscribeFromGame = null;
let colorPickerModal = null;

if (!currentUserId || !sessionId) {
    alert("Sessão inválida.");
    window.location.href = 'app.html';
}

// ---- ELEMENTOS DA UI ----
const myHandDiv = document.getElementById('my-hand');
const discardPileDiv = document.getElementById('discard-pile');
const drawPileDiv = document.getElementById('draw-pile');
const currentPlayerNameSpan = document.getElementById('current-player-name');
const currentColorIndicator = document.getElementById('current-color-indicator');
const lobbyOverlay = document.getElementById('lobby-overlay');
const lobbyPlayersList = document.getElementById('lobby-players-list');
const startGameBtn = document.getElementById('start-game-btn');


// ---- FUNÇÃO DE RENDERIZAÇÃO ----
function renderCard(card, index = 0) {
    const cardDiv = document.createElement('div');
    cardDiv.className = `uno-card ${card.color}`;
    cardDiv.textContent = card.value.replace('_', ' ');
    cardDiv.dataset.cardIndex = index;
    cardDiv.dataset.color = card.color;
    cardDiv.dataset.value = card.value;
    return cardDiv;
}

async function renderGame(game) {
    // Esconde o lobby se o jogo começou
    if (game.status !== 'waiting') {
        lobbyOverlay.style.display = 'none';
    } else {
        const playerDocs = await Promise.all(game.players.map(id => db.getUserProfile(id)));
        lobbyPlayersList.innerHTML = playerDocs.map(doc => `<p>${doc.data().username}</p>`).join('');
        if (game.createdBy === currentUserId) {
            startGameBtn.disabled = game.players.length < 2;
        }
    }
    
    // Renderiza a mão do jogador
    const myHand = game.gameState.playerHands[currentUserId] || [];
    myHandDiv.innerHTML = '';
    myHand.forEach((card, index) => {
        myHandDiv.appendChild(renderCard(card, index));
    });

    // Renderiza a pilha de descarte
    const topCard = game.gameState.discardPile.at(-1);
    if(topCard) {
      discardPileDiv.innerHTML = '';
      discardPileDiv.appendChild(renderCard(topCard));
    }
    
    // Atualiza as informações do jogo
    const currentPlayerId = game.players[game.gameState.turn];
    const playerDoc = await db.getUserProfile(currentPlayerId);
    currentPlayerNameSpan.textContent = playerDoc.data().username;
    
    // Mostra a cor atual
    currentColorIndicator.style.backgroundColor = game.gameState.currentColor?.toLowerCase();
    
    // Habilita/Desabilita as cartas baseadas em quem é o turno
    if(currentPlayerId === currentUserId) {
        myHandDiv.classList.add('active-turn');
    } else {
        myHandDiv.classList.remove('active-turn');
    }
}


// ---- LÓGICA DE AÇÕES DO JOGADOR ----

// Iniciar o jogo
startGameBtn.addEventListener('click', () => {
    if (currentUserId !== currentGameSession.createdBy) return;

    const { playerHands, discardPile, drawPile } = uno.dealInitialHands(currentGameSession.players);
    const firstCard = discardPile[0];

    db.updateGameSession(sessionId, {
        status: 'playing',
        'gameState.playerHands': playerHands,
        'gameState.discardPile': discardPile,
        'gameState.drawPile': drawPile,
        'gameState.currentColor': firstCard.color === 'WILD' ? null : firstCard.color,
        // Efeitos da primeira carta, se houver
    });
});

// Jogar uma carta
myHandDiv.addEventListener('click', async (e) => {
    const cardEl = e.target.closest('.uno-card');
    if (!cardEl) return;
    
    const game = currentGameSession;
    if (game.players[game.gameState.turn] !== currentUserId) {
        return alert("Não é a sua vez!");
    }
    
    const cardIndex = parseInt(cardEl.dataset.cardIndex);
    const playedCard = game.gameState.playerHands[currentUserId][cardIndex];
    const topDiscard = game.gameState.discardPile.at(-1);

    if (uno.isMoveValid(playedCard, topDiscard, game.gameState.currentColor)) {
        // Se a carta for um Curinga, precisamos pedir uma cor
        if (playedCard.color === 'WILD') {
            const chosenColor = await pickColor();
            handlePlayCard(playedCard, cardIndex, chosenColor);
        } else {
            handlePlayCard(playedCard, cardIndex, null);
        }
    } else {
        alert("Jogada inválida!");
    }
});

// Comprar uma carta
drawPileDiv.addEventListener('click', () => {
    // ... implementar a lógica de comprar uma carta ...
});

async function handlePlayCard(card, cardIndex, chosenColor) {
    const game = currentGameSession;
    
    // Remove a carta da mão do jogador
    const newHand = [...game.gameState.playerHands[currentUserId]];
    newHand.splice(cardIndex, 1);

    const { turn, direction, currentColor } = uno.getNextTurn(game.gameState, card, chosenColor);

    const updates = {
        [`gameState.playerHands.${currentUserId}`]: newHand,
        'gameState.discardPile': db.arrayUnion(card),
        'gameState.turn': turn,
        'gameState.direction': direction,
        'gameState.currentColor': currentColor
        // Lógica de +2/+4 precisa ser adicionada aqui
    };
    
    db.updateGameSession(sessionId, updates);
}

// Função para abrir o modal de escolha de cor
function pickColor() {
    return new Promise(resolve => {
        colorPickerModal.show();
        document.querySelectorAll('.color-choice').forEach(btn => {
            btn.onclick = () => {
                colorPickerModal.hide();
                resolve(btn.dataset.color);
            };
        });
    });
}


// ---- INÍCIO ----
async function initializeGame() {
    const userDoc = await db.getUserProfile(currentUserId);
    currentUser = { id: userDoc.id, ...userDoc.data() };
    colorPickerModal = new bootstrap.Modal(document.getElementById('color-picker-modal'));

    unsubscribeFromGame = db.listenToGameSession(sessionId, (doc) => {
        if (doc.exists()) {
            currentGameSession = { id: doc.id, ...doc.data() };
            renderGame(currentGameSession);
        }
    });
}

initializeGame();