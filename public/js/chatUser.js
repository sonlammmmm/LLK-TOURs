/* eslint-disable */
const socket = io();
const chatBox = document.getElementById('chat-box');
const chatForm = document.getElementById('chat-user-form');
const chatInput = document.getElementById('chat-user-input');

const renderedMsgKeys = new Set();
const makeMsgKey = (m) =>
  `${m.senderId}|${m.receiverId}|${m.message || m.content}|${new Date(m.createdAt || Date.now()).getTime()}`;

socket.on('connect', () => {
  socket.emit('register', { userId: window.userId, role: 'user' });
});

function displayMessage(msg) {
  const div = document.createElement('div');
  div.className =
    'llk-chat-message' +
    ((msg.role === 'user' && msg.senderId === window.userId) ? ' mine' : '');
  const time = new Date(msg.createdAt || Date.now()).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  div.innerHTML = `
    <div class="llk-chat-message__header">
      <strong>${msg.senderName}</strong>
      <span class="llk-chat-message__time">${time}</span>
    </div>
    <div class="llk-chat-message__content">${msg.message || msg.content}</div>`;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function safeDisplayMessage(msg) {
  const k = makeMsgKey(msg);
  if (renderedMsgKeys.has(k)) return;
  renderedMsgKeys.add(k);
  displayMessage(msg);
}

/* ===== HYDRATE LỊCH SỬ KHI TẢI LẠI TRANG ===== */
(function hydrateHistory() {
  const msgs = Array.isArray(window.chatMessages) ? window.chatMessages : [];
  if (msgs.length === 0) return;
  const empty = chatBox.querySelector('.llk-chat-empty');
  if (empty) empty.remove();
  // đảm bảo thứ tự tăng dần theo createdAt
  msgs.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  renderedMsgKeys.clear();
  msgs.forEach(m =>
    safeDisplayMessage({
      senderId: (m.sender && m.sender._id) ? m.sender._id : ('' + m.sender),
      receiverId: (m.receiver && m.receiver._id) ? m.receiver._id : ('' + m.receiver),
      senderName: m.senderName,
      message: m.content || m.message,
      role: m.role,
      createdAt: m.createdAt
    })
  );
})();

/* ===== GỬI TIN NHẮN ===== */
chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const message = chatInput.value.trim();
  if (!message) return;

  socket.emit('chatMessage', {
    senderId: window.userId,
    senderName: window.userName,
    receiverId: window.userId,   // hội thoại gom theo userId
    receiverName: 'Admins',
    message,
    role: 'user'
  });
  chatInput.value = '';
});

/* ===== NHẬN REALTIME ===== */
socket.on('newMessage', (msg) => {
  if (msg.senderId === window.userId || msg.receiverId === window.userId) {
    const empty = chatBox.querySelector('.llk-chat-empty');
    if (empty) empty.remove();
    safeDisplayMessage(msg);
  }
});

socket.on('messageError', (d) => alert(d.error || 'Có lỗi khi gửi tin nhắn'));
socket.on('connect_error', (err) => console.error('Socket connection error:', err));
