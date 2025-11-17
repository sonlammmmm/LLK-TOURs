/* eslint-disable */
const socket = io();
const chatBox = document.getElementById('chat-box');
const chatForm = document.getElementById('chat-user-form');
const chatInput = document.getElementById('chat-user-input');

if (window.URLSearchParams) {
  const prefillParams = new URLSearchParams(window.location.search);
  const chatPrefill = prefillParams.get('prefill');
  if (chatPrefill && chatInput) {
    chatInput.value = chatPrefill;
    chatInput.focus();
    if (window.history && window.history.replaceState) {
      prefillParams.delete('prefill');
      const newSearch = prefillParams.toString();
      const newUrl = `${window.location.pathname}${newSearch ? `?${newSearch}` : ''}${window.location.hash || ''}`;
      window.history.replaceState({}, '', newUrl);
    }
  }
}

const renderedMsgKeys = new Set();
const renderedDayKeys = new Set();

const adminAvatarMap = window.chatAdminAvatars || {};
const fallbackAdminAvatar =
  window.chatFallbackAdminAvatar || '/img/users/default.jpg';
const userAvatar = window.userAvatar || fallbackAdminAvatar;

const partnerAvatarEl = document.querySelector('.chat-partner__avatar');
const partnerNameEl = document.querySelector('.chat-partner__name');
const partnerStatusEl = document.querySelector('.chat-partner__status');

const partnerState = (() => {
  const base =
    (window.chatPartner && typeof window.chatPartner === 'object'
      ? window.chatPartner
      : null) || {};
  return {
    name: base.name || 'Admin LLK',
    avatar: base.avatar || fallbackAdminAvatar,
    status: base.status || 'Sẵn sàng hỗ trợ'
  };
})();

const renderPartnerState = info => {
  if (partnerAvatarEl && info.avatar) partnerAvatarEl.src = info.avatar;
  if (partnerNameEl && info.name) partnerNameEl.textContent = info.name;
  if (partnerStatusEl && info.status) partnerStatusEl.textContent = info.status;
};

renderPartnerState(partnerState);

const makeMsgKey = msg => {
  const created = new Date(msg.createdAt || Date.now()).getTime();
  return `${msg.senderId}|${msg.receiverId}|${msg.message}|${created}`;
};

socket.on('connect', () => {
  socket.emit('register', { userId: window.userId, role: 'user' });
});

const getDayKey = date => {
  const d = new Date(date);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

const formatDayLabel = date => {
  const target = new Date(date);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const targetKey = getDayKey(target);
  if (targetKey === getDayKey(today)) return 'Hôm nay';
  if (targetKey === getDayKey(yesterday)) return 'Hôm qua';

  return target.toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

const formatTimeLabel = date =>
  new Date(date).toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit'
  });

const ensureDayDivider = date => {
  const key = getDayKey(date);
  if (renderedDayKeys.has(key)) return;

  const divider = document.createElement('div');
  divider.className = 'chat-date-divider';
  divider.dataset.dayKey = key;
  const label = document.createElement('span');
  label.textContent = formatDayLabel(date);
  divider.appendChild(label);
  chatBox.appendChild(divider);
  renderedDayKeys.add(key);
};

const attachAvatar = msg => {
  if (msg.senderAvatar) return msg;
  const enhanced = { ...msg };
  const isUserSender =
    enhanced.senderId === window.userId || enhanced.role === 'user';
  enhanced.senderAvatar = isUserSender
    ? userAvatar
    : adminAvatarMap[enhanced.senderId] || fallbackAdminAvatar;
  return enhanced;
};

const normalizeMessage = msg => {
  const normalized = { ...msg };
  normalized.senderId = normalized.senderId || normalized.sender || '';
  normalized.receiverId = normalized.receiverId || normalized.receiver || '';
  normalized.message = normalized.message || normalized.content || '';
  normalized.createdAt = normalized.createdAt || Date.now();
  normalized.senderName =
    normalized.senderName ||
    (normalized.role === 'user' ? window.userName : 'Admin');
  return attachAvatar(normalized);
};

