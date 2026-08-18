/**
 * app.js - Lógica principal del Punto de Venta Offline de PulpoCigars
 * Controla el almacenamiento local, el carrito, el catálogo, las fotos y el historial.
 */

// =========================================================================
// 1. CONFIGURACIÓN DE BASE DE DATOS LOCAL Y SEMILLAS
// =========================================================================
const DEFAULT_PRODUCTS = [
    {
        id: "1",
        nombre: "Marlboro Red",
        marca: "Marlboro",
        descripcion: "Sabor clásico americano, filtro corcho",
        precio_cajetilla: 75.0,
        precio_paquete: 720.0,
        precio_cajon: 6800.0,
        stock_cajetilla: 50,
        stock_paquete: 20,
        stock_cajon: 5,
        ruta_imagen: "" 
    },
    {
        id: "2",
        nombre: "Lucky Strike Click",
        marca: "Lucky Strike",
        descripcion: "Con cápsula de menta fresca",
        precio_cajetilla: 70.0,
        precio_paquete: 680.0,
        precio_cajon: 6500.0,
        stock_cajetilla: 40,
        stock_paquete: 15,
        stock_cajon: 4,
        ruta_imagen: ""
    },
    {
        id: "3",
        nombre: "Camel Original",
        marca: "Camel",
        descripcion: "Tabaco rubio aromático",
        precio_cajetilla: 72.0,
        precio_paquete: 690.0,
        precio_cajon: 6600.0,
        stock_cajetilla: 35,
        stock_paquete: 12,
        stock_cajon: 3,
        ruta_imagen: ""
    },
    {
        id: "4",
        nombre: "Pall Mall XL",
        marca: "Pall Mall",
        descripcion: "Filtro suave mayor rendimiento",
        precio_cajetilla: 65.0,
        precio_paquete: 620.0,
        precio_cajon: 5900.0,
        stock_cajetilla: 60,
        stock_paquete: 25,
        stock_cajon: 6,
        ruta_imagen: ""
    },
    {
        id: "5",
        nombre: "Cohiba Siglo II",
        marca: "Cohiba",
        descripcion: "Puro habano premium hecho a mano",
        precio_cajetilla: 450.0,
        precio_paquete: 4200.0,
        precio_cajon: 39000.0,
        stock_cajetilla: 15,
        stock_paquete: 5,
        stock_cajon: 2,
        ruta_imagen: ""
    }
];

const AppState = {
    currentTab: "pos-tab",
    activeBrandFilter: "all",
    searchQuery: "",
    cart: [], // Array de: { product: {}, presentation: 'cajetilla'|'paquete'|'cajon', qty: Number, activePrice: Number }
    selectedOrderForDetails: null,
    uploadedImageBase64: "", // Imagen actual en el formulario de catálogo
    productStatesInPOS: {} // Almacena qué presentación está seleccionada por id de producto en el POS
};

const IS_SERVER = false; // Forzamos false para usar LocalDB que interactúa con /api/data
const API_URL = "";

function saveFileViaServer(filename, content, type = 'text') {
    fallbackDownload(filename, content, type);
}

function fallbackDownload(filename, content, type) {
    let dataStr = "";
    if (type === 'base64') {
        dataStr = content;
    } else {
        dataStr = "data:text/json;charset=utf-8,\uFEFF" + encodeURIComponent(content);
    }
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", filename);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
}

class LocalDB {
    static async initAsync() {
        try {
            const res = await fetch('/api/data');
            const data = await res.json();
            AppState.products = (data.products && data.products.length > 0) ? data.products : DEFAULT_PRODUCTS;
            AppState.orders = data.orders || [];
            AppState.clients = (data.clients && data.clients.length > 0) ? data.clients : [
                { id: "c1", nombre: "Cliente General", telefono: "-", email: "" }
            ];
        } catch (err) {
            console.error("Error cargando desde Neon DB:", err);
            AppState.products = DEFAULT_PRODUCTS;
            AppState.orders = [];
            AppState.clients = [
                { id: "c1", nombre: "Cliente General", telefono: "-", email: "" }
            ];
        }
    }

    static getProducts() {
        return AppState.products;
    }

    static saveProducts(products) {
        AppState.products = products;
        fetch('/api/data', { method: 'POST', body: JSON.stringify({ products }) }).catch(console.error);
    }

    static getOrders() {
        return AppState.orders;
    }

    static saveOrders(orders) {
        AppState.orders = orders;
        fetch('/api/data', { method: 'POST', body: JSON.stringify({ orders }) }).catch(console.error);
    }

    static getClients() {
        return AppState.clients;
    }

    static saveClients(clients) {
        AppState.clients = clients;
        fetch('/api/data', { method: 'POST', body: JSON.stringify({ clients }) }).catch(console.error);
    }
}



// =========================================================================
// 3. SELECCIÓN DE ELEMENTOS DEL DOM
// =========================================================================
const DOM = {
    navButtons: document.querySelectorAll(".nav-btn"),
    tabPanes: document.querySelectorAll(".tab-pane"),
    
    // POS / Ventas
    brandsBar: document.getElementById("brands-bar"),
    productsGrid: document.getElementById("products-grid"),
    searchInput: document.getElementById("search-input"),
    menuTitle: document.getElementById("menu-title"),
    
    // Carrito / Factura
    clientName: document.getElementById("client-name"),
    clientPhone: document.getElementById("client-phone"),
    cartEmptyState: document.getElementById("cart-empty-state"),
    cartItemsList: document.getElementById("cart-items-list"),
    summarySubtotal: document.getElementById("summary-subtotal"),
    summaryTotal: document.getElementById("summary-total"),
    paymentBtns: document.querySelectorAll(".payment-btn"),
    btnPlaceOrder: document.getElementById("btn-place-order"),
    
    // Catálogo
    catalogForm: document.getElementById("catalog-form"),
    editProductId: document.getElementById("edit-product-id"),
    prodName: document.getElementById("prod-name"),
    prodBrand: document.getElementById("prod-brand"),
    prodDesc: document.getElementById("prod-desc"),
    priceCajetilla: document.getElementById("price-cajetilla"),
    costCajetilla: document.getElementById("cost-cajetilla"),
    stockCajetilla: document.getElementById("stock-cajetilla"),
    pricePaquete: document.getElementById("price-paquete"),
    costPaquete: document.getElementById("cost-paquete"),
    stockPaquete: document.getElementById("stock-paquete"),
    priceCajon: document.getElementById("price-cajon"),
    costCajon: document.getElementById("cost-cajon"),
    stockCajon: document.getElementById("stock-cajon"),
    prodImageFile: document.getElementById("prod-image-file"),
    imgFormPreview: document.getElementById("img-form-preview"),
    imgFormPreviewContainer: document.getElementById("img-form-preview-container"),
    btnRemoveFormImg: document.getElementById("btn-remove-form-img"),
    btnClearCatalogForm: document.getElementById("btn-clear-catalog-form"),
    catalogFormTitle: document.getElementById("catalog-form-title"),
    btnSubmitProduct: document.getElementById("btn-submit-product"),
    catalogSearchInput: document.getElementById("catalog-search-input"),
    catalogTableBody: document.getElementById("catalog-table-body"),
    
    // Historial
    historySearchInput: document.getElementById("history-search-input"),
    historyTableBody: document.getElementById("history-table-body"),
    historyDetailsContainer: document.getElementById("history-details-container"),
    detailsEmptyState: document.getElementById("details-empty-state"),
    orderDetailsCard: document.getElementById("order-details-card"),
    detailsFolio: document.getElementById("details-folio"),
    detailsDate: document.getElementById("details-date"),
    detailsClientName: document.getElementById("details-client-name"),
    detailsClientPhone: document.getElementById("details-client-phone"),
    detailsPaymentMethod: document.getElementById("details-payment-method"),
    detailsItemsList: document.getElementById("details-items-list"),
    detailsTotal: document.getElementById("details-total"),
    btnDeleteOrder: document.getElementById("btn-delete-order"),
    btnExportInventory: document.getElementById("btn-export-inventory"),
    btnImportInventory: document.getElementById("btn-import-inventory"),
    btnDownloadOrderSheet: document.getElementById("btn-download-order-sheet"),
    fileImportInventory: document.getElementById("file-import-inventory"),
    statProductsCount: document.getElementById("stat-products-count"),
    dashTotalProducts: document.getElementById("dash-total-products"),
    dashLowStock: document.getElementById("dash-low-stock"),
    dashOutOfStock: document.getElementById("dash-out-of-stock"),
    
    // Pestañas Nuevas
    btnClientsTab: document.getElementById("btn-clients-tab"),
    btnAnalyticsTab: document.getElementById("btn-analytics-tab"),
    
    // Gestión de Clientes (Formulario & Tabla)
    clientForm: document.getElementById("client-form"),
    editClientId: document.getElementById("edit-client-id"),
    cName: document.getElementById("c-name"),
    cPhone: document.getElementById("c-phone"),
    cEmail: document.getElementById("c-email"),
    cAddress: document.getElementById("c-address"),
    btnSubmitClient: document.getElementById("btn-submit-client"),
    btnClearClientForm: document.getElementById("btn-clear-client-form"),
    clientSearchInput: document.getElementById("client-search-input"),
    clientsTableBody: document.getElementById("clients-table-body"),
    clientFormTitle: document.getElementById("client-form-title"),
    btnExportClientsExcel: document.getElementById("btn-export-clients-excel"),
    btnImportClientsExcel: document.getElementById("btn-import-clients-excel"),
    fileImportClients: document.getElementById("file-import-clients"),
    
    // Buscador predictivo en Carrito
    clientSelectInput: document.getElementById("client-select-input"),
    clientDropdown: document.getElementById("client-dropdown"),
    btnClearSelectedClient: document.getElementById("btn-clear-selected-client"),
    selectedClientBadge: document.getElementById("selected-client-badge"),
    selectedClientNameDisplay: document.getElementById("selected-client-name-display"),
    
    // Descuentos en Carrito
    discountType: document.getElementById("discount-type"),
    discountValue: document.getElementById("discount-value"),
    discountTotalRow: document.getElementById("discount-total-row"),
    summaryDiscount: document.getElementById("summary-discount"),
    
    // Analíticas
    kpiGrossSales: document.getElementById("kpi-gross-sales"),
    kpiTicketCount: document.getElementById("kpi-ticket-count"),
    kpiAverageTicket: document.getElementById("kpi-average-ticket"),
    kpiProfitMargin: document.getElementById("kpi-profit-margin"),
    paymentMethodsAnalytics: document.getElementById("payment-methods-analytics"),
    topProductsAnalytics: document.getElementById("top-products-analytics"),
    
    // Impresión y Exportación de Pedidos en Historial
    btnPrintHistoryOrder: document.getElementById("btn-print-history-order"),
    btnExportOrderExcel: document.getElementById("btn-export-order-excel"),
    btnExportAllOrdersExcel: document.getElementById("btn-export-all-orders-excel"),

    // Modal de Venta Flexible
    productModal: document.getElementById("product-modal"),
    btnCloseProductModal: document.getElementById("btn-close-product-modal"),
    modalCigTitle: document.getElementById("modal-cig-title"),
    modalCigImgContainer: document.getElementById("modal-cig-img-container"),
    modalPriceInput: document.getElementById("modal-price-input"),
    modalQtyInput: document.getElementById("modal-qty-input"),
    btnModalQtyMinus: document.getElementById("btn-modal-qty-minus"),
    btnModalQtyPlus: document.getElementById("btn-modal-qty-plus"),
    modalStockInfo: document.getElementById("modal-stock-info"),
    modalSubtotalDisplay: document.getElementById("modal-subtotal-display"),
    btnModalAddToCart: document.getElementById("btn-modal-add-to-cart"),

    // Modal de Venta Exitosa
    modalSaleSuccess: document.getElementById("modal-sale-success"),
    closeSaleSuccess: document.getElementById("close-sale-success"),
    saleSuccessFolio: document.getElementById("sale-success-folio"),
    btnDownloadReceipt: document.getElementById("btn-download-receipt"),
    btnSkipReceipt: document.getElementById("btn-skip-receipt")
};

