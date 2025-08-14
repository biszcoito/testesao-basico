
import * as db from './firestore.js';
import * as ui from './ui.js';
import * as theme from './theme.js';
import { chatManager } from './chat.js';

// ---- VALIDAÇÃO E DADOS GLOBAIS ----
const currentUserId = localStorage.getItem('currentUserId');
if (!currentUserId) window.location.href = 'index.html';

window.currentUser = null;
window.chatManager = chatManager; // Expondo o gerenciador de chat para o HTML

// --- MODAIS BOOTSTRAP ---
let addFriendModal; // Será inicializado depois do DOM carregar
let gameLobbyModal;
let unsubscribeFromGames = null;

document.addEventListener('DOMContentLoaded', initializeApp);

// ---- INICIALIZAÇÃO ----
function initializeApp() {
    // Inicializa modais aqui para garantir que os elementos existem
    addFriendModal = new bootstrap.Modal(document.getElementById('add-friend-modal'));
    gameLobbyModal = new bootstrap.Modal(document.getElementById('game-lobby-modal'));

    setupEventListeners();
    theme.loadThemeSettings();
    
    db.listenToUserProfile(currentUserId, (userSnap) => {
        if (!userSnap.exists()) { logout(); return; }
        window.currentUser = { id: userSnap.id, ...userSnap.data() };
        ui.renderUserProfile(window.currentUser);
        loadFriends();
        loadGroups();
    });
}

// --- FUNÇÕES DE CARREGAMENTO DE DADOS NA SIDEBAR ---
async function loadFriends() {
    if (!window.currentUser?.friends || window.currentUser.friends.length === 0) {
        ui.renderFriendsList([]);
        return;
    }
    const friendsPromises = window.currentUser.friends.map(id => db.getUserProfile(id));
    const friendsDocs = await Promise.all(friendsPromises);
    const friends = friendsDocs.map(doc => doc.exists() ? { id: doc.id, ...doc.data() } : null).filter(Boolean);
    ui.renderFriendsList(friends); 
}

function loadGroups() {
    db.listenToUserGroups(currentUserId, (snapshot) => {
        const groups = snapshot.docs.map(doc => ({
            id: doc.id,
            name: doc.data().groupName,
            memberCount: doc.data().members.length
        }));
        ui.renderGroupsList(groups);
    }, (error) => {
        console.error("Erro ao carregar grupos:", error);
    });
}

// ---- GERENCIADOR DE JOGOS (LOBBY) ----
const gameManager = {
    async createGame(gameType) {
        const activeChat = chatManager.getActiveChat();
        if (!activeChat || activeChat.type !== 'group' || !window.currentUser) {
            alert("Você precisa estar em um grupo para iniciar um jogo.");
            return;
        }

        let gameData;

        if (gameType === 'stop') {
            const categories = prompt("Digite as categorias do Stop (separadas por vírgula):", "Nome, Cor, CEP, Animal");
            if (!categories || categories.trim() === "") return;

            gameData = {
                groupId: activeChat.id,
                gameType: 'stop',
                status: 'waiting',
                createdBy: window.currentUser.id,
                players: [window.currentUser.id],
                maxPlayers: 8,
                createdAt: db.serverTimestamp(),
                gameState: {
                    round: 1,
                    currentLetter: null,
                    categories: categories.split(',').map(c => c.trim()),
                    responses: {},
                    scores: {},
                    stoppedBy: null,
                    usedLetters: [],
                }
            };
        } else if (gameType === 'uno') { // LÓGICA DO UNO ADICIONADA AQUI
            gameData = {
                groupId: activeChat.id,
                gameType: 'uno',
                status: 'waiting',
                createdBy: window.currentUser.id,
                players: [window.currentUser.id],
                maxPlayers: 10,
                createdAt: db.serverTimestamp(),
                gameState: {
                    turn: 0,
                    direction: 1,
                    currentColor: null,
                    drawPile: [],
                    discardPile: [],
                    playerHands: {},
                    winner: null
                }
            };
        } else if (gameType === 'chess') { // Adiciona este bloco else if
            gameData = {
                groupId: activeChat.id,
                gameType: 'chess',
                status: 'waiting', 
                createdBy: window.currentUser.id,
                players: [window.currentUser.id], // [brancas, pretas]
                maxPlayers: 2,
                createdAt: db.serverTimestamp(),
                gameState: {
                    // FEN (Forsyth-Edwards Notation) representa a posição de todas as peças.
                    // "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1" é a posição inicial.
                    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
                    history: [], // Histórico de jogadas em notação algébrica
                    winner: null,
                    statusText: 'Aguardando oponente...'
                }
            };
        } else {
            alert(`Jogo "${gameType}" ainda não implementado.`);
            return;
        }
        
        try {
            const sessionDoc = await db.createGameSession(gameData);
            gameLobbyModal.hide();
            // Redireciona para a página correta baseada no tipo de jogo
            const gamePage = {
                'stop': 'game_stop.html',
                'uno': 'game_uno.html',
                'chess': 'game_chess.html'
            }[gameType];

            window.location.href = `${gamePage}?id=${sessionDoc.id}`;
        } catch(error) {
            console.error("Erro ao criar sessão de jogo:", error);
            alert("Não foi possível criar o jogo.");
        }
    },
    
    async joinGame(sessionId) {
        if (!window.currentUser) return;

        // Adiciona o jogador ao array de players na sessão de jogo
        await db.updateGameSession(sessionId, { 
            players: db.arrayUnion(window.currentUser.id) 
        });

        // Pega os detalhes do jogo para saber para qual página redirecionar
        const gameSnap = await db.getGameSession(sessionId);
        if (gameSnap.exists()) {
            const gameData = gameSnap.data();
            const gamePage = gameData.gameType === 'uno' ? 'game_uno.html' : 'game_stop.html';
            window.location.href = `${gamePage}?id=${sessionId}`;
        } else {
            alert("O jogo não existe mais.");
        }
    },

    async enterGame(sessionId) { // Renomeado para async para poder buscar dados
        const gameSnap = await db.getGameSession(sessionId);
         if (gameSnap.exists()) {
            const gameData = gameSnap.data();
            const gamePage = gameData.gameType === 'uno' ? 'game_uno.html' : 'game_stop.html';
            window.location.href = `${gamePage}?id=${sessionId}`;
        } else {
            alert("O jogo não existe mais.");
        }
    }
};
window.gameManager = gameManager; // Expõe para o onclick do HTML

