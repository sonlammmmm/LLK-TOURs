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

const loadImage = (file) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });

const compressImage = async (file, options = {}) => {
  if (!file || !file.type || !file.type.startsWith('image/')) return file;
  const {
    maxWidth = 1920,
    maxHeight = 1080,
    quality = 0.82,
    maxSizeBytes = 1.5 * 1024 * 1024
  } = options;
  try {
    const image = await loadImage(file);
    const { width, height } = image;
    const scale = Math.min(1, maxWidth / width, maxHeight / height);
    if (scale === 1 && file.size <= maxSizeBytes) return file;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => {
      canvas.toBlob(
        (result) => resolve(result || file),
        file.type || 'image/jpeg',
        quality
      );
    });
    if (!blob || blob === file) return file;
    return new File([blob], file.name, {
      type: blob.type,
      lastModified: Date.now()
    });
  } catch (err) {
    console.warn('Unable to compress image', err);
    return file;
  }
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
  const maxGroupSizeInput = document.getElementById('maxGroupSize');

  const saveBtn = document.querySelector('.btn-save-tour');
  const stepperButtons = form.querySelectorAll('.tour-form__stepper-button');
  const stepSections = form.querySelectorAll('.tour-form__step');
  let currentStep = 1;
  const quickStartDateInput = document.getElementById('quick-start-date');
  const quickStartSlotsInput = document.getElementById('quick-start-slots');
  const imageCoverInput = document.getElementById('imageCover');
  const imagesInput = document.getElementById('images');
  const resolvePreviewTarget = (input, fallbackSelector) => {
    if (!input) return fallbackSelector ? document.querySelector(fallbackSelector) : null;
    const selector = input.dataset?.previewTarget;
    if (selector) {
      const el = document.querySelector(selector);
      if (el) return el;
    }
    return fallbackSelector ? document.querySelector(fallbackSelector) : null;
  };
  const coverPreviewEl = resolvePreviewTarget(imageCoverInput, '.image-cover-preview');
  const galleryPreviewEl = resolvePreviewTarget(imagesInput, '.tour-images-preview');
  const defaultCoverPreview = coverPreviewEl ? coverPreviewEl.innerHTML : '';
  const defaultGalleryPreview = galleryPreviewEl ? galleryPreviewEl.innerHTML : '';
  const guideOptionsTemplate = document.getElementById('guide-options-template');
  const guideOptionsMarkup =
    (guideOptionsTemplate && guideOptionsTemplate.innerHTML.trim()) ||
    '<option value="">Ch\u1ecdn h\u01b0\u1edbng d\u1eabn vi\u00ean</option>';
  if (guideOptionsTemplate) guideOptionsTemplate.remove();
  const maxGalleryAttr =
    imagesInput && imagesInput.dataset ? imagesInput.dataset.maxFiles : null;
  const parsedMaxGallery =
    maxGalleryAttr && !Number.isNaN(Number(maxGalleryAttr))
      ? Number(maxGalleryAttr)
      : NaN;
  const maxGalleryImages =
    Number.isFinite(parsedMaxGallery) && parsedMaxGallery > 0
      ? parsedMaxGallery
      : 6;
  let pendingCoverFile = null;
  let pendingGalleryFiles = [];

  const insertBeforeEmptyState = (container, node) => {
    if (!container || !node) return;
    const empty = container.querySelector('.form-empty-state');
    container.insertBefore(node, empty || null);
  };

  const toggleEmptyState = (container) => {
    if (!container) return;
    const empty = container.querySelector('.form-empty-state');
    if (!empty) return;
    const selector = container.dataset.itemSelector || '.form__group';
    const hasItems = container.querySelectorAll(selector).length > 0;
    empty.classList.toggle('is-hidden', hasItems);
  };

  const readFileAsDataURL = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const renderCoverPreview = async (file) => {
    if (!coverPreviewEl) return;
    if (!file) {
      coverPreviewEl.innerHTML = defaultCoverPreview;
      return;
    }
    try {
      const dataUrl = await readFileAsDataURL(file);
      coverPreviewEl.innerHTML = '';
      const img = document.createElement('img');
      img.src = dataUrl;
      img.alt = 'Ảnh bìa xem trước';
      coverPreviewEl.appendChild(img);
    } catch (err) {
      console.error('Không thể hiển thị ảnh bìa:', err);
      coverPreviewEl.innerHTML = defaultCoverPreview;
    }
  };

  const renderGalleryPreview = async (files) => {
    if (!galleryPreviewEl) return;
    if (!files || !files.length) {
      galleryPreviewEl.innerHTML = defaultGalleryPreview;
      return;
    }
    galleryPreviewEl.innerHTML = '';
    files.forEach(async (file, index) => {
      try {
        const dataUrl = await readFileAsDataURL(file);
        const wrapper = document.createElement('div');
        wrapper.className = 'image-preview-grid__item';
        const img = document.createElement('img');
        img.src = dataUrl;
        img.alt = `Ảnh tour ${index + 1}`;
        wrapper.appendChild(img);
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'image-preview-grid__remove';
        removeBtn.dataset.index = String(index);
        removeBtn.innerHTML = '×';
        wrapper.appendChild(removeBtn);
        galleryPreviewEl.appendChild(wrapper);
      } catch (err) {
        console.error('Không thể hiển thị preview ảnh tour:', err);
      }
    });
  };

  const clearImageSelection = (type) => {
    if (type === 'cover') {
      pendingCoverFile = null;
      if (imageCoverInput) imageCoverInput.value = '';
      renderCoverPreview(null);
    } else if (type === 'gallery') {
      pendingGalleryFiles = [];
      if (imagesInput) imagesInput.value = '';
      renderGalleryPreview([]);
    }
  };

  if (form) {
    const clearButtons = form.querySelectorAll('.image-upload__clear');
    clearButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.clearType;
        clearImageSelection(type);
      });
    });
  }

  if (galleryPreviewEl) {
    galleryPreviewEl.addEventListener('click', (e) => {
      const removeBtn = e.target.closest('.image-preview-grid__remove');
      if (!removeBtn) return;
      e.preventDefault();
      const index = Number(removeBtn.dataset.index);
      if (Number.isNaN(index)) return;
      pendingGalleryFiles.splice(index, 1);
      if (!pendingGalleryFiles.length && imagesInput) {
        imagesInput.value = '';
      }
      renderGalleryPreview(pendingGalleryFiles);
    });
  }

  const getGalleryFiles = () => {
    if (pendingGalleryFiles.length) {
      return pendingGalleryFiles.slice(0, maxGalleryImages);
    }
    if (imagesInput && imagesInput.files && imagesInput.files.length > 0) {
      return Array.from(imagesInput.files).slice(0, maxGalleryImages);
    }
    return [];
  };

  const syncEmptyStates = () => {
    toggleEmptyState(locationsContainer);
    toggleEmptyState(startDatesContainer);
    toggleEmptyState(guidesContainer);
  };

  syncEmptyStates();

  if (imageCoverInput) {
    imageCoverInput.addEventListener('change', () => {
      if (imageCoverInput.files && imageCoverInput.files[0]) {
        pendingCoverFile = imageCoverInput.files[0];
      } else {
        pendingCoverFile = null;
      }
      renderCoverPreview(pendingCoverFile);
    });
  }

  if (imagesInput) {
    imagesInput.addEventListener('change', () => {
      const files =
        imagesInput.files && imagesInput.files.length
          ? Array.from(imagesInput.files)
          : [];
      if (files.length > maxGalleryImages) {
        showAlert(
          'info',
          `Chỉ sử dụng ${maxGalleryImages} ảnh đầu tiên trong lần tải này.`
        );
      }
      pendingGalleryFiles = files.slice(0, maxGalleryImages);
      renderGalleryPreview(pendingGalleryFiles);
    });
  }

  const goToStep = (step) => {
    const target = Math.min(Math.max(1, Number(step)), stepSections.length);
    currentStep = target;
    stepSections.forEach((section) => {
      const sectionStep = Number(section.dataset.step);
      section.classList.toggle('is-active', sectionStep === currentStep);
    });
    stepperButtons.forEach((btn) => {
      const btnStep = Number(btn.dataset.step);
      btn.classList.toggle('is-active', btnStep === currentStep);
    });
  };

  if (stepSections.length && stepperButtons.length) {
    goToStep(1);
    stepperButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.dataset.step) goToStep(Number(btn.dataset.step));
      });
    });
  }

  form.addEventListener('click', (e) => {
    const navBtn = e.target.closest('[data-step-action]');
    if (!navBtn) return;
    const targetStep = Number(navBtn.dataset.stepTarget);
    if (!Number.isNaN(targetStep)) {
      goToStep(targetStep);
    }
  });

  const syncEmptyStartSlots = () => {
    if (!startDatesContainer || !maxGroupSizeInput) return;
    const fallback = maxGroupSizeInput.value;
    if (!fallback) return;
    startDatesContainer
      .querySelectorAll('.start-date-slots')
      .forEach((input) => {
        if (!input.value) input.value = fallback;
      });
  };

  maxGroupSizeInput?.addEventListener('input', () => {
    syncEmptyStartSlots();
  });

  syncEmptyStartSlots();

  /* ----- Thêm/Xóa địa điểm ----- */
  if (btnAddLocation && locationsContainer) {
    btnAddLocation.addEventListener('click', () => {
      const idx = locationsContainer.querySelectorAll('.location-item').length;
      const node = elFromHTML(`
        <div class="location-item" data-index="${idx}">
          <button class="location-item__remove" type="button">×</button>
          <div class="form__group">
            <label class="form__label">Tên chặng/điểm dừng</label>
            <input class="location-description form__input" type="text" required>
          </div>
          <div class="form__group">
            <label class="form__label">Địa chỉ/Ghi chú</label>
            <input class="location-address form__input" type="text" placeholder="Ví dụ: Buổi sáng tại...">
          </div>
          <div class="form__group">
            <label class="form__label">Tọa độ (lng, lat)</label>
            <input class="location-coordinates form__input" type="text" placeholder="106.695249, 10.775400">
            <small class="form__help">Định dạng: kinh độ, vĩ độ (VD: 106.695, 10.775)</small>
          </div>
          <div class="form__group">
            <label class="form__label">Ngày thực hiện</label>
            <input class="location-day form__input" type="number" min="1" required placeholder="1">
          </div>
        </div>
      `);
      insertBeforeEmptyState(locationsContainer, node);
      toggleEmptyState(locationsContainer);
    });

    locationsContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.location-item__remove');
      if (!btn) return;
      const item = btn.closest('.location-item');
      if (item) item.remove();
      toggleEmptyState(locationsContainer);
    });
  }

  /* ----- Thêm/Xóa ngày khởi hành ----- */
  if (btnAddStartDate && startDatesContainer) {
    btnAddStartDate.addEventListener('click', () => {
      const quickDateValue = quickStartDateInput?.value?.trim();
      if (!quickDateValue) {
        showAlert('error', 'Vui lòng chọn ngày khởi hành trước khi thêm.');
        quickStartDateInput?.focus();
        return;
      }

      const trimmedSlotValue = quickStartSlotsInput?.value?.trim();
      const fallbackSlotSource =
        trimmedSlotValue || maxGroupSizeInput?.value?.trim() || '';
      if (!fallbackSlotSource) {
        showAlert(
          'error',
          'Vui lòng nhập số slot khả dụng hoặc sức chứa tối đa trước khi thêm.'
        );
        quickStartSlotsInput?.focus();
        return;
      }

      const slotNumber = Number(fallbackSlotSource);
      if (Number.isNaN(slotNumber) || slotNumber <= 0) {
        showAlert('error', 'Số slot phải lớn hơn 0.');
        quickStartSlotsInput?.focus();
        return;
      }

      const normalizedDate = quickDateValue;
      const hasDuplicate = Array.from(
        startDatesContainer.querySelectorAll('.start-date')
      ).some((input) => input.value === normalizedDate);
      if (hasDuplicate) {
        showAlert('error', 'Ngày khởi hành này đã tồn tại trong lịch.');
        quickStartDateInput?.focus();
        return;
      }

      const idx = startDatesContainer.querySelectorAll('.start-date-item').length;
      const node = elFromHTML(`
        <div class="start-date-item" data-index="${idx}">
          <button class="start-date-item__remove" type="button">×</button>
          <div class="form__group">
            <label class="form__label">Ngày khởi hành</label>
            <input class="start-date form__input" type="date" required>
          </div>
          <div class="form__group">
            <label class="form__label">Slot tối đa</label>
            <input class="start-date-slots form__input" type="number" min="1" placeholder="Theo sức chứa tối đa">
          </div>
        </div>
      `);

      const dateField = node.querySelector('.start-date');
      const slotsField = node.querySelector('.start-date-slots');
      if (dateField) dateField.value = normalizedDate;
      if (slotsField) slotsField.value = slotNumber;

      if (quickStartDateInput) quickStartDateInput.value = '';
      if (trimmedSlotValue && quickStartSlotsInput) quickStartSlotsInput.value = '';

      insertBeforeEmptyState(startDatesContainer, node);
      toggleEmptyState(startDatesContainer);
      syncEmptyStartSlots();
    });

    startDatesContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.start-date-item__remove');
      if (!btn) return;
      const item = btn.closest('.start-date-item');
      if (item) item.remove();
      toggleEmptyState(startDatesContainer);
    });
  }

  /* ----- Thêm/Xóa hướng dẫn viên ----- */
  if (btnAddGuide && guidesContainer) {
    btnAddGuide.addEventListener('click', () => {
      const idx = guidesContainer.querySelectorAll('.guide-item').length;
      const node = elFromHTML(`
        <div class="guide-item" data-index="${idx}">
          <button class="guide-item__remove" type="button">×</button>
          <div class="form__group">
            <label class="form__label">Hướng dẫn viên</label>
            <select class="guide-select form__input" required>
              ${guideOptionsMarkup}
            </select>
          </div>
        </div>
      `);
      insertBeforeEmptyState(guidesContainer, node);
      toggleEmptyState(guidesContainer);
    });

    guidesContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.guide-item__remove');
      if (!btn) return;
      const item = btn.closest('.guide-item');
      if (item) item.remove();
      toggleEmptyState(guidesContainer);
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
      const summary = getVal('#summary');
      const description = getVal('#description');
      const parsedMaxGroupSize = Number(maxGroupSize);
      const fallbackAvailableSlots =
        !Number.isNaN(parsedMaxGroupSize) && parsedMaxGroupSize > 0
          ? parsedMaxGroupSize
          : 0;

      if (duration) fd.set('duration', duration);
      if (maxGroupSize) fd.set('maxGroupSize', maxGroupSize);
      if (price) fd.set('price', price);
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

      // IMAGES + COVER (compressed)
      const coverCandidate =
        pendingCoverFile ||
        (imageCoverInput &&
          imageCoverInput.files &&
          imageCoverInput.files.length > 0 &&
          imageCoverInput.files[0]);
      if (coverCandidate) {
        const compressedCover = await compressImage(coverCandidate);
        fd.set('imageCover', compressedCover);
      }
      const galleryFiles = getGalleryFiles();
      if (galleryFiles.length > maxGalleryImages) {
        showAlert(
          'info',
          `Chỉ sử dụng ${maxGalleryImages} ảnh đầu tiên trong danh sách.`
        );
      }
      const limitedGallery = galleryFiles.slice(0, maxGalleryImages);
      for (const file of limitedGallery) {
        const compressed = await compressImage(file);
        fd.append('images', compressed);
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
          const payload = { date: new Date(dateVal).toISOString() };
          const slotsValue = Number(
            item.querySelector('.start-date-slots')?.value
          );
          if (!Number.isNaN(slotsValue) && slotsValue > 0) {
            payload.availableSlots = slotsValue;
          } else if (fallbackAvailableSlots > 0) {
            payload.availableSlots = fallbackAvailableSlots;
          }
          startDatesPayload.push(payload);
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
        saveBtn.textContent = 'Lưu tour';
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

export const initTourAdminInteractions = () => {
  const quickForms = document.querySelectorAll('.llk-admin-tour-card__quick-start');
  if (!quickForms.length) return;

  quickForms.forEach((form) => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const dateInput = form.querySelector('input[type="date"]');
      const slotInput = form.querySelector('input[type="number"]');
      const submitBtn = form.querySelector('button[type="submit"]');

      const tourId = form.dataset.tourId;
      const maxSize = Number(form.dataset.maxSize) || 0;
      const dateValue = dateInput?.value;
      const slotsValue = Number(slotInput?.value) || maxSize;

      if (!dateValue) {
        showAlert('error', 'Vui lòng chọn ngày khởi hành');
        return;
      }

      try {
        if (submitBtn) submitBtn.disabled = true;
        await axios({
          method: 'PATCH',
          url: `/api/v1/tours/${tourId}`,
          data: {
            startDates: JSON.stringify([
              {
                date: new Date(dateValue).toISOString(),
                availableSlots: slotsValue
              }
            ]),
            maxGroupSize: maxSize,
            appendStartDates: true
          }
        });
        showAlert('success', 'Đã thêm ngày khởi hành mới');
        window.setTimeout(() => window.location.reload(), 1200);
      } catch (err) {
        console.error('Error adding quick start date:', err);
        showAlert(
          'error',
          err.response ? err.response.data.message : 'Không thể thêm ngày khởi hành'
        );
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  });
};

export const initTourSearch = () => {
  const searchInput = document.querySelector('.llk-admin-panel__search');
  if (!searchInput) return;

  const tourCards = Array.from(document.querySelectorAll('.llk-admin-tour-card'));
  const cardsData = tourCards.map((card) => ({
    card,
    searchableText: card.textContent.trim().toLowerCase(),
  }));

  const filterTours = () => {
    const query = searchInput.value.trim().toLowerCase();
    const showAll = query === '';

    cardsData.forEach(({ card, searchableText }) => {
      const matches = showAll || searchableText.includes(query);
      card.style.display = matches ? '' : 'none';
    });
  };

  searchInput.addEventListener('input', filterTours);
};
