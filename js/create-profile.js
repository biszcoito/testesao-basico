import { getFirestore, collection, addDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { app } from './firebase-config.js';

const db = getFirestore(app);

const profileForm = document.getElementById('profile-form');
const usernameInput = document.getElementById('username-input');

const newProfileEmail = localStorage.getItem('newUserEmail');
if (!newProfileEmail) {
    window.location.href = 'index.html';
}

function generateUniqueId() {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

profileForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = usernameInput.value.trim();

    if (!username) {
        alert("Por favor, escolha um nome de usuário.");
        return;
    }

    try {
        const newUser = {
            email: newProfileEmail,
            username: username,
            uniqueId: generateUniqueId(),
            friends: [], // <-- CORREÇÃO: Inicializa a lista de amigos vazia
            profilePictureUrl: "path/to/default/image.png"
        };
        
        const docRef = await addDoc(collection(db, "users"), newUser);
        
        localStorage.setItem('currentUserId', docRef.id);
        localStorage.removeItem('newUserEmail');
        window.location.href = 'app.html';

    } catch (error) {
        console.error("Erro ao criar perfil: ", error);
        alert("Ocorreu um erro ao criar o perfil.");
    }
});