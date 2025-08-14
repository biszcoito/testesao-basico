import * as db from './firestore.js';

// ---- VALIDAÇÃO E INICIALIZAÇÃO ----
const currentUserId = localStorage.getItem('currentUserId');
const tableId = new URLSearchParams(window.location.search).get('id');

if (!currentUserId || !tableId) {
    alert("Informações inválidas. Retornando para a página principal.");
    window.location.href = 'app.html';
}

// ---- SELETORES DO DOM ----
const tableTitleDiv = document.getElementById('table-title');
const tableContainer = document.getElementById('table-container');
const addRowBtn = document.getElementById('add-row-btn');
const addColBtn = document.getElementById('add-col-btn');

let currentTableData = null;

// ===== FUNÇÃO AUXILIAR: CONTADOR DE DIAS =====
function formatDateCountdown(dateString) {
    if (!dateString || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        return { text: '', color: 'text-muted' };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const parts = dateString.split('-');
    const targetDate = new Date(parts[0], parts[1] - 1, parts[2]);
    targetDate.setHours(0, 0, 0, 0);

    const diffTime = targetDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
        return { text: 'Hoje', color: 'text-primary fw-bold' };
    } else if (diffDays > 0) {
        return { text: `Faltam ${diffDays} dia(s)`, color: 'text-success' };
    } else {
        return { text: `Há ${Math.abs(diffDays)} dia(s)`, color: 'text-danger' };
    }
}


// ---- FUNÇÃO AUXILIAR DE RENDERIZAÇÃO DE CÉLULA (ATUALIZADA) ----
function renderCell(cellData, header, rowIndex) {
    const td = document.createElement('td');

    switch (header.type) {
        case 'checkbox': {
            const wrapper = document.createElement('div');
            wrapper.className = 'd-flex justify-content-center align-items-center h-100';
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.className = 'form-check-input';
            input.checked = cellData?.value === true;
            input.onchange = () => updateCell(rowIndex, header.id, input.checked);
            wrapper.appendChild(input);
            td.appendChild(wrapper);
            break;
        }
        case 'date': {
            const container = document.createElement('div');
            container.className = 'd-flex flex-column';

            const input = document.createElement('input');
            input.type = 'date';
            input.className = 'form-control form-control-sm';
            input.value = cellData?.value || '';
            
            const countdownSpan = document.createElement('span');
            countdownSpan.className = 'small text-nowrap';
            
            const updateCountdown = () => {
                const countdown = formatDateCountdown(input.value);
                countdownSpan.textContent = countdown.text;
                countdownSpan.className = `small text-nowrap ${countdown.color}`;
            };
            
            input.onblur = () => {
                updateCell(rowIndex, header.id, input.value);
            };
            input.onchange = updateCountdown;
            
            container.appendChild(input);
            container.appendChild(countdownSpan);
            td.appendChild(container);
            updateCountdown();
            break;
        }
        case 'select': {
            const select = document.createElement('select');
            select.className = 'form-select form-select-sm';
            select.add(new Option('Selecione...', '')); // Adiciona uma opção vazia
            if(header.options && Array.isArray(header.options)) {
                header.options.forEach(opt => {
                    const option = new Option(opt, opt, opt === cellData?.value, opt === cellData?.value);
                    select.add(option);
                });
            }
            select.value = cellData?.value || '';
            select.onchange = () => updateCell(rowIndex, header.id, select.value);
            td.appendChild(select);
            break;
        }
        default: // 'text'
            td.contentEditable = true;
            td.innerText = cellData?.value || '';
            td.onblur = (e) => updateCell(rowIndex, header.id, e.target.innerText.trim());
            break;
    }
    return td;
}

