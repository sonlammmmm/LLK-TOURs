/* eslint-disable */
const socket = io();
const chatBox = document.getElementById('chat-box');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const userList = document.getElementById('user-list');

let currentUserId = null;
let currentUserName = null;

// Chọn user để chat
userList.addEventListener('click', e => {
  if (e.target.classList.contains('user-item')) {
    currentUserId = e.target.dataset.userid;
    currentUserName = e.target.dataset.username;
    chatBox.innerHTML = '';
    socket.emit('joinRoom', { room: currentUserId });
    document.querySelectorAll('.user-item').forEach(el => el.classList.remove('active'));
    e.target.classList.add('active');
  }
});

// Gửi tin nhắn
chatForm.addEventListener('submit', e => {
  e.preventDefault();
  if (!currentUserId) return alert('Chọn người dùng để chat!');
  const message = chatInput.value.trim();
  if (!message) return;

  socket.emit('chatMessage', {
    senderId: window.userId,
    senderName: window.userName,
    receiverId: currentUserId,
    receiverName: currentUserName,
    message,
    role: 'admin'
  });
  chatInput.value = '';
});

// Nhận tin nhắn realtime
socket.on('newMessage', msg => {
  if (msg.senderId === currentUserId || msg.receiverId === currentUserId) {
    const div = document.createElement('div');
    div.classList.add('chat-message');
    div.classList.toggle('mine', msg.role === 'admin');
    div.innerHTML = `<strong>${msg.senderName}:</strong> ${msg.message}`;
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
  }
});
