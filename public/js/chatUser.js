/* eslint-disable */
const socket = io();
const chatBtn = document.getElementById('chat-float');
const chatPopup = document.getElementById('chat-popup');
const closeBtn = document.querySelector('.close-btn');
const chatBody = document.getElementById('chat-body');
const chatForm = document.getElementById('chat-user-form');
const chatInput = document.getElementById('chat-user-input');

chatBtn.addEventListener('click', () => {
  chatPopup.classList.toggle('hidden');
  socket.emit('joinRoom', { room: window.userId });
});

closeBtn.addEventListener('click', () => chatPopup.classList.add('hidden'));

chatForm.addEventListener('submit', e => {
  e.preventDefault();
  const message = chatInput.value.trim();
  if (!message) return;

  socket.emit('chatMessage', {
    senderId: window.userId,
    senderName: window.userName,
    receiverId: 'ADMIN', // hoặc gửi broadcast tới admin dashboard
    receiverName: 'Admin',
    message,
    role: 'user'
  });
  chatInput.value = '';
});

socket.on('newMessage', msg => {
  const div = document.createElement('div');
  div.classList.add('chat-message');
  div.classList.toggle('mine', msg.role === 'user' && msg.senderId === window.userId);
  div.innerHTML = `<strong>${msg.senderName}:</strong> ${msg.message}`;
  chatBody.appendChild(div);
  chatBody.scrollTop = chatBody.scrollHeight;
});
