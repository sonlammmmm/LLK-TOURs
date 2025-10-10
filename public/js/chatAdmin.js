/* eslint-disable */
const socket = io();
const chatBox = document.getElementById('chat-box');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const userList = document.getElementById('user-list');

let currentUserId = null;
let currentUserName = null;

// Debug: Log để kiểm tra
console.log('Admin ID:', window.userId);
console.log('Admin Name:', window.userName);

// Kiểm tra dữ liệu trước khi đăng ký
if (!window.userId) {
  console.error('Missing admin ID!');
} else {
  // Đăng ký admin với socket
  socket.emit('register', { 
    userId: window.userId, 
    role: 'admin' 
  });
}

// Hàm hiển thị tin nhắn
function displayMessage(msg) {
  const div = document.createElement('div');
  div.classList.add('chat-message');
  
  // Tin nhắn của admin sẽ có class 'mine'
  if (msg.role === 'admin' || msg.senderId === window.userId) {
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

// Chọn user để chat
userList.addEventListener('click', async e => {
  const userItem = e.target.closest('.user-item');
  if (!userItem) return;

  currentUserId = userItem.dataset.userid;
  currentUserName = userItem.dataset.username;
  
  // Clear chat box
  chatBox.innerHTML = '<div class="chat-loading">Đang tải lịch sử chat...</div>';
  
  // Highlight user đang chọn
  document.querySelectorAll('.user-item').forEach(el => el.classList.remove('active'));
  userItem.classList.add('active');
  
  // Join room của user này
  socket.emit('joinUserRoom', { userId: currentUserId });
  
  // Load lịch sử chat
  try {
    const response = await fetch(`/api/v1/messages/history/${currentUserId}`);
    const data = await response.json();
    
    chatBox.innerHTML = '';
    
    if (data.data.messages.length === 0) {
      chatBox.innerHTML = '<div class="chat-empty">Chưa có tin nhắn nào</div>';
    } else {
      data.data.messages.forEach(msg => {
        displayMessage({
          senderId: msg.sender,
          senderName: msg.senderName,
          message: msg.content,
          role: msg.role,
          createdAt: msg.createdAt
        });
      });
    }
  } catch (err) {
    chatBox.innerHTML = '<div class="chat-error">Không thể tải lịch sử chat</div>';
    console.error('Error loading chat history:', err);
  }
});

// Gửi tin nhắn
chatForm.addEventListener('submit', e => {
  e.preventDefault();
  
  if (!currentUserId) {
    alert('Vui lòng chọn người dùng để chat!');
    return;
  }
  
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
  // Chỉ hiển thị nếu đang chat với user này
  if (msg.senderId === currentUserId || msg.receiverId === currentUserId) {
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