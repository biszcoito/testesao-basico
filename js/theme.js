// --- Seletores e Constantes ---
const body = document.body;
const myMessageColorPicker = document.getElementById('my-message-color-picker');
const otherMessageColorPicker = document.getElementById('other-message-color-picker'); // NOVO
const saveSettingsBtn = document.getElementById('save-settings-btn');
const themeSelector = document.getElementById('theme-selector');
const gradientButtons = document.querySelectorAll('.gradient-preset');
const myMessagePreview = document.getElementById('my-message-preview');

// --- Preferências Padrão ---
const defaultSettings = {
    theme: 'light',
    myMessageBg: '#0d6efd',
    otherMessageBg: '#e9ecef', // NOVO
};

let currentSettings = {};

// --- Funções Principais ---

export function loadThemeSettings() {
    const savedSettings = JSON.parse(localStorage.getItem('app_settings'));
    currentSettings = { ...defaultSettings, ...savedSettings };
    applyThemeSettings();
    updateSettingsUI();
}

function applyThemeSettings() {
    body.className = '';
    body.classList.add(`theme-${currentSettings.theme}`);
    
    const styleId = 'custom-message-style';
    let styleSheet = document.getElementById(styleId);
    if (!styleSheet) {
        styleSheet = document.createElement('style');
        styleSheet.id = styleId;
        document.head.appendChild(styleSheet);
    }
    // Agora, aplica ambas as cores
    styleSheet.innerHTML = `
        .my-message-bubble { background: ${currentSettings.myMessageBg}; }
        .other-message-bubble { background-color: ${currentSettings.otherMessageBg}; }
    `;
}

function saveThemeSettings() {
    localStorage.setItem('app_settings', JSON.stringify(currentSettings));
    applyThemeSettings();
    alert('Configurações salvas!');
}

function updateSettingsUI() {
    if(!themeSelector || !myMessageColorPicker || !otherMessageColorPicker) return;
    
    themeSelector.value = currentSettings.theme;
    myMessageColorPicker.value = isHexColor(currentSettings.myMessageBg) ? currentSettings.myMessageBg : '#0d6efd';
    otherMessageColorPicker.value = currentSettings.otherMessageBg; // NOVO
    updateMessagePreview();
}

function updateMessagePreview() {
    myMessagePreview.style.background = currentSettings.myMessageBg;
}

function isHexColor(str) {
    return /^#[0-9A-F]{6}$/i.test(str);
}


// --- Event Listeners ---
export function setupThemeEventListeners() {
    if(!themeSelector || !myMessageColorPicker || !otherMessageColorPicker) return;
    
    themeSelector.addEventListener('change', (e) => currentSettings.theme = e.target.value);
    
    myMessageColorPicker.addEventListener('input', (e) => {
        currentSettings.myMessageBg = e.target.value;
        updateMessagePreview();
    });

    otherMessageColorPicker.addEventListener('input', (e) => { // NOVO
        currentSettings.otherMessageBg = e.target.value;
    });

    gradientButtons.forEach(button => {
        button.addEventListener('click', () => {
            currentSettings.myMessageBg = button.style.background;
            updateMessagePreview();
        });
    });

    saveSettingsBtn.addEventListener('click', saveThemeSettings);
}