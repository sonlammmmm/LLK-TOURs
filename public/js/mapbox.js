/* eslint-disable */
export const displayMap = locations => {
  mapboxgl.accessToken = 'pk.eyJ1Ijoic29ubGFtbW1tbSIsImEiOiJjbWI5ZTRhNHUwc2lhMm1wcG9oOTFjOWhpIn0.DVRADww5JYhPdzh9_iZqDA';

  // Tính toán trung tâm bản đồ dựa trên tất cả các điểm
  const bounds = new mapboxgl.LngLatBounds();
  locations.forEach(loc => {
    bounds.extend(loc.coordinates);
  });
  
  const center = bounds.getCenter();

  const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/light-v11',
    center: [center.lng, center.lat], // Sử dụng trung tâm được tính toán
    zoom: 10,
    scrollZoom: false,
    boxZoom: true,
    dragRotate: false,
    touchZoomRotate: true,
    doubleClickZoom: true,
    keyboard: true,
    dragPan: true
  });

  const sortedLocations = [...locations].sort((a, b) => b.day - a.day);

  const popupStorage = new Map();

  // Thêm marker và popup
  sortedLocations.forEach(loc => {
    // Tạo marker tùy chỉnh
    const el = document.createElement('div');
    el.className = 'marker';
    el.style.cursor = 'pointer';

    // Tạo popup
    const popup = new mapboxgl.Popup({
      offset: 30,
      closeButton: true,
      closeOnClick: false,
      closeOnMove: false
    })
      .setLngLat(loc.coordinates)
      .setHTML(`
        <div class="popup-content">
          <div class="popup-day">Ngày ${loc.day}</div>
          <div class="popup-description">${loc.description}</div>
        </div>
      `);

    // Thêm marker vào bản đồ
    const marker = new mapboxgl.Marker({
      element: el,
      anchor: 'bottom'
    })
      .setLngLat(loc.coordinates)
      .addTo(map);

    // Lưu popup vào storage
    popupStorage.set(loc.day, {
      popup: popup,
      isOpen: false
    });

    popup.addTo(map);
    popupStorage.get(loc.day).isOpen = true;

    popup.on('close', () => {
      popupStorage.get(loc.day).isOpen = false;
    });

    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const popupData = popupStorage.get(loc.day);
      
      if (popupData.isOpen) {
        // Nếu popup đang mở, đóng nó
        popupData.popup.remove();
        popupData.isOpen = false;
      } else {
        // Nếu popup đang đóng, mở nó
        popupData.popup.addTo(map);
        popupData.isOpen = true;
      }
    });
  });

  map.fitBounds(bounds, {
    padding: {
      top: 100,
      bottom: 100,
      left: 50,
      right: 50
    },
    maxZoom: 12
  });

  const nav = new mapboxgl.NavigationControl({
    showCompass: false,
    showZoom: true
  });
  map.addControl(nav, 'top-right');
};