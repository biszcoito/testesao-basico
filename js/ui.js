export const userProfileDiv = document.getElementById('user-profile');
export const userUniqueIdDiv = document.getElementById('user-unique-id');

export function getChatWindowHTML() {
    return `
        <div id="chat-window" class="card h-100 d-flex flex-column">
            <div id="chat-header" class="card-header d-flex justify-content-between align-items-center">
                <h5 id="chat-title" class="mb-0"></h5>
                <div class="btn-group">
                    <div id="tables-menu" class="dropdown">
                        <button class="btn btn-light btn-sm" type="button" data-bs-toggle="dropdown" title="Ver tabelas">
                            <i class="bi bi-table"></i>
                            <span id="tables-count-badge" class="badge bg-primary rounded-pill position-absolute top-0 start-100 translate-middle"></span>
                        </button>
                        <ul id="tables-dropdown-list" class="dropdown-menu dropdown-menu-end"></ul>
                    </div>
                    <div id="group-management-menu" class="dropdown">
                        <button class="btn btn-light btn-sm" type="button" data-bs-toggle="dropdown" title="Opções do grupo"><i class="bi bi-three-dots-vertical"></i></button>
                        <ul class="dropdown-menu dropdown-menu-end">
                            <li><a class="dropdown-item" id="manage-members-btn" href="#"><i class="bi bi-person-plus-fill me-2"></i>Adicionar Membros</a></li>
                            <li><a class="dropdown-item" id="manage-admins-btn" href="#"><i class="bi bi-person-check-fill me-2"></i>Gerenciar Admins</a></li>
                            <li><hr class="dropdown-divider"></li>
                            <li><a class="dropdown-item text-danger" id="delete-group-btn" href="#"><i class="bi bi-trash-fill me-2"></i>Apagar Grupo</a></li>
                        </ul>
                    </div>
                </div>
            </div>
            <div id="chat-messages" class="card-body overflow-auto d-flex flex-column gap-3 p-3"></div>
            <div class="card-footer p-2">
                <form id="chat-form" class="d-flex align-items-center">
                    <div class="dropdown me-2">
                        <button class="btn btn-outline-secondary" type="button" data-bs-toggle="dropdown"><i class="bi bi-plus-lg"></i></button>
                        <ul class="dropdown-menu">
                            <li><a class="dropdown-item" id="create-table-btn" href="#"><i class="bi bi-table me-2"></i>Criar Planilha</a></li>
                            <li><a class="dropdown-item" href="#" id="create-poll-btn"><i class="bi bi-bar-chart-steps me-2"></i>Criar Enquete</a></li>
                            <li><hr class="dropdown-divider"></li>
                            <li><a class="dropdown-item" href="#" id="start-game-btn"><i class="bi bi-dice-5 me-2"></i>Iniciar Jogo</a></li>
                        </ul>
                    </div>
                    <input type="text" id="chat-input" class="form-control" placeholder="Digite uma mensagem..." autocomplete="off">
                    <button type="submit" class="btn btn-primary ms-2"><i class="bi bi-send-fill"></i></button>
                </form>
            </div>
        </div>
    `;
}

export function getWelcomeViewHTML() {
    return `
        <div id="welcome-view" class="d-flex h-100 justify-content-center align-items-center text-center">
            <div>
                <i class="bi bi-chat-dots-fill display-1 text-muted"></i>
                <h3 class="text-muted mt-3">Selecione um chat para começar</h3>
            </div>
        </div>`;
}

export function renderUserProfile(userData) {
    userProfileDiv.textContent = userData.username;
    userUniqueIdDiv.textContent = `ID #${userData.uniqueId}`;
}

export function renderFriendsList(friends) {
    const targetElement = document.getElementById('users-list');
    if (!targetElement) return;
    targetElement.innerHTML = ''; // Limpa a lista antes de re-renderizar

    if (!friends || friends.length === 0) {
        targetElement.innerHTML = '<li class="list-group-item text-muted"><span class="text">Adicione amigos pelo ID!</span></li>';
        return;
    }

    friends.forEach(friend => {
        if (friend) {
            const li = document.createElement('li');
            li.className = 'list-group-item list-group-item-action';
            li.style.cursor = 'pointer';

            const span = document.createElement('span');
            span.className = 'text';
            span.textContent = `${friend.username} #${friend.uniqueId}`;
            
            li.appendChild(span);

            // Adiciona o listener de forma programática
            li.addEventListener('click', () => {
                window.chatManager.openChat(friend.id, 'user', friend.username);
            });

            targetElement.appendChild(li);
        }
    });
}

export function renderGroupsList(groups) {
    const targetElement = document.getElementById('groups-list');
    if (!targetElement) return;
    targetElement.innerHTML = '';
    if (!groups || groups.length === 0) {
        targetElement.innerHTML = '<li class="list-group-item text-muted"><span class="text">Crie ou entre em um grupo.</span></li>';
        return;
    }
    groups.forEach(group => {
        targetElement.innerHTML += `
            <a href="#" class="list-group-item list-group-item-action d-flex justify-content-between align-items-center" onclick="window.chatManager.openChat('${group.id}', 'group', '${group.name}')">
                <span class="text">${group.name}</span>
                <span class="d-flex align-items-center">
                    <i class="bi bi-people-fill text-muted me-2 compact-hidden"></i><span class="compact-hidden">${group.memberCount}</span>
                    <span class="badge bg-danger rounded-pill ms-2 d-none" id="notify-badge-${group.id}"></span>
                </span>
            </a>`;
    });
}