// =========================================================================
// 3.5. RESUMEN DINÁMICO DE INVENTARIO
// =========================================================================
function updateInventoryStats() {
    const products = LocalDB.getProducts();
    const totalCount = products.length;
    
    let lowStockCount = 0;
    let outOfStockCount = 0;
    
    products.forEach(p => {
        const sCaj = parseInt(p.stock_cajetilla) || 0;
        const sPaq = parseInt(p.stock_paquete) || 0;
        const sCajon = parseInt(p.stock_cajon) || 0;
        
        // Bajo stock: al menos una de las presentaciones tiene entre 1 y 5 unidades
        if ((sCaj > 0 && sCaj <= 5) || (sPaq > 0 && sPaq <= 5) || (sCajon > 0 && sCajon <= 5)) {
            lowStockCount++;
        }
        
        // Agotado: al menos una de las presentaciones está en 0
        if (sCaj === 0 || sPaq === 0 || sCajon === 0) {
            outOfStockCount++;
        }
    });

    // Calcular suma total de stock por unidades
    let totCaj = 0, totPaq = 0, totCj = 0;
    products.forEach(p => {
        totCaj += parseInt(p.stock_cajetilla) || 0;
        totPaq += parseInt(p.stock_paquete) || 0;
        totCj += parseInt(p.stock_cajon) || 0;
    });

    const totEquivCaj = totCaj + (totPaq * 10) + (totCj * 500);

    if (DOM.statProductsCount) {
        DOM.statProductsCount.textContent = `Stock total: ${totCaj} Caj. | ${totPaq} Paq. | ${totCj} Cj. (Equivalente real: ${totEquivCaj.toLocaleString()} Cajetillas)`;
    }
    if (DOM.dashTotalProducts) {
        DOM.dashTotalProducts.textContent = totalCount;
    }
    if (DOM.dashLowStock) {
        DOM.dashLowStock.textContent = lowStockCount;
    }
    if (DOM.dashOutOfStock) {
        DOM.dashOutOfStock.textContent = outOfStockCount;
    }
}





// =========================================================================
// 4. LÓGICA DE NAVEGACIÓN ENTRE PESTAÑAS
// =========================================================================
function switchTab(tabId) {
    AppState.currentTab = tabId;
    
    // Actualizar botones de navegación
    DOM.navButtons.forEach(btn => {
        if (btn.getAttribute("data-tab") === tabId) {
            btn.classList.add("active");
        } else {
            btn.classList.remove("active");
        }
    });

    // Mostrar/ocultar paneles
    DOM.tabPanes.forEach(pane => {
        if (pane.id === tabId) {
            pane.classList.add("active");
        } else {
            pane.classList.remove("active");
        }
    });

    // Acciones especiales al cambiar de pestaña
    if (tabId === "pos-tab") {
        renderPOS();
    } else if (tabId === "catalog-tab") {
        renderCatalogTable();
        clearCatalogForm();
    } else if (tabId === "history-tab") {
        renderHistoryTable();
        showOrderDetails(null);
    } else if (tabId === "clients-tab") {
        renderClientsTable();
        clearClientForm();
    } else if (tabId === "analytics-tab") {
        renderAnalytics();
    }
}

DOM.navButtons.forEach(btn => {
    btn.addEventListener("click", () => {
        switchTab(btn.getAttribute("data-tab"));
    });
});

// =========================================================================
// 5. MÓDULO DE FOTOS / IMÁGENES (CONVERSIÓN Y REDIMENSIONAMIENTO A BASE64)
// =========================================================================
function resizeAndConvertImage(file, callback) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement("canvas");
            const MAX_WIDTH = 120; // Redimensionar para optimizar LocalStorage
            const MAX_HEIGHT = 120;
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }
            } else {
                if (height > MAX_HEIGHT) {
                    width *= MAX_HEIGHT / height;
                    height = MAX_HEIGHT;
                }
            }
            
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, width, height);
            
            // Comprimir la imagen a JPEG de calidad 0.7
            const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
            callback(dataUrl);
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

DOM.prodImageFile.addEventListener("change", function(e) {
    if (e.target.files && e.target.files[0]) {
        resizeAndConvertImage(e.target.files[0], (base64Str) => {
            AppState.uploadedImageBase64 = base64Str;
            DOM.imgFormPreview.src = base64Str;
            DOM.imgFormPreview.style.display = "block";
            DOM.btnRemoveFormImg.style.display = "inline-block";
            DOM.imgFormPreviewContainer.querySelector(".preview-placeholder").style.display = "none";
        });
    }
});

DOM.btnRemoveFormImg.addEventListener("click", function() {
    AppState.uploadedImageBase64 = "";
    DOM.imgFormPreview.src = "";
    DOM.imgFormPreview.style.display = "none";
    DOM.btnRemoveFormImg.style.display = "none";
    DOM.imgFormPreviewContainer.querySelector(".preview-placeholder").style.display = "block";
    DOM.prodImageFile.value = "";
});

// =========================================================================
// 6. LÓGICA DE PUNTO DE VENTA (POS / FACTURACIÓN)
// =========================================================================

// Obtener marcas únicas para rellenar la barra de filtros
function updateBrandsBar() {
    const products = LocalDB.getProducts();
    const brands = [...new Set(products.map(p => p.marca.trim()))];
    
    // Crear contenedor HTML
    let html = `<button class="brand-chip ${AppState.activeBrandFilter === 'all' ? 'active' : ''}" data-brand="all">Todos</button>`;
    
    brands.forEach(br => {
        html += `<button class="brand-chip ${AppState.activeBrandFilter === br ? 'active' : ''}" data-brand="${br}">${br}</button>`;
    });
    
    DOM.brandsBar.innerHTML = html;

    // Asignar eventos de clic
    DOM.brandsBar.querySelectorAll(".brand-chip").forEach(chip => {
        chip.addEventListener("click", () => {
            DOM.brandsBar.querySelectorAll(".brand-chip").forEach(c => c.classList.remove("active"));
            chip.classList.add("active");
            AppState.activeBrandFilter = chip.getAttribute("data-brand");
            renderPOS();
        });
    });
}

// Renderizar la cuadrícula de productos en el POS
function renderPOS() {
    const products = LocalDB.getProducts();
    let filtered = products;

    // Filtrar por Marca
    if (AppState.activeBrandFilter !== "all") {
        filtered = filtered.filter(p => p.marca === AppState.activeBrandFilter);
    }

    // Filtrar por Buscador
    if (AppState.searchQuery.trim() !== "") {
        const q = AppState.searchQuery.toLowerCase().trim();
        filtered = filtered.filter(p => p.nombre.toLowerCase().includes(q) || p.marca.toLowerCase().includes(q));
    }

    // Rellenar Grid
    let html = "";
    if (filtered.length === 0) {
        html = `<div class="cart-empty-state" style="grid-column: 1/-1; padding: 40px 0;">
                    <p>No se encontraron cigarros registrados.</p>
                </div>`;
    } else {
        filtered.forEach(p => {
            // Renderizar imagen o placeholder SVG
            let imgHTML = "";
            if (p.ruta_imagen) {
                imgHTML = `<img src="${p.ruta_imagen}" alt="${p.nombre}">`;
            } else {
                imgHTML = `<div class="product-image-placeholder">
                                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><circle cx="12" cy="12" r="10"></circle><line x1="8" y1="12" x2="16" y2="12"></line><line x1="12" y1="8" x2="12" y2="16"></line></svg>
                                <span style="font-size:10px; margin-top:4px;">Cigarro</span>
                           </div>`;
            }

            const sCaj = parseInt(p.stock_cajetilla) || 0;
            const sPaq = parseInt(p.stock_paquete) || 0;
            const sCajon = parseInt(p.stock_cajon) || 0;
            const hasLowStock = (sCaj > 0 && sCaj <= 5) || (sPaq > 0 && sPaq <= 5) || (sCajon > 0 && sCajon <= 5);
            const isOutOfStock = sCaj === 0 && sPaq === 0 && sCajon === 0;

            let stockTag = "";
            if (isOutOfStock) {
                stockTag = `<span class="stock-badge stock-empty">Agotado</span>`;
            } else if (hasLowStock) {
                stockTag = `<span class="stock-badge stock-low">¡Bajo Stock!</span>`;
            } else {
                stockTag = `<span class="stock-badge stock-ok">En Stock</span>`;
            }

            html += `
                <div class="product-card" data-id="${p.id}" style="cursor:pointer;">
                    <div class="product-image-container">
                        ${imgHTML}
                        <span class="product-brand-tag">${p.marca}</span>
                    </div>
                    <div class="product-info">
                        <h3 class="product-name">${p.nombre}</h3>
                        <p class="product-desc" title="${p.descripcion || ''}">${p.descripcion || 'Sin descripción.'}</p>
                        <div style="font-size:11px; color:var(--text-secondary); margin-top:4px; font-weight:600;">
                            Caj: S/${p.precio_cajetilla.toFixed(1)} | Paq: S/${p.precio_paquete.toFixed(1)} | Cj: S/${p.precio_cajon.toFixed(1)}
                        </div>
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:6px;">
                            ${stockTag}
                            <span style="font-size:10px; color:var(--text-muted);">Configurar ⚙️</span>
                        </div>
                    </div>
                </div>
            `;
        });
    }
    DOM.productsGrid.innerHTML = html;

    // Asignar Eventos a las Tarjetas de Producto
    DOM.productsGrid.querySelectorAll(".product-card").forEach(card => {
        const id = card.getAttribute("data-id");
        const p = products.find(prod => prod.id === id);

        card.addEventListener("click", () => {
            openProductModal(p);
        });
    });
}

// Abrir el Modal de Venta Flexible
function openProductModal(product) {
    AppState.modalProduct = product;
    
    DOM.modalCigTitle.textContent = `${product.nombre} (${product.marca})`;
    
    if (product.ruta_imagen) {
        DOM.modalCigImgContainer.innerHTML = `<img src="${product.ruta_imagen}" style="width:100%; height:100%; object-fit:cover;">`;
    } else {
        DOM.modalCigImgContainer.innerHTML = `
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" class="placeholder-svg"><circle cx="12" cy="12" r="10"></circle><line x1="8" y1="12" x2="16" y2="12"></line><line x1="12" y1="8" x2="12" y2="16"></line></svg>
        `;
    }
    
    // Seleccionar presentación cajetilla por defecto
    const radios = document.getElementsByName("modal-presentation");
    radios.forEach(r => {
        if (r.value === "cajetilla") r.checked = true;
    });
    
    DOM.modalQtyInput.value = 1;
    updateModalFields();
    
    DOM.productModal.style.display = "flex";
}

// Actualizar precios y stock dentro del modal
function updateModalFields() {
    const product = AppState.modalProduct;
    if (!product) return;
    
    const radios = document.getElementsByName("modal-presentation");
    let presentation = "cajetilla";
    radios.forEach(r => {
        if (r.checked) presentation = r.value;
    });
    
    let price = product.precio_cajetilla;
    let stock = parseInt(product.stock_cajetilla) || 0;
    
    if (presentation === "paquete") {
        price = product.precio_paquete;
        stock = parseInt(product.stock_paquete) || 0;
    } else if (presentation === "cajon") {
        price = product.precio_cajon;
        stock = parseInt(product.stock_cajon) || 0;
    }
    
    DOM.modalPriceInput.value = price.toFixed(2);
    DOM.modalStockInfo.textContent = `Stock disponible: ${stock}`;
    DOM.modalStockInfo.className = "modal-stock-text";
    
    if (stock === 0) {
        DOM.modalStockInfo.classList.add("empty");
    } else if (stock <= 5) {
        DOM.modalStockInfo.classList.add("low");
    } else {
        DOM.modalStockInfo.classList.add("ok");
    }
    
    calculateModalSubtotal();
}

function calculateModalSubtotal() {
    const price = parseFloat(DOM.modalPriceInput.value) || 0;
    const qty = parseInt(DOM.modalQtyInput.value) || 1;
    const subtotal = price * qty;
    DOM.modalSubtotalDisplay.textContent = `S/${subtotal.toFixed(2)}`;
}

// Manejar el buscador central
DOM.searchInput.addEventListener("input", (e) => {
    AppState.searchQuery = e.target.value;
    renderPOS();
});

// Ajustar cantidad de productos en el carrito
function adjustCartQty(product, presentation, price, action) {
    const existingIndex = AppState.cart.findIndex(it => it.product.id === product.id && it.presentation === presentation);
    
    let activeStock = parseInt(product.stock_cajetilla) || 0;
    if (presentation === "paquete") activeStock = parseInt(product.stock_paquete) || 0;
    else if (presentation === "cajon") activeStock = parseInt(product.stock_cajon) || 0;

    if (existingIndex > -1) {
        if (action === "plus") {
            if (AppState.cart[existingIndex].qty < activeStock) {
                AppState.cart[existingIndex].qty += 1;
            }
        } else if (action === "minus") {
            AppState.cart[existingIndex].qty -= 1;
            if (AppState.cart[existingIndex].qty <= 0) {
                AppState.cart.splice(existingIndex, 1);
            }
        }
    } else {
        if (action === "plus" && activeStock > 0) {
            let cost = product.costo_cajetilla || 0;
            if (presentation === "paquete") cost = product.costo_paquete || 0;
            else if (presentation === "cajon") cost = product.costo_cajon || 0;

            AppState.cart.push({
                product: product,
                presentation: presentation,
                qty: 1,
                activePrice: price,
                costo: cost
            });
        }
    }

    renderPOS();
    renderCart();
}

