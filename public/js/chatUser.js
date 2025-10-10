/* eslint-disable */
const socket = io();
const chatBox = document.getElementById('chat-box');
const chatForm = document.getElementById('chat-user-form');
const chatInput = document.getElementById('chat-user-input');

const adminId = window.adminId;
const adminName = window.adminName || 'Admin';

// Đăng ký user vào socket
socket.on('connect', () => {
  socket.emit('register', { userId: window.userId, role: 'user' });
});

// Hiển thị bong bóng chat
function displayMessage(msg) {
  const div = document.createElement('div');
  div.className = 'llk-chat-message';
  if (msg.role === 'user' && msg.senderId === window.userId) {
    div.classList.add('mine');
  }

  const time = new Date(msg.createdAt || Date.now()).toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit'
  });
  
  div.innerHTML = `
    <div class="llk-chat-message__header">
      <strong>${msg.senderName}</strong>
      <span class="llk-chat-message__time">${time}</span>
    </div>
    <div class="llk-chat-message__content">${msg.message || msg.content}</div>
  `;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// Load lịch sử có sẵn server render
window.addEventListener('DOMContentLoaded', () => {
  if (window.chatMessages && window.chatMessages.length > 0) {
    window.chatMessages.forEach((m) =>
      displayMessage({
        senderId: m.sender,
        senderName: m.senderName,
        message: m.content,
        role: m.role,
        createdAt: m.createdAt
      })
    );
  } else {
    chatBox.innerHTML = '<div class="llk-chat-empty">Bắt đầu cuộc trò chuyện với Admin</div>';
  }
});

// Gửi tin
chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const message = chatInput.value.trim();
  if (!message) return;

  socket.emit('chatMessage', {
    senderId: window.userId,
    senderName: window.userName,
    receiverId: adminId,
    receiverName: adminName,
    message,
    role: 'user'
  });

  chatInput.value = '';
});

// Nhận tin realtime (lọc theo user hiện tại)
socket.on('newMessage', (msg) => {
  if (msg.senderId === window.userId || msg.receiverId === window.userId) {
    const empty = chatBox.querySelector('.llk-chat-empty');
    if (empty) empty.remove();
    displayMessage(msg);
  }
});

// Xử lý lỗi
socket.on('messageError', (d) => {
  alert(d.error || 'Có lỗi khi gửi tin nhắn');
});

socket.on('connect_error', (err) => {
  console.error('Socket connection error:', err);
});