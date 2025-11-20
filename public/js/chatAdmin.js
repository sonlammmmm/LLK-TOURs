/* eslint-disable */
const socket = io();

const chatBox = document.getElementById('chat-box');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const userList = document.getElementById('user-list');
const searchInput = document.getElementById('user-search');
const partnerAvatar = document.getElementById('active-user-avatar');
const partnerName = document.getElementById('active-user-name');
const partnerStatus = document.getElementById('active-user-status');
const statActive = document.getElementById('chat-stat-active');
const statNew = document.getElementById('chat-stat-new');
const statPending = document.getElementById('chat-stat-pending');
const statTimestamp = document.getElementById('chat-stat-timestamp');

// Pagination state
let currentPage = 1;
let isLoading = false;
let hasMore = true;
const ROOM_LIMIT = 6;
const PRIORITY_THRESHOLD = 5;

// LocalStorage keys
const LS_KEY = 'LLK_ADMINCHAT_CURRENT_USER';
const HISTORY_KEY = 'LLK_ADMINCHAT_HISTORY';

const getAvatarSrc = (user) =>
  user && user.photo ? `/img/users/${user.photo}` : '/img/users/default.jpg';

// Maps lưu trạng thái
const usersMap = new Map();
const unreadCount = new Map();
const renderedMsgKeys = new Set();
const seenMessageKeys = new Set();

const makeMsgKey = (m) =>
  `${m.senderId}|${m.receiverId}|${m.message || m.content}|${new Date(
    m.createdAt || Date.now()
  ).getTime()}`;

// Đăng ký admin vào socket
if (window.userId) {
  const registerAdmin = () => socket.emit('register', { userId: window.userId, role: 'admin' });
  if (socket.connected) registerAdmin();
  socket.on('connect', registerAdmin);
}

// ========== HIỂN THỊ TIN NHẮN ==========
function displayMessage(msg) {
  const wrapper = document.createElement('div');
  wrapper.classList.add('admin-chat-message');
  if (msg.role === 'admin' || msg.senderId === window.userId) {
    wrapper.classList.add('admin-chat-message--mine');
  }

  const header = document.createElement('div');
  header.className = 'admin-chat-message__header';

  const name = document.createElement('strong');
  name.textContent =
    msg.senderName || (msg.role === 'admin' ? 'Admin' : msg.receiverName || 'Người dùng');

  const timeEl = document.createElement('span');
  timeEl.className = 'admin-chat-message__time';
  timeEl.textContent = new Date(msg.createdAt || Date.now()).toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit'
  });

  header.appendChild(name);
  header.appendChild(timeEl);

  const content = document.createElement('p');
  content.className = 'admin-chat-message__content';
  content.textContent = msg.message || msg.content || '';

  wrapper.appendChild(header);
  wrapper.appendChild(content);
  chatBox.appendChild(wrapper);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function safeDisplayMessage(msg) {
  const k = makeMsgKey(msg);
  if (renderedMsgKeys.has(k)) return;
  renderedMsgKeys.add(k);
  const empty = chatBox.querySelector('.admin-chat-empty');
  if (empty) empty.remove();
  displayMessage(msg);
}

// ========== QUẢN LÝ USER LIST ==========
function updateUnreadBadge(userId) {
  const count = unreadCount.get(userId) || 0;
  const li = usersMap.get(userId);
  if (!li) return;

  let badge = li.querySelector('.admin-chat-room__badge');
  if (count > 0) {
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'admin-chat-room__badge';
      li.appendChild(badge);
    }
    badge.textContent = count > 99 ? '99+' : count;
  } else if (badge) {
    badge.remove();
  }
  updatePriorityIndicator(userId);
}

function updatePriorityIndicator(userId) {
  const li = usersMap.get(userId);
  if (!li) return;
  const count = unreadCount.get(userId) || 0;
  const existing = li.querySelector('.admin-chat-room__priority');
  if (count >= PRIORITY_THRESHOLD) {
    if (!existing) {
      const badge = document.createElement('span');
      badge.className = 'admin-chat-room__priority';
      badge.textContent = 'Ưu tiên';
      li.appendChild(badge);
    }
  } else if (existing) {
    existing.remove();
  }
}