// Renderizar el carrito de compras lateral
function renderCart() {
    const totalQty = AppState.cart.reduce((sum, item) => sum + item.qty, 0);
    const mobileBadge = document.getElementById("mobile-cart-badge");
    if (mobileBadge) {
        mobileBadge.textContent = totalQty;
    }

    if (AppState.cart.length === 0) {
        DOM.cartEmptyState.style.display = "flex";
        DOM.cartItemsList.style.display = "none";
        DOM.summarySubtotal.textContent = "S/0.00";
        DOM.summaryTotal.textContent = "S/0.00";
        return;
    }

    DOM.cartEmptyState.style.display = "none";
    DOM.cartItemsList.style.display = "flex";

    let html = "";
    let subtotal = 0;

    AppState.cart.forEach((item, index) => {
        const itemSubtotal = item.activePrice * item.qty;
        subtotal += itemSubtotal;

        let imgHTML = "";
        if (item.product.ruta_imagen) {
            imgHTML = `<img src="${item.product.ruta_imagen}" class="cart-item-thumbnail" alt="${item.product.nombre}">`;
        } else {
            imgHTML = `<div class="cart-item-thumbnail" style="display:flex; align-items:center; justify-content:center; background:#E2E8F0; color:#64748B; font-size:8px; font-weight:700;">Cig</div>`;
        }

        html += `
            <div class="cart-item">
                ${imgHTML}
                <div class="cart-item-details">
                    <h4 class="cart-item-name">${item.product.nombre}</h4>
                    <div class="cart-item-meta">
                        <span class="cart-item-presentation">${item.presentation}</span>
                        <span class="cart-item-price">S/${item.activePrice.toFixed(2)}</span>
                    </div>
                </div>
                <div class="cart-item-actions">
                    <span class="cart-item-subtotal">S/${itemSubtotal.toFixed(2)}</span>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <div class="cart-item-qty">
                            <button class="cart-qty-btn" data-index="${index}" data-action="minus">-</button>
                            <span class="cart-qty-val">${item.qty}</span>
                            <button class="cart-qty-btn" data-index="${index}" data-action="plus">+</button>
                        </div>
                        <button class="cart-item-remove-btn" data-index="${index}" title="Quitar item">
                            <svg class="icon-small" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                    </div>
                </div>
            </div>
        `;
    });

    // Calcular descuentos
    const dType = DOM.discountType ? DOM.discountType.value : "none";
    const dVal = DOM.discountType ? parseFloat(DOM.discountValue.value) || 0 : 0;
    let discountAmount = 0;

    if (dType === "percent") {
        discountAmount = subtotal * (dVal / 100);
    } else if (dType === "fixed") {
        discountAmount = dVal;
    }

    discountAmount = Math.min(discountAmount, subtotal);
    const finalTotal = subtotal - discountAmount;

    DOM.cartItemsList.innerHTML = html;
    DOM.summarySubtotal.textContent = `S/${subtotal.toFixed(2)}`;
    
    if (discountAmount > 0) {
        if (DOM.discountTotalRow) DOM.discountTotalRow.style.display = "flex";
        if (DOM.summaryDiscount) DOM.summaryDiscount.textContent = `-S/${discountAmount.toFixed(2)}`;
    } else {
        if (DOM.discountTotalRow) DOM.discountTotalRow.style.display = "none";
    }

    DOM.summaryTotal.textContent = `S/${finalTotal.toFixed(2)}`;

    // Asignar eventos de cantidad y remoción en el carrito
    DOM.cartItemsList.querySelectorAll(".cart-qty-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const idx = parseInt(btn.getAttribute("data-index"));
            const action = btn.getAttribute("data-action");
            const item = AppState.cart[idx];
            
            adjustCartQty(item.product, item.presentation, item.activePrice, action);
        });
    });

    DOM.cartItemsList.querySelectorAll(".cart-item-remove-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const idx = parseInt(btn.getAttribute("data-index"));
            AppState.cart.splice(idx, 1);
            renderPOS();
            renderCart();
        });
    });
}

// Selector de Métodos de Pago
DOM.paymentBtns.forEach(btn => {
    btn.addEventListener("click", () => {
        DOM.paymentBtns.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        btn.querySelector("input").checked = true;
    });
});

// Guardar/Registrar el Pedido Final
function placeOrder() {
    const clientName = DOM.clientName.value.trim();
    const clientPhone = DOM.clientPhone.value.trim();
    
    if (clientName === "") {
        alert("Por favor, ingresa el Nombre del Cliente.");
        DOM.clientName.focus();
        return;
    }

    if (AppState.cart.length === 0) {
        alert("El carrito está vacío. Agrega productos al pedido.");
        return;
    }

    // Calcular Subtotal, Descuento y Total de la venta
    const subtotal = AppState.cart.reduce((sum, item) => sum + (item.activePrice * item.qty), 0);
    const dType = DOM.discountType ? DOM.discountType.value : "none";
    const dVal = DOM.discountValue ? parseFloat(DOM.discountValue.value) || 0 : 0;
    let discountAmount = 0;

    if (dType === "percent") {
        discountAmount = subtotal * (dVal / 100);
    } else if (dType === "fixed") {
        discountAmount = dVal;
    }
    
    discountAmount = Math.min(discountAmount, subtotal);
    const total = subtotal - discountAmount;
    const method = document.querySelector('input[name="payment-method"]:checked').value;
    
    // Delivery Fields
    const elDate = document.getElementById("delivery-date");
    const elTime = document.getElementById("delivery-time");
    const elAddress = document.getElementById("delivery-address");
    const elLat = document.getElementById("delivery-lat");
    const elLng = document.getElementById("delivery-lng");
    const deliveryDate = elDate ? elDate.value : "";
    const deliveryTime = elTime ? elTime.value : "";
    const deliveryAddress = elAddress ? elAddress.value.trim() : "";
    const deliveryLat = elLat ? elLat.value : "";
    const deliveryLng = elLng ? elLng.value : "";
    
    // Generar Folio
    const dateObj = new Date();
    const timestamp = dateObj.getFullYear() +
                      String(dateObj.getMonth() + 1).padStart(2, '0') +
                      String(dateObj.getDate()).padStart(2, '0') +
                      String(dateObj.getHours()).padStart(2, '0') +
                      String(dateObj.getMinutes()).padStart(2, '0') +
                      String(dateObj.getSeconds()).padStart(2, '0');
    const folio = `PED-${timestamp}`;

    // Estructura del Pedido
    const newOrder = {
        id: timestamp,
        folio: folio,
        cliente: clientName,
        telefono: clientPhone || "-",
        fecha: dateObj.toLocaleDateString() + " " + dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
        subtotal: subtotal,
        descuento: discountAmount,
        total: total,
        metodo: method,
        deliveryDate: deliveryDate,
        deliveryTime: deliveryTime,
        deliveryAddress: deliveryAddress,
        deliveryLat: deliveryLat,
        deliveryLng: deliveryLng,
        deliveryStatus: (deliveryDate || deliveryAddress) ? "Pendiente" : "Entregado",
        items: AppState.cart.map(it => ({
            id: it.product.id,
            nombre: it.product.nombre,
            marca: it.product.marca,
            presentacion: it.presentation,
            qty: it.qty,
            precio: it.activePrice,
            costo: it.costo || 0,
            subtotal: it.activePrice * it.qty
        }))
    };

    // Guardar la venta en servidor o localmente
    if (IS_SERVER) {
        try {
            const xhr = new XMLHttpRequest();
            xhr.open("POST", `${API_URL}/api/pedidos`, false);
            xhr.setRequestHeader("Content-Type", "application/json");
            xhr.send(JSON.stringify(newOrder));
            const res = JSON.parse(xhr.responseText);
            if (res.error) throw new Error(res.error);
            newOrder.folio = res.folio; // Usar el folio e ID del servidor
            newOrder.id = res.id;
            LocalDB.init();
        } catch (err) {
            alert("Error al registrar la venta en el servidor: " + err.message);
            return;
        }
    } else {
        // Descontar stock de los productos
        const products = LocalDB.getProducts();
        AppState.cart.forEach(item => {
            const prod = products.find(p => p.id === item.product.id);
            if (prod) {
                if (item.presentation === "cajetilla") {
                    prod.stock_cajetilla = Math.max(0, (parseInt(prod.stock_cajetilla) || 0) - item.qty);
                } else if (item.presentation === "paquete") {
                    prod.stock_paquete = Math.max(0, (parseInt(prod.stock_paquete) || 0) - item.qty);
                } else if (item.presentation === "cajon") {
                    prod.stock_cajon = Math.max(0, (parseInt(prod.stock_cajon) || 0) - item.qty);
                }
            }
        });
        LocalDB.saveProducts(products);

        // Guardar en la BD local
        const orders = LocalDB.getOrders();
        orders.unshift(newOrder); // Agregar al inicio
        LocalDB.saveOrders(orders);
    }

    // Disparar Modal de Venta Exitosa en lugar de confirm
    if (DOM.saleSuccessFolio) DOM.saleSuccessFolio.textContent = folio;
    if (DOM.modalSaleSuccess) {
        DOM.modalSaleSuccess.style.display = "flex";
        
        // Limpiar listeners previos para evitar duplicados si hace varias ventas
        const newBtnDownload = DOM.btnDownloadReceipt.cloneNode(true);
        DOM.btnDownloadReceipt.parentNode.replaceChild(newBtnDownload, DOM.btnDownloadReceipt);
        DOM.btnDownloadReceipt = newBtnDownload;
        
        const newBtnSkip = DOM.btnSkipReceipt.cloneNode(true);
        DOM.btnSkipReceipt.parentNode.replaceChild(newBtnSkip, DOM.btnSkipReceipt);
        DOM.btnSkipReceipt = newBtnSkip;
        
        const newClose = DOM.closeSaleSuccess.cloneNode(true);
        DOM.closeSaleSuccess.parentNode.replaceChild(newClose, DOM.closeSaleSuccess);
        DOM.closeSaleSuccess = newClose;

        const closeModalAndReset = () => {
            DOM.modalSaleSuccess.style.display = "none";
            // Resetear formulario de venta DESPUÉS de cerrar el modal
            if (DOM.clientSelectInput) DOM.clientSelectInput.value = "";
            if (DOM.clientName) DOM.clientName.value = "Cliente General";
            if (DOM.clientPhone) DOM.clientPhone.value = "-";
            if (DOM.btnClearSelectedClient) DOM.btnClearSelectedClient.style.display = "none";
            if (DOM.selectedClientBadge) DOM.selectedClientBadge.style.display = "none";
            
            if (DOM.discountType) DOM.discountType.value = "none";
            if (DOM.discountValue) DOM.discountValue.value = "0";
            
            const elDate = document.getElementById("delivery-date");
            const elTime = document.getElementById("delivery-time");
            const elAddress = document.getElementById("delivery-address");
            const elLat = document.getElementById("delivery-lat");
            const elLng = document.getElementById("delivery-lng");
            if(elDate) elDate.value = "";
            if(elTime) elTime.value = "";
            if(elAddress) elAddress.value = "";
            if(elLat) elLat.value = "";
            if(elLng) elLng.value = "";

            AppState.cart = [];
            renderCart();
        };

        DOM.btnDownloadReceipt.addEventListener("click", () => {
            printReceipt(newOrder);
            closeModalAndReset();
        });

        DOM.btnSkipReceipt.addEventListener("click", () => {
            closeModalAndReset();
        });

        DOM.closeSaleSuccess.addEventListener("click", () => {
            closeModalAndReset();
        });
    } else {
        // Fallback en caso de que no exista el modal (por si acaso)
        if (confirm(`Venta registrada exitosamente.\nFolio: ${folio}\n\n¿Deseas DESCARGAR el PDF del ticket de compra?`)) {
            printReceipt(newOrder);
        }
        
        // Resetear formulario de venta
        if (DOM.clientSelectInput) DOM.clientSelectInput.value = "";
        if (DOM.clientName) DOM.clientName.value = "Cliente General";
        if (DOM.clientPhone) DOM.clientPhone.value = "-";
        if (DOM.btnClearSelectedClient) DOM.btnClearSelectedClient.style.display = "none";
        if (DOM.selectedClientBadge) DOM.selectedClientBadge.style.display = "none";
        
        if (DOM.discountType) DOM.discountType.value = "none";
        if (DOM.discountValue) DOM.discountValue.value = "0";

        const elDate = document.getElementById("delivery-date");
        const elTime = document.getElementById("delivery-time");
        const elAddress = document.getElementById("delivery-address");
        const elLat = document.getElementById("delivery-lat");
        const elLng = document.getElementById("delivery-lng");
        if(elDate) elDate.value = "";
        if(elTime) elTime.value = "";
        if(elAddress) elAddress.value = "";
        if(elLat) elLat.value = "";
        if(elLng) elLng.value = "";

        AppState.cart = [];
        renderCart();
    }
    renderPOS();
    renderCatalogTable();
    updateInventoryStats();

    // Cerrar drawer en móvil
    const invoiceSidebar = document.getElementById("invoice-sidebar");
    if (invoiceSidebar) invoiceSidebar.classList.remove("active-drawer");
}

