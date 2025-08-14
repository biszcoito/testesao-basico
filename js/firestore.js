import { getFirestore, doc, getDoc, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, getDocs, updateDoc, arrayUnion, where, deleteDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { app } from './firebase-config.js';

// Re-exporta serverTimestamp e arrayUnion para que outros módulos possam usá-los
export { serverTimestamp, arrayUnion }; 

const db = getFirestore(app);

// ---- Listeners (Tempo Real) ----
export const listenToUserProfile = (userId, callback) => onSnapshot(doc(db, "users", userId), callback);
export const listenToUserGroups = (userId, callback, errorCallback) => {
    const q = query(collection(db, "groups"), where('members', 'array-contains', userId), orderBy('createdAt', 'desc'));
    return onSnapshot(q, callback, errorCallback);
};
export const listenToChatMessages = (chatId, callback) => {
    const q = query(collection(db, "chats", chatId, "messages"), orderBy("timestamp", "asc"));
    return onSnapshot(q, callback);
};
export const listenToGroupDetails = (groupId, callback) => onSnapshot(doc(db, "groups", groupId), callback);
export const listenForNotifications = (groupId, lastSeenTime, callback) => {
    const q = query(collection(db, "chats", groupId, "messages"), where("timestamp", ">", lastSeenTime));
    return onSnapshot(q, callback);
};
// ADIÇÃO CRÍTICA: Listener para a página da tabela.
export const listenToTableDetails = (tableId, callback) => onSnapshot(doc(db, "tables", tableId), callback);
export const listenToTableLinks = (chatId, callback) => {
    const q = query(collection(db, "chats", chatId, "messages"), where("type", "==", "table_link"), orderBy("timestamp", "desc"));
    return onSnapshot(q, callback);
};

// ---- Ações de Leitura (Uma Vez) ----
export const getUserProfile = (userId) => getDoc(doc(db, "users", userId));
export const findUserByUniqueId = (uniqueId) => getDocs(query(collection(db, "users"), where("uniqueId", "==", uniqueId)));
export const getMessage = (chatId, messageId) => getDoc(doc(db, "chats", chatId, "messages", messageId));

// ---- Ações de Escrita ----
export const addFriend = (currentUserId, friendId) => updateDoc(doc(db, "users", currentUserId), { friends: arrayUnion(friendId) });
export const createGroup = (groupName, userId) => addDoc(collection(db, "groups"), {groupName, createdBy: userId, members: [userId], admins: [userId], createdAt: serverTimestamp()});
export const updateLastSeen = (userId, groupId) => updateDoc(doc(db, "users", userId), { [`lastSeen.${groupId}`]: serverTimestamp() });
export const sendMessage = (chatId, messageData) => addDoc(collection(db, "chats", chatId, "messages"), messageData);
export const deleteMessage = (chatId, messageId) => deleteDoc(doc(db, "chats", chatId, "messages", messageId));
export const updateGroup = (groupId, data) => updateDoc(doc(db, "groups", groupId), data);
export const deleteGroup = (groupId) => deleteDoc(doc(db, "groups", groupId));
export const updateTable = (tableId, data) => updateDoc(doc(db, "tables", tableId), data);
export const updateMessage = (chatId, messageId, data) => updateDoc(doc(db, "chats", chatId, "messages", messageId), data);

export const createTable = (title, headers, userId) => {
    // Gera IDs únicos para cada cabeçalho
    const headersWithIds = headers.map((header, index) => ({ ...header, id: `h${index + 1}` }));

    // Cria a primeira linha vazia com a estrutura de objeto de célula
    const firstRow = {};
    headersWithIds.forEach(h => {
        firstRow[h.id] = { value: h.type === 'checkbox' ? false : '' };
    });

    return addDoc(collection(db, "tables"), {
        title,
        headers: headersWithIds,
        createdBy: userId,
        rows: [firstRow],
        createdAt: serverTimestamp()
    });
};

// No final das funções de Listeners
export const listenToPosts = (callback) => {
    const q = query(collection(db, "posts"), orderBy("timestamp", "desc"));
    return onSnapshot(q, callback);
};

// No final das funções de Escrita
export const createPost = (userId, username, content) => {
    return addDoc(collection(db, "posts"), {
        authorId: userId,
        authorName: username,
        content: content,
        timestamp: serverTimestamp()
    });
};
// ... (no final do firestore.js)

// ---- Funções de Jogo ----
export const listenToGameSessions = (groupId, callback) => {
    const q = query(collection(db, "game_sessions"), where("groupId", "==", groupId), where("status", "!=", "finished"));
    return onSnapshot(q, callback);
};

export const createGameSession = (gameData) => {
    return addDoc(collection(db, "game_sessions"), gameData);
};

export const getGameSession = (sessionId) => {
    return getDoc(doc(db, "game_sessions", sessionId));
};

export const updateGameSession = (sessionId, data) => {
    return updateDoc(doc(db, "game_sessions", sessionId), data);
};

export const listenToGameSession = (sessionId, callback) => {
    return onSnapshot(doc(db, "game_sessions", sessionId), callback);
};