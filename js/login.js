import { getFirestore, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { app } from './firebase-config.js';

const db = getFirestore(app);

const loginForm = document.getElementById('login-form');
const emailInput = document.getElementById('email-input');

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = emailInput.value.trim().toLowerCase();

    if (!email) {
        alert("Por favor, digite um e-mail.");
        return;
    }

    try {
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("email", "==", email));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            localStorage.setItem('newUserEmail', email);
            window.location.href = 'create-profile.html';
        } else {
            const userDoc = querySnapshot.docs[0];
            localStorage.setItem('currentUserId', userDoc.id);
            window.location.href = 'app.html';
        }
    } catch (error) {
        console.error("Erro no login: ", error);
        alert("Ocorreu um erro. Tente novamente.");
    }
});