DOM.btnPlaceOrder.addEventListener("click", placeOrder);

// Atajo de teclado F12
window.addEventListener("keydown", (e) => {
    if (e.key === "F12") {
        e.preventDefault();
        placeOrder();
    }
});

// =========================================================================
// 7. GESTIÓN DEL CATÁLOGO DE PRODUCTOS (ABM)
// =========================================================================

// Limpiar formulario de Catálogo
function clearCatalogForm() {
    DOM.editProductId.value = "";
    DOM.prodName.value = "";
    DOM.prodBrand.value = "";
    DOM.prodDesc.value = "";
    DOM.priceCajetilla.value = "0.00";
    DOM.costCajetilla.value = "0.00";
    DOM.stockCajetilla.value = "0";
    DOM.pricePaquete.value = "0.00";
    DOM.costPaquete.value = "0.00";
    DOM.stockPaquete.value = "0";
    DOM.priceCajon.value = "0.00";
    DOM.costCajon.value = "0.00";
    DOM.stockCajon.value = "0";
    DOM.prodImageFile.value = "";
    
    // Resetear imagen
    AppState.uploadedImageBase64 = "";
    DOM.imgFormPreview.src = "";
    DOM.imgFormPreview.style.display = "none";
    DOM.btnRemoveFormImg.style.display = "none";
    DOM.imgFormPreviewContainer.querySelector(".preview-placeholder").style.display = "block";
    
    DOM.catalogFormTitle.textContent = "Registrar Nuevo Cigarro";
    DOM.btnSubmitProduct.textContent = "Guardar Cigarro";
}

DOM.btnClearCatalogForm.addEventListener("click", clearCatalogForm);

// Guardar / Editar Producto
DOM.catalogForm.addEventListener("submit", function(e) {
    e.preventDefault();
    
    const id = DOM.editProductId.value;
    const name = DOM.prodName.value.trim();
    const brand = DOM.prodBrand.value.trim();
    const desc = DOM.prodDesc.value.trim();
    const pCajetilla = parseFloat(DOM.priceCajetilla.value) || 0;
    const cCajetilla = parseFloat(DOM.costCajetilla.value) || 0;
    const pPaquete = parseFloat(DOM.pricePaquete.value) || 0;
    const cPaquete = parseFloat(DOM.costPaquete.value) || 0;
    const pCajon = parseFloat(DOM.priceCajon.value) || 0;
    const cCajon = parseFloat(DOM.costCajon.value) || 0;
    const sCajetilla = parseInt(DOM.stockCajetilla.value) || 0;
    const sPaquete = parseInt(DOM.stockPaquete.value) || 0;
    const sCajon = parseInt(DOM.stockCajon.value) || 0;
    
    const products = LocalDB.getProducts();

    const prodData = {
        id: id || "",
        nombre: name,
        marca: brand,
        descripcion: desc,
        precio_cajetilla: pCajetilla,
        costo_cajetilla: cCajetilla,
        precio_paquete: pPaquete,
        costo_paquete: cPaquete,
        precio_cajon: pCajon,
        costo_cajon: cCajon,
        stock_cajetilla: sCajetilla,
        stock_paquete: sPaquete,
        stock_cajon: sCajon,
        ruta_imagen: AppState.uploadedImageBase64
    };

    if (IS_SERVER) {
        try {
            const xhr = new XMLHttpRequest();
            xhr.open("POST", `${API_URL}/api/productos`, false);
            xhr.setRequestHeader("Content-Type", "application/json");
            xhr.send(JSON.stringify(prodData));
            const res = JSON.parse(xhr.responseText);
            if (res.error) throw new Error(res.error);
            alert(`Producto "${name}" guardado correctamente.`);
            LocalDB.init();
        } catch (err) {
            alert("Error al guardar en el servidor: " + err.message);
            return;
        }
    } else {
        if (id === "") {
            prodData.id = String(Date.now());
            products.push(prodData);
            alert(`Producto "${name}" registrado correctamente.`);
        } else {
            const index = products.findIndex(p => p.id === id);
            if (index > -1) {
                products[index] = prodData;
                alert(`Producto "${name}" modificado correctamente.`);
            }
        }
        LocalDB.saveProducts(products);
    }
    clearCatalogForm();
    renderCatalogTable();
    updateBrandsBar();
    updateInventoryStats();
});