function renderSingleMessage(msgId, msgData, currentUser, activeChatData) {
    switch (msgData.type) {
        case 'poll': return renderPollMessage(msgId, msgData, currentUser);
        case 'table_link': return renderTableLinkMessage(msgId, msgData);
        default: return renderTextMessage(msgId, msgData, currentUser, activeChatData);
    }
}

function renderTextMessage(msgId, msgData, currentUser, activeChatData) {
    const containerDiv = document.createElement('div');
    const isMine = msgData.senderId === currentUser.id;
    const userIsAdmin = activeChatData?.type === 'group' && activeChatData.details?.admins?.includes(currentUser.id);
    const canDelete = isMine || userIsAdmin;
    const deleteButtonHtml = canDelete ? `<i class="bi bi-trash delete-icon" onclick="window.chatManager.handleDeleteMessage('${msgId}')"></i>` : '';
    const senderNameHtml = (activeChatData?.type === 'group' && !isMine) ? `<div class="sender-name">${msgData.senderName}</div>` : '';
    containerDiv.className = `message-container d-flex align-items-center ${isMine ? 'my-message-container' : 'other-message-container'}`;
    const bubbleDiv = document.createElement('div');
    bubbleDiv.className = `message-bubble ${isMine ? 'my-message-bubble' : 'other-message-bubble'}`;
    bubbleDiv.innerHTML = `${senderNameHtml}<div>${msgData.text}</div>`;
    if (isMine) {
        containerDiv.insertAdjacentHTML('afterbegin', deleteButtonHtml);
        containerDiv.appendChild(bubbleDiv);
    } else {
        containerDiv.appendChild(bubbleDiv);
        containerDiv.insertAdjacentHTML('beforeend', deleteButtonHtml);
    }
    return containerDiv;
}

function renderPollMessage(msgId, msgData, currentUser) {
    const div = document.createElement('div');
    div.className = 'message-container justify-content-center w-100';
    const totalVotes = Object.values(msgData.options).reduce((sum, votersArray) => sum + votersArray.length, 0);
    const hasVoted = Object.values(msgData.options).some(votersArray => votersArray.includes(currentUser.id));
    const optionsHtml = Object.entries(msgData.options).map(([option, votersArray]) => {
        const votes = votersArray.length;
        const percentage = totalVotes > 0 ? (votes / totalVotes) * 100 : 0;
        const votedInThisOption = votersArray.includes(currentUser.id);
        return `
            <div class="poll-option ${votedInThisOption ? 'voted-here' : ''}">
                <div class="d-flex justify-content-between">
                    <span>${option} ${votedInThisOption ? '<i class="bi bi-check-circle-fill text-success"></i>' : ''}</span>
                    <span class="text-muted small">${votes} votos</span>
                </div>
                <div class="progress" style="height: 20px;"><div class="progress-bar" role="progressbar" style="width: ${percentage}%;"></div></div>
                ${!hasVoted ? `<button class="btn btn-sm btn-outline-primary mt-2" onclick="window.chatManager.voteOnPoll('${msgId}', '${option}')">Votar</button>` : ''}
            </div>`;
    }).join('');
    div.innerHTML = `<div class="special-message-card w-100">
            <h6 class="card-title fw-bold">${msgData.question}</h6>
            <p class="card-subtitle mb-2 text-muted small">Enviada por: ${msgData.senderName}</p>
            <div class="d-flex flex-column gap-2">${optionsHtml}</div>
            <p class="card-text text-center mt-2 small text-muted">${totalVotes} votos no total. ${hasVoted ? 'Você já votou.' : ''}</p>
        </div>`;
    return div;
}

function renderTableLinkMessage(msgId, msgData) {
    const div = document.createElement('div');
    div.className = 'message-container justify-content-center w-100';
    div.innerHTML = `
        <div class="special-message-card w-100 text-center">
            <p class="mb-2"><i class="bi bi-table fs-4"></i></p>
            <h6 class="card-title fw-bold">Planilha: ${msgData.title}</h6>
            <p class="card-subtitle mb-2 text-muted small">Criada por: ${msgData.senderName}</p>
            <a href="table.html?id=${msgData.tableId}" class="btn btn-primary mt-2" target="_blank" rel="noopener noreferrer">Abrir Planilha</a>
        </div>`;
    return div;
}

export function renderMessages(messages, currentUser, activeChatData) {
    const chatMessagesContainer = document.getElementById('chat-messages');
    if (!chatMessagesContainer) return;
    chatMessagesContainer.innerHTML = '';
    messages.forEach(msg => {
        chatMessagesContainer.appendChild(renderSingleMessage(msg.id, msg.data, currentUser, activeChatData));
    });
    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
}

export function renderTablesDropdown(tableLinks) {
    const tablesDropdownList = document.getElementById('tables-dropdown-list');
    const tablesCountBadge = document.getElementById('tables-count-badge');
    if (!tablesDropdownList || !tablesCountBadge) return;
    const count = tableLinks.length;
    tablesCountBadge.textContent = count > 0 ? count : '';
    tablesCountBadge.classList.toggle('d-none', count === 0);
    if (count === 0) {
        tablesDropdownList.innerHTML = '<li><p class="dropdown-item text-muted small">Nenhuma planilha neste grupo.</p></li>';
        return;
    }
    tablesDropdownList.innerHTML = tableLinks.map(link => `
        <li>
            <a class="dropdown-item d-flex justify-content-between align-items-center" href="table.html?id=${link.tableId}" target="_blank">
                <span>${link.title}</span><i class="bi bi-box-arrow-up-right text-muted small"></i>
            </a>
        </li>`).join('');
}