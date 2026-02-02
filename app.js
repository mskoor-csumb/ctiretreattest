// ── State ──
let friends = JSON.parse(localStorage.getItem('tastebuds_friends') || '[]');
let recommendations = JSON.parse(localStorage.getItem('tastebuds_recs') || '[]');
let selectedRating = 0;
let selectedColor = '#e74c3c';
let placingPin = false;
let markers = [];

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

  // Friend chips
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

  // Rec form select
  recSelect.innerHTML = '<option value="">Select a bud...</option>' +
    friends.map(f => `<option value="${f.id}">${escapeHtml(f.name)}</option>`).join('');

  // Filter select
  const currentFilter = filterSelect.value;
  filterSelect.innerHTML = '<option value="all">All Buds</option>' +
    friends.map(f => `<option value="${f.id}">${escapeHtml(f.name)}</option>`).join('');
  filterSelect.value = currentFilter;
}

// ── Render Map Markers ──
function renderMarkers() {
  // Clear existing
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
    const popupHtml = `
      <div class="popup-title">${escapeHtml(rec.place)}</div>
      ${rec.cuisine ? `<div class="popup-cuisine">${escapeHtml(rec.cuisine)}</div>` : ''}
      <div class="popup-stars">${stars}</div>
      ${rec.note ? `<div class="popup-note">"${escapeHtml(rec.note)}"</div>` : ''}
      <div class="popup-friend">Recommended by <strong style="color:${friend.color}">${escapeHtml(friend.name)}</strong></div>
      <button class="popup-delete-btn" onclick="deleteRec('${rec.id}')">Remove</button>
    `;

    const marker = L.marker([rec.lat, rec.lng], { icon: createMarkerIcon(friend.color) })
      .addTo(map)
      .bindPopup(popupHtml, { maxWidth: 260 });

    markers.push(marker);
  });
}

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

// ── Map Click for Pin Placement ──
map.on('click', (e) => {
  document.getElementById('rec-lat').value = e.latlng.lat.toFixed(6);
  document.getElementById('rec-lng').value = e.latlng.lng.toFixed(6);
  document.getElementById('placement-banner').classList.add('hidden');
  placingPin = false;
});

// Focus lat/lng fields to show placement banner
['rec-lat', 'rec-lng'].forEach(id => {
  document.getElementById(id).addEventListener('focus', () => {
    document.getElementById('placement-banner').classList.remove('hidden');
  });
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.getElementById('placement-banner').classList.add('hidden');
  }
});

// ── Add Recommendation Form ──
document.getElementById('rec-form').addEventListener('submit', (e) => {
  e.preventDefault();

  const friendId = document.getElementById('rec-friend').value;
  const place = document.getElementById('rec-place').value.trim();
  const cuisine = document.getElementById('rec-cuisine').value.trim();
  const note = document.getElementById('rec-note').value.trim();
  const lat = parseFloat(document.getElementById('rec-lat').value);
  const lng = parseFloat(document.getElementById('rec-lng').value);

  if (!friendId || !place || isNaN(lat) || isNaN(lng)) {
    alert('Please fill in the required fields and set a location on the map.');
    return;
  }

  recommendations.push({
    id: generateId(),
    friendId,
    place,
    cuisine,
    note,
    rating: selectedRating,
    lat,
    lng
  });

  save();
  renderFriends();
  renderMarkers();

  // Reset form
  document.getElementById('rec-form').reset();
  selectedRating = 0;
  updateStars();
  document.getElementById('rec-lat').value = '';
  document.getElementById('rec-lng').value = '';

  // Fly to the new pin
  map.flyTo([lat, lng], Math.max(map.getZoom(), 6));
});

// ── Filters ──
document.getElementById('filter-friend').addEventListener('change', renderMarkers);
document.getElementById('filter-cuisine').addEventListener('input', renderMarkers);

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
    { id: 'rec1', friendId: 'demo1', place: "Da Michele", cuisine: 'Pizza', note: 'The margherita is life-changing. Cash only!', rating: 5, lat: 40.8498, lng: 14.2632 },
    { id: 'rec2', friendId: 'demo1', place: "Mercado de San Miguel", cuisine: 'Tapas', note: 'Go early to avoid crowds. Try the jamón.', rating: 4, lat: 40.4153, lng: -3.7090 },
    { id: 'rec3', friendId: 'demo2', place: "Tsukiji Outer Market", cuisine: 'Sushi', note: 'Best fresh sushi for breakfast. Sushi Dai is worth the wait.', rating: 5, lat: 35.6654, lng: 139.7707 },
    { id: 'rec4', friendId: 'demo2', place: "Ichiran Ramen", cuisine: 'Ramen', note: 'Order extra firm noodles and rich broth.', rating: 4, lat: 33.5902, lng: 130.4017 },
    { id: 'rec5', friendId: 'demo3', place: "Karim's", cuisine: 'Mughlai', note: 'The mutton burra kebab is a must. Historic Old Delhi gem.', rating: 5, lat: 28.6507, lng: 77.2334 },
    { id: 'rec6', friendId: 'demo3', place: "Dishoom", cuisine: 'Indian', note: 'Bombay-style cafe. Black daal is legendary.', rating: 4, lat: 51.5176, lng: -0.0780 },
    { id: 'rec7', friendId: 'demo4', place: "La Cabrera", cuisine: 'Steak', note: 'Best steak in Buenos Aires. The sides are amazing too.', rating: 5, lat: -34.5883, lng: -58.4252 },
    { id: 'rec8', friendId: 'demo4', place: "Café de Flore", cuisine: 'French Café', note: 'Classic Parisian café. Great croque monsieur.', rating: 3, lat: 48.8540, lng: 2.3325 },
    { id: 'rec9', friendId: 'demo2', place: "Jay Fai", cuisine: 'Thai Street Food', note: 'Michelin-starred street food! Crab omelette is unreal.', rating: 5, lat: 13.7536, lng: 100.5014 },
    { id: 'rec10', friendId: 'demo1', place: "Schwartz's Deli", cuisine: 'Smoked Meat', note: 'Montreal smoked meat sandwich, medium fat. No debate.', rating: 4, lat: 45.5169, lng: -73.5577 }
  ];

  save();
}

// ── Init ──
seedDemoData();
renderFriends();
renderMarkers();