const updatePartnerFromMessage = msg => {
  if (!msg || !msg.role) return;
  if (msg.role === 'admin') {
    partnerState.name = msg.senderName || 'Admin LLK';
    partnerState.avatar =
      msg.senderAvatar ||
      adminAvatarMap[msg.senderId] ||
      fallbackAdminAvatar;
    partnerState.status = 'Đang trò chuyện cùng bạn';
    renderPartnerState(partnerState);
  } else if (msg.role === 'user') {
    partnerState.status = 'Đang chờ phản hồi';
    renderPartnerState(partnerState);
  }
};

const createMessageElement = msg => {
  const createdAt = new Date(msg.createdAt || Date.now());
  const isMine = msg.senderId === window.userId || msg.role === 'user';
  const wrapper = document.createElement('div');
  wrapper.className = 'chat-message ' + (isMine ? 'chat-message--me' : 'chat-message--admin');

  if (!isMine) {
    const avatar = document.createElement('img');
    avatar.className = 'chat-message__avatar';
    avatar.src = msg.senderAvatar || fallbackAdminAvatar;
    avatar.alt = msg.senderName || 'Admin';
    wrapper.appendChild(avatar);
  }

  const bubble = document.createElement('div');
  bubble.className = 'chat-message__bubble';

  const meta = document.createElement('div');
  meta.className = 'chat-message__meta';

  const nameSpan = document.createElement('span');
  nameSpan.className = 'chat-message__name';
  nameSpan.textContent = msg.senderName || (isMine ? 'Bạn' : 'Admin');

  const timeSpan = document.createElement('span');
  timeSpan.className = 'chat-message__time';
  timeSpan.textContent = formatTimeLabel(createdAt);

  meta.appendChild(nameSpan);
  meta.appendChild(timeSpan);

  const text = document.createElement('p');
  text.className = 'chat-message__text';
  text.textContent = msg.message;

  bubble.appendChild(meta);
  bubble.appendChild(text);

  wrapper.appendChild(bubble);

  return wrapper;
};

const displayMessage = msg => {
  const createdAt = new Date(msg.createdAt || Date.now());
  ensureDayDivider(createdAt);
  const element = createMessageElement(msg);
  chatBox.appendChild(element);
  chatBox.scrollTop = chatBox.scrollHeight;
};

const safeDisplayMessage = rawMsg => {
  const msg = normalizeMessage(rawMsg);
  const key = makeMsgKey(msg);
  if (renderedMsgKeys.has(key)) return;
  renderedMsgKeys.add(key);
  updatePartnerFromMessage(msg);

  const empty = chatBox.querySelector('.chat-panel__empty');
  if (empty) empty.remove();

  displayMessage(msg);
};

(() => {
  const msgs = Array.isArray(window.chatMessages) ? window.chatMessages : [];
  if (msgs.length === 0) return;
  msgs.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  renderedMsgKeys.clear();
  renderedDayKeys.clear();
  chatBox.innerHTML = '';
  msgs.forEach(m =>
    safeDisplayMessage({
      sender: m.sender,
      receiver: m.receiver,
      senderName: m.senderName,
      message: m.content || m.message,
      role: m.role,
      createdAt: m.createdAt,
      senderAvatar: m.senderAvatar
    })
  );
})();

chatForm.addEventListener('submit', e => {
  e.preventDefault();
  const message = chatInput.value.trim();
  if (!message) return;

  socket.emit('chatMessage', {
    senderId: window.userId,
    senderName: window.userName,
    receiverId: window.userId,
    receiverName: 'Admins',
    message,
    role: 'user'
  });
  updatePartnerFromMessage({ role: 'user' });
  chatInput.value = '';
});

socket.on('newMessage', msg => {
  if (msg.senderId === window.userId || msg.receiverId === window.userId) {
    safeDisplayMessage(msg);
  }
});

socket.on('messageError', data =>
  alert(data.error || 'Có lỗi khi gửi tin nhắn')
);
socket.on('connect_error', err =>
  console.error('Socket connection error:', err)
);
