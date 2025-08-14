import * as db from './firestore.js';

// ---- VALIDAÇÃO E INICIALIZAÇÃO ----
const currentUserId = localStorage.getItem('currentUserId');
const sessionId = new URLSearchParams(window.location.search).get('id');

if (!currentUserId || !sessionId) {
    alert("Sessão de xadrez inválida.");
    window.location.href = 'app.html';
}

// ---- VARIÁVEIS GLOBAIS ----
let board = null;      // O objeto da UI (Chessboard.js)
let game = new Chess();  // O motor de lógica (Chess.js)
let myColor = null;    // 'white' ou 'black'
let currentGameSession = null; // Dados do Firestore
let unsubscribeFromGame = null;

// ---- ELEMENTOS DA UI ----
const statusText = document.getElementById('game-status-text');
const playerWhite = document.getElementById('player-white');
const playerBlack = document.getElementById('player-black');
const yourColor = document.getElementById('your-color');


// ---- FUNÇÕES DE LÓGICA DO JOGO ----

// Chamado quando uma peça é arrastada
function onDragStart(source, piece) {
    // Não permite mover se o jogo acabou ou não é a sua vez
    if (game.game_over() || (game.turn() === 'w' && myColor !== 'white') || (game.turn() === 'b' && myColor !== 'black')) {
        return false;
    }
}

// Chamado quando uma peça é solta
async function onDrop(source, target) {
    // Tenta fazer a jogada na lógica do chess.js
    let move = game.move({
        from: source,
        to: target,
        promotion: 'q' // Promove sempre para rainha (simplificação)
    });

    // Se a jogada for ilegal, retorna a peça para a posição original
    if (move === null) return 'snapback';

    // Se a jogada foi válida, atualiza o Firestore
    await db.updateGameSession(sessionId, {
        'gameState.fen': game.fen(),
        'gameState.history': db.arrayUnion(move.san)
    });
}

// Chamado após a peça ser solta em uma casa válida
function onSnapEnd() {
    // Atualiza a UI do tabuleiro para a posição do motor de lógica
    board.position(game.fen());
}


// ---- FUNÇÕES DE RENDERIZAÇÃO E ATUALIZAÇÃO ----

// Função principal que atualiza a tela com dados do Firestore
async function updateGame(gameSession) {
    currentGameSession = gameSession;
    
    // Carrega a posição do tabuleiro do FEN salvo no Firestore
    game.load(gameSession.gameState.fen);
    
    // Define a cor do jogador
    if(currentUserId === gameSession.players[0]) myColor = 'white';
    if(currentUserId === gameSession.players[1]) myColor = 'black';

    // Orientação do tabuleiro: Brancas olham de baixo, Pretas de cima
    const orientation = myColor === 'black' ? 'black' : 'white';
    
    // Se o tabuleiro da UI não existe, cria ele
    if (!board) {
        board = Chessboard('boardContainer', {
            draggable: true,
            position: game.fen(),
            orientation: orientation,
            onDragStart: onDragStart,
            onDrop: onDrop,
            onSnapEnd: onSnapEnd
        });
    } else {
        // Se já existe, apenas atualiza a posição e orientação
        board.position(game.fen());
        board.orientation(orientation);
    }

    // Atualiza os nomes dos jogadores
    const whitePlayerDoc = await db.getUserProfile(gameSession.players[0]);
    playerWhite.textContent = `Brancas: ${whitePlayerDoc.data().username}`;

    if(gameSession.players.length > 1) {
       const blackPlayerDoc = await db.getUserProfile(gameSession.players[1]);
       playerBlack.textContent = `Pretas: ${blackPlayerDoc.data().username}`;
    } else {
       playerBlack.textContent = `Pretas: Aguardando oponente...`;
    }

    yourColor.textContent = `Você está jogando de ${myColor === 'white' ? 'Brancas' : 'Pretas'}`;

    // Atualiza o status do jogo
    let currentStatus = '';
    const turn = game.turn() === 'w' ? 'Brancas' : 'Pretas';
    
    if (game.in_checkmate()) {
        currentStatus = `FIM DE JOGO - ${turn} estão em xeque-mate.`;
    } else if (game.in_draw()) {
        currentStatus = 'FIM DE JOGO - Empate.';
    } else {
        currentStatus = `É a vez das ${turn}.`;
        if (game.in_check()) {
            currentStatus += ` As ${turn} estão em xeque.`;
        }
    }
    statusText.textContent = currentStatus;
}


// ---- INÍCIO ----

async function initializeChessGame() {
    // Entra na sala (se só houver um jogador, se torna as Pretas)
    const gameDoc = await db.getGameSession(sessionId);
    const gameData = gameDoc.data();
    if(gameData.players.length === 1 && gameData.players[0] !== currentUserId) {
        await db.updateGameSession(sessionId, {
            players: db.arrayUnion(currentUserId)
        });
    }

    // Ouve as atualizações da partida em tempo real
    unsubscribeFromGame = db.listenToGameSession(sessionId, async (doc) => {
        if(doc.exists()) {
           await updateGame(doc.data());
        }
    });
}

initializeChessGame();