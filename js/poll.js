import * as db from './firestore.js';

// ---- VALIDAÇÃO INICIAL ----
const currentUserId = localStorage.getItem('currentUserId');
const activeGroupId = new URLSearchParams(window.location.search).get('groupId'); 
const activeGroupName = sessionStorage.getItem('activeGroupName');

// Se o usuário não estiver logado ou não tiver um grupo ativo, volta para o app principal.
if (!currentUserId || !activeGroupId) {
    alert("Nenhum grupo selecionado. Voltando para a página principal.");
    window.location.href = 'app.html';
}

// ---- SELETORES DO DOM ----
const pollForm = document.getElementById('poll-form');
const pollQuestionInput = document.getElementById('poll-question');
const pollOptionsContainer = document.getElementById('poll-options-container');
const addOptionBtn = document.getElementById('add-option-btn');

// ---- LÓGICA DA PÁGINA ----
addOptionBtn.addEventListener('click', () => {
    const optionInputs = pollOptionsContainer.querySelectorAll('.poll-option-input');
    const newOptionDiv = document.createElement('div');
    newOptionDiv.className = 'mb-2 input-group';
    newOptionDiv.innerHTML = `
        <input type="text" class="form-control poll-option-input" placeholder="Opção ${optionInputs.length + 1}" required>
        <button type="button" class="btn btn-outline-danger remove-option-btn"><i class="bi bi-x-lg"></i></button>
    `;
    pollOptionsContainer.appendChild(newOptionDiv);
    newOptionDiv.querySelector('.remove-option-btn').addEventListener('click', () => {
        newOptionDiv.remove();
    });
});

pollForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const question = pollQuestionInput.value.trim();
    const optionInputs = Array.from(pollOptionsContainer.querySelectorAll('.poll-option-input'));
    const options = optionInputs.map(input => input.value.trim()).filter(Boolean);

    if (!question || options.length < 2) {
        alert("A enquete precisa de uma pergunta e pelo menos duas opções válidas.");
        return;
    }
    
    // Converte o array de opções para o formato de mapa exigido pelo Firestore
    const optionsMap = Object.fromEntries(options.map(opt => [opt, []]));

    const userData = await db.getUserProfile(currentUserId);
    if (!userData.exists()) {
        alert("Erro: não foi possível encontrar os dados do usuário.");
        return;
    }

    const pollMessage = {
        type: 'poll',
        senderId: currentUserId,
        senderName: userData.data().username,
        question: question,
        options: optionsMap, // Agora guarda os IDs dos votantes
        timestamp: db.serverTimestamp()
    };
    
    try {
        await db.sendMessage(activeGroupId, pollMessage);
        // Limpa o storage para não reabrir o mesmo grupo
        sessionStorage.removeItem('activeGroupId');
        sessionStorage.removeItem('activeGroupName');
        // Redireciona de volta para o app
        window.location.href = 'app.html';
    } catch (error) {
        console.error("Erro ao criar enquete:", error);
        alert("Ocorreu um erro ao criar a enquete.");
    }
});