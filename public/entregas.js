let storeData = null;
let map;
let routingControl;
let markers = [];
let routeWaypoints = [];
let currentDriverPos = null;
let currentTab = 'pendientes';

async function fetchOrders() {
    try {
        const res = await fetch('/api/data');
        storeData = await res.json();
        
        initMap();
        await renderDeliveriesAndMap();
    } catch (e) {
        document.getElementById('deliveries-list').innerHTML = `<p style="color:red; text-align:center;">Error al cargar las entregas.</p>`;
    }
}

function initMap() {
    map = L.map('map', { zoomControl: false }).setView([-12.046374, -77.042793], 12);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    
    L.control.zoom({ position: 'topright' }).addTo(map);
}

async function geocodeAddress(address) {
    if (!address || address.trim() === '') return null;
    try {
        const searchQuery = encodeURIComponent(address + ", Peru");
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${searchQuery}&limit=1`);
        const data = await response.json();
        
        if (data && data.length > 0) {
            return L.latLng(data[0].lat, data[0].lon);
        }
    } catch (error) {
        console.error("Error geocoding:", error);
    }
    return null;
}

function clearMap() {
    markers.forEach(m => map.removeLayer(m));
    markers = [];
    if (routingControl) {
        map.removeControl(routingControl);
        routingControl = null;
    }
    routeWaypoints = [];
}

const getPosition = () => new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
        (pos) => resolve(L.latLng(pos.coords.latitude, pos.coords.longitude)),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 5000 }
    );
});

// UI Toggles
window.switchTab = function(tabId) {
    currentTab = tabId;
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`tab-${tabId}`).classList.add('active');
    renderDeliveriesAndMap(false); // don't refetch GPS every tab switch
}

window.toggleMobileView = function(view) {
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    document.getElementById(`nav-${view}`).classList.add('active');
    
    if (view === 'map') {
        document.body.classList.add('show-map');
        setTimeout(() => map.invalidateSize(), 300); // fix leaflet map render bug when hidden
    } else {
        document.body.classList.remove('show-map');
    }
}

// Global colors for markers OptimoRoute style
const colors = ['#f39c12', '#3498db', '#e74c3c', '#9b59b6', '#2ecc71', '#1abc9c', '#e67e22', '#34495e'];

async function renderDeliveriesAndMap(fetchGps = true) {
    const list = document.getElementById('deliveries-list');
    let orders = storeData.orders || [];
    let deliveries = orders.filter(o => o.deliveryDate || o.deliveryAddress || (o.deliveryLat && o.deliveryLng));
    
    if (deliveries.length === 0) {
        list.innerHTML = `<p style="text-align:center; color:#888; padding: 40px;">No hay pedidos para entregar en este momento.</p>`;
        return;
    }

    if (fetchGps && currentTab === 'pendientes') {
        list.innerHTML = `<p style="text-align:center; color:#888; padding: 20px;">Ubicando tu posición actual...</p>`;
        currentDriverPos = await getPosition();
    }

    // Geocode and calc distance
    for (let i = 0; i < deliveries.length; i++) {
        let order = deliveries[i];
        if (order.deliveryStatus === 'Pendiente' && (order.deliveryAddress || (order.deliveryLat && order.deliveryLng))) {
            if (order.deliveryLat && order.deliveryLng) {
                order._latLng = L.latLng(order.deliveryLat, order.deliveryLng);
            } else if (!order._latLng) { // don't geocode again if we did
                order._latLng = await geocodeAddress(order.deliveryAddress);
            }
            
            if (currentDriverPos && order._latLng) {
                order._distance = currentDriverPos.distanceTo(order._latLng);
            } else {
                order._distance = 9999999;
            }
        }
    }

    // Filter by tab
    let filteredDeliveries = deliveries.filter(o => {
        if (currentTab === 'pendientes') return o.deliveryStatus === 'Pendiente';
        return o.deliveryStatus === 'Entregado';
    });

    if (currentTab === 'pendientes') {
        filteredDeliveries.sort((a, b) => {
            if (currentDriverPos) {
                return (a._distance || 9999999) - (b._distance || 9999999);
            }
            return new Date(a.fecha) - new Date(b.fecha);
        });
    } else {
        filteredDeliveries.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    }

    clearMap();
    let html = '';
    
    if (filteredDeliveries.length === 0) {
        html = `<p style="text-align:center; color:#888; padding: 40px;">No hay pedidos en esta sección.</p>`;
    }
    
    let pendingCount = 1;
    
    for (let i = 0; i < filteredDeliveries.length; i++) {
        const order = filteredDeliveries[i];
        const isEntregado = order.deliveryStatus === 'Entregado';
        
        let stopNum = pendingCount++;
        let stopLabel = isEntregado ? '✓' : stopNum;
        let color = isEntregado ? '#2ecc71' : colors[stopNum % colors.length];
        
        let distText = "";
        let missingCoordsWarning = "";
        
        if (!isEntregado) {
            if (order._distance && order._distance < 9999999) {
                distText = `<br><span style="font-size:11px; color:#888;">📍 a ${(order._distance / 1000).toFixed(2)} km</span>`;
            } else if (!order._latLng) {
                missingCoordsWarning = `<div style="background: #fee2e2; color: #ef4444; font-size: 11px; padding: 6px; border-radius: 4px; margin-top: 5px;">⚠️ Sin GPS. Editar cliente para fijar mapa.</div>`;
            }
        }

        // Add Marker to map
        if (order._latLng) {
            const markerHtml = `
                <div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 50%; display: flex; justify-content: center; align-items: center; color: white; font-weight: bold; font-size: 12px; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">
                    ${stopLabel}
                </div>
            `;
            const icon = L.divIcon({ html: markerHtml, className: '', iconSize: [24, 24], iconAnchor: [12, 12] });
            const marker = L.marker(order._latLng, { icon }).addTo(map);
            marker.bindPopup(`<b>Parada ${stopLabel}:</b> ${order.cliente}<br>${order.deliveryAddress}`);
            markers.push(marker);
        }

        html += `
        <div class="order-card ${isEntregado ? 'entregado' : ''}" style="border-left-color: ${color}">
            <div class="order-header">
                <span class="icon-type">🚚</span>
                <span style="flex:1;">${order.cliente}</span>
                <span style="font-size:12px; font-weight:normal; color:#888;">${order.deliveryTime || ''}</span>
            </div>
            <div class="order-meta">
                ${order.deliveryAddress || 'Coordenadas GPS (Sin texto)'} ${distText}
                ${missingCoordsWarning}
                <div style="margin-top:4px;"><a href="tel:${order.telefono}" style="color:#3498db; text-decoration:none;">📞 ${order.telefono || 'Sin número'}</a></div>
            </div>
            <div class="order-items">
                ${order.items.map(it => `<div>${it.qty}x ${it.nombre} (${it.presentacion})</div>`).join('')}
            </div>
            <div class="action-row">
                ${!isEntregado && order._latLng ? `<button class="btn-action outline" onclick="showRouteOnMap(${order._latLng.lat}, ${order._latLng.lng})">📍 Ruta</button>` : ''}
                ${!isEntregado ? `<a href="https://www.google.com/maps/dir/?api=1&destination=${order._latLng ? `${order._latLng.lat},${order._latLng.lng}` : encodeURIComponent(order.deliveryAddress)}" target="_blank" class="btn-action outline" style="text-decoration:none;">🗺️ G. Maps</a>` : ''}
                ${!isEntregado ? `<button class="btn-action success" onclick="markDelivered('${order.id}')">Entregado ✓</button>` : ''}
            </div>
        </div>
        `;
    }

    list.innerHTML = html;

    if (currentDriverPos) {
        const markerHtml = `
            <div style="background-color: #34495e; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.5);"></div>
        `;
        const startMarker = L.marker(currentDriverPos, {
            icon: L.divIcon({ html: markerHtml, className: '', iconSize: [16, 16], iconAnchor: [8, 8] })
        }).addTo(map);
        startMarker.bindPopup("<b>📍 Tu ubicación actual</b>").openPopup();
        markers.push(startMarker);
    }
    
    if (markers.length > 0) {
        const group = new L.featureGroup(markers);
        map.fitBounds(group.getBounds().pad(0.1));
    }
}

window.showRouteOnMap = function(lat, lng) {
    if (!currentDriverPos) {
        alert("No pudimos obtener tu ubicación actual.");
        return;
    }
    
    if (routingControl) {
        map.removeControl(routingControl);
        routingControl = null;
    }

    const destLatLng = L.latLng(lat, lng);

    routingControl = L.Routing.control({
        waypoints: [currentDriverPos, destLatLng],
        router: L.Routing.osrmv1({ language: 'es', profile: 'driving' }),
        routeWhileDragging: false,
        addWaypoints: false,
        show: false,
        lineOptions: { styles: [{color: '#0f2b45', opacity: 0.8, weight: 6}] },
        createMarker: function() { return null; }
    }).addTo(map);

    const group = new L.featureGroup([L.marker(currentDriverPos), L.marker(destLatLng)]);
    map.fitBounds(group.getBounds().pad(0.1));
    
    // Switch to map view automatically on mobile
    if(window.innerWidth <= 768) {
        toggleMobileView('map');
    }
}

window.markDelivered = async function(orderId) {
    if (!confirm('¿Marcar pedido como entregado?')) return;

    let orders = storeData.orders || [];
    const index = orders.findIndex(o => o.id === orderId);
    
    if (index > -1) {
        orders[index].deliveryStatus = 'Entregado';
        
        try {
            const res = await fetch('/api/data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orders: orders })
            });
            const result = await res.json();
            if(result.success) {
                storeData.orders = orders;
                await renderDeliveriesAndMap(false);
            } else {
                orders[index].deliveryStatus = 'Pendiente';
            }
        } catch (err) {
            orders[index].deliveryStatus = 'Pendiente';
        }
    }
}

async function logout() {
    try {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/';
    } catch (e) {
        window.location.href = '/';
    }
}

document.addEventListener("DOMContentLoaded", fetchOrders);