// ---- LÓGICA DE RENDERIZAÇÃO DA TABELA PRINCIPAL ----
function renderTable(tableData) {
    tableTitleDiv.textContent = tableData.title;

    const table = document.createElement('table');
    table.className = 'table table-bordered table-hover align-middle'; // `align-middle` melhora a aparência
    
    // Cabeçalhos
    const thead = table.createTHead();
    const headerRow = thead.insertRow();
    tableData.headers.forEach(header => {
        const th = document.createElement('th');
        th.innerText = header.name;
        headerRow.appendChild(th);
    });
    const actionTh = document.createElement('th');
    actionTh.innerText = "Ações";
    actionTh.style.width = "1%"; // Reduz a largura da coluna de ações
    headerRow.appendChild(actionTh);
    
    // Linhas
    const tbody = table.createTBody();
    if (tableData.rows && Array.isArray(tableData.rows)) {
        tableData.rows.forEach((rowObject, rowIndex) => {
            const row = tbody.insertRow();
            tableData.headers.forEach(header => {
                const cellData = rowObject[header.id];
                const cellElement = renderCell(cellData, header, rowIndex);
                row.appendChild(cellElement);
            });
    
            const actionCell = row.insertCell();
            actionCell.innerHTML = `<button class="btn btn-sm btn-outline-danger border-0"><i class="bi bi-trash"></i></button>`;
            actionCell.firstChild.onclick = () => deleteRow(rowIndex);
        });
    }

    tableContainer.innerHTML = '';
    tableContainer.appendChild(table);
}

// ---- FUNÇÕES DE ATUALIZAÇÃO NO FIRESTORE ----
async function updateCell(rowIndex, headerId, newValue) {
    if (currentTableData.rows[rowIndex]?.[headerId]?.value === newValue) return;

    const newRows = [...currentTableData.rows];
    if (!newRows[rowIndex][headerId]) {
        newRows[rowIndex][headerId] = {};
    }
    newRows[rowIndex][headerId].value = newValue;

    await db.updateTable(tableId, { rows: newRows });
}

async function deleteRow(rowIndex) {
    if (!confirm("Tem certeza que quer apagar esta linha?")) return;
    const newRows = [...currentTableData.rows];
    newRows.splice(rowIndex, 1);
    await db.updateTable(tableId, { rows: newRows });
}

// ---- EVENT LISTENERS DOS BOTÕES ----

addRowBtn.addEventListener('click', () => {
    if (!currentTableData) return;
    const newRow = {};
    currentTableData.headers.forEach(header => {
        newRow[header.id] = { value: header.type === 'checkbox' ? false : '' };
    });
    
    const newRows = [...currentTableData.rows, newRow];
    db.updateTable(tableId, { rows: newRows });
});

addColBtn.addEventListener('click', async () => {
    if (!currentTableData) return;
    const newColName = prompt("Digite o nome da nova coluna:");

    if (!newColName || newColName.trim() === '') {
        alert("O nome da coluna não pode ser vazio.");
        return;
    }
    if (currentTableData.headers.some(h => h.name === newColName.trim())) {
        alert("Já existe uma coluna com este nome.");
        return;
    }
    
    const newHeader = {
        name: newColName.trim(),
        type: 'text',
        id: `h${Date.now()}`
    };
    
    const newHeaders = [...currentTableData.headers, newHeader];

    const newRows = currentTableData.rows.map(row => ({
        ...row,
        [newHeader.id]: { value: '' }
    }));

    await db.updateTable(tableId, { headers: newHeaders, rows: newRows });
});


// ---- INICIA A PÁGINA ----
async function initializeTablePage() {
    const userSnap = await db.getUserProfile(currentUserId);
    if (!userSnap.exists()) {
        window.location.href = 'index.html';
        return;
    }
    const userData = userSnap.data();
    document.getElementById('user-profile').textContent = userData.username;
    
    db.listenToTableDetails(tableId, (tableDoc) => {
        if (!tableDoc.exists()) {
            alert("Tabela não encontrada ou foi apagada.");
            window.location.href = 'app.html';
            return;
        }
        currentTableData = tableDoc.data();
        
        if (!currentTableData.rows) {
            currentTableData.rows = [];
        }

        renderTable(currentTableData);
    });
}

initializeTablePage();