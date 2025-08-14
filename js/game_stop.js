import * as db from './firestore.js';

// ---- VALIDAÇÃO E INICIALIZAÇÃO ----
const currentUserId = localStorage.getItem('currentUserId');
const sessionId = new URLSearchParams(window.location.search).get('id');
let currentUser = null; // Guardará os dados do usuário logado
let currentGameSession = null; // Guardará os dados do jogo em tempo real
let unsubscribeFromGame = null; // Para poder parar de ouvir as atualizações

if (!currentUserId || !sessionId) {
    alert("Informações inválidas. Retornando para a página principal.");
    window.location.href = 'app.html';
}

// ---- ELEMENTOS DA UI ----
const playersListDiv = document.getElementById('players-list');
const lobbyView = document.getElementById('lobby-view');
const playingView = document.getElementById('playing-view');
const validationView = document.getElementById('validation-view');
const leaderNameSpan = document.getElementById('leader-name');
const startRoundBtn = document.getElementById('start-round-btn');
const currentLetterDisplay = document.getElementById('current-letter-display');
const currentLetterText = document.getElementById('current-letter-text');
const gameBoard = document.getElementById('game-board');
const stopBtn = document.getElementById('stop-btn');
const validationTable = document.getElementById('validation-table');
const stoppedByPlayerSpan = document.getElementById('stopped-by-player');
const roundNumberSpan = document.getElementById('round-number');


// ---- LÓGICA PRINCIPAL ----
async function initializeGamePage() {
    // 1. Carregar perfil do usuário
    const userDoc = await db.getUserProfile(currentUserId);
    if (!userDoc.exists()) {
        alert("Usuário não encontrado!");
        window.location.href = 'index.html';
        return;
    }
    currentUser = { id: userDoc.id, ...userDoc.data() };

    // 2. Começar a ouvir a sessão do jogo em tempo real
    unsubscribeFromGame = db.listenToGameSession(sessionId, (gameDoc) => {
        if (!gameDoc.exists()) {
            alert("Sessão de jogo não encontrada ou foi terminada.");
            unsubscribeFromGame();
            window.location.href = 'app.html';
            return;
        }
        currentGameSession = { id: gameDoc.id, ...gameDoc.data() };
        renderGame(currentGameSession);
    });
}

// Função central que renderiza a UI baseada no estado do jogo
async function renderGame(game) {
    roundNumberSpan.textContent = game.gameState.round || 1;
    // Renderiza a lista de jogadores e suas pontuações (vamos adicionar depois)
    const playerPromises = game.players.map(id => db.getUserProfile(id));
    const playerDocs = await Promise.all(playerPromises);
    playersListDiv.innerHTML = playerDocs.map(doc => `<span class="badge bg-secondary">${doc.data().username}</span>`).join('');
    
    // Mostra a tela correta baseada no status do jogo
    lobbyView.classList.add('d-none');
    playingView.classList.add('d-none');
    validationView.classList.add('d-none');
    
    switch(game.status) {
        case 'waiting':
            lobbyView.classList.remove('d-none');
            const leaderDoc = await db.getUserProfile(game.createdBy);
            leaderNameSpan.textContent = leaderDoc.data().username;
            if (game.createdBy === currentUser.id) {
                startRoundBtn.disabled = false;
            }
            break;
        case 'playing':
            playingView.classList.remove('d-none');
            renderGameBoard(game.gameState.categories, game.gameState.responses[currentUser.id] || {});
            currentLetterDisplay.textContent = game.gameState.currentLetter;
            currentLetterText.textContent = game.gameState.currentLetter;
            break;
        case 'validating':
            validationView.classList.remove('d-none');
            const stoppedByDoc = await db.getUserProfile(game.gameState.stoppedBy);
            stoppedByPlayerSpan.textContent = stoppedByDoc.data().username;
            renderValidationTable(game);
            break;
    }
}

// Renderiza o tabuleiro do jogo (categorias e inputs)
function renderGameBoard(categories, userResponses) {
    gameBoard.innerHTML = categories.map(category => `
        <div class="input-group input-group-lg mb-3">
            <span class="input-group-text">${category}</span>
            <input type="text" class="form-control game-input" data-category="${category}" value="${userResponses[category] || ''}">
        </div>
    `).join('');
}

// Renderiza a tabela para validação de respostas
function renderValidationTable(game) {
    // Implementaremos a lógica de validação na próxima fase
    validationTable.innerHTML = `<p class="text-muted">A tabela de validação aparecerá aqui em breve.</p>`;
}


// ---- AÇÕES DO JOGADOR ----
startRoundBtn.addEventListener('click', () => {
    // Só o líder pode iniciar
    if (currentUser.id !== currentGameSession.createdBy) return;

    // Sorteia uma letra que ainda não foi usada
    const alphabet = 'ABCDEFGHIJKLMNOPRSTUVZ'.split(''); // sem K, Q, W, X, Y
    const usedLetters = currentGameSession.gameState.usedLetters || [];
    const availableLetters = alphabet.filter(l => !usedLetters.includes(l));
    const randomLetter = availableLetters[Math.floor(Math.random() * availableLetters.length)];

    const updates = {
        status: 'playing',
        'gameState.currentLetter': randomLetter,
        'gameState.usedLetters': db.arrayUnion(randomLetter)
    };
    db.updateGameSession(sessionId, updates);
});

// Listener para salvar respostas em tempo real no Firestore (usa "debouncing")
let debounceTimer;
gameBoard.addEventListener('input', (e) => {
    if (e.target.classList.contains('game-input')) {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            const category = e.target.dataset.category;
            const value = e.target.value;
            const updatePath = `gameState.responses.${currentUser.id}.${category}`;
            db.updateGameSession(sessionId, { [updatePath]: value.toUpperCase() });
        }, 500); // Salva 500ms depois que o usuário para de digitar
    }
});

stopBtn.addEventListener('click', () => {
    // Impede duplo clique
    stopBtn.disabled = true;

    // Atualiza o estado do jogo para "validating" e marca quem apertou "Stop"
    const updates = {
        status: 'validating',
        'gameState.stoppedBy': currentUser.id
    };
    db.updateGameSession(sessionId, updates);
});

// Inicia a página
initializeGamePage();