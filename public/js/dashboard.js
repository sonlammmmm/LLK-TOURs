/* eslint-disable */
document.addEventListener('DOMContentLoaded', () => {
  const TEXT = {
    noData: 'Chưa có dữ liệu',
    ordersRefreshed: 'Đã cập nhật đơn hàng gần nhất.',
    reviewsRefreshed: 'Đã cập nhật danh sách đánh giá.',
    ordersError: 'Không thể cập nhật đơn hàng.',
    reviewsError: 'Không thể cập nhật danh sách đánh giá.',
    reviewUpdateError: 'Không thể cập nhật đánh giá.',
    reviewDeleteError: 'Không thể xóa đánh giá.',
    reviewSaved: 'Đã lưu đánh giá.',
    reviewDeleted: 'Đã xóa đánh giá.',
    reviewHidden: 'Đã ẩn đánh giá.',
    reviewShown: 'Đã hiển thị đánh giá.',
    reviewHideAction: 'Ẩn đánh giá',
    reviewShowAction: 'Hiện đánh giá',
    reviewHiddenLabel: 'Đã ẩn',
    reviewVisibleLabel: 'Đang hiển thị',
    confirmDelete: 'Bạn chắc chắn muốn xóa đánh giá này?',
    fetchError: 'Không thể tải dữ liệu.',
    modalTitlePrefix: 'Đánh giá',
    modalSubtitleSeparator: '•',
    defaultCustomer: 'Khách mới',
    defaultOrderNote: 'Đơn mới'
  };

  const formatMillions = value =>
    value >= 1000000
      ? `${(value / 1000000).toFixed(1)} triệu`
      : value.toLocaleString
      ? value.toLocaleString('vi-VN')
      : value;

  const parseJSONPayload = (source, fallback = []) => {
    const node =
      typeof source === 'string' ? document.getElementById(source) : source;
    if (!node) return fallback;
    try {
      const raw = node.textContent || node.innerText || '';
      return JSON.parse(raw || '[]');
    } catch (error) {
      console.warn('Unable to parse dashboard JSON payload:', error);
      return fallback;
    }
  };

  const monthlyCtx = document.getElementById('monthlyChart')?.getContext('2d');
  const monthlyData = parseJSONPayload('dashboardRevenueData', []);
  let monthlyChartInstance;
  const createMonthlyChart = () => {
    if (!monthlyCtx || !monthlyData.length) return;
    if (monthlyChartInstance) monthlyChartInstance.destroy();
    monthlyChartInstance = new Chart(monthlyCtx, {
      type: 'bar',
      data: {
        labels: monthlyData.map(item => item.month),
        datasets: [
          {
            label: 'Doanh thu (VND)',
            data: monthlyData.map(item => item.revenue),
            backgroundColor: 'rgba(54, 162, 235, 0.5)',
            borderColor: 'rgba(54, 162, 235, 1)',
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: value => formatMillions(Number(value) || 0)
            }
          }
        },
        plugins: {
          title: { display: true, text: 'Doanh thu theo tháng (VND)' },
          legend: { position: 'bottom' }
        }
      }
    });
  };
  createMonthlyChart();

  const dailyCtx = document.getElementById('dailyChart')?.getContext('2d');
  const dailyRevenueByMonth = parseJSONPayload(
    'dashboardDailyRevenueData',
    []
  );
  let dailyChartInstance;
  const createDailyChart = monthIndex => {
    if (!dailyCtx || !dailyRevenueByMonth.length) return;
    const monthData = dailyRevenueByMonth[monthIndex];
    if (!monthData) return;
    if (dailyChartInstance) dailyChartInstance.destroy();
    dailyChartInstance = new Chart(dailyCtx, {
      type: 'line',
      data: {
        labels: monthData.days.map(day => day.day),
        datasets: [
          {
            label: `Doanh thu ${monthData.month} (VND)`,
            data: monthData.days.map(day => day.revenue),
            backgroundColor: 'rgba(255, 99, 132, 0.5)',
            borderColor: 'rgba(255, 99, 132, 1)',
            borderWidth: 1,
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: value => formatMillions(Number(value) || 0)
            }
          }
        },
        plugins: {
          title: {
            display: true,
            text: `Doanh thu theo ngày - ${monthData.month} (VND)`
          },
          legend: { position: 'bottom' }
        }
      }
    });
  };

  const selectMonthElement = document.getElementById('selectMonth');
  const defaultMonthRaw = selectMonthElement
    ? parseInt(selectMonthElement.value, 10)
    : new Date().getMonth();
  const defaultMonthIndex = Number.isNaN(defaultMonthRaw)
    ? 0
    : defaultMonthRaw;
  const initialMonthIndex =
    dailyRevenueByMonth[defaultMonthIndex] != null ? defaultMonthIndex : 0;
  createDailyChart(initialMonthIndex);
  if (selectMonthElement) {
    selectMonthElement.value = initialMonthIndex;
    selectMonthElement.addEventListener('change', function handleMonthChange() {
      const monthIndex = parseInt(this.value, 10);
      if (!Number.isNaN(monthIndex)) {
        createDailyChart(monthIndex);
      }
    });
  }

  const statusCtx = document.getElementById('statusChart')?.getContext('2d');
  const statusData = parseJSONPayload('dashboardStatusData', []);
  let statusChartInstance;
  const createStatusChart = () => {
    if (!statusCtx || !statusData.length) return;
    if (statusChartInstance) statusChartInstance.destroy();
    statusChartInstance = new Chart(statusCtx, {
      type: 'doughnut',
      data: {
        labels: statusData.map(item => item.label),
        datasets: [
          {
            data: statusData.map(item => item.value),
            backgroundColor: ['#22c55e', '#f97316'],
            borderColor: ['#15803d', '#c2410c'],
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' },
          title: { display: true, text: 'Tỷ lệ đơn hàng theo trạng thái' }
        }
      }
    });
  };
  createStatusChart();

  const selectYearElement = document.getElementById('selectYear');
  if (selectYearElement) {
    selectYearElement.addEventListener('change', function handleYearChange() {
      const chosenYear = this.value;
      if (chosenYear) {
        window.location.href = `/admin/dashboard?year=${chosenYear}`;
      }
    });
  }

  const MAX_RECENT_ORDERS = 6;
  const MAX_REVIEW_ITEMS = 8;
  const DEFAULT_AVATAR = '/img/users/default.jpg';

  const ordersRefreshBtn = document.querySelector('[data-orders-refresh]');
  const reviewRefreshBtn = document.querySelector('[data-review-refresh]');
  const recentOrdersList = document.querySelector('[data-recent-orders-list]');
  const reviewGrid = document.querySelector('[data-review-feed]');
  const reviewEmptyMessage = document.querySelector('[data-review-empty]');
  const ordersDataElement = document.getElementById(
    'dashboardRecentOrdersData'
  );
  const reviewsDataElement = document.getElementById(
    'dashboardReviewFeedData'
  );

  const escapeHTML = input => {
    if (typeof input !== 'string') return '';
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  const limitArray = (items, max) => {
    if (!Array.isArray(items)) return [];
    return items.slice(0, max);
  };

  const formatDateLabel = isoString => {
    if (!isoString) return '--';
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return '--';
    return date.toLocaleDateString('vi-VN');
  };

  const normalizeOrder = order => {
    if (!order) return null;
    const id = order.id || order._id;
    if (!id) return null;
    return {
      id: id.toString(),
      customer: order.customer || TEXT.defaultCustomer,
      note: order.note || TEXT.defaultOrderNote,
      amount: order.amount || '',
      status: order.status || ''
    };
  };

  const normalizeReview = review => {
    if (!review) return null;
    const id = review.id || review._id;
    if (!id) return null;
    const avatar =
      review.reviewerAvatar ||
      (review.user && review.user.photo
        ? `/img/users/${review.user.photo}`
        : DEFAULT_AVATAR);
    const parsedRating = Number(review.rating);
    const safeRating = Number.isFinite(parsedRating)
      ? Math.round(parsedRating)
      : 0;
    return {
      id: id.toString(),
      reviewer:
        review.reviewer ||
        (review.user && review.user.name) ||
        'Ẩn danh',
      reviewerAvatar: avatar,
      rating: safeRating,
      content: review.content || review.review || '',
      tourName:
        review.tourName ||
        (review.tour && review.tour.name) ||
        'Tour không xác định',
      isHidden: Boolean(review.isHidden),
      createdAt: review.createdAt || new Date().toISOString()
    };
  };

  let recentOrdersState = recentOrdersList
    ? limitArray(
        parseJSONPayload(ordersDataElement, [])
          .map(normalizeOrder)
          .filter(Boolean),
        MAX_RECENT_ORDERS
      )
    : [];

  let reviewFeedState = reviewGrid
    ? limitArray(
        parseJSONPayload(reviewsDataElement, [])
          .map(normalizeReview)
          .filter(Boolean),
        MAX_REVIEW_ITEMS
      )
    : [];

  const ensureAlertContainer = () =>
    document.querySelector('.alert-container');

  const showInlineAlert = (type, message) => {
    const container = ensureAlertContainer();
    if (!container) return;
    const el = document.createElement('div');
    el.className = `alert alert--${type}`;
    el.innerHTML = `<span class="alert__message">${escapeHTML(
      message
    )}</span>`;
    container.appendChild(el);
    setTimeout(() => {
      el.classList.add('hide');
      setTimeout(() => el.remove(), 400);
    }, 4000);
  };

  const updateReviewEmptyVisibility = () => {
    if (!reviewEmptyMessage) return;
    reviewEmptyMessage.classList.toggle(
      'is-hidden',
      Boolean(reviewFeedState.length)
    );
  };

  const renderRecentOrders = () => {
    if (!recentOrdersList) return;
    if (!recentOrdersState.length) {
      recentOrdersList.innerHTML = `<li><span>${TEXT.noData}</span></li>`;
      return;
    }
    recentOrdersList.innerHTML = recentOrdersState
      .map(
        order => `
          <li data-order-id="${escapeHTML(order.id)}">
            <span>
              <strong>${escapeHTML(order.customer)}</strong><br>
              <small>${escapeHTML(order.note || '')}</small>
            </span>
            <span>
              <strong>${escapeHTML(order.amount || '')}</strong><br>
              <small class="status-label">${escapeHTML(
                order.status || ''
              )}</small>
            </span>
          </li>`
      )
      .join('');
  };

  const renderReviewCards = () => {
    if (!reviewGrid) return;
    updateReviewEmptyVisibility();
    if (!reviewFeedState.length) {
      reviewGrid.innerHTML = '';
      return;
    }
    reviewGrid.innerHTML = reviewFeedState
      .map(review => {
        const ratingClass =
          review.rating >= 4
            ? 'review-card--positive'
            : review.rating <= 2
            ? 'review-card--negative'
            : 'review-card--neutral';
        const statusClass = review.isHidden ? 'is-hidden' : 'is-visible';
        const statusText = review.isHidden
          ? TEXT.reviewHiddenLabel
          : TEXT.reviewVisibleLabel;
        const ratingValue = Number.isFinite(review.rating)
          ? review.rating
          : Number.isFinite(Number(review.rating))
          ? Math.round(Number(review.rating))
          : review.rating || 0;
        return `
          <div class="llk-admin-review-card ${ratingClass}" data-review-card data-review-id="${escapeHTML(
            review.id
          )}" data-review-rating="${escapeHTML(
          String(
            typeof review.rating === 'number'
              ? review.rating
              : review.rating || ''
          )
        )}" data-review-hidden="${review.isHidden}">
            <div class="llk-admin-review-card__header">
              <div class="llk-admin-review-card__reviewer">
                <img src="${escapeHTML(
                  review.reviewerAvatar || DEFAULT_AVATAR
                )}" alt="${escapeHTML(review.reviewer)}" loading="lazy" />
                <div class="llk-admin-review-card__reviewer-info">
                  <strong>${escapeHTML(review.reviewer)}</strong>
                  <span>${escapeHTML(review.tourName)}</span>
                </div>
              </div>
              <span class="llk-admin-review-card__rating">
                <i class="fa-solid fa-star" aria-hidden="true"></i>
                ${escapeHTML(String(ratingValue || 0))}
              </span>
            </div>
            <p class="llk-admin-review-card__content">${escapeHTML(
              review.content
            )}</p>
            <div class="llk-admin-review-card__meta">
              <span>${escapeHTML(formatDateLabel(review.createdAt))}</span>
              <span class="llk-admin-review-card__status ${statusClass}">
                ${escapeHTML(statusText)}
              </span>
            </div>
          </div>`;
      })
      .join('');
  };

  renderRecentOrders();
  renderReviewCards();

  const fetchJSON = async url => {
    const response = await fetch(url, { credentials: 'same-origin' });
    if (!response.ok) {
      let message = TEXT.fetchError;
      try {
        const payload = await response.json();
        message = payload.message || payload.error || message;
      } catch {
        message = response.statusText || message;
      }
      throw new Error(message);
    }
    return response.json();
  };

  const refreshRecentOrders = async showAlert => {
    if (!recentOrdersList) return;
    try {
      const data = await fetchJSON(
        `/api/v1/bookings/recent-feed?limit=${MAX_RECENT_ORDERS}`
      );
      const orders = (data.data && data.data.orders) || [];
      recentOrdersState = limitArray(
        orders.map(normalizeOrder).filter(Boolean),
        MAX_RECENT_ORDERS
      );
      renderRecentOrders();
      if (showAlert) {
        showInlineAlert('success', TEXT.ordersRefreshed);
      }
    } catch (error) {
      console.error('Unable to refresh recent orders:', error);
      if (showAlert) {
        showInlineAlert('error', error.message || TEXT.ordersError);
      }
    }
  };

  const refreshReviewFeed = async showAlert => {
    if (!reviewGrid) return;
    try {
      const data = await fetchJSON(
        `/api/v1/reviews/latest/feed?includeHidden=true&limit=${MAX_REVIEW_ITEMS}`
      );
      const reviews = (data.data && data.data.reviews) || [];
      reviewFeedState = limitArray(
        reviews.map(normalizeReview).filter(Boolean),
        MAX_REVIEW_ITEMS
      );
      renderReviewCards();
      if (showAlert) {
        showInlineAlert('success', TEXT.reviewsRefreshed);
      }
    } catch (error) {
      console.error('Unable to refresh reviews:', error);
      if (showAlert) {
        showInlineAlert('error', error.message || TEXT.reviewsError);
      }
    }
  };

  if (ordersRefreshBtn) {
    ordersRefreshBtn.addEventListener('click', () => {
      ordersRefreshBtn.disabled = true;
      refreshRecentOrders(true).finally(() => {
        ordersRefreshBtn.disabled = false;
      });
    });
  }

  if (reviewRefreshBtn) {
    reviewRefreshBtn.addEventListener('click', () => {
      reviewRefreshBtn.disabled = true;
      refreshReviewFeed(true).finally(() => {
        reviewRefreshBtn.disabled = false;
      });
    });
  }

  if (recentOrdersList) {
    setInterval(() => refreshRecentOrders(false), 60000);
  }
  if (reviewGrid) {
    setInterval(() => refreshReviewFeed(false), 60000);
  }

  const updateReviewState = review => {
    const normalized = normalizeReview(review);
    if (!normalized) return;
    reviewFeedState = limitArray(
      [normalized, ...reviewFeedState.filter(item => item.id !== normalized.id)],
      MAX_REVIEW_ITEMS
    );
    renderReviewCards();
    if (activeReview && activeReview.id === normalized.id) {
      openReviewModal(normalized);
    }
  };

  const removeReviewState = reviewId => {
    if (!reviewId) return;
    reviewFeedState = reviewFeedState.filter(item => item.id !== reviewId);
    renderReviewCards();
    if (activeReview && activeReview.id === reviewId) {
      closeReviewModal();
    }
  };

  const reviewModal = document.querySelector('[data-review-modal]');
  const reviewModalClose = reviewModal?.querySelector(
    '[data-review-modal-close]'
  );
  const reviewModalTitle = reviewModal?.querySelector(
    '[data-review-modal-title]'
  );
  const reviewModalSubtitle = reviewModal?.querySelector(
    '[data-review-modal-subtitle]'
  );
  const reviewForm = reviewModal?.querySelector('[data-review-form]');
  const reviewRatingField = reviewModal?.querySelector('#modalReviewRating');
  const reviewContentField = reviewModal?.querySelector('#modalReviewContent');
  const reviewToggleBtn = reviewModal?.querySelector('[data-review-toggle]');
  const reviewDeleteBtn = reviewModal?.querySelector('[data-review-delete]');
  let activeReview = null;

  const openReviewModal = review => {
    if (!reviewModal || !review) return;
    activeReview = review;
    reviewModal.classList.remove('hidden');
    if (reviewModalTitle) {
      reviewModalTitle.textContent = `${TEXT.modalTitlePrefix} - ${
        review.tourName
      }`;
    }
    if (reviewModalSubtitle) {
      reviewModalSubtitle.textContent = `${review.reviewer} ${TEXT.modalSubtitleSeparator} ${formatDateLabel(
        review.createdAt
      )}`;
    }
    if (reviewRatingField) {
      reviewRatingField.value = review.rating || 5;
    }
    if (reviewContentField) {
      reviewContentField.value = review.content || '';
    }
    if (reviewToggleBtn) {
      reviewToggleBtn.textContent = review.isHidden
        ? TEXT.reviewShowAction
        : TEXT.reviewHideAction;
    }
  };

  const closeReviewModal = () => {
    if (!reviewModal) return;
    reviewModal.classList.add('hidden');
    activeReview = null;
  };

  reviewModalClose?.addEventListener('click', closeReviewModal);
  reviewModal?.addEventListener('click', event => {
    if (event.target === reviewModal) {
      closeReviewModal();
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      closeReviewModal();
    }
  });

  reviewGrid?.addEventListener('click', event => {
    const target = event.target;
    if (!target || typeof target.closest !== 'function') return;
    const card = target.closest('[data-review-card]');
    if (!card) return;
    const reviewId = card.getAttribute('data-review-id');
    if (!reviewId) return;
    const review = reviewFeedState.find(item => item.id === reviewId);
    if (review) {
      openReviewModal(review);
    }
  });

  const extractReviewPayload = data =>
    data?.data?.data || data?.data?.review || data?.review || null;

  reviewForm?.addEventListener('submit', async event => {
    event.preventDefault();
    if (!activeReview) return;
    const payload = {
      rating: Number(reviewRatingField.value) || activeReview.rating,
      review: reviewContentField.value.trim()
    };
    try {
      const response = await fetch(`/api/v1/reviews/${activeReview.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'same-origin'
      });
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.message || TEXT.reviewUpdateError);
      }
      const body = await response.json();
      const updated = extractReviewPayload(body);
      updateReviewState(updated);
      showInlineAlert('success', TEXT.reviewSaved);
    } catch (error) {
      console.error('Unable to update review:', error);
      showInlineAlert('error', error.message || TEXT.reviewUpdateError);
    }
  });

  reviewToggleBtn?.addEventListener('click', async () => {
    if (!activeReview) return;
    const nextState = !activeReview.isHidden;
    try {
      const response = await fetch(`/api/v1/reviews/${activeReview.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isHidden: nextState }),
        credentials: 'same-origin'
      });
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.message || TEXT.reviewUpdateError);
      }
      const body = await response.json();
      const updated = extractReviewPayload(body);
      updateReviewState(updated);
      showInlineAlert(
        'success',
        nextState ? TEXT.reviewHidden : TEXT.reviewShown
      );
    } catch (error) {
      console.error('Unable to toggle review visibility:', error);
      showInlineAlert('error', error.message || TEXT.reviewUpdateError);
    }
  });

  reviewDeleteBtn?.addEventListener('click', async () => {
    if (!activeReview) return;
    const confirmation = window.confirm(TEXT.confirmDelete);
    if (!confirmation) return;
    try {
      const response = await fetch(`/api/v1/reviews/${activeReview.id}`, {
        method: 'DELETE',
        credentials: 'same-origin'
      });
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.message || TEXT.reviewDeleteError);
      }
      removeReviewState(activeReview.id);
      showInlineAlert('success', TEXT.reviewDeleted);
    } catch (error) {
      console.error('Unable to delete review:', error);
      showInlineAlert('error', error.message || TEXT.reviewDeleteError);
    }
  });

  const initDashboardSocket = () => {
    if (
      typeof io === 'undefined' ||
      !window.userRole ||
      window.userRole !== 'admin'
    ) {
      return null;
    }
    const socket = io();
    const register = () => {
      if (window.userId) {
        socket.emit('register', { userId: window.userId, role: 'admin' });
      }
    };
    socket.on('connect', register);
    socket.on('dashboard:orders:new', payload => {
      if (!payload || !payload.order) return;
      const normalized = normalizeOrder(payload.order);
      if (!normalized) return;
      recentOrdersState = limitArray(
        [normalized, ...recentOrdersState.filter(o => o.id !== normalized.id)],
        MAX_RECENT_ORDERS
      );
      renderRecentOrders();
    });
    socket.on('dashboard:reviews:upsert', payload => {
      if (!payload || !payload.review) return;
      updateReviewState(payload.review);
    });
    socket.on('dashboard:reviews:remove', payload => {
      if (!payload || !payload.reviewId) return;
      removeReviewState(payload.reviewId);
    });
    socket.on('connect_error', err =>
      console.error('Dashboard socket error:', err)
    );
    return socket;
  };

  initDashboardSocket();
});
