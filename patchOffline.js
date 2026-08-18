const fs = require('fs');

let code = fs.readFileSync('C:\\Users\\jrengifo\\Downloads\\BILO\\public\\app.js', 'utf8');

const offlineLogic = `
// --- OFFLINE POS LOGIC ---
window.downloadOfflinePOS = async function() {
    try {
        const res = await fetch('/offline-template.html');
        let html = await res.text();
        
        const clients = LocalDB.getClients();
        const products = LocalDB.getProducts();
        
        html = html.replace('__CLIENTS_DATA__', JSON.stringify(clients));
        html = html.replace('__PRODUCTS_DATA__', JSON.stringify(products));
        
        const dataStr = "data:text/html;charset=utf-8," + encodeURIComponent(html);
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "BILO_POS_Offline.html");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    } catch (e) {
        alert('Error al generar POS Offline: ' + e.message);
    }
}

window.handleOfflineUpload = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const uploadedOrders = JSON.parse(e.target.result);
            if (!Array.isArray(uploadedOrders)) throw new Error("Formato inválido.");
            
            let orders = LocalDB.getOrders();
            let products = LocalDB.getProducts();
            
            let newCount = 0;
            
            uploadedOrders.forEach(o => {
                // Evitar duplicados por id
                if (!orders.find(existing => existing.id === o.id)) {
                    orders.push(o);
                    newCount++;
                    
                    // Descontar inventario
                    o.items.forEach(item => {
                        const prod = products.find(p => p.id === item.id);
                        if (prod) {
                            let currentTotal = getProductTotalUnits(prod);
                            let qtyToDeduct = item.qty * getPresentationMultiplier(item.presentacion);
                            updateProductStockFromTotal(prod, currentTotal - qtyToDeduct);
                        }
                    });
                }
            });
            
            if (newCount > 0) {
                LocalDB.saveOrders(orders);
                LocalDB.saveProducts(products);
                if (IS_SERVER) {
                    saveAllDataToServer(products, orders, LocalDB.getClients());
                }
                alert(\`¡Se sincronizaron \${newCount} pedidos correctamente!\`);
                renderProductsGrid();
                if(DOM.historyTableBody) renderHistoryTable();
            } else {
                alert('No se encontraron pedidos nuevos en el archivo.');
            }
            
        } catch (err) {
            alert('Error al leer el archivo. Asegúrate de subir el archivo .json exportado del POS Offline.');
        }
        // Limpiar input
        document.getElementById('offline-upload-input').value = "";
    };
    reader.readAsText(file);
}
`;

code = code + '\n' + offlineLogic;

fs.writeFileSync('C:\\Users\\jrengifo\\Downloads\\BILO\\public\\app.js', code);
console.log("Offline logic injected successfully!");
