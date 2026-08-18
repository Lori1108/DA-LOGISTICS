const fs = require('fs');

let code = fs.readFileSync('C:\\Users\\jrengifo\\Downloads\\BILO\\public\\app.js', 'utf8');

// 1. Add zoneSelectInput to DOM object
code = code.replace(
    /clientSelectInput: document\.getElementById\("client-select-input"\),/,
    `clientSelectInput: document.getElementById("client-select-input"),\n    zoneSelectInput: document.getElementById("zone-select-input"),`
);

// 2. Add populate zones function and run it when initializing clients
const populateZonesCode = `
function populateZones() {
    if (!DOM.zoneSelectInput) return;
    const clients = LocalDB.getClients();
    const zones = new Set();
    clients.forEach(c => {
        if (c.zona) zones.add(c.zona);
    });
    
    const currentVal = DOM.zoneSelectInput.value;
    let html = '<option value="">Todas las Zonas</option>';
    Array.from(zones).sort().forEach(z => {
        html += \`<option value="\${z}">\${z}</option>\`;
    });
    DOM.zoneSelectInput.innerHTML = html;
    DOM.zoneSelectInput.value = currentVal;
}
`;

// Inject before renderClientsTable
code = code.replace(/function renderClientsTable\(\) \{/, populateZonesCode + '\nfunction renderClientsTable() {\n    if(DOM.zoneSelectInput) populateZones();');

// 3. Update filterClientDropdown to use zone
code = code.replace(
    /const query = DOM\.clientSelectInput\.value\.toLowerCase\(\)\.trim\(\);\s*const clients = LocalDB\.getClients\(\);/,
    `const query = DOM.clientSelectInput.value.toLowerCase().trim();
        const clients = LocalDB.getClients();
        const selectedZone = DOM.zoneSelectInput ? DOM.zoneSelectInput.value : "";`
);

code = code.replace(
    /const matches = clients\.filter\(c => c\.nombre\.toLowerCase\(\)\.includes\(query\) \|\| c\.telefono\.includes\(query\)\);/,
    `const matches = clients.filter(c => {
            const matchesZone = selectedZone === "" || c.zona === selectedZone;
            const matchesQuery = c.nombre.toLowerCase().includes(query) || c.telefono.includes(query);
            return matchesZone && matchesQuery;
        });`
);

// 4. Add event listener to zoneSelectInput
code = code.replace(
    /if \(DOM\.clientSelectInput\) \{/,
    `if (DOM.clientSelectInput) {
    if (DOM.zoneSelectInput) {
        DOM.zoneSelectInput.addEventListener("change", filterClientDropdown);
    }`
);

fs.writeFileSync('C:\\Users\\jrengifo\\Downloads\\BILO\\public\\app.js', code);
console.log("Patched app.js successfully!");
