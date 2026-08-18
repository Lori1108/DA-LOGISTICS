let storeData = null;
let map;
let routingControl;
let markers = [];
let routeWaypoints = [];

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
    // Inicializar en Lima por defecto si no hay pedidos (puedes cambiarlo)
    map = L.map('map').setView([-12.046374, -77.042793], 12);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
}

// Función para geocodificar usando Nominatim (gratuito)
async function geocodeAddress(address) {
    if (!address || address.trim() === '') return null;
    
    try {
        // Agregamos contexto para ayudar a Nominatim (asumimos Perú si no se especifica)
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

// Limpiar mapa
function clearMap() {
    markers.forEach(m => map.removeLayer(m));
    markers = [];
    if (routingControl) {
        map.removeControl(routingControl);
        routingControl = null;
    }
    routeWaypoints = [];
}

let currentDriverPos = null;

async function renderDeliveriesAndMap() {
    const list = document.getElementById('deliveries-list');
    
    let orders = storeData.orders || [];
    let deliveries = orders.filter(o => o.deliveryDate || o.deliveryAddress);
    
    if (deliveries.length === 0) {
        list.innerHTML = `<p style="text-align:center; color:var(--text-secondary); padding: 40px;">No hay pedidos para entregar en este momento.</p>`;
        return;
    }

    list.innerHTML = `<p style="text-align:center; padding: 20px;">Obteniendo tu ubicación actual para ordenar los pedidos por cercanía...</p>`;
    
    const getPosition = () => new Promise((resolve) => {
        if (!navigator.geolocation) return resolve(null);
        navigator.geolocation.getCurrentPosition(
            (pos) => resolve(L.latLng(pos.coords.latitude, pos.coords.longitude)),
            () => resolve(null),
            { enableHighAccuracy: true, timeout: 5000 }
        );
    });

    currentDriverPos = await getPosition();

    // Geocodificar direcciones faltantes y calcular distancias
    for (let i = 0; i < deliveries.length; i++) {
        let order = deliveries[i];
        if (order.deliveryStatus === 'Pendiente' && order.deliveryAddress) {
            if (order.deliveryLat && order.deliveryLng) {
                order._latLng = L.latLng(order.deliveryLat, order.deliveryLng);
            } else {
                order._latLng = await geocodeAddress(order.deliveryAddress);
            }
            
            if (currentDriverPos && order._latLng) {
                order._distance = currentDriverPos.distanceTo(order._latLng);
            } else {
                order._distance = 9999999;
            }
        }
    }

    deliveries.sort((a, b) => {
        if (a.deliveryStatus === 'Pendiente' && b.deliveryStatus !== 'Pendiente') return -1;
        if (a.deliveryStatus !== 'Pendiente' && b.deliveryStatus === 'Pendiente') return 1;
        if (a.deliveryStatus === 'Pendiente' && b.deliveryStatus === 'Pendiente') {
             if (currentDriverPos) {
                  return (a._distance || 9999999) - (b._distance || 9999999);
             }
        }
        return new Date(b.fecha) - new Date(a.fecha);
    });

    clearMap();
    let html = '';
    let pendingCount = 1;
    
    for (let i = 0; i < deliveries.length; i++) {
        const order = deliveries[i];
        const isEntregado = order.deliveryStatus === 'Entregado';
        
        let stopLabel = isEntregado ? '✅' : pendingCount++;
        
        let distText = "";
        let missingCoordsWarning = "";
        
        if (!isEntregado) {
            if (order._distance && order._distance < 9999999) {
                distText = `<br><span style="font-size:11px; color:var(--text-secondary);">📍 a ${(order._distance / 1000).toFixed(2)} km de distancia</span>`;
            } else if (!order._latLng) {
                missingCoordsWarning = `<div style="background: rgba(239, 68, 68, 0.1); color: #ef4444; font-size: 11px; padding: 6px; border-radius: 4px; margin-top: 5px;">⚠️ Coordenadas GPS faltantes. El administrador debe "Fijar Ubicación en Mapa" al editar este cliente para poder trazar la ruta.</div>`;
            }
        }

        if (!isEntregado && order._latLng) {
            const marker = L.marker(order._latLng).addTo(map);
            marker.bindPopup(`<b>Parada ${stopLabel}:</b> ${order.cliente}<br>${order.deliveryAddress}`);
            markers.push(marker);
        }

        html += `
        <div class="order-card ${isEntregado ? 'entregado' : ''}" id="order-${order.id}">
            <div class="order-header">
                <span><span style="background:var(--primary);color:white;padding:2px 6px;border-radius:4px;font-size:12px;margin-right:5px;">${stopLabel}</span> ${order.cliente}</span>
                <span style="color: ${isEntregado ? 'var(--success)' : 'var(--warning)'}; font-size:12px; padding: 4px 8px; border-radius: 12px; background: ${isEntregado ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)'};">
                    ${order.deliveryStatus || 'Pendiente'}
                </span>
            </div>
            <div class="order-meta">
                <p>📍 <strong>Dirección:</strong> ${order.deliveryAddress || 'No especificada'} ${distText}</p>
                ${missingCoordsWarning}
                <p style="margin-top:5px;">📞 <strong>Teléfono:</strong> <a href="tel:${order.telefono}" style="color: var(--primary);">${order.telefono}</a></p>
                <p>🕒 <strong>Fecha programada:</strong> ${order.deliveryDate || 'N/A'} ${order.deliveryTime || ''}</p>
            </div>
            <div class="order-items">
                <div style="font-weight:bold; margin-bottom: 5px; border-bottom: 1px solid var(--border-color); padding-bottom: 4px;">Productos a entregar:</div>
                ${order.items.map(it => `
                    <div class="item-row">
                        <span>${it.qty}x ${it.nombre} (${it.presentacion})</span>
                    </div>
                `).join('')}
            </div>
            <div class="action-row" style="flex-wrap: wrap;">
                ${!isEntregado && order._latLng ? `<button class="btn-secondary" onclick="showRouteOnMap(${order._latLng.lat}, ${order._latLng.lng}, '${order.cliente}')" style="font-size:12px; padding: 6px 10px; flex: 1;">📍 Ver en Mapa</button>` : ''}
                ${!isEntregado ? `<a href="https://www.google.com/maps/dir/?api=1&destination=${order._latLng ? `${order._latLng.lat},${order._latLng.lng}` : encodeURIComponent(order.deliveryAddress)}" target="_blank" class="btn-secondary" style="font-size:12px; padding: 6px 10px; text-decoration:none; text-align:center; flex: 1;">📱 Google Maps</a>` : ''}
                ${!isEntregado ? `<button class="btn-primary" onclick="markDelivered('${order.id}')" style="background: var(--success); border-color: var(--success); font-size:12px; padding: 6px 10px; flex: 1;">Entregado ✅</button>` : ''}
            </div>
        </div>
        `;
    }

    list.innerHTML = html;

    if (currentDriverPos) {
        const startMarker = L.marker(currentDriverPos, {
            icon: L.icon({
                iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
                shadowSize: [41, 41]
            })
        }).addTo(map);
        startMarker.bindPopup("<b>📍 Tu ubicación actual</b>").openPopup();
        markers.push(startMarker);
    }
    
    if (markers.length > 0) {
        const group = new L.featureGroup(markers);
        map.fitBounds(group.getBounds().pad(0.1));
    }
}

window.showRouteOnMap = function(lat, lng, cliente) {
    if (!currentDriverPos) {
        alert("No pudimos obtener tu ubicación actual para trazar la ruta. Asegúrate de tener el GPS activado.");
        return;
    }
    
    if (routingControl) {
        map.removeControl(routingControl);
        routingControl = null;
    }

    const destLatLng = L.latLng(lat, lng);

    routingControl = L.Routing.control({
        waypoints: [currentDriverPos, destLatLng],
        routeWhileDragging: false,
        addWaypoints: false,
        show: false,
        lineOptions: {
            styles: [{color: '#3b82f6', opacity: 0.8, weight: 6}]
        },
        createMarker: function() { return null; } // No crear marcadores adicionales del router
    }).addTo(map);

    // Centrar mapa
    const group = new L.featureGroup([L.marker(currentDriverPos), L.marker(destLatLng)]);
    map.fitBounds(group.getBounds().pad(0.1));
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function markDelivered(orderId) {
    if (!confirm('¿Estás seguro que deseas marcar este pedido como entregado?')) return;

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
                await renderDeliveriesAndMap();
                alert('Pedido marcado como entregado correctamente.');
            } else {
                alert('Error guardando en la base de datos.');
                orders[index].deliveryStatus = 'Pendiente';
            }
        } catch (err) {
            alert('Error de red al actualizar pedido.');
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

// Iniciar app
document.addEventListener("DOMContentLoaded", fetchOrders);