function appendUserToList(user, prepend = false) {
  if (usersMap.has(user._id)) {
    const existingLi = usersMap.get(user._id);
    const lastEl = existingLi.querySelector('.admin-chat-room__last');
    if (lastEl) lastEl.textContent = user.lastMessage || 'Tin nhắn mới';
    if (user.photo) existingLi.dataset.avatar = getAvatarSrc(user);
    if (user.email) existingLi.dataset.email = user.email;
    if (prepend && userList.firstChild !== existingLi) {
      userList.prepend(existingLi);
    }
    return;
  }

  const avatar = getAvatarSrc(user);
  const li = document.createElement('li');
  li.className = 'admin-chat-room';
  li.dataset.userid = user._id;
  li.dataset.username = user.name;
  li.dataset.avatar = avatar;
  li.dataset.email = user.email || '';
  li.innerHTML = `
    <div class="admin-chat-room__info">
      <img class="admin-chat-room__avatar" src="${avatar}" alt="${user.name}">
      <div class="admin-chat-room__texts">
        <span class="admin-chat-room__name">${user.name}</span>
        <small class="admin-chat-room__last">${user.lastMessage || 'Tin nhắn mới'}</small>
      </div>
    </div>
  `;
  if (prepend) userList.prepend(li);
  else userList.appendChild(li);

  usersMap.set(user._id, li);
  updateUnreadBadge(user._id);
  updateStats();
  updatePriorityIndicator(user._id);
}

// ========== LOAD DANH SÁCH USER ==========
async function loadUserList(page = 1) {
  if (isLoading || (!hasMore && page > 1)) return;
  isLoading = true;

  if (page > 1) {
    const loading = document.createElement('li');
    loading.className = 'admin-chat-room--loading';
    loading.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang tải...';
    userList.appendChild(loading);
  }

  try {
    const res = await fetch(
      `/api/v1/messages/users-with-messages?page=${page}&limit=${ROOM_LIMIT}`
    );
    const data = await res.json();

    document.querySelectorAll('.admin-chat-room--loading').forEach((n) => n.remove());
    if (!data.data || data.data.users.length === 0) {
      if (page === 1)
        userList.innerHTML =
          '<li class="admin-chat-room--empty">Chưa có cuộc trò chuyện nào</li>';
      hasMore = false;
      updateStats();
      return;
    }

    userList.querySelectorAll('.admin-chat-room--empty').forEach((el) => el.remove());

    const limited = data.data.users.slice(0, ROOM_LIMIT);
    limited.forEach((user) => appendUserToList(user, false));

    hasMore = data.data.pagination.hasMore;
    currentPage = page;
  } catch (e) {
    console.error('Không thể tải danh sách:', e);
  } finally {
    isLoading = false;
    updateTimestamp();
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
        .filter(Boolean)
        .slice(0, ROOM_LIMIT);
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
  updateStats();
  updateTimestamp();
}
bootstrap();

function updateStats() {
  if (statActive) statActive.textContent = usersMap.size;
  const unreadTotal = Array.from(unreadCount.values()).reduce((sum, val) => sum + val, 0);
  if (statNew) statNew.textContent = unreadTotal;
  const pendingRooms = Array.from(unreadCount.values()).filter((val) => val > 0).length;
  if (statPending) statPending.textContent = pendingRooms;
}

function updateTimestamp() {
  if (!statTimestamp) return;
  const now = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  statTimestamp.textContent = `Cập nhật ${now}`;
}

// ========== MỞ PHÒNG CHAT ==========
async function openUserRoom(li) {
  document
    .querySelectorAll('.admin-chat-room')
    .forEach((el) => el.classList.remove('admin-chat-room--active'));
  li.classList.add('admin-chat-room--active');

  const userId = li.dataset.userid;
  const userName = li.dataset.username;
  const userAvatar = li.dataset.avatar || '/img/users/default.jpg';

  if (partnerAvatar) partnerAvatar.src = userAvatar;
  if (partnerName) partnerName.textContent = userName;
  if (partnerStatus) partnerStatus.textContent = `Đang trò chuyện với ${userName}`;

  localStorage.setItem(LS_KEY, userId);

  // Lưu vào lịch sử localStorage
  let history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  history = [userId, ...history.filter((id) => id !== userId)].slice(0, ROOM_LIMIT);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));

  unreadCount.set(userId, 0);
  updateUnreadBadge(userId);
  updateStats();

  chatBox.innerHTML = '<div class="admin-chat-loading">Đang tải lịch sử chat...</div>';
  socket.emit('joinUserRoom', { userId });

  try {
    const res = await fetch(`/api/v1/messages/history/${userId}`);
    const data = await res.json();

    chatBox.innerHTML = '';
    renderedMsgKeys.clear();

    if (!data.data || data.data.messages.length === 0) {
      chatBox.innerHTML = '<div class="admin-chat-empty">Chưa có tin nhắn nào</div>';
      if (partnerStatus) partnerStatus.textContent = `Chưa có tin nhắn với ${userName}`;
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
    if (partnerStatus) {
      partnerStatus.textContent = `Đang trao đổi (${data.data.messages.length} tin nhắn)`;
    }
  } catch (e) {
    console.error('Lỗi tải lịch sử chat:', e);
    chatBox.innerHTML = '<div class="admin-chat-error">Không thể tải lịch sử chat</div>';
    if (partnerStatus) partnerStatus.textContent = 'Không thể tải lịch sử chat';
  }
}

