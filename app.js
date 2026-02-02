// ── State ──
let friends = JSON.parse(localStorage.getItem('tastebuds_friends') || '[]');
let recommendations = JSON.parse(localStorage.getItem('tastebuds_recs') || '[]');
let selectedRating = 0;
let selectedColor = '#e74c3c';
let selectedDuration = '24h';
let placingPin = false;
let markers = [];
let tripMarkers = [];
let currentPhotoData = null;

// ── Map Setup ──
const map = L.map('map', {
  center: [20, 0],
  zoom: 2,
  minZoom: 2,
  worldCopyJump: true,
  zoomControl: true
});

L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; <a href="https://carto.com/">CARTO</a> | &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
  subdomains: 'abcd',
  maxZoom: 19
}).addTo(map);

// ── Helper: Create colored marker icon ──
function createMarkerIcon(color) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="28" height="40">
      <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z" fill="${color}"/>
      <circle cx="12" cy="11" r="5" fill="rgba(255,255,255,0.9)"/>
    </svg>`;
  return L.divIcon({
    html: svg,
    className: 'custom-marker',
    iconSize: [28, 40],
    iconAnchor: [14, 40],
    popupAnchor: [0, -36]
  });
}

// ── Persistence ──
function save() {
  localStorage.setItem('tastebuds_friends', JSON.stringify(friends));
  localStorage.setItem('tastebuds_recs', JSON.stringify(recommendations));
}

// ── Render Friends List ──
function renderFriends() {
  const list = document.getElementById('friends-list');
  const recSelect = document.getElementById('rec-friend');
  const filterSelect = document.getElementById('filter-friend');

  list.innerHTML = friends.length === 0
    ? '<p style="color:#555;font-size:0.8rem;">No buds yet. Add one!</p>'
    : friends.map(f => {
        const count = recommendations.filter(r => r.friendId === f.id).length;
        return `
          <div class="friend-chip" data-id="${f.id}">
            <span class="friend-dot" style="background:${f.color}"></span>
            <span class="friend-name">${escapeHtml(f.name)}</span>
            <span class="friend-count">${count} rec${count !== 1 ? 's' : ''}</span>
            <button class="friend-delete" onclick="deleteFriend('${f.id}')" title="Remove bud">&times;</button>
          </div>`;
      }).join('');

  recSelect.innerHTML = '<option value="">Select a bud...</option>' +
    friends.map(f => `<option value="${f.id}">${escapeHtml(f.name)}</option>`).join('');

  const currentFilter = filterSelect.value;
  filterSelect.innerHTML = '<option value="all">All Buds</option>' +
    friends.map(f => `<option value="${f.id}">${escapeHtml(f.name)}</option>`).join('');
  filterSelect.value = currentFilter;
}

// ── Render Map Markers ──
function renderMarkers() {
  markers.forEach(m => map.removeLayer(m));
  markers = [];

  const filterFriend = document.getElementById('filter-friend').value;
  const filterCuisine = document.getElementById('filter-cuisine').value.toLowerCase().trim();

  let filtered = recommendations;

  if (filterFriend !== 'all') {
    filtered = filtered.filter(r => r.friendId === filterFriend);
  }

  if (filterCuisine) {
    filtered = filtered.filter(r => (r.cuisine || '').toLowerCase().includes(filterCuisine));
  }

  filtered.forEach(rec => {
    const friend = friends.find(f => f.id === rec.friendId);
    if (!friend) return;

    const stars = '★'.repeat(rec.rating) + '☆'.repeat(5 - rec.rating);

    // Build popup HTML
    let popupHtml = '';

    // Photo
    if (rec.photo) {
      popupHtml += `<img class="popup-photo" src="${rec.photo}" onclick="openLightbox('${rec.id}')" alt="Food photo">`;
    }

    // Title (linked if URL exists)
    if (rec.url) {
      popupHtml += `<div class="popup-title"><a href="${escapeHtml(rec.url)}" target="_blank" rel="noopener">${escapeHtml(rec.place)}</a></div>`;
      popupHtml += `<div class="popup-url"><a href="${escapeHtml(rec.url)}" target="_blank" rel="noopener">${escapeHtml(rec.url)}</a></div>`;
    } else {
      popupHtml += `<div class="popup-title">${escapeHtml(rec.place)}</div>`;
    }

    if (rec.cuisine) {
      popupHtml += `<div class="popup-cuisine">${escapeHtml(rec.cuisine)}</div>`;
    }
    popupHtml += `<div class="popup-stars">${stars}</div>`;
    if (rec.note) {
      popupHtml += `<div class="popup-note">"${escapeHtml(rec.note)}"</div>`;
    }
    popupHtml += `<div class="popup-friend">Recommended by <strong style="color:${friend.color}">${escapeHtml(friend.name)}</strong></div>`;
    popupHtml += `<button class="popup-delete-btn" onclick="deleteRec('${rec.id}')">Remove</button>`;

    const marker = L.marker([rec.lat, rec.lng], { icon: createMarkerIcon(friend.color) })
      .addTo(map)
      .bindPopup(popupHtml, { maxWidth: 280 });

    markers.push(marker);
  });
}

// ── Lightbox ──
const lightboxModal = document.getElementById('lightbox-modal');
const lightboxImg = document.getElementById('lightbox-img');

window.openLightbox = function(recId) {
  const rec = recommendations.find(r => r.id === recId);
  if (!rec || !rec.photo) return;
  lightboxImg.src = rec.photo;
  lightboxModal.classList.remove('hidden');
};

document.getElementById('lightbox-close').addEventListener('click', () => {
  lightboxModal.classList.add('hidden');
});

lightboxModal.addEventListener('click', (e) => {
  if (e.target === lightboxModal) lightboxModal.classList.add('hidden');
});

// ── Add Friend ──
const friendModal = document.getElementById('friend-modal');
const friendForm = document.getElementById('friend-form');

document.getElementById('add-friend-btn').addEventListener('click', () => {
  friendModal.classList.remove('hidden');
  document.getElementById('friend-name').value = '';
  document.getElementById('friend-name').focus();
});

document.getElementById('cancel-friend').addEventListener('click', () => {
  friendModal.classList.add('hidden');
});

friendModal.addEventListener('click', (e) => {
  if (e.target === friendModal) friendModal.classList.add('hidden');
});

// Color picker
document.getElementById('color-picker').addEventListener('click', (e) => {
  const swatch = e.target.closest('.color-swatch');
  if (!swatch) return;
  document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
  swatch.classList.add('active');
  selectedColor = swatch.dataset.color;
});

friendForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = document.getElementById('friend-name').value.trim();
  if (!name) return;

  friends.push({
    id: generateId(),
    name,
    color: selectedColor
  });

  save();
  renderFriends();
  renderMarkers();
  friendModal.classList.add('hidden');
});

// ── Delete Friend ──
window.deleteFriend = function(id) {
  if (!confirm('Remove this bud and all their recommendations?')) return;
  friends = friends.filter(f => f.id !== id);
  recommendations = recommendations.filter(r => r.friendId !== id);
  save();
  renderFriends();
  renderMarkers();
};

// ── Delete Recommendation ──
window.deleteRec = function(id) {
  recommendations = recommendations.filter(r => r.id !== id);
  save();
  renderFriends();
  renderMarkers();
};

// ── Star Rating ──
const starContainer = document.getElementById('star-rating');
const ratingInput = document.getElementById('rec-rating');

starContainer.addEventListener('click', (e) => {
  const star = e.target.closest('.star');
  if (!star) return;
  selectedRating = parseInt(star.dataset.value);
  ratingInput.value = selectedRating;
  updateStars();
});

function updateStars() {
  document.querySelectorAll('#star-rating .star').forEach(s => {
    s.classList.toggle('active', parseInt(s.dataset.value) <= selectedRating);
  });
}

// ── Photo Upload ──
const photoInput = document.getElementById('rec-photo');
const photoPlaceholder = document.getElementById('photo-placeholder');
const photoPreview = document.getElementById('photo-preview');
const photoPreviewImg = document.getElementById('photo-preview-img');
const photoUploadArea = document.getElementById('photo-upload-area');

photoInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) processPhoto(file);
});

// Drag and drop
photoUploadArea.addEventListener('dragover', (e) => {
  e.preventDefault();
  photoUploadArea.classList.add('dragover');
});

photoUploadArea.addEventListener('dragleave', () => {
  photoUploadArea.classList.remove('dragover');
});

photoUploadArea.addEventListener('drop', (e) => {
  e.preventDefault();
  photoUploadArea.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) {
    processPhoto(file);
  }
});

function processPhoto(file) {
  // Resize to keep localStorage manageable
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX = 800;
      let w = img.width, h = img.height;
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
        else { w = Math.round(w * MAX / h); h = MAX; }
      }
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      currentPhotoData = canvas.toDataURL('image/jpeg', 0.7);
      showPhotoPreview(currentPhotoData);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function showPhotoPreview(dataUrl) {
  photoPreviewImg.src = dataUrl;
  photoPlaceholder.classList.add('hidden');
  photoPreview.classList.remove('hidden');
}

function clearPhotoPreview() {
  currentPhotoData = null;
  photoInput.value = '';
  photoPlaceholder.classList.remove('hidden');
  photoPreview.classList.add('hidden');
  photoPreviewImg.src = '';
}

document.getElementById('remove-photo').addEventListener('click', (e) => {
  e.stopPropagation();
  clearPhotoPreview();
});

// ── Map Click for Pin Placement ──
map.on('click', (e) => {
  document.getElementById('rec-lat').value = e.latlng.lat.toFixed(6);
  document.getElementById('rec-lng').value = e.latlng.lng.toFixed(6);
  document.getElementById('placement-banner').classList.add('hidden');
  placingPin = false;
});

['rec-lat', 'rec-lng'].forEach(id => {
  document.getElementById(id).addEventListener('focus', () => {
    document.getElementById('placement-banner').classList.remove('hidden');
  });
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.getElementById('placement-banner').classList.add('hidden');
    lightboxModal.classList.add('hidden');
  }
});

// ── Add Recommendation Form ──
document.getElementById('rec-form').addEventListener('submit', (e) => {
  e.preventDefault();

  const friendId = document.getElementById('rec-friend').value;
  const place = document.getElementById('rec-place').value.trim();
  const url = document.getElementById('rec-url').value.trim();
  const cuisine = document.getElementById('rec-cuisine').value.trim();
  const note = document.getElementById('rec-note').value.trim();
  const lat = parseFloat(document.getElementById('rec-lat').value);
  const lng = parseFloat(document.getElementById('rec-lng').value);

  if (!friendId || !place || isNaN(lat) || isNaN(lng)) {
    alert('Please fill in the required fields and set a location on the map.');
    return;
  }

  const rec = {
    id: generateId(),
    friendId,
    place,
    cuisine,
    note,
    rating: selectedRating,
    lat,
    lng
  };

  if (url) rec.url = url;
  if (currentPhotoData) rec.photo = currentPhotoData;

  recommendations.push(rec);

  save();
  renderFriends();
  renderMarkers();

  // Reset form
  document.getElementById('rec-form').reset();
  selectedRating = 0;
  updateStars();
  document.getElementById('rec-lat').value = '';
  document.getElementById('rec-lng').value = '';
  clearPhotoPreview();

  map.flyTo([lat, lng], Math.max(map.getZoom(), 6));
});

// ── Filters ──
document.getElementById('filter-friend').addEventListener('change', renderMarkers);
document.getElementById('filter-cuisine').addEventListener('input', renderMarkers);

// ── Trip Planner ──
const MEAL_SLOTS = ['Breakfast', 'Lunch', 'Dinner'];
const CITY_COORDS = {
  'tokyo': { lat: 35.6762, lng: 139.6503 },
  'paris': { lat: 48.8566, lng: 2.3522 },
  'nyc': { lat: 40.7128, lng: -74.0060 },
  'new york': { lat: 40.7128, lng: -74.0060 },
  'london': { lat: 51.5074, lng: -0.1278 },
  'rome': { lat: 41.9028, lng: 12.4964 },
  'bangkok': { lat: 13.7563, lng: 100.5018 },
  'delhi': { lat: 28.6139, lng: 77.2090 },
  'new delhi': { lat: 28.6139, lng: 77.2090 },
  'madrid': { lat: 40.4168, lng: -3.7038 },
  'buenos aires': { lat: -34.6037, lng: -58.3816 },
  'naples': { lat: 40.8518, lng: 14.2681 },
  'napoli': { lat: 40.8518, lng: 14.2681 },
  'fukuoka': { lat: 33.5904, lng: 130.4017 },
  'montreal': { lat: 45.5017, lng: -73.5673 },
  'mumbai': { lat: 19.0760, lng: 72.8777 },
  'mexico city': { lat: 19.4326, lng: -99.1332 },
  'istanbul': { lat: 41.0082, lng: 28.9784 },
  'barcelona': { lat: 41.3874, lng: 2.1686 },
  'sydney': { lat: -33.8688, lng: 151.2093 },
  'seoul': { lat: 37.5665, lng: 126.9780 },
  'lisbon': { lat: 38.7223, lng: -9.1393 },
  'berlin': { lat: 52.5200, lng: 13.4050 },
  'san francisco': { lat: 37.7749, lng: -122.4194 },
  'los angeles': { lat: 34.0522, lng: -118.2437 },
  'chicago': { lat: 41.8781, lng: -87.6298 },
  'singapore': { lat: 1.3521, lng: 103.8198 },
  'hong kong': { lat: 22.3193, lng: 114.1694 },
  'taipei': { lat: 25.0330, lng: 121.5654 },
  'osaka': { lat: 34.6937, lng: 135.5023 },
  'dubai': { lat: 25.2048, lng: 55.2708 },
  'cairo': { lat: 30.0444, lng: 31.2357 },
  'marrakech': { lat: 31.6295, lng: -7.9811 },
  'lima': { lat: -12.0464, lng: -77.0428 },
  'hanoi': { lat: 21.0285, lng: 105.8542 },
  'ho chi minh': { lat: 10.8231, lng: 106.6297 },
  'saigon': { lat: 10.8231, lng: 106.6297 },
  'athens': { lat: 37.9838, lng: 23.7275 },
  'prague': { lat: 50.0755, lng: 14.4378 },
  'amsterdam': { lat: 52.3676, lng: 4.9041 },
  'copenhagen': { lat: 55.6761, lng: 12.5683 },
  'vienna': { lat: 48.2082, lng: 16.3738 }
};

// Duration pills
document.querySelector('.duration-pills').addEventListener('click', (e) => {
  const pill = e.target.closest('.pill');
  if (!pill) return;
  document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
  pill.classList.add('active');
  selectedDuration = pill.dataset.duration;
});

// Haversine distance in km
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

document.getElementById('plan-trip-btn').addEventListener('click', () => {
  const cityInput = document.getElementById('trip-city').value.trim().toLowerCase();
  if (!cityInput) {
    alert('Please enter a city name.');
    return;
  }

  // Resolve city coordinates
  let cityCoords = CITY_COORDS[cityInput];

  // Fuzzy match: check if input is a substring of any known city
  if (!cityCoords) {
    for (const [name, coords] of Object.entries(CITY_COORDS)) {
      if (name.includes(cityInput) || cityInput.includes(name)) {
        cityCoords = coords;
        break;
      }
    }
  }

  // If still not found, check if any rec is near a place with this name
  if (!cityCoords) {
    // Try to find center from existing recs that match
    const matchingRecs = recommendations.filter(r =>
      r.place.toLowerCase().includes(cityInput) ||
      (r.cuisine || '').toLowerCase().includes(cityInput)
    );
    if (matchingRecs.length > 0) {
      cityCoords = { lat: matchingRecs[0].lat, lng: matchingRecs[0].lng };
    }
  }

  if (!cityCoords) {
    alert(`City "${document.getElementById('trip-city').value.trim()}" not recognized. Try a major city name like Tokyo, Paris, NYC, etc.`);
    return;
  }

  // Find nearby recommendations (within 100km radius)
  const RADIUS_KM = 100;
  const nearby = recommendations
    .map(rec => ({
      ...rec,
      distance: haversine(cityCoords.lat, cityCoords.lng, rec.lat, rec.lng)
    }))
    .filter(rec => rec.distance <= RADIUS_KM)
    .sort((a, b) => b.rating - a.rating || a.distance - b.distance);

  const resultsDiv = document.getElementById('trip-results');

  if (nearby.length === 0) {
    resultsDiv.innerHTML = `
      <div class="trip-no-results">No recommendations found near this city. Ask your buds for some!</div>
      <button class="trip-clear-btn" onclick="clearTrip()">Clear</button>
    `;
    resultsDiv.classList.remove('hidden');
    return;
  }

  // Determine number of days
  let numDays;
  switch (selectedDuration) {
    case '24h': numDays = 1; break;
    case '3d': numDays = 3; break;
    case '1w': numDays = 7; break;
    default: numDays = 1;
  }

  // Build itinerary: assign recs to meal slots across days
  const mealsPerDay = 3;
  const totalSlots = numDays * mealsPerDay;
  const itinerary = [];

  // Fill slots, cycling through available recs
  for (let i = 0; i < totalSlots; i++) {
    if (nearby.length === 0) break;
    const rec = nearby[i % nearby.length];
    const day = Math.floor(i / mealsPerDay);
    const mealType = MEAL_SLOTS[i % mealsPerDay];
    itinerary.push({ day, mealType, rec });
  }

  // Group by day
  const days = {};
  itinerary.forEach(item => {
    if (!days[item.day]) days[item.day] = [];
    days[item.day].push(item);
  });

  let html = '';
  for (const [dayNum, meals] of Object.entries(days)) {
    const dayLabel = numDays === 1 ? 'Your Day' : `Day ${parseInt(dayNum) + 1}`;
    html += `<div class="trip-day">`;
    html += `<div class="trip-day-header">${dayLabel}</div>`;
    meals.forEach(({ mealType, rec }) => {
      const friend = friends.find(f => f.id === rec.friendId);
      const friendColor = friend ? friend.color : '#555';
      html += `
        <div class="trip-meal" onclick="flyToRec('${rec.id}')">
          <span class="trip-meal-type">${mealType}</span>
          <span class="trip-meal-name">${escapeHtml(rec.place)}</span>
          <span class="trip-meal-cuisine">${escapeHtml(rec.cuisine || '')}</span>
          <span class="trip-meal-friend" style="background:${friendColor}"></span>
        </div>`;
    });
    html += `</div>`;
  }

  html += `<button class="trip-clear-btn" onclick="clearTrip()">Clear Itinerary</button>`;

  resultsDiv.innerHTML = html;
  resultsDiv.classList.remove('hidden');

  // Highlight trip markers on map and fit bounds
  clearTripMarkers();
  const bounds = [];
  nearby.forEach(rec => {
    const friend = friends.find(f => f.id === rec.friendId);
    if (!friend) return;
    bounds.push([rec.lat, rec.lng]);
  });

  if (bounds.length > 0) {
    map.flyToBounds(bounds, { padding: [50, 50], maxZoom: 12 });
  }
});

window.flyToRec = function(recId) {
  const rec = recommendations.find(r => r.id === recId);
  if (!rec) return;
  map.flyTo([rec.lat, rec.lng], 14);

  // Open the corresponding marker popup
  markers.forEach(m => {
    const latlng = m.getLatLng();
    if (Math.abs(latlng.lat - rec.lat) < 0.0001 && Math.abs(latlng.lng - rec.lng) < 0.0001) {
      m.openPopup();
    }
  });
};

function clearTripMarkers() {
  tripMarkers.forEach(m => map.removeLayer(m));
  tripMarkers = [];
}

window.clearTrip = function() {
  document.getElementById('trip-results').classList.add('hidden');
  document.getElementById('trip-results').innerHTML = '';
  document.getElementById('trip-city').value = '';
  clearTripMarkers();
};

// ── Utilities ──
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ── Seed demo data if first visit ──
function seedDemoData() {
  if (friends.length > 0 || recommendations.length > 0) return;

  friends = [
    { id: 'demo1', name: 'Marco', color: '#e74c3c' },
    { id: 'demo2', name: 'Yuki', color: '#3498db' },
    { id: 'demo3', name: 'Priya', color: '#2ecc71' },
    { id: 'demo4', name: 'Sofia', color: '#f39c12' }
  ];

  recommendations = [
    { id: 'rec1', friendId: 'demo1', place: "Da Michele", cuisine: 'Pizza', note: 'The margherita is life-changing. Cash only!', rating: 5, lat: 40.8498, lng: 14.2632, url: 'https://damichele.net' },
    { id: 'rec2', friendId: 'demo1', place: "Mercado de San Miguel", cuisine: 'Tapas', note: 'Go early to avoid crowds. Try the jamón.', rating: 4, lat: 40.4153, lng: -3.7090, url: 'https://mercadodesanmiguel.es' },
    { id: 'rec3', friendId: 'demo2', place: "Tsukiji Outer Market", cuisine: 'Sushi', note: 'Best fresh sushi for breakfast. Sushi Dai is worth the wait.', rating: 5, lat: 35.6654, lng: 139.7707 },
    { id: 'rec4', friendId: 'demo2', place: "Ichiran Ramen", cuisine: 'Ramen', note: 'Order extra firm noodles and rich broth.', rating: 4, lat: 33.5902, lng: 130.4017, url: 'https://en.ichiran.com' },
    { id: 'rec5', friendId: 'demo3', place: "Karim's", cuisine: 'Mughlai', note: 'The mutton burra kebab is a must. Historic Old Delhi gem.', rating: 5, lat: 28.6507, lng: 77.2334 },
    { id: 'rec6', friendId: 'demo3', place: "Dishoom", cuisine: 'Indian', note: 'Bombay-style cafe. Black daal is legendary.', rating: 4, lat: 51.5176, lng: -0.0780, url: 'https://www.dishoom.com' },
    { id: 'rec7', friendId: 'demo4', place: "La Cabrera", cuisine: 'Steak', note: 'Best steak in Buenos Aires. The sides are amazing too.', rating: 5, lat: -34.5883, lng: -58.4252, url: 'https://www.lacabrera.com.ar' },
    { id: 'rec8', friendId: 'demo4', place: "Café de Flore", cuisine: 'French Café', note: 'Classic Parisian café. Great croque monsieur.', rating: 3, lat: 48.8540, lng: 2.3325, url: 'https://cafedeflore.fr' },
    { id: 'rec9', friendId: 'demo2', place: "Jay Fai", cuisine: 'Thai Street Food', note: 'Michelin-starred street food! Crab omelette is unreal.', rating: 5, lat: 13.7536, lng: 100.5014 },
    { id: 'rec10', friendId: 'demo1', place: "Schwartz's Deli", cuisine: 'Smoked Meat', note: 'Montreal smoked meat sandwich, medium fat. No debate.', rating: 4, lat: 45.5169, lng: -73.5577, url: 'https://www.schwartzsdeli.com' }
  ];

  save();
}

// ── Init ──
seedDemoData();
renderFriends();
renderMarkers();
