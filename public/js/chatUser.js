/* eslint-disable */

// Debug: Log để kiểm tra TRƯỚC KHI init socket
console.log('=== CHAT USER DEBUG ===');
console.log('User ID:', window.userId);
console.log('User Name:', window.userName);
console.log('Admin ID:', window.adminId);
console.log('Admin Name:', window.adminName);

if (!window.userId || !window.adminId) {
  alert('Lỗi: Không tìm thấy thông tin user hoặc admin. Vui lòng đăng nhập lại.');
  console.error('Missing required data!');
}

const socket = io();
const chatBox = document.getElementById('chat-box');
const chatForm = document.getElementById('chat-user-form');
const chatInput = document.getElementById('chat-user-input');

const adminId = window.adminId;
const adminName = window.adminName || 'Admin';

// Đăng ký user KHI SOCKET CONNECT THÀNH CÔNG
socket.on('connect', () => {
  console.log('✅ Socket connected:', socket.id);
  console.log('📝 Registering user:', window.userId);
  
  socket.emit('register', { 
    userId: window.userId, 
    role: 'user' 
  });
});

// Hàm hiển thị tin nhắn
function displayMessage(msg) {
  const div = document.createElement('div');
  div.classList.add('chat-message');
  
  // Tin nhắn của user hiện tại sẽ có class 'mine'
  if (msg.role === 'user' && msg.senderId === window.userId) {
    div.classList.add('mine');
  }
  
  const time = new Date(msg.createdAt || Date.now()).toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit'
  });
  
  div.innerHTML = `
    <div class="chat-message__header">
      <strong>${msg.senderName}</strong>
      <span class="chat-message__time">${time}</span>
    </div>
    <div class="chat-message__content">${msg.message || msg.content}</div>
  `;
  
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// Load lịch sử chat khi trang load
window.addEventListener('DOMContentLoaded', () => {
  // Nếu có messages được pass từ server (từ getUserChatView)
  if (window.chatMessages && window.chatMessages.length > 0) {
    window.chatMessages.forEach(msg => {
      displayMessage({
        senderId: msg.sender,
        senderName: msg.senderName,
        message: msg.content,
        role: msg.role,
        createdAt: msg.createdAt
      });
    });
  } else {
    chatBox.innerHTML = '<div class="chat-empty">Bắt đầu cuộc trò chuyện với Admin</div>';
  }
});

// Gửi tin nhắn
chatForm.addEventListener('submit', e => {
  e.preventDefault();
  
  const message = chatInput.value.trim();
  if (!message) return;

  // Validation trước khi gửi
  if (!window.userId || !adminId) {
    alert('Lỗi: Thiếu thông tin user. Vui lòng tải lại trang.');
    console.error('Cannot send message - missing IDs', {
      userId: window.userId,
      adminId: adminId
    });
    return;
  }

  console.log('📤 Sending message:', {
    senderId: window.userId,
    receiverId: adminId,
    message: message
  });

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

// Nhận tin nhắn realtime
socket.on('newMessage', msg => {
  // Chỉ hiển thị tin nhắn liên quan đến user này
  if (msg.senderId === window.userId || msg.receiverId === window.userId) {
    // Xóa message "chưa có tin nhắn" nếu có
    const emptyMsg = chatBox.querySelector('.chat-empty');
    if (emptyMsg) emptyMsg.remove();
    
    displayMessage(msg);
  }
});

// Xử lý lỗi
socket.on('messageError', data => {
  alert(data.error || 'Có lỗi xảy ra khi gửi tin nhắn');
});

socket.on('connect_error', (error) => {
  console.error('Socket connection error:', error);
});