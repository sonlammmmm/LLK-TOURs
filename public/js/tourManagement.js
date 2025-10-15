/* eslint-disable */
import axios from 'axios';
import { showAlert } from './alerts';

export const createTour = async (tourData) => {
  try {
    const url = '/api/v1/tours';
    const res = await axios({
      method: 'POST',
      url,
      data: tourData,
      // KHÔNG set Content-Type; axios sẽ tự set boundary khi data là FormData
    });

    if (res.data.status === 'success') {
      showAlert('success', 'Tour đã được tạo thành công!');
      window.setTimeout(() => {
        location.assign('/admin/tours');
      }, 1500);
    }
  } catch (err) {
    console.error('Error creating tour:', err);
    showAlert('error', err.response ? err.response.data.message : 'Đã xảy ra lỗi khi tạo tour');
  }
};

export const updateTour = async (tourId, tourData) => {
  try {
    const url = `/api/v1/tours/${tourId}`;
    const res = await axios({
      method: 'PATCH',
      url,
      data: tourData,
      // KHÔNG set Content-Type; axios sẽ tự set boundary
    });

    if (res.data.status === 'success') {
      showAlert('success', 'Tour đã được cập nhật thành công!');
      window.setTimeout(() => {
        location.reload();
      }, 1500);
    }
  } catch (err) {
    console.error('Error updating tour:', err);
    showAlert('error', err.response ? err.response.data.message : 'Đã xảy ra lỗi khi cập nhật tour');
  }
};

export const deleteTour = async (tourId) => {
  try {
    const url = `/api/v1/tours/${tourId}`;
    const res = await axios({ method: 'DELETE', url });

    if (res.status === 204) {
      showAlert('success', 'Tour đã được xóa thành công!');
      window.setTimeout(() => {
        location.reload();
      }, 1500);
    }
  } catch (err) {
    showAlert('error', err.response ? err.response.data.message : 'Đã xảy ra lỗi khi xóa tour');
  }
};

// Chuẩn hoá chuỗi "lng, lat" -> [lng, lat]; auto-swap nếu người dùng nhập nhầm (lat, lng)
const parseCoordinates = (coordsStr) => {
  const parts = String(coordsStr || '')
    .split(',')
    .map((s) => Number.parseFloat(s.trim()));

  if (parts.length !== 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) {
    throw new Error('Tọa độ không hợp lệ. Vui lòng nhập theo định dạng: kinh độ, vĩ độ (VD: 106.695, 10.775)');
  }

  let [lng, lat] = parts;

  // Dải Việt Nam: lat 8–24, lng 102–110 → phát hiện đảo chiều
  const inVNLat = (x) => x >= 8 && x <= 24;
  const inVNLng = (x) => x >= 102 && x <= 110;
  if (inVNLat(lng) && inVNLng(lat)) {
    console.warn('Cảnh báo: Có thể bạn đã nhập nhầm (vĩ độ, kinh độ). Đã tự động đổi thành (kinh độ, vĩ độ).');
    [lng, lat] = [lat, lng];
  }

  if (lng < -180 || lng > 180) throw new Error(`Kinh độ không hợp lệ: ${lng}. Kinh độ phải từ -180 đến 180`);
  if (lat < -90 || lat > 90) throw new Error(`Vĩ độ không hợp lệ: ${lat}. Vĩ độ phải từ -90 đến 90`);

  return [lng, lat]; // GeoJSON uses [lng, lat]
};

// Lấy giá trị input theo selector
const getVal = (sel) => {
  const el = document.querySelector(sel);
  return el && el.value != null ? String(el.value).trim() : '';
};

// Tạo element từ HTML string
const elFromHTML = (html) => {
  const div = document.createElement('div');
  div.innerHTML = html.trim();
  return div.firstElementChild;
};