// --- EVENT LISTENERS E HANDLERS ---
function setupEventListeners() {
    theme.setupThemeEventListeners();
    
    document.getElementById('logout-button')?.addEventListener('click', logout);
    document.getElementById('add-friend-form')?.addEventListener('submit', handleAddFriend);
    document.getElementById('create-group-btn')?.addEventListener('click', handleCreateGroup);
    document.getElementById('sidebar-toggle-btn')?.addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('compact');
    });

    // Lógica do Modal de Lobby de Jogos
    const lobbyModalEl = document.getElementById('game-lobby-modal');
    lobbyModalEl?.addEventListener('show.bs.modal', () => {
        const activeChat = chatManager.getActiveChat();
        if (activeChat && activeChat.type === 'group') {
            if (unsubscribeFromGames) unsubscribeFromGames();
            unsubscribeFromGames = db.listenToGameSessions(activeChat.id, (snapshot) => {
                const sessions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                // Verifique se a função renderActiveGameSessions existe antes de chamar
                if (ui.renderActiveGameSessions) {
                    ui.renderActiveGameSessions(sessions, window.currentUser.id);
                }
            });
        }
    });
    lobbyModalEl?.addEventListener('hide.bs.modal', () => {
        if (unsubscribeFromGames) {
            unsubscribeFromGames();
            unsubscribeFromGames = null;
        }
    });

    document.getElementById('game-creation-buttons')?.addEventListener('click', (e) => {
        const button = e.target.closest('.list-group-item');
        if (button && button.dataset.game && !button.classList.contains('disabled')) {
            gameManager.createGame(button.dataset.game);
        }
    });
}

async function handleAddFriend(e) {
    e.preventDefault();
    const addFriendInput = document.getElementById('add-friend-input');
    const friendUniqueId = addFriendInput.value.trim();
    if (!friendUniqueId || (window.currentUser && friendUniqueId === window.currentUser.uniqueId)) return;

    try {
        const querySnapshot = await db.findUserByUniqueId(friendUniqueId);
        if (querySnapshot.empty) { 
            alert("Usuário não encontrado.");
            return; 
        }
        
        const friendDoc = querySnapshot.docs[0];
        if (window.currentUser.friends?.includes(friendDoc.id)) {
            alert(`${friendDoc.data().username} já é seu amigo.`);
            return;
        }
        
        await db.addFriend(currentUserId, friendDoc.id);
        alert(`${friendDoc.data().username} adicionado!`);
        addFriendInput.value = '';
        addFriendModal.hide();
    } catch (error) { 
        console.error("Erro ao adicionar amigo: ", error); 
        alert("Ocorreu um erro ao adicionar o amigo.");
    }
}

async function handleCreateGroup() {
    const groupName = prompt("Digite o nome do novo grupo:")?.trim();
    if (groupName) {
        try {
            await db.createGroup(groupName, currentUserId);
        } catch(error) {
            console.error("Erro ao criar grupo:", error);
            alert("Não foi possível criar o grupo.");
        }
    }
}

function logout() {
    localStorage.removeItem('currentUserId');
    window.location.href = 'index.html';
}
