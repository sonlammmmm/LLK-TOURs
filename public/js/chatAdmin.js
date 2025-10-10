/* eslint-disable */
const socket = io();

const chatBox = document.getElementById('chat-box');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const userList = document.getElementById('user-list');

let currentUserId = null;
let currentUserName = null;

// Pagination state
let currentPage = 1;
let isLoading = false;
let hasMore = true;

// Chống render trùng tin nhắn
const renderedMsgKeys = new Set();
const makeMsgKey = (m) =>
  `${m.senderId}|${m.receiverId}|${m.message || m.content}|${new Date(m.createdAt || Date.now()).getTime()}`;

function safeDisplayMessage(msg) {
  const k = makeMsgKey(msg);
  if (renderedMsgKeys.has(k)) return;
  renderedMsgKeys.add(k);
  displayMessage(msg);
}

// Đăng ký admin vào socket
if (window.userId) {
  socket.emit('register', { userId: window.userId, role: 'admin' });
}

// Hiển thị bong bóng chat
function displayMessage(msg) {
  const div = document.createElement('div');
  div.classList.add('llk-chat-message');
  if (msg.role === 'admin' || msg.senderId === window.userId) {
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

// ===== Quản lý danh sách room và unread count =====
const usersMap = new Map();
const unreadCount = new Map();

function updateUnreadBadge(userId) {
  const count = unreadCount.get(userId) || 0;
  const li = usersMap.get(userId);
  if (!li) return;

  let badge = li.querySelector('.llk-unread-badge');
  
  if (count > 0) {
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'llk-unread-badge';
      li.appendChild(badge);
    }
    badge.textContent = count > 99 ? '99+' : count;
  } else {
    if (badge) badge.remove();
  }
}

function appendUserToList(user, prepend = false) {
  // Nếu đã tồn tại → update thông tin
  if (usersMap.has(user._id)) {
    const existingLi = usersMap.get(user._id);
    const nameEl = existingLi.querySelector('.llk-user-name');
    const lastEl = existingLi.querySelector('.llk-user-last');
    
    if (nameEl) nameEl.textContent = user.name;
    if (lastEl) lastEl.textContent = user.lastMessage || 'Tin nhắn mới';
    
    // Nếu có tin mới → đẩy lên đầu
    if (prepend && userList.firstChild !== existingLi) {
      userList.prepend(existingLi);
    }
    return;
  }

  const li = document.createElement('li');
  li.className = 'llk-user-item';
  li.dataset.userid = user._id;
  li.dataset.username = user.name;
  li.innerHTML = `
    <div class="llk-user-info">
      <i class="fa-solid fa-user-circle"></i>
      <div class="llk-user-texts">
        <span class="llk-user-name">${user.name}</span>
        <small class="llk-user-last">${user.lastMessage || 'Tin nhắn mới'}</small>
      </div>
    </div>
  `;

  if (prepend) {
    userList.prepend(li);
  } else {
    // Xóa loading indicator nếu có
    const loading = userList.querySelector('.llk-user-loading');
    if (loading) {
      userList.insertBefore(li, loading);
    } else {
      userList.appendChild(li);
    }
  }
  
  usersMap.set(user._id, li);
  updateUnreadBadge(user._id);
}

// Load user list với pagination
async function loadUserList(page = 1) {
  if (isLoading || (!hasMore && page > 1)) return;
  
  isLoading = true;
  
  // Hiển thị loading indicator nếu load thêm
  if (page > 1) {
    let loading = userList.querySelector('.llk-user-loading');
    if (!loading) {
      loading = document.createElement('li');
      loading.className = 'llk-user-loading';
      loading.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang tải...';
      userList.appendChild(loading);
    }
  }

  try {
    const res = await fetch(`/api/v1/messages/users-with-messages?page=${page}&limit=8`);
    const data = await res.json();
    
    // Xóa loading indicator
    const loading = userList.querySelector('.llk-user-loading');
    if (loading) loading.remove();
    
    if (page === 1) {
      // Clear list chỉ khi load trang đầu
      const emptyMsg = userList.querySelector('.llk-user-empty');
      if (emptyMsg) emptyMsg.remove();
    }
    
    if (!data.data || data.data.users.length === 0) {
      if (page === 1) {
        userList.innerHTML = '<li class="llk-user-empty">Chưa có cuộc trò chuyện nào</li>';
        hasMore = false;
      }
      return;
    }
    
    // Append users
    data.data.users.forEach(user => appendUserToList(user, false));
    
    // Update pagination state
    hasMore = data.data.pagination.hasMore;
    currentPage = page;
    
  } catch (e) {
    console.error('Không thể tải danh sách chat:', e);
    const loading = userList.querySelector('.llk-user-loading');
    if (loading) loading.remove();
  } finally {
    isLoading = false;
  }
}

// Infinite scroll cho user list
userList.addEventListener('scroll', () => {
  if (isLoading || !hasMore) return;
  
  const scrollTop = userList.scrollTop;
  const scrollHeight = userList.scrollHeight;
  const clientHeight = userList.clientHeight;
  
  // Khi scroll gần đến cuối (còn 50px)
  if (scrollTop + clientHeight >= scrollHeight - 50) {
    loadUserList(currentPage + 1);
  }
});

// ===== LocalStorage để nhớ phòng đang mở =====
const LS_KEY = 'LLK_ADMINCHAT_CURRENT_USER';

async function bootstrap() {
  await loadUserList(1);

  // Ưu tiên mở lại phòng cũ
  const lastUserId = localStorage.getItem(LS_KEY);
  let targetLi = lastUserId && usersMap.get(lastUserId);
  
  // Nếu không có phòng cũ hoặc không tìm thấy → mở phòng đầu
  if (!targetLi) {
    targetLi = userList.querySelector('.llk-user-item');
  }

  if (targetLi) openUserRoom(targetLi);
}
bootstrap();

// Mở 1 phòng chat
async function openUserRoom(li) {
  document.querySelectorAll('.llk-user-item').forEach((el) => el.classList.remove('active'));
  li.classList.add('active');

  currentUserId = li.dataset.userid;
  currentUserName = li.dataset.username;
  localStorage.setItem(LS_KEY, currentUserId);

  // Reset unread count khi mở room
  unreadCount.set(currentUserId, 0);
  updateUnreadBadge(currentUserId);

  chatBox.innerHTML = '<div class="llk-chat-loading">Đang tải lịch sử chat...</div>';

  socket.emit('joinUserRoom', { userId: currentUserId });

  try {
    const res = await fetch(`/api/v1/messages/history/${currentUserId}`);
    const data = await res.json();

    chatBox.innerHTML = '';
    renderedMsgKeys.clear();
    
    if (!data.data || data.data.messages.length === 0) {
      chatBox.innerHTML = '<div class="llk-chat-empty">Chưa có tin nhắn nào</div>';
      return;
    }

    data.data.messages.forEach((m) =>
      displayMessage({
        senderId: m.sender,
        senderName: m.senderName,
        message: m.content,
        role: m.role,
        createdAt: m.createdAt
      })
    );
  } catch (e) {
    console.error('Lỗi tải lịch sử chat:', e);
    chatBox.innerHTML = '<div class="llk-chat-error">Không thể tải lịch sử chat</div>';
  }
}

// Click chọn user trong danh sách
userList.addEventListener('click', (e) => {
  const li = e.target.closest('.llk-user-item');
  if (!li) return;
  openUserRoom(li);
});

// Gửi tin nhắn
chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!currentUserId) return alert('Vui lòng chọn người dùng để chat!');

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
socket.on('newMessage', (msg) => {
  // Nếu tin gửi đến admin từ user → thêm/update vào list & đẩy lên đầu
  if (msg.receiverId === window.userId && msg.role === 'user') {
    appendUserToList({
      _id: msg.senderId,
      name: msg.senderName,
      lastMessage: msg.message
    }, true); // prepend = true
    
    // Tăng unread count nếu không phải room hiện tại
    if (msg.senderId !== currentUserId) {
      const count = unreadCount.get(msg.senderId) || 0;
      unreadCount.set(msg.senderId, count + 1);
      updateUnreadBadge(msg.senderId);
    }
  }

  // Nếu đang ở đúng phòng → hiển thị
  const inCurrent = msg.senderId === currentUserId || msg.receiverId === currentUserId;

  if (inCurrent) {
    const empty = chatBox.querySelector('.llk-chat-empty');
    if (empty) empty.remove();
    safeDisplayMessage(msg);
  }
});

// Lỗi socket
socket.on('messageError', (d) => alert(d.error || 'Có lỗi khi gửi tin nhắn'));
socket.on('connect_error', (err) => console.error('Socket error:', err));