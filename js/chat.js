import * as db from './firestore.js';
import * as ui from './ui.js';

let activeChatData = null;
let unsubscribeFromMessages = null;
let unsubscribeFromGroupDetails = null;
let unsubscribeFromTableLinks = null;

let addMembersModal, manageAdminsModal, createTableModal, gameLobbyModal;

export const chatManager = {
    openChat,
    handleDeleteMessage,
    voteOnPoll,
    getActiveChat: () => activeChatData,
};

// ==========================================================
// LÓGICA DO MODAL DE CRIAÇÃO DE PLANILHA
// ==========================================================

// Função auxiliar para adicionar uma linha à tabela de configuração de colunas.
function addColumnConfigurationRow() {
    const tbody = document.getElementById('column-config-table-body');
    if (!tbody) return;

    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td><input type="text" class="form-control form-control-sm column-name" required></td>
        <td>
            <select class="form-select form-select-sm column-type">
                <option value="text" selected>Texto</option>
                <option value="number">Número</option>
                <option value="checkbox">Caixa de Seleção</option>
                <option value="date">Data</option>
                <option value="select">Lista Suspensa</option>
            </select>
        </td>
        <td><input type="text" class="form-control form-control-sm column-options" placeholder="Opção1, Opção2" style="display: none;"></td>
        <td><button type="button" class="btn btn-danger btn-sm remove-column-btn"><i class="bi bi-trash"></i></button></td>
    `;
    tbody.appendChild(tr);

    const typeSelect = tr.querySelector('.column-type');
    const optionsInput = tr.querySelector('.column-options');
    typeSelect.addEventListener('change', () => {
        optionsInput.style.display = typeSelect.value === 'select' ? 'block' : 'none';
    });

    tr.querySelector('.remove-column-btn').addEventListener('click', () => {
        tr.remove();
    });
}

// ==========================================================
// FLUXO PRINCIPAL DO CHAT
// ==========================================================

async function openChat(id, type, name) {
    if (activeChatData?.id === id) return;
    closeChat(); 

    document.getElementById('welcome-view').classList.add('d-none');
    const chatWrapper = document.getElementById('chat-window-wrapper');
    chatWrapper.innerHTML = ui.getChatWindowHTML();
    chatWrapper.classList.remove('d-none');

    // ESTA FUNÇÃO AGORA CUIDA DE TUDO
    initializeChatModalsAndListeners();
    
    activeChatData = { id, type, name, details: null };

    const chatTitle = document.getElementById('chat-title');
    const groupManagementMenu = document.getElementById('group-management-menu');
    const tablesMenu = document.getElementById('tables-menu');

    chatTitle.textContent = name;
    groupManagementMenu.classList.toggle('d-none', type !== 'group');
    tablesMenu.classList.toggle('d-none', type !== 'group');

    if (type === 'group' && window.currentUser) {
        db.updateLastSeen(window.currentUser.id, id);
        unsubscribeFromGroupDetails = db.listenToGroupDetails(id, (groupDoc) => {
            if (groupDoc.exists()) {
                activeChatData.details = groupDoc.data();
                rerenderCurrentMessages();
            }
        });
        unsubscribeFromTableLinks = db.listenToTableLinks(id, (snapshot) => {
            const tableLinks = snapshot.docs.map(doc => doc.data());
            ui.renderTablesDropdown(tableLinks);
        });
    } else {
        ui.renderTablesDropdown([]);
    }

    const chatId = getChatId();
    unsubscribeFromMessages = db.listenToChatMessages(chatId, (snapshot) => {
        activeChatData.messages = snapshot.docs.map(doc => ({ id: doc.id, data: doc.data() }));
        rerenderCurrentMessages();
    });
}

// FUNÇÃO DE INICIALIZAÇÃO CORRIGIDA E UNIFICADA
function initializeChatModalsAndListeners() {
    addMembersModal = new bootstrap.Modal(document.getElementById('add-members-modal'));
    manageAdminsModal = new bootstrap.Modal(document.getElementById('manage-admins-modal'));
    createTableModal = new bootstrap.Modal(document.getElementById('create-table-modal'));
    gameLobbyModal = new bootstrap.Modal(document.getElementById('game-lobby-modal'));

    // Listeners gerais do chat
    document.getElementById('chat-form')?.addEventListener('submit', handleSendMessage);
    document.getElementById('manage-members-btn')?.addEventListener('click', () => openAddMembersModal());
    document.getElementById('save-members-btn')?.addEventListener('click', handleSaveMembers);
    document.getElementById('manage-admins-btn')?.addEventListener('click', () => openManageAdminsModal());
    document.getElementById('save-admins-btn')?.addEventListener('click', handleSaveAdmins);
    document.getElementById('delete-group-btn')?.addEventListener('click', handleDeleteGroup);
    document.getElementById('create-poll-btn')?.addEventListener('click', handleOpenPollPage);
    document.getElementById('start-game-btn')?.addEventListener('click', () => gameLobbyModal.show());

    // Listeners específicos para a criação de planilhas
    document.getElementById('create-table-btn')?.addEventListener('click', () => createTableModal.show());
    document.getElementById('save-table-btn')?.addEventListener('click', handleCreateTable);
    document.getElementById('add-column-config-btn')?.addEventListener('click', addColumnConfigurationRow);

    // Listener para limpar e popular o modal da planilha toda vez que ele for aberto
    const createTableModalEl = document.getElementById('create-table-modal');
    createTableModalEl?.addEventListener('show.bs.modal', () => {
        const tbody = document.getElementById('column-config-table-body');
        if (tbody) {
            tbody.innerHTML = ''; // Limpa a tabela de configuração antiga
        }
        addColumnConfigurationRow(); // Adiciona a primeira linha
    });
}

function closeChat() {
    if (unsubscribeFromMessages) unsubscribeFromMessages();
    if (unsubscribeFromGroupDetails) unsubscribeFromGroupDetails();
    if (unsubscribeFromTableLinks) unsubscribeFromTableLinks();
    
    const chatWrapper = document.getElementById('chat-window-wrapper');
    const welcomeView = document.getElementById('welcome-view');

    if (chatWrapper && welcomeView) {
        chatWrapper.innerHTML = '';
        chatWrapper.classList.add('d-none');
        welcomeView.classList.remove('d-none');
    }
    
    activeChatData = null;
}

function rerenderCurrentMessages() {
    if (window.currentUser && activeChatData && activeChatData.messages) {
        ui.renderMessages(activeChatData.messages, window.currentUser, activeChatData);
    }
}

function getChatId() {
    if (!activeChatData || !window.currentUser) return null;
    return activeChatData.type === 'group' ? activeChatData.id : [window.currentUser.id, activeChatData.id].sort().join('_');
}

async function handleSendMessage(e) {
    e.preventDefault();
    const textInput = document.getElementById('chat-input');
    const text = textInput.value.trim();
    if (text && activeChatData && window.currentUser) {
        await db.sendMessage(getChatId(), {
            type: 'text',
            senderId: window.currentUser.id,
            senderName: window.currentUser.username,
            text,
            timestamp: db.serverTimestamp()
        });
        textInput.value = '';
    }
}

async function openAddMembersModal() {
    if (!activeChatData || activeChatData.type !== 'group' || !activeChatData.details) return;
    const { members } = activeChatData.details;
    const friendsToShow = window.currentUser.friends?.filter(friendId => !members.includes(friendId)) || [];
    const modalFriendsList = document.getElementById('modal-friends-list');
    
    if (friendsToShow.length === 0) {
        modalFriendsList.innerHTML = '<li class="list-group-item">Todos os seus amigos já estão no grupo.</li>';
    } else {
        const friendsPromises = friendsToShow.map(id => db.getUserProfile(id));
        const friendsDocs = await Promise.all(friendsPromises);
        modalFriendsList.innerHTML = friendsDocs.map(doc => doc.exists() ? `<li class="list-group-item"><input class="form-check-input me-2" type="checkbox" value="${doc.id}">${doc.data().username}</li>` : '').join('');
    }
}

async function handleSaveMembers() {
    if (!activeChatData || activeChatData.type !== 'group') return;
    const membersToAdd = Array.from(document.querySelectorAll('#modal-friends-list input:checked')).map(input => input.value);
    if (membersToAdd.length > 0) {
        await db.updateGroup(activeChatData.id, { members: db.arrayUnion(...membersToAdd) });
        addMembersModal.hide();
    }
}

async function openManageAdminsModal() {
    if (!activeChatData || activeChatData.type !== 'group' || !activeChatData.details?.admins.includes(window.currentUser.id)) {
        alert("Apenas administradores podem fazer isso.");
        return;
    }
    
    const { members, admins, createdBy } = activeChatData.details;
    const membersPromises = members.map(id => db.getUserProfile(id));
    const membersDocs = await Promise.all(membersPromises);
    const modalAdminsList = document.getElementById('modal-admins-list');

    modalAdminsList.innerHTML = membersDocs.map(doc => {
        if (!doc.exists()) return '';
        const member = { id: doc.id, ...doc.data() };
        const isAdmin = admins.includes(member.id);
        const isCreator = createdBy === member.id;
        return `
            <li class="list-group-item">
              <input class="form-check-input me-1" type="checkbox" value="${member.id}" ${isAdmin ? 'checked' : ''} ${isCreator ? 'disabled' : ''}>
              ${member.username} ${isCreator ? '<span class="badge bg-dark ms-2">Criador</span>' : ''}
            </li>`;
    }).join('');
}

async function handleSaveAdmins() {
    if (!activeChatData || activeChatData.type !== 'group' || !activeChatData.details) return;
    let newAdminIds = Array.from(document.querySelectorAll('#modal-admins-list input:checked')).map(input => input.value);
    if (!newAdminIds.includes(activeChatData.details.createdBy)) {
        newAdminIds.push(activeChatData.details.createdBy);
    }
    await db.updateGroup(activeChatData.id, { admins: newAdminIds });
    manageAdminsModal.hide();
}

async function handleDeleteGroup() {
    if (!activeChatData || activeChatData.type !== 'group' || !activeChatData.details?.admins.includes(window.currentUser.id)) {
        alert("Apenas administradores podem apagar o grupo.");
        return;
    }
    if (confirm(`TEM CERTEZA que quer apagar o grupo "${activeChatData.name}"?`)) {
        await db.deleteGroup(activeChatData.id);
        closeChat();
    }
}

function handleOpenPollPage() {
    if (activeChatData && activeChatData.type === 'group') {
        window.location.href = `poll.html?groupId=${activeChatData.id}`;
    } else {
        alert("Enquetes só podem ser criadas em grupos.");
    }
}

async function handleDeleteMessage(messageId) {
    if (!confirm("Tem certeza que quer apagar a mensagem?")) return;
    await db.deleteMessage(getChatId(), messageId);
}

async function voteOnPoll(msgId, option) {
    const chatId = getChatId();
    if (!chatId || !window.currentUser) return;
    const msgDoc = await db.getMessage(chatId, msgId);
    if (!msgDoc.exists()) return;
    
    const alreadyVoted = Object.values(msgDoc.data().options).some(arr => arr.includes(window.currentUser.id));
    if (alreadyVoted) return;
    
    await db.updateMessage(chatId, msgId, { [`options.${option}`]: db.arrayUnion(window.currentUser.id) });
}

// ===== FUNÇÃO `handleCreateTable` ATUALIZADA =====
// Agora lê os dados da nova tabela de configuração interativa.
async function handleCreateTable() {
    if (!activeChatData || activeChatData.type !== 'group' || !window.currentUser) {
        alert("As planilhas só podem ser criadas em grupos.");
        return;
    }

    const title = document.getElementById('table-title-input').value.trim();
    if (!title) {
        alert("Por favor, forneça um título para a planilha.");
        return;
    }

    try {
        const headers = [];
        const configRows = document.querySelectorAll('#column-config-table-body tr');

        if (configRows.length === 0) {
            alert("Adicione pelo menos uma coluna para a planilha.");
            return;
        }

        for (const row of configRows) {
            const name = row.querySelector('.column-name').value.trim();
            const type = row.querySelector('.column-type').value;
            
            if (!name) {
                alert("Todas as colunas devem ter um nome.");
                row.querySelector('.column-name').focus();
                return; // Para a execução
            }

            const headerObj = { name, type };

            if (type === 'select') {
                const optionsRaw = row.querySelector('.column-options').value.trim();
                if (!optionsRaw) {
                    alert(`A coluna de seleção "${name}" precisa de opções.`);
                    row.querySelector('.column-options').focus();
                    return; // Para a execução
                }
                headerObj.options = optionsRaw.split(',').map(p => p.trim()).filter(Boolean);
            }
            headers.push(headerObj);
        }
        
        // 1. Chamar createTable (que já foi atualizada)
        const tableDoc = await db.createTable(title, headers, window.currentUser.id);

        // 2. Enviar a mensagem de link
        await db.sendMessage(getChatId(), {
            type: 'table_link',
            senderId: window.currentUser.id,
            senderName: window.currentUser.username,
            tableId: tableDoc.id,
            title: title,
            timestamp: db.serverTimestamp()
        });

        // 3. Limpar e fechar o modal
        document.getElementById('table-title-input').value = '';
        createTableModal.hide();

    } catch (error) {
        console.error("Erro ao processar ou criar planilha:", error);
        alert(`Ocorreu um erro: ${error.message}`);
    }
}