// Renderizar la tabla de productos del Catálogo
function renderCatalogTable() {
    const products = LocalDB.getProducts();
    const searchVal = DOM.catalogSearchInput.value.toLowerCase().trim();
    
    let filtered = products;
    if (searchVal !== "") {
        filtered = filtered.filter(p => p.nombre.toLowerCase().includes(searchVal) || p.marca.toLowerCase().includes(searchVal));
    }

    let html = "";
    if (filtered.length === 0) {
        html = `<tr><td colspan="6" style="text-align:center; color:var(--text-secondary); padding: 30px 0;">No hay productos para mostrar.</td></tr>`;
    } else {
        filtered.forEach(p => {
            let imgHTML = "";
            if (p.ruta_imagen) {
                imgHTML = `<img src="${p.ruta_imagen}" class="table-thumbnail" alt="${p.nombre}">`;
            } else {
                imgHTML = `<div class="table-thumbnail" style="display:flex; align-items:center; justify-content:center; background:#E2E8F0; color:#64748B; font-size:10px; font-weight:700;">Sin Foto</div>`;
            }

            html += `
                <tr>
                    <td>${imgHTML}</td>
                    <td>
                        <div style="font-weight:700; font-size:14px;">${p.nombre}</div>
                        <div class="table-product-brand">${p.marca}</div>
                    </td>
                    <td><strong>S/${p.precio_cajetilla.toFixed(2)}</strong></td>
                    <td><strong>S/${p.precio_paquete.toFixed(2)}</strong></td>
                    <td><strong>S/${p.precio_cajon.toFixed(2)}</strong></td>
                    <td>
                        <span class="stock-badge ${(parseInt(p.stock_cajetilla) || 0) === 0 ? 'stock-empty' : ((parseInt(p.stock_cajetilla) || 0) <= 5 ? 'stock-low' : 'stock-ok')}">C: ${p.stock_cajetilla || 0}</span>
                        <span class="stock-badge ${(parseInt(p.stock_paquete) || 0) === 0 ? 'stock-empty' : ((parseInt(p.stock_paquete) || 0) <= 5 ? 'stock-low' : 'stock-ok')}">P: ${p.stock_paquete || 0}</span>
                        <span class="stock-badge ${(parseInt(p.stock_cajon) || 0) === 0 ? 'stock-empty' : ((parseInt(p.stock_cajon) || 0) <= 5 ? 'stock-low' : 'stock-ok')}">CJ: ${p.stock_cajon || 0}</span>
                    </td>
                    <td><strong>${((parseInt(p.stock_cajetilla) || 0) + ((parseInt(p.stock_paquete) || 0) * 10) + ((parseInt(p.stock_cajon) || 0) * 500)).toLocaleString()} Caj.</strong></td>
                    <td>
                        <div style="display:flex; gap:8px;">
                            <button class="btn-primary btn-sm btn-edit-prod" data-id="${p.id}" style="padding:6px 10px; font-size:11px;">Editar</button>
                            <button class="btn-danger-outline btn-sm btn-delete-prod" data-id="${p.id}">Eliminar</button>
                        </div>
                    </td>
                </tr>
            `;
        });
    }
    
    DOM.catalogTableBody.innerHTML = html;

    // Asignar eventos de editar y eliminar
    DOM.catalogTableBody.querySelectorAll(".btn-edit-prod").forEach(btn => {
        btn.addEventListener("click", () => {
            const id = btn.getAttribute("data-id");
            const prod = products.find(p => p.id === id);
            if (prod) {
                DOM.editProductId.value = prod.id;
                DOM.prodName.value = prod.nombre;
                DOM.prodBrand.value = prod.marca;
                DOM.prodDesc.value = prod.descripcion || "";
                DOM.priceCajetilla.value = prod.precio_cajetilla.toFixed(2);
                DOM.costCajetilla.value = (prod.costo_cajetilla || 0).toFixed(2);
                DOM.pricePaquete.value = prod.precio_paquete.toFixed(2);
                DOM.costPaquete.value = (prod.costo_paquete || 0).toFixed(2);
                DOM.priceCajon.value = prod.precio_cajon.toFixed(2);
                DOM.costCajon.value = (prod.costo_cajon || 0).toFixed(2);
                DOM.stockCajetilla.value = prod.stock_cajetilla || 0;
                DOM.stockPaquete.value = prod.stock_paquete || 0;
                DOM.stockCajon.value = prod.stock_cajon || 0;
                
                if (prod.ruta_imagen) {
                    AppState.uploadedImageBase64 = prod.ruta_imagen;
                    DOM.imgFormPreview.src = prod.ruta_imagen;
                    DOM.imgFormPreview.style.display = "block";
                    DOM.btnRemoveFormImg.style.display = "inline-block";
                    DOM.imgFormPreviewContainer.querySelector(".preview-placeholder").style.display = "none";
                } else {
                    DOM.btnRemoveFormImg.click();
                }

                DOM.catalogFormTitle.textContent = "Editar Cigarro: " + prod.nombre;
                DOM.btnSubmitProduct.textContent = "Guardar Cambios";
                // Desplazar el formulario al tope
                DOM.catalogForm.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });

    DOM.catalogTableBody.querySelectorAll(".btn-delete-prod").forEach(btn => {
        btn.addEventListener("click", () => {
            const id = btn.getAttribute("data-id");
            const prod = products.find(p => p.id === id);
            if (prod && confirm(`¿Estás seguro de que deseas eliminar "${prod.nombre}" del catálogo?\nEsta acción no se puede deshacer.`)) {
                if (IS_SERVER) {
                    try {
                        const xhr = new XMLHttpRequest();
                        xhr.open("DELETE", `${API_URL}/api/productos?id=${id}`, false);
                        xhr.send();
                        LocalDB.init();
                    } catch (err) {
                        alert("Error al eliminar del servidor: " + err.message);
                        return;
                    }
                } else {
                    const updatedProducts = products.filter(p => p.id !== id);
                    LocalDB.saveProducts(updatedProducts);
                }
                renderCatalogTable();
                updateBrandsBar();
                updateInventoryStats();
                // Limpiar si estábamos editando ese mismo producto
                if (DOM.editProductId.value === id) {
                    clearCatalogForm();
                }
            }
        });
    });
}

// Búsqueda interactiva en el catálogo
DOM.catalogSearchInput.addEventListener("input", renderCatalogTable);

// =========================================================================
// 8. HISTORIAL DE VENTAS
// =========================================================================

// Mostrar los detalles del pedido seleccionado en el historial
function showOrderDetails(order) {
    AppState.selectedOrderForDetails = order;
    
    if (!order) {
        DOM.detailsEmptyState.style.display = "flex";
        DOM.orderDetailsCard.style.display = "none";
        return;
    }

    DOM.detailsEmptyState.style.display = "none";
    DOM.orderDetailsCard.style.display = "flex";

    DOM.detailsFolio.textContent = order.folio;
    DOM.detailsDate.textContent = `Fecha: ${order.fecha}`;
    DOM.detailsClientName.textContent = order.cliente;
    DOM.detailsClientPhone.textContent = order.telefono;
    DOM.detailsPaymentMethod.textContent = order.metodo;
    
    let html = "";
    order.items.forEach(it => {
        html += `
            <li class="details-item-row">
                <div>
                    <span class="details-item-name">${it.nombre}</span>
                    <div class="details-item-meta">Presentación: ${it.presentacion} | Cantidad: ${it.qty} x S/${it.precio.toFixed(2)}</div>
                </div>
                <span class="details-item-subtotal">S/${it.subtotal.toFixed(2)}</span>
            </li>
        `;
    });
    DOM.detailsItemsList.innerHTML = html;
    DOM.detailsTotal.textContent = `S/${order.total.toFixed(2)}`;
}

// Renderizar tabla del historial
function renderHistoryTable() {
    const orders = LocalDB.getOrders();
    const searchVal = DOM.historySearchInput.value.toLowerCase().trim();
    
    let filtered = orders;
    if (searchVal !== "") {
        filtered = filtered.filter(o => o.cliente.toLowerCase().includes(searchVal) || o.folio.toLowerCase().includes(searchVal));
    }

    let html = "";
    if (filtered.length === 0) {
        html = `<tr><td colspan="6" style="text-align:center; color:var(--text-secondary); padding: 30px 0;">No se encontraron pedidos.</td></tr>`;
    } else {
        filtered.forEach(o => {
            const isSelected = AppState.selectedOrderForDetails && AppState.selectedOrderForDetails.id === o.id;
            html += `
                <tr class="${isSelected ? 'selected' : ''}" data-id="${o.id}">
                    <td><strong>${o.folio}</strong></td>
                    <td>${o.cliente}</td>
                    <td>${o.fecha}</td>
                    <td><strong>S/${o.total.toFixed(2)}</strong></td>
                    <td><span class="payment-badge">${o.metodo}</span></td>
                    <td>
                        <button class="btn-secondary btn-sm btn-view-order" data-id="${o.id}" style="padding:4px 8px; font-size:11px;">Ver Detalle</button>
                    </td>
                </tr>
            `;
        });
    }
    DOM.historyTableBody.innerHTML = html;

    // Clicks en la tabla para ver detalle
    DOM.historyTableBody.querySelectorAll("tr").forEach(row => {
        const id = row.getAttribute("data-id");
        if (!id) return;
        
        const clickHandler = () => {
            DOM.historyTableBody.querySelectorAll("tr").forEach(r => r.classList.remove("selected"));
            row.classList.add("selected");
            const order = orders.find(o => o.id === id);
            showOrderDetails(order);
        };

        row.addEventListener("click", clickHandler);
        // También el botón por si acaso
        const btn = row.querySelector(".btn-view-order");
        if (btn) btn.addEventListener("click", (e) => {
            e.stopPropagation(); // Evitar doble click
            clickHandler();
        });
    });
}

// Editar pedido del historial (cargar al carrito)
const btnEditOrder = document.getElementById("btn-edit-order");
if (btnEditOrder) {
    btnEditOrder.addEventListener("click", () => {
        if (!AppState.selectedOrderForDetails) return;
        
        if (AppState.cart.length > 0) {
            if (!confirm('Tus productos actuales en el carrito se perderán. ¿Deseas continuar editando este pedido?')) return;
        }

        const order = AppState.selectedOrderForDetails;
        
        // 1. Cargar productos al carrito
        AppState.cart = JSON.parse(JSON.stringify(order.items)); // Copia profunda
        
        // 2. Establecer cliente
        const clients = LocalDB.getClients();
        const clientObj = clients.find(c => c.nombre === order.cliente);
        if (clientObj) {
            AppState.currentClient = clientObj;
        } else {
            // Si el cliente fue eliminado, creamos un objeto temporal
            AppState.currentClient = { nombre: order.cliente, telefono: order.telefono, address: order.deliveryAddress, lat: order.deliveryLat, lng: order.deliveryLng };
        }
        
        // 3. Eliminar el pedido original del historial y restaurar inventario
        const orders = LocalDB.getOrders();
        if (IS_SERVER) {
            try {
                const xhr = new XMLHttpRequest();
                xhr.open("DELETE", `${API_URL}/api/pedidos?id=${order.id}`, false);
                xhr.send();
                LocalDB.init();
            } catch (err) {
                console.warn("Error al eliminar pedido del servidor al editar", err);
            }
        } else {
            // Restaurar inventario
            const products = LocalDB.getProducts();
            order.items.forEach(it => {
                const p = products.find(prod => prod.id === it.id);
                if (p) p.stock += it.qty;
            });
            LocalDB.saveProducts(products);

            const updatedOrders = orders.filter(o => o.id !== order.id);
            LocalDB.saveOrders(updatedOrders);
            
            renderCatalogTable();
        }
        
        showOrderDetails(null);
        renderHistoryTable();
        
        // 4. Cambiar a la pestaña de POS
        renderCart();
        DOM.clientSelect.value = clientObj ? clientObj.id : "";
        switchTab("pos-tab");
        
        alert("El pedido ha sido cargado en el Punto de Venta para su edición.");
    });
}

// Eliminar pedido del historial
DOM.btnDeleteOrder.addEventListener("click", () => {
    if (!AppState.selectedOrderForDetails) return;
    
    const orders = LocalDB.getOrders();
    const order = AppState.selectedOrderForDetails;
    
    if (confirm(`¿Estás seguro de que deseas eliminar permanentemente la venta con folio ${order.folio}?\nEsta acción no se puede deshacer.`)) {
        if (IS_SERVER) {
            try {
                const xhr = new XMLHttpRequest();
                xhr.open("DELETE", `${API_URL}/api/pedidos?id=${order.id}`, false);
                xhr.send();
                LocalDB.init();
            } catch (err) {
                alert("Error al eliminar pedido del servidor: " + err.message);
                return;
            }
        } else {
            // Restaurar inventario
            const products = LocalDB.getProducts();
            order.items.forEach(it => {
                const p = products.find(prod => prod.id === it.id);
                if (p) p.stock += it.qty;
            });
            LocalDB.saveProducts(products);
            
            const updatedOrders = orders.filter(o => o.id !== order.id);
            LocalDB.saveOrders(updatedOrders);
            
            renderCatalogTable();
        }
        showOrderDetails(null);
        renderHistoryTable();
    }
});

// Búsqueda interactiva en historial
DOM.historySearchInput.addEventListener("input", renderHistoryTable);



// =========================================================================
// 9. IMPORTAR / EXPORTAR INVENTARIO (JSON PARA COMPARTIR/SUBIR A OTRAS WEB)
// =========================================================================

// Exportar el inventario de productos a JSON
DOM.btnExportInventory.addEventListener("click", () => {
    const backupData = {
        products: LocalDB.getProducts(),
        orders: LocalDB.getOrders(),
        exportDate: new Date().toISOString(),
        appName: "DaLogistics"
    };

    const dateObj = new Date();
    const dateFormatted = `${dateObj.getFullYear()}-${String(dateObj.getMonth()+1).padStart(2,'0')}-${String(dateObj.getDate()).padStart(2,'0')}`;
    const filename = `Inventario_DaLogistics_${dateFormatted}.json`;
    const content = JSON.stringify(backupData, null, 2);
    saveFileViaServer(filename, content, 'text');
});

// Importar el inventario de productos desde un archivo JSON
DOM.btnImportInventory.addEventListener("click", () => {
    DOM.fileImportInventory.click();
});

DOM.fileImportInventory.addEventListener("change", function(e) {
    if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        const reader = new FileReader();
        
        reader.onload = function(evt) {
            try {
                const data = JSON.parse(evt.target.result);
                
                if (data.appName !== "DaLogistics" || !data.products) {
                    throw new Error("El archivo no corresponde a un formato de inventario de DA LOGISTICS válido.");
                }

                if (confirm(`Se han detectado ${data.products.length} productos en la copia del inventario.\n\n¿Deseas IMPORTAR este inventario? Esto actualizará tu catálogo local.`)) {
                    LocalDB.saveProducts(data.products);
                    if (data.orders) {
                        LocalDB.saveOrders(data.orders);
                    }
                    alert("Inventario cargado y actualizado con éxito. La página se actualizará.");
                    window.location.reload();
                }
            } catch (err) {
                alert("Error al importar el archivo: " + err.message);
            }
        };
        
        reader.readAsText(file);
    }
});

// =========================================================================
// 9.5. FUNCIONES AVANZADAS DE LOYVERSE (CRM, DESCUENTOS, TICKET, ANALÍTICAS)
// =========================================================================

// --- 9.5.1. DESCUENTOS EN EL CARRITO ---
if (DOM.discountType && DOM.discountValue) {
    DOM.discountType.addEventListener("change", () => {
        if (DOM.discountType.value === "none") {
            DOM.discountValue.value = "0";
        }
        renderCart();
    });
    DOM.discountValue.addEventListener("input", renderCart);
}

// --- 9.5.2. TICKET DE IMPRESIÓN ---
function printReceipt(order) {
    const printContainer = document.getElementById("print-ticket-receipt");
    if (!printContainer) return;

    document.getElementById("receipt-folio").textContent = order.folio;
    document.getElementById("receipt-date").textContent = order.fecha;
    document.getElementById("receipt-client").textContent = order.cliente;
    document.getElementById("receipt-payment").textContent = order.metodo;

    let itemsHtml = "";
    order.items.forEach(it => {
        itemsHtml += `
            <tr>
                <td style="text-align:left;">${it.qty} x ${it.nombre} (${it.presentacion})</td>
                <td style="text-align:right;">S/${it.subtotal.toFixed(2)}</td>
            </tr>
        `;
    });
    document.getElementById("receipt-items-body").innerHTML = itemsHtml;

    document.getElementById("receipt-subtotal").textContent = `S/${(order.subtotal || order.total).toFixed(2)}`;

    const discountRow = document.getElementById("receipt-discount-row");
    const discountVal = document.getElementById("receipt-discount");
    if (order.descuento && order.descuento > 0) {
        discountRow.style.display = "flex";
        discountVal.textContent = `-S/${order.descuento.toFixed(2)}`;
    } else {
        discountRow.style.display = "none";
    }

    document.getElementById("receipt-total").textContent = `S/${order.total.toFixed(2)}`;

    // Opciones para generar el archivo PDF
    const opt = {
        margin:       [0.3, 0.3],
        filename:     `Ticket_${order.folio}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, logging: false },
        jsPDF:        { unit: 'in', format: [3.5, 6], orientation: 'portrait' } // Formato ticket de 80mm
    };

    // Renderizar PDF
    const originalDisplay = printContainer.style.display;
    printContainer.style.display = "block"; // Mostrarlo para que html2pdf lea los estilos
    
    html2pdf().set(opt).from(printContainer).output('datauristring').then(pdfDataUrl => {
        printContainer.style.display = originalDisplay; // Restaurar estado oculto
        saveFileViaServer(`Ticket_${order.folio}.pdf`, pdfDataUrl, 'base64');
    }).catch(err => {
        console.error("Error al generar PDF:", err);
        printContainer.style.display = originalDisplay;
    });
}

// Botón de reimpresión desde el Historial
if (DOM.btnPrintHistoryOrder) {
    DOM.btnPrintHistoryOrder.addEventListener("click", () => {
        if (AppState.selectedOrderForDetails) {
            printReceipt(AppState.selectedOrderForDetails);
        }
    });
}

// --- 9.5.3. GESTIÓN DE CLIENTES (CRM) ---
function clearClientForm() {
    DOM.editClientId.value = "";
    DOM.cName.value = "";
    DOM.cPhone.value = "";
    DOM.cEmail.value = "";
    DOM.cAddress.value = "";
    DOM.clientFormTitle.textContent = "Registrar Nuevo Cliente";
    DOM.btnSubmitClient.textContent = "Guardar Cliente";
}

if (DOM.btnClearClientForm) {
    DOM.btnClearClientForm.addEventListener("click", clearClientForm);
}

function renderClientsTable() {
    const clients = LocalDB.getClients();
    const orders = LocalDB.getOrders();
    const searchVal = DOM.clientSearchInput.value.toLowerCase().trim();

    let filtered = clients;
    if (searchVal !== "") {
        filtered = filtered.filter(c => c.nombre.toLowerCase().includes(searchVal) || c.telefono.includes(searchVal));
    }

    let html = "";
    if (filtered.length === 0) {
        html = `<tr><td colspan="5" style="text-align:center; color:var(--text-secondary); padding: 30px 0;">No hay clientes registrados.</td></tr>`;
    } else {
        filtered.forEach(c => {
            // Calcular estadísticas de compras del cliente
            const clientOrders = orders.filter(o => o.cliente.toLowerCase() === c.nombre.toLowerCase());
            const purchaseCount = clientOrders.length;
            const totalSpent = clientOrders.reduce((sum, o) => sum + o.total, 0);

            html += `
                <tr>
                    <td>
                        <div style="display:flex; align-items:center; gap:8px;">
                            <div class="cashier-avatar" style="background-color:var(--primary); font-size:12px; width:30px; height:30px; border-radius:50%; display:flex; align-items:center; justify-content:center; color:#fff; font-weight:700;">
                                ${c.nombre.split(" ").map(w => w[0]).join("").substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                                <div style="font-weight:700; font-size:14px;">${c.nombre}</div>
                                <div style="font-size:11px; color:var(--text-muted);">${c.email || 'Sin correo registrado'}</div>
                            </div>
                        </div>
                    </td>
                    <td><strong>${c.telefono}</strong></td>
                    <td><span class="ranking-qty">${purchaseCount}</span></td>
                    <td><strong>S/${totalSpent.toFixed(2)}</strong></td>
                    <td>
                        <div style="display:flex; gap:8px;">
                            <button class="btn-primary btn-sm btn-edit-client" data-id="${c.id}" style="padding:6px 10px; font-size:11px;">Editar</button>
                            <button class="btn-danger-outline btn-sm btn-delete-client" data-id="${c.id}">Eliminar</button>
                        </div>
                    </td>
                </tr>
            `;
        });
    }

    DOM.clientsTableBody.innerHTML = html;

    // Asignar eventos de editar y eliminar
    DOM.clientsTableBody.querySelectorAll(".btn-edit-client").forEach(btn => {
        btn.addEventListener("click", () => {
            const id = btn.getAttribute("data-id");
            const c = clients.find(item => item.id === id);
            if (c) {
                DOM.editClientId.value = c.id;
                DOM.cName.value = c.nombre;
                DOM.cPhone.value = c.telefono || "";
                DOM.cEmail.value = c.email || "";
                DOM.cAddress.value = c.address || "";
                document.getElementById("c-lat").value = c.lat || "";
                document.getElementById("c-lng").value = c.lng || "";
                DOM.clientFormTitle.textContent = "Editar Cliente: " + c.nombre;
                DOM.btnSubmitClient.textContent = "Guardar Cambios";
                DOM.clientForm.scrollIntoView({ behavior: 'smooth' });
                
                // Show on map if coordinates exist
                if (c.lat && c.lng) {
                    showCoordinatesOnMap(c.lat, c.lng, c.address);
                }
            }
        });
    });

    DOM.clientsTableBody.querySelectorAll(".btn-delete-client").forEach(btn => {
        btn.addEventListener("click", () => {
            const id = btn.getAttribute("data-id");
            const c = clients.find(item => item.id === id);
            if (c && confirm(`¿Estás seguro de que deseas eliminar a "${c.nombre}"?\nEsta acción no se puede deshacer.`)) {
                if (IS_SERVER) {
                    try {
                        const xhr = new XMLHttpRequest();
                        xhr.open("DELETE", `${API_URL}/api/clientes?id=${id}`, false);
                        xhr.send();
                        LocalDB.init();
                    } catch (err) {
                        alert("Error al eliminar cliente: " + err.message);
                        return;
                    }
                } else {
                    const updated = clients.filter(item => item.id !== id);
                    LocalDB.saveClients(updated);
                }
                renderClientsTable();
                if (DOM.editClientId.value === id) {
                    clearClientForm();
                }
            }
        });
    });
}

if (DOM.clientForm) {
    DOM.clientForm.addEventListener("submit", function(e) {
        e.preventDefault();
        const id = DOM.editClientId.value;
        const name = DOM.cName.value.trim();
        const phone = DOM.cPhone.value.trim();
        const email = DOM.cEmail.value.trim();
        const address = DOM.cAddress.value.trim();
        const lat = document.getElementById("c-lat").value;
        const lng = document.getElementById("c-lng").value;

        const clients = LocalDB.getClients();

        if(!name || !phone) {
            return alert("Por favor, ingrese el nombre y el teléfono (campos obligatorios).");
        }

        const clientData = {
            id: id || "",
            nombre: name,
            telefono: phone,
            email: email,
            address: address,
            lat: lat,
            lng: lng,
            totalSpent: 0,
            orders: []
        };

        if (IS_SERVER) {
            try {
                const xhr = new XMLHttpRequest();
                xhr.open("POST", `${API_URL}/api/clientes`, false);
                xhr.setRequestHeader("Content-Type", "application/json");
                xhr.send(JSON.stringify(clientData));
                const res = JSON.parse(xhr.responseText);
                if (res.error) throw new Error(res.error);
                alert(`Cliente "${name}" guardado correctamente.`);
                LocalDB.init();
            } catch (err) {
                alert("Error al guardar cliente en el servidor: " + err.message);
                return;
            }
        } else {
            if (id === "") {
                clientData.id = "client_" + Date.now();
                clients.push(clientData);
                
                // Actualizar pedidos pendientes de este cliente (por si fue creado como manual antes)
                const orders = LocalDB.getOrders();
                let updatedOrders = false;
                orders.forEach(o => {
                    const orderClientName = (o.cliente || "").trim().toLowerCase();
                    const newClientName = (name || "").trim().toLowerCase();
                    
                    if (orderClientName === newClientName && o.deliveryStatus === 'Pendiente') {
                        o.cliente = name;
                        o.telefono = phone;
                        o.deliveryAddress = address;
                        o.deliveryLat = lat;
                        o.deliveryLng = lng;
                        updatedOrders = true;
                    }
                });
                if (updatedOrders) {
                    LocalDB.saveOrders(orders);
                }
                
                alert(`Cliente "${name}" registrado correctamente.`);
            } else {
                const index = clients.findIndex(item => item.id === id);
                if (index > -1) {
                    const oldName = clients[index].nombre;
                    clients[index].nombre = name;
                    clients[index].telefono = phone;
                    clients[index].email = email;
                    clients[index].address = address;
                    clients[index].lat = lat;
                    clients[index].lng = lng;
                    
                    // Actualizar pedidos pendientes de este cliente si cambia la dirección
                    const orders = LocalDB.getOrders();
                    let updatedOrders = false;
                    orders.forEach(o => {
                        const orderClientName = (o.cliente || "").trim().toLowerCase();
                        const oldClientName = (oldName || "").trim().toLowerCase();
                        const newClientName = (name || "").trim().toLowerCase();
                        
                        if ((orderClientName === oldClientName || orderClientName === newClientName) && o.deliveryStatus === 'Pendiente') {
                            o.cliente = name;
                            o.telefono = phone;
                            o.deliveryAddress = address;
                            o.deliveryLat = lat;
                            o.deliveryLng = lng;
                            updatedOrders = true;
                        }
                    });
                    if (updatedOrders) {
                        LocalDB.saveOrders(orders);
                    }
                    
                    alert(`Cliente "${name}" modificado correctamente.`);
                }
            }
            LocalDB.saveClients(clients);
        }
        clearClientForm();
        renderClientsTable();
    });
}

if (DOM.clientSearchInput) {
    DOM.clientSearchInput.addEventListener("input", renderClientsTable);
}

// --- 9.5.4. BUSCADOR PREDICTIVO EN CARRITO (POS) ---
if (DOM.clientSelectInput) {
    // Rellenar y filtrar dropdown de clientes en base a lo escrito
    const filterClientDropdown = () => {
        const query = DOM.clientSelectInput.value.toLowerCase().trim();
        const clients = LocalDB.getClients();
        
        let html = "";
        const matches = clients.filter(c => c.nombre.toLowerCase().includes(query) || c.telefono.includes(query));
        
        if (matches.length > 0) {
            matches.forEach(c => {
                html += `<div class="client-dropdown-item" data-id="${c.id}" data-name="${c.nombre}" data-phone="${c.telefono}" data-address="${c.address || ''}" data-lat="${c.lat || ''}" data-lng="${c.lng || ''}">${c.nombre} (${c.telefono})</div>`;
            });
        } else {
            html += `<div class="client-dropdown-item" style="color:var(--text-secondary); cursor:default;">Registrar nuevo cliente al facturar...</div>`;
        }
        
        DOM.clientDropdown.innerHTML = html;
        DOM.clientDropdown.style.display = "block";

        // Click en un item del dropdown
        DOM.clientDropdown.querySelectorAll(".client-dropdown-item").forEach(item => {
            item.addEventListener("click", () => {
                const id = item.getAttribute("data-id");
                if (id) {
                    const name = item.getAttribute("data-name");
                    const phone = item.getAttribute("data-phone");
                    const address = item.getAttribute("data-address");
                    const lat = item.getAttribute("data-lat");
                    const lng = item.getAttribute("data-lng");
                    
                    DOM.clientName.value = name;
                    DOM.clientPhone.value = phone;
                    
                    DOM.selectedClientNameDisplay.textContent = name;
                    DOM.selectedClientBadge.style.display = "flex";
                    
                    const elAddress = document.getElementById("delivery-address");
                    const elLat = document.getElementById("delivery-lat");
                    const elLng = document.getElementById("delivery-lng");
                    
                    if (elAddress && address) elAddress.value = address;
                    if (elLat && lat) elLat.value = lat;
                    if (elLng && lng) elLng.value = lng;
                    
                    DOM.btnClearSelectedClient.style.display = "block";
                    DOM.clientSelectInput.value = "";
                }
                DOM.clientDropdown.style.display = "none";
            });
        });
    };

    DOM.clientSelectInput.addEventListener("input", filterClientDropdown);
    DOM.clientSelectInput.addEventListener("focus", filterClientDropdown);

    // Ocultar dropdown al clickear fuera
    document.addEventListener("click", (e) => {
        if (DOM.clientDropdown && !DOM.clientSelectInput.contains(e.target) && !DOM.clientDropdown.contains(e.target)) {
            DOM.clientDropdown.style.display = "none";
        }
    });

    // Limpiar cliente seleccionado
    if (DOM.btnClearSelectedClient) {
        DOM.btnClearSelectedClient.addEventListener("click", () => {
            DOM.clientName.value = "Cliente General";
            DOM.clientPhone.value = "-";
            DOM.selectedClientBadge.style.display = "none";
            DOM.btnClearSelectedClient.style.display = "none";
            DOM.clientSelectInput.value = "";
            const elAddress = document.getElementById("delivery-address");
            const elLat = document.getElementById("delivery-lat");
            const elLng = document.getElementById("delivery-lng");
            if (elAddress) elAddress.value = "";
            if (elLat) elLat.value = "";
            if (elLng) elLng.value = "";
        });
    }
}

// --- 9.5.5. ANALÍTICAS / BACK OFFICE ---
function renderAnalytics() {
    const orders = LocalDB.getOrders();
    const totalTransactions = orders.length;
    
    const grossSales = orders.reduce((sum, o) => sum + o.total, 0);
    const averageTicket = totalTransactions > 0 ? (grossSales / totalTransactions) : 0;

    // Escribir KPIs principales
    const totalCost = orders.reduce((sum, o) => {
        const orderCost = o.items ? o.items.reduce((itemSum, item) => itemSum + ((item.costo || 0) * item.qty), 0) : 0;
        return sum + orderCost;
    }, 0);
    const profitMargin = grossSales - totalCost;

    if (DOM.kpiGrossSales) DOM.kpiGrossSales.textContent = `S/${grossSales.toFixed(2)}`;
    if (DOM.kpiTicketCount) DOM.kpiTicketCount.textContent = totalTransactions;
    if (DOM.kpiAverageTicket) DOM.kpiAverageTicket.textContent = `S/${averageTicket.toFixed(2)}`;
    if (DOM.kpiProfitMargin) DOM.kpiProfitMargin.textContent = `S/${profitMargin.toFixed(2)}`;

    // 1. Calcular Analíticas por Método de Pago
    const paymentMethods = { Efectivo: 0, Tarjeta: 0, Transferencia: 0 };
    orders.forEach(o => {
        if (paymentMethods[o.metodo] !== undefined) {
            paymentMethods[o.metodo] += o.total;
        }
    });

    let methodsHtml = "";
    const maxMethodVal = Math.max(...Object.values(paymentMethods), 1);
    
    Object.keys(paymentMethods).forEach(method => {
        const val = paymentMethods[method];
        const pct = (val / maxMethodVal) * 100;
        
        methodsHtml += `
            <div class="progress-item">
                <div class="progress-label">
                    <span>${method}</span>
                    <span>S/${val.toFixed(2)}</span>
                </div>
                <div class="progress-track">
                    <div class="progress-fill ${method.toLowerCase()}" style="width: ${pct}%"></div>
                </div>
            </div>
        `;
    });
    if (DOM.paymentMethodsAnalytics) DOM.paymentMethodsAnalytics.innerHTML = methodsHtml;

    // 2. Ranking de Productos Más Vendidos
    const productSales = {}; // Almacena { key: { name, presentation, qty, total } }
    
    orders.forEach(o => {
        o.items.forEach(it => {
            const key = it.nombre + " - " + it.presentacion;
            if (!productSales[key]) {
                productSales[key] = {
                    nombre: it.nombre,
                    presentacion: it.presentacion,
                    qty: 0,
                    income: 0
                };
            }
            productSales[key].qty += it.qty;
            productSales[key].income += it.subtotal;
        });
    });

    // Ordenar y tomar los top 5
    const topProducts = Object.values(productSales)
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 5);

    let topHtml = "";
    if (topProducts.length === 0) {
        topHtml = `<div style="text-align:center; color:var(--text-secondary); padding: 15px 0;">Aún no hay ventas registradas.</div>`;
    } else {
        topProducts.forEach(prod => {
            topHtml += `
                <div class="ranking-row">
                    <div>
                        <span class="ranking-name">${prod.nombre}</span>
                        <span style="font-size:11px; color:var(--text-muted); display:block;">Presentación: ${prod.presentacion}</span>
                    </div>
                    <div style="text-align:right;">
                        <span class="ranking-qty">${prod.qty} uds</span>
                        <strong style="display:block; font-size:12px; margin-top:2px;">S/${prod.income.toFixed(2)}</strong>
                    </div>
                </div>
            `;
        });
    }
    if (DOM.topProductsAnalytics) DOM.topProductsAnalytics.innerHTML = topHtml;
}

// =========================================================================
// 10. INICIALIZACIÓN DE LA VISTA
// =========================================================================
// --- EVENTOS DEL MODAL DE VENTA FLEXIBLE ---
if (DOM.btnCloseProductModal) {
    DOM.btnCloseProductModal.addEventListener("click", () => {
        DOM.productModal.style.display = "none";
    });
}

if (DOM.productModal) {
    DOM.productModal.addEventListener("click", (e) => {
        if (e.target === DOM.productModal) {
            DOM.productModal.style.display = "none";
        }
    });
}

document.getElementsByName("modal-presentation").forEach(radio => {
    radio.addEventListener("change", updateModalFields);
});

if (DOM.modalPriceInput) {
    DOM.modalPriceInput.addEventListener("input", calculateModalSubtotal);
}

if (DOM.btnModalQtyMinus) {
    DOM.btnModalQtyMinus.addEventListener("click", () => {
        let val = parseInt(DOM.modalQtyInput.value) || 1;
        if (val > 1) {
            DOM.modalQtyInput.value = val - 1;
            calculateModalSubtotal();
        }
    });
}

if (DOM.btnModalQtyPlus) {
    DOM.btnModalQtyPlus.addEventListener("click", () => {
        let val = parseInt(DOM.modalQtyInput.value) || 1;
        DOM.modalQtyInput.value = val + 1;
        calculateModalSubtotal();
    });
}

if (DOM.modalQtyInput) {
    DOM.modalQtyInput.addEventListener("input", () => {
        let val = parseInt(DOM.modalQtyInput.value) || 1;
        if (val < 1) DOM.modalQtyInput.value = 1;
        calculateModalSubtotal();
    });
}

if (DOM.btnModalAddToCart) {
    DOM.btnModalAddToCart.addEventListener("click", () => {
        const product = AppState.modalProduct;
        if (!product) return;

        const radios = document.getElementsByName("modal-presentation");
        let presentation = "cajetilla";
        radios.forEach(r => {
            if (r.checked) presentation = r.value;
        });

        let activeStock = parseInt(product.stock_cajetilla) || 0;
        if (presentation === "paquete") activeStock = parseInt(product.stock_paquete) || 0;
        else if (presentation === "cajon") activeStock = parseInt(product.stock_cajon) || 0;

        const price = parseFloat(DOM.modalPriceInput.value) || 0;
        const qty = parseInt(DOM.modalQtyInput.value) || 1;

        if (price < 0 || qty <= 0) {
            alert("Por favor ingresa un precio y cantidad válidos.");
            return;
        }

        const existingIndex = AppState.cart.findIndex(it => it.product.id === product.id && it.presentation === presentation);
        let qty_ya_agregada = existingIndex > -1 ? AppState.cart[existingIndex].qty : 0;

        if (qty_ya_agregada + qty > activeStock) {
            alert(`Stock insuficiente. Solo quedan ${activeStock} unidades disponibles.`);
            return;
        }

        if (existingIndex > -1) {
            AppState.cart[existingIndex].qty += qty;
            AppState.cart[existingIndex].activePrice = price; 
        } else {
            AppState.cart.push({
                product: product,
                presentation: presentation,
                qty: qty,
                activePrice: price
            });
        }

        DOM.productModal.style.display = "none";
        renderPOS();
        renderCart();
    });
}

// --- EVENTOS DE RESPONSIVIDAD PARA EL CARRITO EN MÓVIL Y DESKTOP ---
const mobileCartToggle = document.getElementById("btn-mobile-cart-toggle");
const closeInvoiceDrawer = document.getElementById("btn-close-invoice-drawer");
const invoiceSidebar = document.getElementById("invoice-sidebar");

const toggleCart = (e) => {
    if (e) e.stopPropagation();
    if (window.innerWidth <= 1024) {
        if (invoiceSidebar) invoiceSidebar.classList.toggle("active-drawer");
    } else {
        document.body.classList.toggle("cart-closed");
    }
};

const closeCart = () => {
    if (window.innerWidth <= 1024) {
        if (invoiceSidebar) invoiceSidebar.classList.remove("active-drawer");
    } else {
        document.body.classList.add("cart-closed");
    }
};

if (mobileCartToggle && invoiceSidebar) {
    mobileCartToggle.addEventListener("click", toggleCart);
}

if (closeInvoiceDrawer && invoiceSidebar) {
    closeInvoiceDrawer.addEventListener("click", closeCart);
}

// Cerrar drawer al hacer clic fuera de él en móvil
document.addEventListener('click', (e) => {
    if (window.innerWidth <= 1024) {
        if (invoiceSidebar && invoiceSidebar.classList.contains('active-drawer')) {
            if (!invoiceSidebar.contains(e.target) && mobileCartToggle && !mobileCartToggle.contains(e.target)) {
                invoiceSidebar.classList.remove("active-drawer");
            }
        }
    }
});

// LOGOUT
const btnLogout = document.getElementById("btn-logout");
if (btnLogout) {
    btnLogout.addEventListener("click", async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
            window.location.href = '/';
        } catch (err) {
            console.error("Error logging out", err);
            window.location.href = '/';
        }
    });
}

// Cerrar drawer al cambiar de pestaña
DOM.navButtons.forEach(btn => {
    btn.addEventListener("click", () => {
        if (window.innerWidth <= 1024) {
            closeCart();
        }
    });
});

// --- DESCARGAR HOJA DE PEDIDO A PROVEEDORES (EXCEL CSV) ---
function downloadProviderOrderExcel() {
    const products = LocalDB.getProducts();
    const lowStockItems = [];
    
    // Umbral de bajo stock y meta de reabastecimiento
    const MIN_THRESHOLD = 5;
    const TARGET_STOCK = 20; // Queremos completar a 20 unidades
    
    products.forEach(p => {
        const sCaj = parseInt(p.stock_cajetilla) || 0;
        const sPaq = parseInt(p.stock_paquete) || 0;
        const sCajon = parseInt(p.stock_cajon) || 0;
        
        if (sCaj < MIN_THRESHOLD) {
            lowStockItems.push({
                nombre: p.nombre,
                marca: p.marca,
                presentacion: "Cajetilla",
                stock: sCaj,
                minimo: MIN_THRESHOLD,
                pedido_sugerido: TARGET_STOCK - sCaj
            });
        }
        if (sPaq < MIN_THRESHOLD) {
            lowStockItems.push({
                nombre: p.nombre,
                marca: p.marca,
                presentacion: "Paquete",
                stock: sPaq,
                minimo: MIN_THRESHOLD,
                pedido_sugerido: TARGET_STOCK - sPaq
            });
        }
        if (sCajon < MIN_THRESHOLD) {
            lowStockItems.push({
                nombre: p.nombre,
                marca: p.marca,
                presentacion: "Cajón",
                stock: sCajon,
                minimo: MIN_THRESHOLD,
                pedido_sugerido: TARGET_STOCK - sCajon
            });
        }
    });

    // Construir contenido del reporte CSV formateado para Excel en Español
    let csvContent = "\uFEFF"; // BOM para caracteres UTF-8 en Excel
    csvContent += "PEDIDO SUGERIDO A PROVEEDORES - DA LOGISTICS\r\n";
    csvContent += `Fecha de Generacion:;${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}\r\n`;
    csvContent += "Criterio de Reorden:;Stock disponible menor a 5 unidades (Sugerido para rellenar stock a 20 unidades)\r\n\r\n";
    csvContent += "Cigarro;Marca;Presentacion;Stock Actual;Umbral Minimo;Cantidad a Pedir\r\n";

    if (lowStockItems.length === 0) {
        csvContent += "Todos los productos del inventario estan en niveles óptimos. No se requiere comprar nada.;;;;;\r\n";
    } else {
        lowStockItems.forEach(item => {
            csvContent += `${item.nombre};${item.marca};${item.presentacion};${item.stock};${item.minimo};${item.pedido_sugerido}\r\n`;
        });
    }

    const dateFormatted = new Date().toISOString().slice(0, 10);
    saveFileViaServer(`Pedido_Proveedores_DaLogistics_${dateFormatted}.csv`, csvContent, 'text');
}

if (DOM.btnDownloadOrderSheet) {
    DOM.btnDownloadOrderSheet.addEventListener("click", downloadProviderOrderExcel);
}

// --- DESCARGAR UN PEDIDO SELECCIONADO A EXCEL (CSV) ---
function downloadSingleOrderExcel() {
    const order = AppState.selectedOrderForDetails;
    if (!order) return;
    
    let csvContent = "\uFEFF"; // BOM para Excel
    csvContent += `REPORTE DE PEDIDO / COMPRA - FOLIO: ${order.folio}\r\n`;
    csvContent += `Fecha:;${order.fecha}\r\n`;
    csvContent += `Cliente:;${order.cliente}\r\n`;
    csvContent += `Telefono:;${order.telefono || "-"}\r\n`;
    csvContent += `Metodo Pago:;${order.metodo}\r\n\r\n`;
    csvContent += "Producto;Presentacion;Cantidad;Precio Unitario;Subtotal\r\n";
    
    order.items.forEach(it => {
        csvContent += `${it.nombre};${it.presentacion};${it.qty};${it.precio};${it.subtotal}\r\n`;
    });
    
    csvContent += `\r\n;;;TOTAL PEDIDO:;${order.total}\r\n`;
    
    saveFileViaServer(`Pedido_${order.folio}.csv`, csvContent, 'text');
}

if (DOM.btnExportOrderExcel) {
    DOM.btnExportOrderExcel.addEventListener("click", downloadSingleOrderExcel);
}

// --- EXPORTAR TODOS LOS PEDIDOS A EXCEL (CSV) ---
function downloadAllOrdersExcel() {
    const orders = LocalDB.getOrders();
    if (orders.length === 0) {
        alert("No hay pedidos registrados para exportar.");
        return;
    }
    
    let csvContent = "\uFEFF"; // BOM para Excel
    csvContent += "HISTORIAL COMPLETO DE PEDIDOS - DA LOGISTICS\r\n";
    csvContent += `Fecha de Exportacion:;${new Date().toLocaleDateString()}\r\n\r\n`;
    csvContent += "Folio;Fecha;Cliente;Telefono;Producto;Presentacion;Cantidad;Precio Unitario;Subtotal Item;Total Venta\r\n";
    
    orders.forEach(o => {
        o.items.forEach(it => {
            csvContent += `${o.folio};${o.fecha};${o.cliente};${o.telefono || "-"};${it.nombre};${it.presentacion};${it.qty};${it.precio};${it.subtotal};${o.total}\r\n`;
        });
    });
    
    saveFileViaServer(`Historial_Ventas_Completo.csv`, csvContent, 'text');
}

if (DOM.btnExportAllOrdersExcel) {
    DOM.btnExportAllOrdersExcel.addEventListener("click", downloadAllOrdersExcel);
}

// --- EXPORTAR REPORTES DE ANALÍTICAS A EXCEL (CSV) ---
function downloadAnalyticsExcel() {
    const orders = LocalDB.getOrders();
    const totalTransactions = orders.length;
    const grossSales = orders.reduce((sum, o) => sum + o.total, 0);
    const averageTicket = totalTransactions > 0 ? (grossSales / totalTransactions) : 0;

    // Métodos de pago
    const paymentMethods = { Efectivo: 0, Tarjeta: 0, Transferencia: 0 };
    orders.forEach(o => {
        if (paymentMethods[o.metodo] !== undefined) {
            paymentMethods[o.metodo] += o.total;
        }
    });

    // Productos más vendidos
    const productSales = {};
    orders.forEach(o => {
        o.items.forEach(it => {
            const key = it.nombre + " - " + it.presentacion;
            if (!productSales[key]) {
                productSales[key] = { nombre: it.nombre, presentacion: it.presentacion, qty: 0, income: 0 };
            }
            productSales[key].qty += it.qty;
            productSales[key].income += it.subtotal;
        });
    });
    const topProducts = Object.values(productSales).sort((a, b) => b.qty - a.qty);

    let csvContent = "\uFEFF"; // BOM para Excel
    csvContent += "TABLERO DE CONTROL - ANALITICAS DE VENTAS - DA LOGISTICS\r\n";
    csvContent += `Fecha de Exportacion:;${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}\r\n\r\n`;

    csvContent += "=== RESUMEN GENERAL (KPIs) ===\r\n";
    csvContent += `Ventas Brutas Totales:;S/${grossSales.toFixed(2)}\r\n`;
    csvContent += `Cantidad de Tickets:;${totalTransactions}\r\n`;
    csvContent += `Ticket Promedio:;S/${averageTicket.toFixed(2)}\r\n\r\n`;

    csvContent += "=== VENTAS POR METODO DE PAGO ===\r\n";
    csvContent += "Metodo de Pago;Monto Acumulado;Participacion (%)\r\n";
    Object.keys(paymentMethods).forEach(method => {
        const val = paymentMethods[method];
        const pct = grossSales > 0 ? (val / grossSales) * 100 : 0;
        csvContent += `${method};S/${val.toFixed(2)};${pct.toFixed(1)}%\r\n`;
    });
    csvContent += "\r\n";

    csvContent += "=== RANKING DE PRODUCTOS MAS VENDIDOS ===\r\n";
    csvContent += "Producto;Presentacion;Cantidad Vendida;Ingresos Totales\r\n";
    topProducts.forEach(prod => {
        csvContent += `${prod.nombre};${prod.presentacion};${prod.qty};S/${prod.income.toFixed(2)}\r\n`;
    });

    const dateFormatted = new Date().toISOString().slice(0, 10);
    saveFileViaServer(`Tablero_Analiticas_DaLogistics_${dateFormatted}.csv`, csvContent, 'text');
}

const btnExportAnalyticsExcel = document.getElementById("btn-export-analytics-excel");
if (btnExportAnalyticsExcel) {
    btnExportAnalyticsExcel.addEventListener("click", downloadAnalyticsExcel);
}

// --- EXPORTAR CLIENTES A EXCEL (CSV) ---
function exportClientsToExcel() {
    const clients = LocalDB.getClients();
    const orders = LocalDB.getOrders();
    if (clients.length === 0) {
        alert("No hay clientes registrados para exportar.");
        return;
    }
    
    let csvContent = "\uFEFF"; // BOM para Excel
    csvContent += "DIRECTORIO DE CLIENTES - DA LOGISTICS\r\n";
    csvContent += `Fecha de Exportacion:;${new Date().toLocaleDateString()}\r\n\r\n`;
    csvContent += "Nombre;Telefono;Correo;Direccion;Compras;Total Gastado\r\n";
    
    clients.forEach(c => {
        const clientOrders = orders.filter(o => o.cliente.toLowerCase() === c.nombre.toLowerCase());
        const purchaseCount = clientOrders.length;
        const totalSpent = clientOrders.reduce((sum, o) => sum + o.total, 0);
        
        csvContent += `${c.nombre};${c.telefono};${c.email || "-"};${c.address || "-"};${purchaseCount};S/${totalSpent.toFixed(2)}\r\n`;
    });
    
    const dateFormatted = new Date().toISOString().slice(0, 10);
    saveFileViaServer(`Clientes_CRM_${dateFormatted}.csv`, csvContent, 'text');
}

if (DOM.btnExportClientsExcel) {
    DOM.btnExportClientsExcel.addEventListener("click", exportClientsToExcel);
}

// --- IMPORTAR CLIENTES DESDE EXCEL (CSV) ---
function importClientsFromExcel(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const text = e.target.result;
            const lines = text.split(/\r?\n/);
            
            const existingClients = LocalDB.getClients();
            const clientMap = new Map();
            existingClients.forEach(c => clientMap.set(c.telefono.trim(), c));
            
            let importedCount = 0;
            
            // Recorrer líneas del archivo CSV
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                
                // Ignorar filas de metadatos o comentarios de cabecera
                if (line.startsWith("DIRECTORIO DE CLIENTES") || line.startsWith("Fecha de Exportacion:")) {
                    continue;
                }
                
                const cols = line.split(';');
                if (cols.length >= 2) {
                    const name = cols[0].trim();
                    const phone = cols[1].trim();
                    const email = cols[2] ? cols[2].trim() : "";
                    const address = cols[3] ? cols[3].trim() : "";
                    
                    // Ignorar la fila de nombres de columna
                    if (name.toLowerCase() === "nombre" || phone.toLowerCase() === "telefono" || name === "" || phone === "") {
                        continue;
                    }
                    
                    clientMap.set(phone, {
                        id: "client_" + (Date.now() + Math.random()),
                        nombre: name,
                        telefono: phone,
                        email: email === "-" ? "" : email
                    });
                    importedCount++;
                }
            }
            
            LocalDB.saveClients(Array.from(clientMap.values()));
            alert(`Se importaron/actualizaron ${importedCount} clientes desde el archivo Excel (CSV).`);
            renderClientsTable();
            
            // Limpiar selector
            event.target.value = "";
        } catch (err) {
            alert("Error al procesar el archivo Excel. Asegúrate de que use el formato correcto separado por punto y coma (;).");
            console.error(err);
        }
    };
    reader.readAsText(file, "UTF-8");
}

if (DOM.btnImportClientsExcel && DOM.fileImportClients) {
    DOM.btnImportClientsExcel.addEventListener("click", () => {
        DOM.fileImportClients.click();
    });
    DOM.fileImportClients.addEventListener("change", importClientsFromExcel);
}

// =========================================================================
// 3. INICIALIZACIÓN DE LA APP CON DATOS REMOTOS
// =========================================================================
(async function initializeApp() {
    await LocalDB.initAsync();
    
    // Poblar barra de marcas, renderizar la cuadrícula del POS y renderizar el carrito inicial (vacío)
    updateBrandsBar();
    renderPOS();
    renderCart();
    updateInventoryStats();
})();

// --- LÓGICA DE CAMBIO DE TEMA (MODO NOCHE / MODO NORMAL) ---
const themeToggleBtn = document.getElementById("btn-theme-toggle");
if (themeToggleBtn) {
    const currentTheme = localStorage.getItem("dalogistics_theme");
    if (currentTheme === "night") {
        document.body.classList.add("night-theme");
        themeToggleBtn.querySelector(".theme-icon").textContent = "🕶️";
        themeToggleBtn.querySelector(".theme-text").textContent = "Modo Noche";
    } else {
        themeToggleBtn.querySelector(".theme-icon").textContent = "🌙";
        themeToggleBtn.querySelector(".theme-text").textContent = "Modo Normal";
    }

    themeToggleBtn.addEventListener("click", () => {
        document.body.classList.toggle("night-theme");
        const isNight = document.body.classList.contains("night-theme");
        
        if (isNight) {
            localStorage.setItem("dalogistics_theme", "night");
            themeToggleBtn.querySelector(".theme-icon").textContent = "🕶️";
            themeToggleBtn.querySelector(".theme-text").textContent = "Modo Noche";
        } else {
            localStorage.setItem("dalogistics_theme", "dark");
            themeToggleBtn.querySelector(".theme-icon").textContent = "🌙";
            themeToggleBtn.querySelector(".theme-text").textContent = "Modo Normal";
        }
    });
}

// =========================================================================
// 12. MAPA DE CLIENTE (LEAFLET)
// =========================================================================
let clientMap = null;
let clientMarker = null;

function initClientMap() {
    if (clientMap) return; 
    const mapDiv = document.getElementById("client-map");
    if (!mapDiv) return;
    
    if (typeof L === "undefined") {
        setTimeout(initClientMap, 500);
        return;
    }
    
    clientMap = L.map('client-map').setView([-12.046374, -77.042793], 13); // Fallback
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap'
    }).addTo(clientMap);
    
    // Si no hay coordenadas previas y el navegador soporta geolocalización, centrar en la ubicación actual
    if (!document.getElementById("c-lat").value && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((pos) => {
            if (!document.getElementById("c-lat").value) { // Verificar nuevamente por si el usuario ya hizo clic
                clientMap.setView([pos.coords.latitude, pos.coords.longitude], 14);
            }
        }, () => {
            // Silencioso si falla
        }, { timeout: 3000 });
    }
    
    // Permitir hacer clic para mover el pin
    clientMap.on('click', function(e) {
        setMarkerPosition(e.latlng.lat, e.latlng.lng);
    });
}

function setMarkerPosition(lat, lng, addressInfo = "Ubicación seleccionada") {
    const latLng = L.latLng(lat, lng);
    if (clientMarker) {
        clientMarker.setLatLng(latLng);
    } else {
        clientMarker = L.marker(latLng, {draggable: true}).addTo(clientMap);
        
        clientMarker.on('dragend', function(event) {
            var position = clientMarker.getLatLng();
            setMarkerPosition(position.lat, position.lng);
        });
    }
    
    clientMap.setView(latLng, 16);
    document.getElementById("c-lat").value = lat;
    document.getElementById("c-lng").value = lng;
}

async function showAddressOnMap(address) {
    initClientMap();
    const mapDiv = document.getElementById("client-map");
    const helperText = document.getElementById("map-helper-text");
    mapDiv.style.display = "block";
    if(helperText) helperText.style.display = "block";
    
    setTimeout(() => {
        if(clientMap) clientMap.invalidateSize();
    }, 200);

    // Si ya tenemos coordenadas, no buscar, solo mostrar mapa (o buscar si no hay marker)
    if (document.getElementById("c-lat").value && document.getElementById("c-lng").value) {
        setMarkerPosition(document.getElementById("c-lat").value, document.getElementById("c-lng").value);
        return;
    }

    if (!address || address.trim() === '') {
        // Tratar de geolocalizar al usuario si está vacío
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => setMarkerPosition(pos.coords.latitude, pos.coords.longitude),
                () => alert("Ingresa una dirección o toca el mapa para fijar ubicación.")
            );
        }
        return;
    }

    try {
        const searchQuery = encodeURIComponent(address + ", Peru");
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${searchQuery}&limit=1`);
        const data = await res.json();
        
        if (data && data.length > 0) {
            setMarkerPosition(data[0].lat, data[0].lon, address);
        } else {
            alert("No se encontró la dirección exacta. Por favor, navega en el mapa y toca la ubicación correcta para fijar el pin.");
        }
    } catch (e) {
        console.error("Geocoding error", e);
    }
}

function showCoordinatesOnMap(lat, lng, address) {
    initClientMap();
    const mapDiv = document.getElementById("client-map");
    const helperText = document.getElementById("map-helper-text");
    mapDiv.style.display = "block";
    if(helperText) helperText.style.display = "block";
    
    setTimeout(() => {
        if(clientMap) clientMap.invalidateSize();
    }, 200);
    
    setMarkerPosition(lat, lng, address);
}

document.addEventListener("DOMContentLoaded", () => {
    const btnSearch = document.getElementById("btn-search-map");
    if (btnSearch) {
        btnSearch.addEventListener("click", () => {
            const addr = document.getElementById("c-address").value;
            showAddressOnMap(addr);
        });
    }
});
