/* eslint-disable */
const socket = io();

const chatBox = document.getElementById('chat-box');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const userList = document.getElementById('user-list');
const searchInput = document.getElementById('user-search');

// Pagination state
let currentPage = 1;
let isLoading = false;
let hasMore = true;

// LocalStorage keys
const LS_KEY = 'LLK_ADMINCHAT_CURRENT_USER';
const HISTORY_KEY = 'LLK_ADMINCHAT_HISTORY';

// Maps lưu trạng thái
const usersMap = new Map();
const unreadCount = new Map();
const renderedMsgKeys = new Set();

const makeMsgKey = (m) =>
  `${m.senderId}|${m.receiverId}|${m.message || m.content}|${new Date(
    m.createdAt || Date.now()
  ).getTime()}`;

// Đăng ký admin vào socket
if (window.userId) {
  socket.emit('register', { userId: window.userId, role: 'admin' });
}

// ========== HIỂN THỊ TIN NHẮN ==========
function displayMessage(msg) {
  const div = document.createElement('div');
  div.classList.add('llk-chat-message');
  // Admin panel: mọi tin nhắn từ phía admin đều là "mine"
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

function safeDisplayMessage(msg) {
  const k = makeMsgKey(msg);
  if (renderedMsgKeys.has(k)) return;
  renderedMsgKeys.add(k);
  displayMessage(msg);
}

// ========== QUẢN LÝ USER LIST ==========
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
  } else if (badge) {
    badge.remove();
  }
}

function appendUserToList(user, prepend = false) {
  if (usersMap.has(user._id)) {
    const existingLi = usersMap.get(user._id);
    const lastEl = existingLi.querySelector('.llk-user-last');
    if (lastEl) lastEl.textContent = user.lastMessage || 'Tin nhắn mới';
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
  if (prepend) userList.prepend(li);
  else userList.appendChild(li);

  usersMap.set(user._id, li);
  updateUnreadBadge(user._id);
}

// ========== LOAD DANH SÁCH USER ==========
async function loadUserList(page = 1) {
  if (isLoading || (!hasMore && page > 1)) return;
  isLoading = true;

  if (page > 1) {
    const loading = document.createElement('li');
    loading.className = 'llk-user-loading';
    loading.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang tải...';
    userList.appendChild(loading);
  }

  try {
    const res = await fetch(`/api/v1/messages/users-with-messages?page=${page}&limit=8`);
    const data = await res.json();

    document.querySelectorAll('.llk-user-loading').forEach((n) => n.remove());
    if (!data.data || data.data.users.length === 0) {
      if (page === 1)
        userList.innerHTML = '<li class="llk-user-empty">Chưa có cuộc trò chuyện nào</li>';
      hasMore = false;
      return;
    }

    userList.querySelectorAll('.llk-user-empty').forEach((el) => el.remove());

    const limited = data.data.users.slice(0, 6);
    limited.forEach((user) => appendUserToList(user, false));

    hasMore = data.data.pagination.hasMore;
    currentPage = page;
  } catch (e) {
    console.error('Không thể tải danh sách:', e);
  } finally {
    isLoading = false;
  }
}

// ========== LƯU & KHÔI PHỤC LỊCH SỬ ==========
async function bootstrap() {
  const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');

  if (history.length > 0) {
    try {
      const res = await fetch(`/api/v1/messages/search-users?q=${history.join(',')}`);
      const data = await res.json();

      const ordered = history
        .map((id) => data.data.users.find((u) => u._id === id))
        .filter(Boolean);
      ordered.forEach((u) => appendUserToList(u, false));
    } catch (err) {
      console.error('Không thể khôi phục danh sách lịch sử:', err);
    }
  } else {
    await loadUserList(1);
  }

  const lastUserId = localStorage.getItem(LS_KEY);
  const targetLi = lastUserId && usersMap.get(lastUserId);
  if (targetLi) openUserRoom(targetLi);
}
bootstrap();

// ========== MỞ PHÒNG CHAT ==========
async function openUserRoom(li) {
  document.querySelectorAll('.llk-user-item').forEach((el) => el.classList.remove('active'));
  li.classList.add('active');

  const userId = li.dataset.userid;
  const userName = li.dataset.username;

  localStorage.setItem(LS_KEY, userId);

  // Lưu vào lịch sử localStorage
  let history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  history = [userId, ...history.filter((id) => id !== userId)].slice(0, 6);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));

  unreadCount.set(userId, 0);
  updateUnreadBadge(userId);

  chatBox.innerHTML = '<div class="llk-chat-loading">Đang tải lịch sử chat...</div>';
  socket.emit('joinUserRoom', { userId });

  try {
    const res = await fetch(`/api/v1/messages/history/${userId}`);
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

// ========== SỰ KIỆN ==========
userList.addEventListener('click', (e) => {
  const li = e.target.closest('.llk-user-item');
  if (!li) return;
  openUserRoom(li);
});

chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const message = chatInput.value.trim();
  if (!message) return;
  const active = document.querySelector('.llk-user-item.active');
  if (!active) return alert('Vui lòng chọn người dùng để chat!');

  const receiverId = active.dataset.userid;
  const receiverName = active.dataset.username;

  socket.emit('chatMessage', {
    senderId: window.userId,
    senderName: window.userName,
    receiverId,          // luôn = userId đang mở
    receiverName,
    message,
    role: 'admin'
  });
  chatInput.value = '';
});

