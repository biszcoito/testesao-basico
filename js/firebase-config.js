import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";

const firebaseConfig = {
  apiKey: "AIzaSyCcPA_05e87XYAbJgzOeHPZz7G8pkuStzo",
  authDomain: "aprendizado-b94c3.firebaseapp.com",
  projectId: "aprendizado-b94c3",
  storageBucket: "aprendizado-b94c3.firebasestorage.app",
  messagingSenderId: "171343477942",
  appId: "1:171343477942:web:ef8748c5967c6519cfba17",
  measurementId: "G-EE1M25QS8D"
};
const app = initializeApp(firebaseConfig);

export { app };