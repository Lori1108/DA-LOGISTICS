// Helper functions for inventory management
function getProductTotalUnits(prod) {
    return (parseInt(prod.stock_cajetilla) || 0) + 
           ((parseInt(prod.stock_paquete) || 0) * 10) + 
           ((parseInt(prod.stock_cajon) || 0) * 500);
}

function updateProductStockFromTotal(prod, totalUnits) {
    if (totalUnits < 0) totalUnits = 0;
    prod.stock_cajon = Math.floor(totalUnits / 500);
    let rem = totalUnits % 500;
    prod.stock_paquete = Math.floor(rem / 10);
    prod.stock_cajetilla = rem % 10;
}

function getPresentationMultiplier(presentation) {
    if (presentation === 'cajon') return 500;
    if (presentation === 'paquete') return 10;
    return 1;
}

const fs = require('fs');
let code = fs.readFileSync('C:\\Users\\jrengifo\\Downloads\\BILO\\public\\app.js', 'utf8');

// Replace activeStock checks
code = code.replace(
    /let stock = parseInt\(product\.stock_cajetilla\) \|\| 0;\s*if \(presentation === "paquete"\) stock = parseInt\(product\.stock_paquete\) \|\| 0;\s*if \(presentation === "cajon"\) stock = parseInt\(product\.stock_cajon\) \|\| 0;/g,
    `let totalUnits = getProductTotalUnits(product);\n    let stock = Math.floor(totalUnits / getPresentationMultiplier(presentation));`
);

code = code.replace(
    /let activeStock = parseInt\(product\.stock_cajetilla\) \|\| 0;\s*if \(presentation === "paquete"\) activeStock = parseInt\(product\.stock_paquete\) \|\| 0;\s*else if \(presentation === "cajon"\) activeStock = parseInt\(product\.stock_cajon\) \|\| 0;/g,
    `let activeStock = Math.floor(getProductTotalUnits(product) / getPresentationMultiplier(presentation));`
);

// Replace deduction logic in placeOrder
code = code.replace(
    /if \(item\.presentation === "cajetilla"\) \{\s*prod\.stock_cajetilla = Math\.max\(0, \(parseInt\(prod\.stock_cajetilla\) \|\| 0\) - item\.qty\);\s*\} else if \(item\.presentation === "paquete"\) \{\s*prod\.stock_paquete = Math\.max\(0, \(parseInt\(prod\.stock_paquete\) \|\| 0\) - item\.qty\);\s*\} else if \(item\.presentation === "cajon"\) \{\s*prod\.stock_cajon = Math\.max\(0, \(parseInt\(prod\.stock_cajon\) \|\| 0\) - item\.qty\);\s*\}/g,
    `let currentTotal = getProductTotalUnits(prod);\n                let qtyToDeduct = item.qty * getPresentationMultiplier(item.presentation);\n                updateProductStockFromTotal(prod, currentTotal - qtyToDeduct);`
);

// Inject helper functions at the top of the file
if (!code.includes('function getProductTotalUnits')) {
    code = `// Helper functions for inventory management\nfunction getProductTotalUnits(prod) {\n    return (parseInt(prod.stock_cajetilla) || 0) + \n           ((parseInt(prod.stock_paquete) || 0) * 10) + \n           ((parseInt(prod.stock_cajon) || 0) * 500);\n}\n\nfunction updateProductStockFromTotal(prod, totalUnits) {\n    if (totalUnits < 0) totalUnits = 0;\n    prod.stock_cajon = Math.floor(totalUnits / 500);\n    let rem = totalUnits % 500;\n    prod.stock_paquete = Math.floor(rem / 10);\n    prod.stock_cajetilla = rem % 10;\n}\n\nfunction getPresentationMultiplier(presentation) {\n    if (presentation === 'cajon') return 500;\n    if (presentation === 'paquete') return 10;\n    return 1;\n}\n\n` + code;
}

fs.writeFileSync('C:\\Users\\jrengifo\\Downloads\\BILO\\public\\app.js', code);
console.log("Replaced successfully!");