export const handleTourForm = () => {
  const form = document.querySelector('.form-tour');
  if (!form) return;

  const tourIdEl = document.getElementById('tour-id');
  const tourId = tourIdEl ? tourIdEl.value : '';

  const locationsContainer = document.querySelector('.locations-container');
  const btnAddLocation = document.querySelector('.btn-add-location');

  const startDatesContainer = document.querySelector('.start-dates-container');
  const btnAddStartDate = document.querySelector('.btn-add-start-date');

  const guidesContainer = document.querySelector('.guides-container');
  const btnAddGuide = document.querySelector('.btn-add-guide');

  const saveBtn = document.querySelector('.btn-save-tour');

  /* ----- Thêm/Xoá địa điểm ----- */
  if (btnAddLocation && locationsContainer) {
    btnAddLocation.addEventListener('click', () => {
      const idx = locationsContainer.querySelectorAll('.location-item').length;
      const node = elFromHTML(`
        <div class="location-item" data-index="${idx}">
          <button class="location-item__remove" type="button">×</button>
          <div class="form__group">
            <label class="form__label">Mô tả</label>
            <input class="location-description form__input" type="text" required>
          </div>
          <div class="form__group">
            <label class="form__label">Địa chỉ</label>
            <input class="location-address form__input" type="text">
          </div>
          <div class="form__group">
            <label class="form__label">Tọa độ (kinh độ, vĩ độ)</label>
            <input class="location-coordinates form__input" type="text" placeholder="106.695249, 10.775400">
            <small class="form__help">Định dạng: kinh độ, vĩ độ (VD: 106.695, 10.775)</small>
          </div>
          <div class="form__group">
            <label class="form__label">Ngày thứ</label>
            <input class="location-day form__input" type="number" min="1" required>
          </div>
        </div>
      `);
      locationsContainer.insertBefore(node, btnAddLocation);
    });

    locationsContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.location-item__remove');
      if (!btn) return;
      const item = btn.closest('.location-item');
      if (item) item.remove();
    });
  }

  /* ----- Thêm/Xoá start date ----- */
  if (btnAddStartDate && startDatesContainer) {
    btnAddStartDate.addEventListener('click', () => {
      const idx = startDatesContainer.querySelectorAll('.start-date-item').length;
      const node = elFromHTML(`
        <div class="start-date-item" data-index="${idx}">
          <button class="start-date-item__remove" type="button">×</button>
          <div class="form__group">
            <label class="form__label">Ngày khởi hành</label>
            <input class="start-date form__input" type="date" required>
          </div>
        </div>
      `);
      startDatesContainer.insertBefore(node, btnAddStartDate);
    });

    startDatesContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.start-date-item__remove');
      if (!btn) return;
      const item = btn.closest('.start-date-item');
      if (item) item.remove();
    });
  }

  /* ----- Thêm/Xoá guide ----- */
  if (btnAddGuide && guidesContainer) {
    btnAddGuide.addEventListener('click', () => {
      const idx = guidesContainer.querySelectorAll('.guide-item').length;
      const options = Array.from(document.querySelectorAll('.guide-select option'))
        .map((o) => `<option value="${o.value}">${o.textContent}</option>`)
        .join('');
      const node = elFromHTML(`
        <div class="guide-item" data-index="${idx}">
          <button class="guide-item__remove" type="button">×</button>
          <div class="form__group">
            <label class="form__label">Hướng dẫn viên</label>
            <select class="guide-select form__input" required>
              ${options}
            </select>
          </div>
        </div>
      `);
      guidesContainer.insertBefore(node, btnAddGuide);
    });

    guidesContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.guide-item__remove');
      if (!btn) return;
      const item = btn.closest('.guide-item');
      if (item) item.remove();
    });
  }

  /* ----- Submit form ----- */
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (saveBtn) {
      saveBtn.textContent = 'Đang lưu...';
      saveBtn.disabled = true;
    }

    try {
      const fd = new FormData();

      // Các field cơ bản
      fd.set('name', getVal('#name'));
      const duration = getVal('#duration');
      const maxGroupSize = getVal('#maxGroupSize');
      const price = getVal('#price');
      const priceDiscount = getVal('#priceDiscount');
      const summary = getVal('#summary');
      const description = getVal('#description');

      if (duration) fd.set('duration', duration);
      if (maxGroupSize) fd.set('maxGroupSize', maxGroupSize);
      if (price) fd.set('price', price);
      if (priceDiscount) fd.set('priceDiscount', priceDiscount);
      if (summary) fd.set('summary', summary);
      if (description) fd.set('description', description);

      // START LOCATION (JSON string)
      const startLocDesc = getVal('#startLocation');
      const startLocAddr = getVal('#startLocationAddress');
      const startLocCoordsStr = getVal('#startLocationCoordinates');

      if (startLocDesc || startLocAddr || startLocCoordsStr) {
        let coords = undefined;
        if (startLocCoordsStr) {
          coords = parseCoordinates(startLocCoordsStr);
        }
        const startLocation = {
          type: 'Point',
          coordinates: coords ? [Number(coords[0]), Number(coords[1])] : undefined,
          description: startLocDesc || undefined,
          address: startLocAddr || undefined
        };
        Object.keys(startLocation).forEach((k) => startLocation[k] === undefined && delete startLocation[k]);
        fd.set('startLocation', JSON.stringify(startLocation));
      }

      // IMAGES
      const imageCoverInput = document.getElementById('imageCover');
      if (imageCoverInput && imageCoverInput.files.length > 0) {
        fd.set('imageCover', imageCoverInput.files[0]);
      }
      const imagesInput = document.getElementById('images');
      if (imagesInput && imagesInput.files.length > 0) {
        for (let i = 0; i < imagesInput.files.length; i++) {
          fd.append('images', imagesInput.files[i]);
        }
      }

      // LOCATIONS (JSON string array)
      const locationsPayload = [];
      if (locationsContainer) {
        const nodes = locationsContainer.querySelectorAll('.location-item');
        nodes.forEach((item) => {
          const desc = item.querySelector('.location-description')?.value?.trim();
          const addr = item.querySelector('.location-address')?.value?.trim();
          const coordStr = item.querySelector('.location-coordinates')?.value?.trim();
          const dayStr = item.querySelector('.location-day')?.value;

          if (!desc && !addr && !coordStr && !dayStr) return;

          let coords;
          if (coordStr) {
            const [lng, lat] = parseCoordinates(coordStr);
            coords = [Number(lng), Number(lat)];
          }

          const payload = {
            type: 'Point',
            coordinates: coords,
            description: desc || undefined,
            address: addr || undefined,
            day: dayStr ? Number(dayStr) : undefined
          };
          Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);
          locationsPayload.push(payload);
        });
      }
      if (locationsPayload.length) {
        fd.set('locations', JSON.stringify(locationsPayload));
      }

      // START DATES (JSON string array of objects { date })
      const startDatesPayload = [];
      if (startDatesContainer) {
        const nodes = startDatesContainer.querySelectorAll('.start-date-item');
        nodes.forEach((item) => {
          const dateVal = item.querySelector('.start-date')?.value;
          if (!dateVal) return;
          startDatesPayload.push({ date: new Date(dateVal).toISOString() });
          // KHÔNG set availableSlots ở client → backend merge/giữ nguyên
        });
      }
      if (startDatesPayload.length) {
        fd.set('startDates', JSON.stringify(startDatesPayload));
      }

      // GUIDES (JSON string array of ids)
      const guidesPayload = [];
      if (guidesContainer) {
        const selects = guidesContainer.querySelectorAll('.guide-select');
        selects.forEach((sel) => {
          const v = sel.value && sel.value.trim();
          if (v) guidesPayload.push(v);
        });
      }
      if (guidesPayload.length) {
        fd.set('guides', JSON.stringify(guidesPayload));
      }

      // CREATE / UPDATE
      if (tourId) {
        await updateTour(tourId, fd);
      } else {
        await createTour(fd);
      }
    } catch (err) {
      console.error('Error in form submission:', err);
      showAlert('error', err?.message || 'Đã xảy ra lỗi khi lưu tour');
    } finally {
      if (saveBtn) {
        saveBtn.textContent = 'Lưu';
        saveBtn.disabled = false;
      }
    }
  });
};

export const handleDeleteTour = () => {
  const deleteButtons = document.querySelectorAll('.btn-delete-tour');

  deleteButtons.forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const tourId = e.currentTarget.dataset.tourId;
      if (!tourId) return;

      if (confirm('Bạn có chắc chắn muốn xóa tour này? Hành động này không thể hoàn tác.')) {
        await deleteTour(tourId);
      }
    });
  });
};