// ========== SỰ KIỆN ==========
userList.addEventListener('click', (e) => {
  const li = e.target.closest('.admin-chat-room');
  if (!li) return;
  openUserRoom(li);
});

chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const message = chatInput.value.trim();
  if (!message) return;
  const active = document.querySelector('.admin-chat-room.admin-chat-room--active');
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
  appendUserToList({ _id: receiverId, name: receiverName, lastMessage: message }, true);
  chatInput.value = '';
});

// ========== SOCKET REALTIME ==========
socket.on('newMessage', (msg) => {
  const msgKey = makeMsgKey(msg);
  if (seenMessageKeys.has(msgKey)) return;
  seenMessageKeys.add(msgKey);
  // Từ nay server broadcast vào phòng 'admins', nên mọi tin do user gửi đều tới đây
  if (msg.role === 'user') {
    appendUserToList(
      { _id: msg.senderId, name: msg.senderName, lastMessage: msg.message || msg.content },
      true
    );

    // Lưu lịch sử
    let history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    history = [msg.senderId, ...history.filter((id) => id !== msg.senderId)].slice(
      0,
      ROOM_LIMIT
    );
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));

    if (msg.senderId !== localStorage.getItem(LS_KEY)) {
      const count = unreadCount.get(msg.senderId) || 0;
      unreadCount.set(msg.senderId, count + 1);
      updateUnreadBadge(msg.senderId);
    }
  } else if (msg.role === 'admin') {
    appendUserToList(
      { _id: msg.receiverId, name: msg.receiverName, lastMessage: msg.message || msg.content },
      true
    );
  }

  const inCurrent =
    msg.senderId === localStorage.getItem(LS_KEY) ||
    msg.receiverId === localStorage.getItem(LS_KEY);
  if (inCurrent) {
    const empty = chatBox.querySelector('.admin-chat-empty');
    if (empty) empty.remove();
    safeDisplayMessage(msg);
  }
  updateStats();
  updateTimestamp();
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
    unreadCount.clear();
    updateStats();
    loadUserList(1);
    return;
  }

  searchTimeout = setTimeout(async () => {
    userList.innerHTML =
      '<li class="admin-chat-room--loading"><i class="fa-solid fa-spinner fa-spin"></i> Đang tìm...</li>';
    try {
      const res = await fetch(`/api/v1/messages/search-users?q=${encodeURIComponent(keyword)}`);
      const data = await res.json();
      userList.innerHTML = '';
      usersMap.clear();
      unreadCount.clear();
      if (!data.data || data.data.users.length === 0) {
        userList.innerHTML = '<li class="admin-chat-room--empty">Không tìm thấy người dùng</li>';
        updateStats();
        updateTimestamp();
        return;
      }
      data.data.users.forEach((u) => appendUserToList(u, false));
      updateTimestamp();
    } catch {
      userList.innerHTML = '<li class="admin-chat-room--empty">Lỗi tìm kiếm</li>';
      updateTimestamp();
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