// ========== SOCKET REALTIME ==========
socket.on('newMessage', (msg) => {
  // Từ nay server broadcast vào phòng 'admins', nên mọi tin do user gửi đều tới đây
  if (msg.role === 'user') {
    appendUserToList(
      { _id: msg.senderId, name: msg.senderName, lastMessage: msg.message || msg.content },
      true
    );

    // Lưu lịch sử
    let history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    history = [msg.senderId, ...history.filter((id) => id !== msg.senderId)].slice(0, 6);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));

    if (msg.senderId !== localStorage.getItem(LS_KEY)) {
      const count = unreadCount.get(msg.senderId) || 0;
      unreadCount.set(msg.senderId, count + 1);
      updateUnreadBadge(msg.senderId);
    }
  }

  const inCurrent =
    msg.senderId === localStorage.getItem(LS_KEY) ||
    msg.receiverId === localStorage.getItem(LS_KEY);
  if (inCurrent) {
    const empty = chatBox.querySelector('.llk-chat-empty');
    if (empty) empty.remove();
    safeDisplayMessage(msg);
  }
});

socket.on('messageError', (d) => alert(d.error || 'Có lỗi khi gửi tin nhắn'));
socket.on('connect_error', (err) => console.error('Socket error:', err));

// ========== TÌM KIẾM NGƯỜI DÙNG ==========
let searchTimeout = null;
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimeout);
  const keyword = searchInput.value.trim();

  if (!keyword) {
    userList.innerHTML = '';
    usersMap.clear();
    loadUserList(1);
    return;
  }

  searchTimeout = setTimeout(async () => {
    userList.innerHTML =
      '<li class="llk-user-loading"><i class="fa-solid fa-spinner fa-spin"></i> Đang tìm...</li>';
    try {
      const res = await fetch(`/api/v1/messages/search-users?q=${encodeURIComponent(keyword)}`);
      const data = await res.json();
      userList.innerHTML = '';
      usersMap.clear();
      if (!data.data || data.data.users.length === 0) {
        userList.innerHTML = '<li class="llk-user-empty">Không tìm thấy người dùng</li>';
        return;
      }
      data.data.users.forEach((u) => appendUserToList(u, false));
    } catch {
      userList.innerHTML = '<li class="llk-user-empty">Lỗi tìm kiếm</li>';
    }
  }, 400);
});

// ========== INFINITE SCROLL ==========
userList.addEventListener('scroll', () => {
  if (isLoading || !hasMore) return;
  const scrollBottom = userList.scrollTop + userList.clientHeight;
  if (scrollBottom >= userList.scrollHeight - 50) {
    loadUserList(currentPage + 1);
  }
});
