let storeData = null;

async function fetchOrders() {
    try {
        const res = await fetch('/api/data');
        storeData = await res.json();
        renderDeliveries();
    } catch (e) {
        document.getElementById('deliveries-list').innerHTML = `<p style="color:red; text-align:center;">Error al cargar las entregas.</p>`;
    }
}

function renderDeliveries() {
    const list = document.getElementById('deliveries-list');
    
    let orders = storeData.orders || [];
    // Filtramos los pedidos que tienen fecha/dirección de entrega y ordenamos por estado/fecha
    let deliveries = orders.filter(o => o.deliveryDate || o.deliveryAddress);
    
    if (deliveries.length === 0) {
        list.innerHTML = `<p style="text-align:center; color:var(--text-secondary); padding: 40px;">No hay pedidos para entregar en este momento.</p>`;
        return;
    }

    deliveries.sort((a, b) => {
        if (a.deliveryStatus === 'Pendiente' && b.deliveryStatus !== 'Pendiente') return -1;
        if (a.deliveryStatus !== 'Pendiente' && b.deliveryStatus === 'Pendiente') return 1;
        
        return new Date(b.fecha) - new Date(a.fecha);
    });

    let html = '';
    deliveries.forEach(order => {
        const isEntregado = order.deliveryStatus === 'Entregado';
        
        html += `
        <div class="order-card ${isEntregado ? 'entregado' : ''}">
            <div class="order-header">
                <span>Cliente: ${order.cliente}</span>
                <span style="color: ${isEntregado ? 'var(--success)' : 'var(--warning)'}; font-size:12px; padding: 4px 8px; border-radius: 12px; background: ${isEntregado ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)'};">
                    ${order.deliveryStatus || 'Pendiente'}
                </span>
            </div>
            <div class="order-meta">
                <p>📍 <strong>Dirección:</strong> ${order.deliveryAddress || 'No especificada'}</p>
                <p>📞 <strong>Teléfono:</strong> <a href="tel:${order.telefono}" style="color: var(--primary);">${order.telefono}</a></p>
                <p>🕒 <strong>Fecha programada:</strong> ${order.deliveryDate || 'N/A'} ${order.deliveryTime || ''}</p>
                <p style="font-size: 11px; margin-top: 4px;">Folio: ${order.folio}</p>
            </div>
            <div class="order-items">
                <div style="font-weight:bold; margin-bottom: 5px; border-bottom: 1px solid var(--border-color); padding-bottom: 4px;">Productos a entregar:</div>
                ${order.items.map(i => `
                    <div class="item-row">
                        <span>${i.qty}x ${i.nombre} (${i.presentacion})</span>
                    </div>
                `).join('')}
            </div>
            <div class="action-row">
                ${!isEntregado ? `<button class="btn-primary" onclick="markDelivered('${order.id}')" style="background: var(--success); border-color: var(--success); font-size:13px;">Marcar como Entregado ✅</button>` : ''}
            </div>
        </div>
        `;
    });

    list.innerHTML = html;
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
                renderDeliveries();
                alert('Pedido marcado como entregado correctamente.');
            } else {
                alert('Error guardando en la base de datos.');
                orders[index].deliveryStatus = 'Pendiente'; // rollback
            }
        } catch (err) {
            alert('Error de red al actualizar pedido.');
            orders[index].deliveryStatus = 'Pendiente'; // rollback
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
