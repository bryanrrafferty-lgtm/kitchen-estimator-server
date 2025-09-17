// --- Barcode Modal Workflow for Inventory Tab ---
function openBarcodeModal(type) {
        // Get selected inventory item(s)
        const tableBody = document.getElementById(`${type.toLowerCase()}Table`);
        let supplierName = '';
        if (tableBody) {
                // Find all checked checkboxes in the table
                const checkedRows = Array.from(tableBody.querySelectorAll('tr')).filter(tr => {
                        const checkbox = tr.querySelector('input[type="checkbox"]');
                        return checkbox && checkbox.checked;
                });
                if (checkedRows.length > 0) {
                        // Supplier is usually the second <td> (after checkbox)
                        const supplierTd = checkedRows[0].querySelectorAll('td')[1];
                        if (supplierTd) supplierName = supplierTd.textContent.trim();
                }
        }

        // Ensure modal and fields exist before setting values
        let modalEl = document.getElementById('barcodeModal');
        if (!modalEl) {
                // Create modal if not present
                modalEl = document.createElement('div');
                modalEl.innerHTML = `
                <div class="modal fade" id="barcodeModal" tabindex="-1" aria-labelledby="barcodeModalLabel" aria-hidden="true">
                    <div class="modal-dialog">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title" id="barcodeModalLabel">Print Barcode Labels</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                            </div>
                            <div class="modal-body">
                                <label for="barcodeSupplier" class="form-label">Supplier</label>
                                <input type="text" id="barcodeSupplier" class="form-control mb-2">
                                <label for="barcodePO" class="form-label">PO Number</label>
                                <input type="text" id="barcodePO" class="form-control mb-2">
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                                <button type="button" class="btn btn-primary" id="printBarcodeBtn">Print</button>
                            </div>
                        </div>
                    </div>
                </div>`;
                document.body.appendChild(modalEl);
        }
        // Show the modal first, then set values after it's visible
        const supplierInput = document.getElementById('barcodeSupplier');
        const poInput = document.getElementById('barcodePO');
        const printBtn = document.getElementById('printBarcodeBtn');
        if (supplierInput) supplierInput.value = supplierName;
        if (poInput) poInput.value = '';
        const modal = new bootstrap.Modal(document.getElementById('barcodeModal'));
        modal.show();

        // Remove previous click listeners to avoid duplicates
        printBtn.replaceWith(printBtn.cloneNode(true));
        const newPrintBtn = document.getElementById('printBarcodeBtn');
        newPrintBtn.onclick = function () {
                // Optionally, you can use supplierInput.value and poInput.value in printBarcodeLabels if needed
                printBarcodeLabels(type);
                modal.hide();
        };
        // Remove modal from DOM after hidden
        document.getElementById('barcodeModal').addEventListener('hidden.bs.modal', function () {
                // Optionally remove modal from DOM if dynamically created
                // document.body.removeChild(modalEl);
        });
}
const API_BASE = '/api';
const { jsPDF } = window.jspdf;

let selectedProjectKey = null;
const itemsPerPage = 16;
const paginationState = {
    Receiving: { currentPage: 1, totalPages: 1 },
    Inventory: { currentPage: 1, totalPages: 1 },
    Shipping: { currentPage: 1, totalPages: 1 }
};
const selectedItems = {
    Receiving: new Set(),
    Inventory: new Set(),
    Shipping: new Set()
};

// Store square footage summary per project
let projectSquareFtSummary = {};

// --- Default sort state: alphabetize by supplier for all tabs ---
const tableSortState = {
    Receiving: { col: 1, dir: 'asc' },
    Inventory: { col: 1, dir: 'asc' },
    Shipping: { col: 1, dir: 'asc' }
};
const inventoryCache = {
    Receiving: [],
    Inventory: [],
    Shipping: []
};


// Helper: map column index to field name
const colMap = [
    null, 'supplierId', 'itemType', 'modelNumber', 'quantity', 'cartonQuantity', 'weight', 'itemNumber', 'location'
];

// Always sort the cache in-place according to the current sort state
function applySort(type) {
    const sortState = tableSortState[type];
    if (sortState && sortState.col !== null) {
        const field = colMap[sortState.col];
        if (field) {
            inventoryCache[type].sort((a, b) => {
                let valA = (a[field] || '').toString().toLowerCase();
                let valB = (b[field] || '').toString().toLowerCase();
                if (!isNaN(valA) && !isNaN(valB) && valA !== '' && valB !== '') {
                    valA = Number(valA);
                    valB = Number(valB);
                }
                if (valA < valB) return sortState.dir === 'asc' ? -1 : 1;
                if (valA > valB) return sortState.dir === 'asc' ? 1 : -1;
                return 0;
            });
        }
    }
}

// When a header is clicked, update sort state and re-render from cache
function sortTable(tableId, col) {
    const type = tableId.replace('Table', '').charAt(0).toUpperCase() + tableId.replace('Table', '').slice(1);
    if (tableSortState[type].col === col) {
        tableSortState[type].dir = tableSortState[type].dir === 'asc' ? 'desc' : 'asc';
    } else {
        tableSortState[type].col = col;
        tableSortState[type].dir = 'asc';
    }
    applySort(type);
    renderInventoryTable(type, inventoryCache[type]);
}

// Show message using Bootstrap toast
function showMessage(message, type = 'info', duration = 3500) {
    // type: 'info', 'success', 'error'
    const toastId = 'toast-' + Date.now();
    const container = document.getElementById('toast-container');
    const headerText = type === 'success' ? 'Success' : type === 'error' ? 'Error' : 'Notice';
    const headerIcon = type === 'success' ? '✅' : type === 'error' ? '⚠️' : 'ℹ️';
    const toast = document.createElement('div');
    toast.className = 'toast align-items-center';
    toast.id = toastId;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');
    toast.innerHTML = `
        <div class="toast-header">
            <span style="font-size:1.2em; margin-right:0.5em;">${headerIcon}</span>
            <strong class="me-auto">${headerText}</strong>
            <button type="button" class="btn-close ms-2 mb-1" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
        <div class="toast-body">${message}</div>
    `;
    container.appendChild(toast);
    const bsToast = new bootstrap.Toast(toast, { delay: duration });
    bsToast.show();
    toast.addEventListener('hidden.bs.toast', () => toast.remove());
}

// Reusable confirmation modal function
function showConfirmModal(title, message, onConfirm) {
    const modalEl = document.createElement('div');
    modalEl.innerHTML = `
        <div class="modal fade" id="confirmModal" tabindex="-1" aria-labelledby="confirmLabel" aria-hidden="true">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="confirmLabel">${title}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        ${message}
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        <button type="button" class="btn btn-danger" id="confirmBtn">Delete</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modalEl);
    const modal = new bootstrap.Modal(document.getElementById('confirmModal'));
    modal.show();
    const confirmBtn = document.getElementById('confirmBtn');
    confirmBtn.addEventListener('click', () => {
        modal.hide();
        onConfirm();
    });
    modalEl.addEventListener('hidden.bs.modal', () => {
        document.body.removeChild(modalEl);
    });
}

function selectAll(type, checked) {
    const tableBody = document.getElementById(`${type.toLowerCase()}Table`);
    if (!tableBody) return;
    const checkboxes = tableBody.querySelectorAll('.item-check');
    checkboxes.forEach(cb => {
        cb.checked = checked;
        if (checked) {
            selectedItems[type].add(cb.dataset.id);
        } else {
            selectedItems[type].delete(cb.dataset.id);
        }
    });
}

function openNewProjectModal() {
    const modalEl = document.getElementById('newProjectModal');
    if (!modalEl) {
        console.warn('New Project modal not found.');
        return;
    }
    document.getElementById('newCustomer').value = '';
    document.getElementById('newProjectName').value = '';
    const modal = new bootstrap.Modal(modalEl);
    const saveBtn = document.getElementById('saveNewProjectBtn');
    const saveListener = () => {
        saveNewProject();
        saveBtn.removeEventListener('click', saveListener);
    };
    saveBtn.addEventListener('click', saveListener);
    modal.show();
}

async function saveNewProject() {
    try {
        const customerRaw = document.getElementById('newCustomer').value.trim();
        const projectRaw = document.getElementById('newProjectName').value.trim();
        if (!customerRaw || !projectRaw) {
            showMessage('Customer and Project Name are required.', 'error');
            return;
        }
        const customer = customerRaw.replace(/^Customer/, '').trim();
        const projectName = projectRaw.replace(/^Project/, '').trim();
        const projectKey = `${customerRaw}_${projectRaw}`.replace(/\s+/g, '').replace(/[^a-zA-Z0-9-]/g, '');
        const projectData = {
            project_key: projectKey,
            customer,
            projectName,
            address: '',
            address2: '',
            city: '',
            state: '',
            zip: '',
            phone: '',
            contact: '',
            email: '',
            timestamp: new Date().toLocaleString('en-US', { timeZone: 'MST' })
        };
        const projectResponse = await fetch(`${API_BASE}/projects`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(projectData)
        });
        if (!projectResponse.ok) {
            const error = await projectResponse.json().catch(() => ({}));
            throw new Error(error.message || 'Failed to save project');
        }
        selectedProjectKey = projectKey;
        await updateProjectList();
        await loadProjectDetails(projectKey);
        await loadInventory('Receiving');
        bootstrap.Modal.getInstance(document.getElementById('newProjectModal')).hide();
        showMessage('New project created successfully.', 'success');
    } catch (err) {
        showMessage('Failed to create new project: ' + err.message, 'error');
    }
}

function saveProjectDetails() {
    const customer = document.getElementById('customer').value.trim();
    const projectName = document.getElementById('projectName').value.trim();
    const address = document.getElementById('address').value.trim();
    const address2 = document.getElementById('address2').value.trim();
    const city = document.getElementById('city').value.trim();
    const state = document.getElementById('state').value.trim();
    const zip = document.getElementById('zip').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const contact = document.getElementById('contact').value.trim();
    const email = document.getElementById('email').value.trim();

    if (!selectedProjectKey) {
        showMessage('No project selected.', 'error');
        return;
    }

    fetch(`/api/projects/${selectedProjectKey}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            customer, projectName, address, address2, city, state, zip, phone, contact, email
        })
    })
    .then(res => {
        if (!res.ok) throw new Error('Failed to save project details');
        showMessage('Project details saved!', 'success');
    })
    .catch(err => showMessage('Error: ' + err.message, 'error'));
}

async function moveToInventory(itemId) {
    try {
        const response = await fetch(`${API_BASE}/inventory/${itemId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'Inventory' })
        });
        if (!response.ok) throw new Error('Failed to move item to Inventory');
        showMessage('Item moved to Inventory.', 'success');
        await loadInventory('Receiving');
        await loadInventory('Inventory');
        // Update square footage summary and sidebar immediately after move
        await updateSquareFtSummary();
        updateSidebarSquareFt();
    } catch (err) {
        showMessage('Error: ' + err.message, 'error');
    }
}

async function moveToShipping(itemId) {
    try {
        const response = await fetch(`${API_BASE}/inventory/${itemId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'Shipping' })
        });
        if (!response.ok) throw new Error('Failed to move item to Shipping');
        showMessage('Item moved to Shipping.', 'success');
        loadInventory('Inventory');
        loadInventory('Shipping');
    } catch (err) {
        showMessage('Error: ' + err.message, 'error');
    }
}

async function moveToReceiving(itemId) {
    try {
        const response = await fetch(`${API_BASE}/inventory/${itemId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'Receiving' })
        });
        if (!response.ok) throw new Error('Failed to move item to Receiving');
        showMessage('Item moved to Receiving.', 'success');
        await loadInventory('Inventory');
        await loadInventory('Receiving');
        // Update square footage summary and sidebar immediately after move
        await updateSquareFtSummary();
        updateSidebarSquareFt();
    } catch (err) {
        showMessage('Error: ' + err.message, 'error');
    }
}

async function moveToInventoryFromShipping(itemId) {
    try {
        const response = await fetch(`${API_BASE}/inventory/${itemId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'Inventory' })
        });
        if (!response.ok) throw new Error('Failed to return item to Inventory');
        showMessage('Item returned to Inventory.', 'success');
        loadInventory('Shipping');
        loadInventory('Inventory');
    } catch (err) {
        showMessage('Error: ' + err.message, 'error');
    }
}

// --- Edit Modal Functions ---

async function openEditModal(itemId, type) {
    try {
        const response = await fetch(`/api/inventory/${type}/${itemId}`);
        if (!response.ok) throw new Error('Failed to fetch item details');
        const item = await response.json();
        document.getElementById('editSupplier').value = item.supplierId || '';
        document.getElementById('editItem').value = item.itemType || '';
        document.getElementById('editModel').value = item.modelNumber || '';
        document.getElementById('editQuantity').value = item.quantity || '';
        document.getElementById('editItemNumber').value = item.itemNumber || '';
        document.getElementById('editLocation').value = item.location || '';
        document.getElementById('editSquareFt').value = item.squareft || '';
        const modalEl = document.getElementById('editModal');
        modalEl.dataset.itemId = itemId;
        modalEl.dataset.type = type;
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    } catch (err) {
        showMessage('Failed to open edit modal: ' + err.message, 'error');
    }
}

async function saveEdit() {
    try {
        const modalEl = document.getElementById('editModal');
        const itemId = modalEl.dataset.itemId;
        const type = modalEl.dataset.type;
        const updateData = {
            supplierId: document.getElementById('editSupplier').value,
            itemType: document.getElementById('editItem').value,
            modelNumber: document.getElementById('editModel').value,
            quantity: parseInt(document.getElementById('editQuantity').value, 10),
            itemNumber: document.getElementById('editItemNumber').value,
            location: document.getElementById('editLocation').value,
            squareft: Number(document.getElementById('editSquareFt').value) || 0
        };
        const response = await fetch(`/api/inventory/${itemId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData)
        });
        if (!response.ok) throw new Error('Failed to save item changes');
        showMessage('Item updated successfully.', 'success');
        bootstrap.Modal.getInstance(modalEl).hide();
        loadInventory(type);
        await updateSquareFtSummary();
        updateSidebarSquareFt();
    } catch (err) {
        showMessage('Failed to save item: ' + err.message, 'error');
    }
}


async function sendEmailNotification(type) {
    // Preload supplier field with the supplier name of the first selected item (robust for all tabs)
    let supplierName = '';
    const tableBody = document.getElementById(`${type.toLowerCase()}Table`);
    if (tableBody) {
        // Find all checked checkboxes in the table
        const checkedRows = Array.from(tableBody.querySelectorAll('tr')).filter(tr => {
            const checkbox = tr.querySelector('input[type="checkbox"]');
            return checkbox && checkbox.checked;
        });
        if (checkedRows.length > 0) {
            // Supplier is usually the second <td> (after checkbox)
            const supplierTd = checkedRows[0].querySelectorAll('td')[1];
            if (supplierTd) supplierName = supplierTd.textContent.trim();
        }
    }

    // Ensure modal and fields exist before setting values
    const modalEl = document.getElementById('emailNotificationModal');
    if (!modalEl) {
        showMessage('Email Notification modal not found.', 'error');
        return;
    }
    const supplierInput = document.getElementById('emailSupplier');
    const poInput = document.getElementById('emailPO');
    const sendBtn = document.getElementById('sendEmailBtn');
    if (!supplierInput || !poInput || !sendBtn) {
        showMessage('Email fields not found.', 'error');
        return;
    }

    // Show the modal first, then set values after it's visible
    const modal = new bootstrap.Modal(modalEl);
    modal.show();

    // Set values only after modal is visible
    modalEl.addEventListener('shown.bs.modal', function handler() {
        supplierInput.value = supplierName;
        poInput.value = '';
        modalEl.removeEventListener('shown.bs.modal', handler);
    });

    // Remove previous click listeners to avoid duplicates
    sendBtn.replaceWith(sendBtn.cloneNode(true));
    const newSendBtn = document.getElementById('sendEmailBtn');

    newSendBtn.onclick = async function () {
        const supplierVal = supplierInput.value.trim();
        const poVal = poInput.value.trim();
        if (!supplierVal || !poVal) {
            showMessage('Please fill in Supplier and PO Number.', 'error');
            return;
        }

        try {
            if (!selectedProjectKey) return showMessage('Please select a project.', 'error');
            const projectResponse = await fetch(`${API_BASE}/projects/${encodeURIComponent(selectedProjectKey)}`, {
                headers: { 'Content-Type': 'application/json' }
            });
            if (!projectResponse.ok) {
                const error = await projectResponse.json().catch(() => ({}));
                throw new Error(error.message || 'Failed to fetch project details');
            }
            const project = await projectResponse.json();
            if (!project.email) return showMessage('No contact email provided for this project.', 'error');
            if (!project.contact) return showMessage('No contact name provided for this project.', 'error');

            // Build email body (pre-populated message)
            const emailBody = [
                `Dear ${project.contact},`,
                '',
                `Supplier: ${supplierVal}`,
                `PO Number: ${poVal}`,
                '',
                `Items for ${project.projectName} have been received, inspected, and placed into inventory. All items have been received free of damage.`,
                'Please see the attached PDF for details. Images are attached or provided in the link below.',
                '',
                `Date Received: ${new Date().toLocaleString('en-US', { timeZone: 'MST' })}`,
            ].join('\r\n');

            const subject = encodeURIComponent(`Inventory Received for ${project.projectName}`);
            const body = encodeURIComponent(emailBody);
            const mailtoLink = `mailto:${project.email}?subject=${subject}&body=${body}`;
            window.location.href = mailtoLink;

            // Blur the button for accessibility, then hide the modal
            document.activeElement.blur();
            modal.hide();
            showMessage('Email opened for sending.', 'success');
        } catch (err) {
            showMessage('Failed to send email notification: ' + err.message, 'error');
        }
    };
}

async function generateReceiptConfirmation({ freightCo, cartonQty, skidQty }) {
    try {
        if (!selectedProjectKey) return showMessage('Please select a project.', 'error');
        // Get checked checkboxes directly from the Inventory table
        const checkedBoxes = Array.from(document.querySelectorAll(`#inventoryTable .item-check:checked`));
        const checked = checkedBoxes.map(cb => cb.getAttribute('data-id'));
        if (checked.length === 0) return showMessage('No items selected.', 'error');

        const projectResponse = await fetch(`${API_BASE}/projects/${selectedProjectKey}`, {
            headers: { 'Content-Type': 'application/json' }
        });
        if (!projectResponse.ok) {
            const error = await projectResponse.json().catch(() => ({}));
            throw new Error(error.message || 'Failed to fetch project details');
        }
        const project = await projectResponse.json();

        const inventoryResponse = await fetch(`${API_BASE}/inventory/Inventory`, {
            headers: { 'Content-Type': 'application/json' }
        });
        if (!inventoryResponse.ok) {
            const error = await inventoryResponse.json().catch(() => ({}));
            throw new Error(error.message || 'Failed to fetch inventory');
        }
        let allItems = await inventoryResponse.json();
        if (selectedProjectKey) {
            allItems = allItems.filter(item =>
                (item.projectId && item.projectId === selectedProjectKey) ||
                (item.project_key && item.project_key === selectedProjectKey) ||
                (item.projectKey && item.projectKey === selectedProjectKey)
            );
        }
        const items = allItems.filter(item => checked.includes(item._id));
        if (items.length === 0) return showMessage('No items selected.', 'error');

        // Get Supplier and PO Number from modal fields
        const supplier = document.getElementById('receiptSupplier').value.trim();
        const poNumber = document.getElementById('receiptPO').value.trim();

        // Use default jsPDF settings: unit: "mm", format: "letter"
        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'letter'
        });

        // Margins and page width for Letter in mm
        const marginLeft = 10;
        const marginRight = 10;
        const pageWidth = doc.internal.pageSize.getWidth();
        const usableWidth = pageWidth - marginLeft - marginRight; // ~190mm

        // Header block
        let y = createPDFHeader(doc, project.customer, project.projectName, [
            project.address,
            project.address2,
            [project.city, project.state, project.zip].filter(Boolean).join(', ')
        ]);

        // Insert Freight Co, Carton Qty, Skid Qty, Supplier, PO Number
        // Move down by 0.5 inches (12.7mm) from previous info block
        const infoBlockStartY = y + 10 + 12.7; // y + 22.7
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12); // Reduced by 2pt
        doc.text(`Receipt Confirmation for Project: ${project.projectName}`, marginLeft, infoBlockStartY);

        // 4-column table for Freight Co, Carton Qty, Skid Qty, PO Number
        doc.autoTable({
            startY: infoBlockStartY + 6, // 6mm below project name line
            head: [['Freight Co', 'Carton Qty', 'Skid Qty', 'PO Number']],
            body: [[freightCo, cartonQty, skidQty, poNumber]],
            theme: 'grid',
            headStyles: {
                fillColor: [230, 230, 230],
                textColor: [0, 0, 0],
                fontStyle: 'bold',
                fontSize: 11
            },
            bodyStyles: {
                font: 'helvetica',
                fontSize: 11
            },
            styles: {
                cellPadding: 2,
                halign: 'center',
                valign: 'middle',
                font: 'helvetica',
                fontSize: 11
            },
            columnStyles: {
                0: { cellWidth: 45 },
                1: { cellWidth: 35 },
                2: { cellWidth: 35 },
                3: { cellWidth: 55 }
            }
        });

        // Table columns and widths (fit to usableWidth)
        // New order: ITEM #, Supplier, Item, Model, Quantity, Weight (lbs), Location
        const tableRows = items.map(item => [
            item.itemNumber || '',      // ITEM #
            item.supplierId || '',      // Supplier
            item.itemType || '',        // Item
            item.modelNumber || '',     // Model
            item.quantity,
            item.weight ? item.weight.toFixed(2) : '',
            item.location || ''
        ]);

        // Calculate where to start the main inventory table
        const infoTableY = doc.lastAutoTable.finalY || (infoBlockStartY + 12);

        let finalY = createPDFTable(doc, infoTableY + 6, [
            ['ITEM #', 'Supplier', 'Item', 'Model', 'Qty.', 'Weight', 'Location']
        ], tableRows, {
            0: { cellWidth: 25 },   // ITEM #
            1: { cellWidth: 35 },   // Supplier
            2: { cellWidth: 50 },   // Item
            3: { cellWidth: 25 },   // Model
            4: { cellWidth: 15 },   // Qty.
            5: { cellWidth: 15 },   // Weight
            6: { cellWidth: 25 }    // Location
        });

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text('Signature: ______________________________________________', marginLeft, finalY + 20);
        doc.text(`${new Date().toLocaleDateString('en-US', { timeZone: 'MST' })}`, pageWidth - marginRight, finalY + 20, { align: 'right' });

        doc.save(`receipt_confirmation_${selectedProjectKey}.pdf`);
        // Close the modal after PDF is generated
        const modalEl = document.getElementById('receiptConfirmationModal');
        if (modalEl && modalEl.classList.contains('show')) {
            bootstrap.Modal.getInstance(modalEl)?.hide();
        }
        showMessage('Receipt Confirmation PDF generated successfully.', 'success');
    } catch (err) {
        // Always close the modal if open
        const modalEl = document.getElementById('receiptConfirmationModal');
        if (modalEl && modalEl.classList.contains('show')) {
            bootstrap.Modal.getInstance(modalEl)?.hide();
        }
        if (err.message !== 'Receipt confirmation canceled') {
            showMessage('Failed to generate Receipt Confirmation: ' + err.message, 'error');
        }
    }
}

async function printBarcodeLabels(type) {
    try {
        // Get checked checkboxes directly from the table for the current tab
        const tableId = type.toLowerCase() + 'Table';
        const checkedBoxes = Array.from(document.querySelectorAll(`#${tableId} .item-check:checked`));
        const checked = checkedBoxes.map(cb => cb.getAttribute('data-id'));
        if (checked.length === 0) {
            showMessage('No items selected.', 'error');
            return;
        }
        const doc = new jsPDF({ unit: 'in', format: [4, 6] });
        let first = true;
        for (const id of checked) {
            const response = await fetch(`${API_BASE}/inventory/${type}/${id}`, {
                headers: { 'Content-Type': 'application/json' }
            });
            if (!response.ok) continue;
            const item = await response.json();
            if (!item.itemNumber) {
                showMessage(`Please assign an ITEM # for ${item.itemType} before generating label.`, 'error');
                continue;
            }
            // Use cartonQuantity if present and valid, otherwise use quantity
            const numLabels = (item.cartonQuantity != null && !isNaN(item.cartonQuantity) && item.cartonQuantity > 0)
                ? item.cartonQuantity
                : item.quantity;
            for (let n = 1; n <= numLabels; n++) {
                if (!first) doc.addPage([4, 6]);
                first = false;
                const code = Math.random().toString(36).substring(2, 10).toUpperCase();
                const canvas = document.createElement('canvas');
                JsBarcode(canvas, code, { format: 'CODE128', displayValue: false, height: 60, width: 2 });
                doc.addImage(canvas.toDataURL('image/png'), 'PNG', 0.5, 0.5, 3, 1);

                // Item number on its own line
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(24);
                doc.text(`ITEM # ${item.itemNumber ? item.itemNumber.toUpperCase() : ''}`, 0.5, 2, { maxWidth: 3 });

                // Project name on the next line, flush left (no spaces before)
                doc.setFontSize(24);
                doc.text(`${item.projectName ? item.projectName.toUpperCase() : ''}`, 0.5, 2.5, { maxWidth: 3 });

                // Set font and size ONCE for all the following lines
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(12);

                // Reduce line spacing by half for these lines
                const baseY = 3.25;
                const lineSpacing = 0.25; // half spacing

                // Supplier (no prefix)
                doc.text(`${(item.supplierId || '').toUpperCase()}`, 0.5, baseY, { maxWidth: 3 });
                // Description (no prefix)
                doc.text(`${(item.itemType || '').toUpperCase()}`, 0.5, baseY + lineSpacing, { maxWidth: 3 });
                // Model (no prefix, remove all spaces, same font and size as description)
                doc.text(
                    (item.modelNumber || '').replace(/\s+/g, '').toUpperCase(),
                    0.5,
                    baseY + lineSpacing * 2,
                    { maxWidth: 3 }
                );
                // Date Received
                doc.text(`DATE RECEIVED: ${new Date().toLocaleDateString('en-US', { timeZone: 'MST' })}`, 0.5, baseY + lineSpacing * 3, { maxWidth: 3 });
                // Quantity
                doc.text(`QUANTITY: ${item.quantity}`, 0.5, baseY + lineSpacing * 4, { maxWidth: 3 });

                doc.setFont('helvetica', 'bold');
                doc.setFontSize(20);
                doc.text(`${n} OF ${numLabels}`, 0.5, baseY + lineSpacing * 5 + 0.2, { maxWidth: 3 });
            }
        }
        doc.save('barcode_labels.pdf');
        showMessage('Barcode labels generated successfully.', 'success');
    } catch (err) {
        showMessage('Failed to generate barcode labels: ' + err.message, 'error');
    }
}
// --- Inline Update for Editable Table Cells ---
async function updateInline(itemId, field, value) {
    try {
        const response = await fetch(`/api/inventory/${itemId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ [field]: value })
        });
        if (!response.ok) throw new Error('Failed to update field');
        showMessage('Field updated.', 'success');
    } catch (err) {
        showMessage('Failed to update field: ' + err.message, 'error');
    }
}

// --- Delete Inventory Item ---
async function deleteInventoryItem(itemId, type) {
    showConfirmModal('Delete Item', 'Are you sure you want to delete this item?', async () => {
        try {
            const response = await fetch(`/api/inventory/${itemId}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Failed to delete item');
            showMessage('Item deleted.', 'success');
            loadInventory(type);
        } catch (err) {
            showMessage('Failed to delete item: ' + err.message, 'error');
        }
    });
}

// --- Delete Project ---
async function deleteProject(projectKey) {
    if (!projectKey) {
        showMessage('No project selected.', 'error');
        return;
    }
    if (!confirm('Are you sure you want to delete this project and all its inventory?')) return;
    try {
        const response = await fetch(`/api/projects/${encodeURIComponent(projectKey)}`, {
            method: 'DELETE'
        });
        if (!response.ok) throw new Error('Failed to delete project');
        await fetch(`/api/inventory/project/${encodeURIComponent(projectKey)}`, {
            method: 'DELETE'
        });
        showMessage('Project and its inventory deleted.', 'success');
        selectedProjectKey = null;
        await updateProjectList();
        document.getElementById('customer').value = '';
        document.getElementById('projectName').value = '';
        document.getElementById('address').value = '';
        document.getElementById('address2').value = '';
        document.getElementById('city').value = '';
        document.getElementById('state').value = '';
        document.getElementById('zip').value = '';
        document.getElementById('phone').value = '';
        document.getElementById('contact').value = '';
        document.getElementById('email').value = '';
        loadInventory('Receiving');
        loadInventory('Inventory');
        loadInventory('Shipping');
    } catch (err) {
        showMessage('Failed to delete project: ' + err.message, 'error');
    }
}

// --- Print Packing List ---
async function printPackingList(type) {
    try {
        const response = await fetch(`${API_BASE}/inventory/${type}`, {
            headers: { 'Content-Type': 'application/json' }
        });
        if (!response.ok) throw new Error('Failed to fetch inventory');
        let items = await response.json();
        if (selectedProjectKey) {
            items = items.filter(item => item.projectId === selectedProjectKey);
        }
        let projectName = '';
        let customer = '';
        let address = '';
        let address2 = '';
        let city = '';
        let state = '';
        let zip = '';
        let phone = '';
        if (selectedProjectKey) {
            const projectResponse = await fetch(`${API_BASE}/projects/${encodeURIComponent(selectedProjectKey)}`, {
                headers: { 'Content-Type': 'application/json' }
            });
            if (projectResponse.ok) {
                const project = await projectResponse.json();
                projectName = project.projectName || '';
                customer = project.customer || '';
                address = project.address || '';
                address2 = project.address2 || '';
                city = project.city || '';
                state = project.state || '';
                zip = project.zip || '';
                phone = project.phone || '';
            }
        }
        const doc = new jsPDF();
        doc.addImage('CKS Logo.png', 'PNG', 14, 10, 24, 24);
        const lineSpacing = 6;
        let companyY = 40;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text('Commercial Kitchen Solutions', 14, companyY);
        companyY += lineSpacing;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text('13326 N Dysart Rd | Suite 160', 14, companyY);
        companyY += lineSpacing;
        doc.text('Surprise, AZ 85379', 14, companyY);
        const pageWidth = doc.internal.pageSize.getWidth();
        const rightX = pageWidth - 14;
        let customerY = 22;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        if (customer) {
            doc.text(customer, rightX, customerY, { align: 'right' });
            customerY += lineSpacing;
        }
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        if (address) {
            doc.text(address, rightX, customerY, { align: 'right' });
            customerY += lineSpacing;
        }
        if (address2) {
            doc.text(address2, rightX, customerY, { align: 'right' });
            customerY += lineSpacing;
        }
        const cityStateZip = [city, state, zip].filter(Boolean).join(', ');
        if (cityStateZip) {
            doc.text(cityStateZip, rightX, customerY, { align: 'right' });
            customerY += lineSpacing;
        }
        if (phone) {
            doc.text(`Phone: ${phone}`, rightX, customerY, { align: 'right' });
        }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        const titleText = projectName
            ? `Packing List - ${projectName}`
            : 'Packing List';
        doc.text(titleText, 105, 70, { align: 'center' });
        doc.autoTable({
            startY: 80,
            head: [[
                'ITEM #', 'Supplier', 'Item', 'Model', 'Quantity', 'Weight (lbs)', 'Location'
            ]],
            body: items.map(item => [
                item.itemNumber || '',      // ITEM #
                item.supplierId || '',      // Supplier
                item.itemType || '',        // Item
                item.modelNumber || '',     // Model
                item.quantity,
                item.weight,
                item.location || ''
            ]),
            headStyles: {
                fillColor: [0, 0, 0],
                textColor: [255, 255, 255],
                fontStyle: 'bold'
            },
            styles: {
                font: 'helvetica',
                fontSize: 10
            }
        });
        const finalY = doc.lastAutoTable.finalY || 80;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        const dateStr = new Date().toLocaleDateString('en-US', { timeZone: 'MST' });
        doc.text('Signature: ______________________________________________', 14, finalY + 20, { align: 'left' });
        doc.text(dateStr, pageWidth - 14, finalY + 20, { align: 'right' });
        doc.save('packing-list.pdf');
        showMessage('Packing list generated.', 'success');
    } catch (err) {
        showMessage('Failed to generate packing list: ' + err.message, 'error');
    }
}

// Update sidebar fields (show 2 decimal places, only for selected project)
function updateSidebarSquareFt() {
    const summary = projectSquareFtSummary[selectedProjectKey] || { total: 0, received: 0 };
    const total = Number(summary.total || 0);
    const received = Number(summary.received || 0);
    const balance = total - received;
    document.getElementById('sidebarTotal').textContent = total.toFixed(2);
    document.getElementById('sidebarReceived').textContent = received.toFixed(2);
    document.getElementById('sidebarBalance').textContent = balance.toFixed(2);
}

// Update summary from current data (only for selected project)
async function updateSquareFtSummary() {
    if (!selectedProjectKey) return;
    // Fetch all inventory types for the selected project
    const [receivingRes, inventoryRes, shippingRes] = await Promise.all([
        fetch(`${API_BASE}/inventory/Receiving?project_key=${encodeURIComponent(selectedProjectKey)}`),
        fetch(`${API_BASE}/inventory/Inventory?project_key=${encodeURIComponent(selectedProjectKey)}`),
        fetch(`${API_BASE}/inventory/Shipping?project_key=${encodeURIComponent(selectedProjectKey)}`)
    ]);
    const receiving = (await receivingRes.json()).filter(i =>
        (i.projectId === selectedProjectKey || i.project_key === selectedProjectKey || i.projectKey === selectedProjectKey)
    );
    const inventory = (await inventoryRes.json()).filter(i =>
        (i.projectId === selectedProjectKey || i.project_key === selectedProjectKey || i.projectKey === selectedProjectKey)
    );
    const shipping = (await shippingRes.json()).filter(i =>
        (i.projectId === selectedProjectKey || i.project_key === selectedProjectKey || i.projectKey === selectedProjectKey)
    );

    // Total is the sum of squareft for all items in all tabs
    const allItems = receiving.concat(inventory, shipping);
    const total = allItems.reduce((sum, i) => sum + Number(i.squareft || 0), 0);

    // Received is the sum of squareft for all items NOT in Receiving (i.e., in Inventory or Shipping)
    const received = inventory.concat(shipping).reduce((sum, i) => sum + Number(i.squareft || 0), 0);

    projectSquareFtSummary[selectedProjectKey] = { total, received };
}

// When a project is clicked, update the sidebar fields for that project
async function loadProjectDetails(projectKey) {
    try {
        const response = await fetch(`${API_BASE}/projects/${encodeURIComponent(projectKey)}`, {
            headers: { 'Content-Type': 'application/json' }
        });
        if (!response.ok) throw new Error('Failed to fetch project details');
        const project = await response.json();
        document.getElementById('customer').value = project.customer || '';
        document.getElementById('projectName').value = project.projectName || '';
        document.getElementById('address').value = project.address || '';
        document.getElementById('address2').value = project.address2 || '';
        document.getElementById('city').value = project.city || '';
        document.getElementById('state').value = project.state || '';
        document.getElementById('zip').value = project.zip || '';
        document.getElementById('phone').value = project.phone || '';
        document.getElementById('contact').value = project.contact || '';
        document.getElementById('email').value = project.email || '';

        await updateSquareFtSummary();
        updateSidebarSquareFt();
    } catch (err) {
        showMessage('Failed to load project details: ' + err.message, 'error');
    }
}

// Also update the sidebar when a project is selected from the list
async function updateProjectList() {
    try {
        const response = await fetch(`${API_BASE}/projects`, {
            headers: { 'Content-Type': 'application/json' }
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.message || 'Failed to fetch projects');
        }
        const projects = await response.json();
        const projectList = document.getElementById('projectList');
        if (!projectList) return;
        projectList.innerHTML = '';

        let projectArray = [];
        if (Array.isArray(projects)) {
            projectArray = projects;
        } else {
            projectArray = Object.values(projects);
        }

        projectArray.sort((a, b) => {
            const aName = (a.customer || '') + (a.projectName || '');
            const bName = (b.customer || '') + (b.projectName || '');
            return aName.localeCompare(bName);
        });

        if (selectedProjectKey && !projectArray.some(p => p.project_key === selectedProjectKey)) {
            selectedProjectKey = null;
        }
        projectArray.forEach(project => {
            const key = project.project_key || project.key || project.id;
            if (!key) return;
            const li = document.createElement('li');
            li.className = `list-group-item ${selectedProjectKey === key ? 'active' : ''}`;
            li.innerHTML = `<strong>${project.customer}</strong> / ${project.projectName}`;
            li.addEventListener('click', async () => {
                selectedProjectKey = key;
                paginationState.Receiving.currentPage = 1;
                paginationState.Inventory.currentPage = 1;
                paginationState.Shipping.currentPage = 1;
                selectedItems.Receiving.clear();
                selectedItems.Inventory.clear();
                selectedItems.Shipping.clear();
                await updateProjectList();
                await loadProjectDetails(key);
                await loadInventory('Receiving');
                await loadInventory('Inventory');
                await loadInventory('Shipping');
                // Update sidebar for this project
                updateSidebarSquareFt();
            });
            projectList.appendChild(li);
        });
    } catch (err) {
        showMessage('Failed to update project list: ' + err.message, 'error');
    }
}

// --- Inventory Loading with Default Alphabetical Sort ---
async function loadInventory(type) {
    try {
        const response = await fetch(`${API_BASE}/inventory/${type}`, {
            headers: { 'Content-Type': 'application/json' }
        });
        if (!response.ok) throw new Error('Failed to fetch inventory');
        let items = await response.json();
        if (selectedProjectKey) {
            items = items.filter(item =>
                (item.projectId && item.projectId === selectedProjectKey) ||
                (item.project_key && item.project_key === selectedProjectKey) ||
                (item.projectKey && item.projectKey === selectedProjectKey)
            );
        }
        inventoryCache[type] = items;
        applySort(type); // Always sort the cache after loading
        paginationState[type].totalPages = Math.ceil(items.length / itemsPerPage) || 1;
        renderInventoryTable(type, inventoryCache[type]);
    } catch (err) {
        showMessage('Failed to load inventory: ' + err.message, 'error');
    }
}

// CSV import: assign squareft to each item
async function importCsv(event) {
    event.preventDefault();
    try {
        const file = document.getElementById('csvFile').files[0];
        if (!file) {
            showMessage('Please select a CSV file.', 'error');
            return;
        }
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const text = e.target.result;
                const rows = text.split('\n').map(row => row.split(',').map(cell => cell.trim()));
                if (rows.length < 2) throw new Error('Invalid CSV format: file is empty or has no data rows');
                const headers = rows[0].map(header => header.toLowerCase());
                const requiredHeaders = ['customername', 'projectname', 'supplier', 'itemtype', 'modelnumber', 'quantity', 'weight', 'itemnumber'];
                for (const header of requiredHeaders) {
                    if (!headers.includes(header)) throw new Error(`Invalid CSV format: missing required header '${header}'`);
                }
                const customerNameIdx = headers.indexOf('customername');
                const projectNameIdx = headers.indexOf('projectname');
                const supplierIdx = headers.indexOf('supplier');
                const itemTypeIdx = headers.indexOf('itemtype');
                const modelNumberIdx = headers.indexOf('modelnumber');
                const quantityIdx = headers.indexOf('quantity');
                const weightIdx = headers.indexOf('weight');
                const itemNumberIdx = headers.indexOf('itemnumber');
                const squareFtIdx = headers.indexOf('squareft');
                const customerRaw = rows[1][customerNameIdx]?.trim();
                const projectRaw = rows[1][projectNameIdx]?.trim();
                if (!customerRaw || !projectRaw) throw new Error('Invalid CSV format: missing customerName or projectName in data row');
                const customer = customerRaw.replace(/^Customer/, '').trim();
                const projectName = projectRaw.replace(/^Project/, '').trim();
                const projectKey = `${customerRaw}_${projectRaw}`.replace(/\s+/g, '').replace(/[^a-zA-Z0-9-]/g, '');
                const projectData = {
                    project_key: projectKey,
                    customer,
                    projectName,
                    address: '',
                    address2: '',
                    city: '',
                    state: '',
                    zip: '',
                    phone: '',
                    contact: '',
                    email: '',
                    timestamp: new Date().toLocaleString('en-US', { timeZone: 'MST' })
                };
                const projectResponse = await fetch(`${API_BASE}/projects`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(projectData)
                });
                if (!projectResponse.ok) {
                    const error = await projectResponse.json().catch(() => ({}));
                    throw new Error(error.message || 'Failed to save project');
                }
                const inventoryItems = [];
                for (let i = 1; i < rows.length; i++) {
                    const row = rows[i];
                    if (row.length < headers.length) continue;
                    const quantity = parseInt(row[quantityIdx]);
                    const weight = parseFloat(row[weightIdx]);
                    if (isNaN(quantity) || isNaN(weight)) continue;
                    inventoryItems.push({
                        supplierId: row[supplierIdx],
                        itemType: row[itemTypeIdx],
                        modelNumber: row[modelNumberIdx],
                        quantity,
                        weight,
                        itemNumber: row[itemNumberIdx] || '',
                        location: '',
                        projectId: projectKey,
                        customer,
                        projectName,
                        type: 'Receiving',
                        squareft: Number(row[squareFtIdx]) || 0,
                    });
                }
                await Promise.all(inventoryItems.map(async (inventoryItem) => {
                    const inventoryResponse = await fetch(`${API_BASE}/inventory`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(inventoryItem)
                    });
                    if (!inventoryResponse.ok) {
                        const inventoryResult = await inventoryResponse.json().catch(() => ({}));
                        throw new Error(inventoryResult.message || `Failed to add inventory item`);
                    }
                }));
                selectedProjectKey = projectKey;
                await updateProjectList();
                await loadProjectDetails(projectKey);
                await loadInventory('Receiving');
                showMessage('CSV imported successfully.', 'success');
            } catch (err) {
                showMessage('Failed to import CSV: ' + err.message, 'error');
            }
        };
        reader.onerror = () => showMessage('Error reading CSV file.', 'error');
        reader.readAsText(file);
    } catch (err) {
        showMessage('Failed to import CSV: ' + err.message, 'error');
    }
}

function nextPage(type) {
    if (paginationState[type].currentPage < paginationState[type].totalPages) {
        paginationState[type].currentPage++;
        loadInventory(type);
    }
}

function prevPage(type) {
    if (paginationState[type].currentPage > 1) {
        paginationState[type].currentPage--;
        loadInventory(type);
    }
}

function initializeInventoryApp() {
    updateProjectList();
    loadInventory('Receiving');
    loadInventory('Inventory');
    loadInventory('Shipping');
    const saveEditBtn = document.getElementById('saveEditItemBtn');
    if (saveEditBtn) {
        saveEditBtn.onclick = saveEdit;
    }

    updateSidebarSquareFt();
}

document.addEventListener('DOMContentLoaded', initializeInventoryApp);

function renderInventoryTable(type, items) {
    const tableBody = document.getElementById(`${type.toLowerCase()}Table`);
    if (!tableBody) return;
    // Persist selected checkboxes across renders
    const selectedIds = new Set();
    tableBody.querySelectorAll('.item-check:checked').forEach(cb => {
        if (cb.dataset.id) selectedIds.add(cb.dataset.id);
    });
    tableBody.innerHTML = '';

    // Calculate total pages and update pagination state
    const totalPages = Math.max(1, Math.ceil(items.length / itemsPerPage));
    paginationState[type].totalPages = totalPages;
    // Clamp currentPage to valid range
    paginationState[type].currentPage = Math.min(
        Math.max(1, paginationState[type].currentPage || 1),
        totalPages
    );

    const start = (paginationState[type].currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pagedItems = items.slice(start, end);

    pagedItems.forEach(item => {
        const tr = document.createElement('tr');
        let rowHtml = '';

        // Checkbox column
    const checkedAttr = selectedIds.has(item._id) ? 'checked' : '';
    rowHtml += `<td><input type="checkbox" class="item-check" data-id="${item._id || ''}" ${checkedAttr}></td>`;

        // Supplier, Item, Model, Quantity, Carton Qty, Weight, ITEM #
        rowHtml += `<td>${item.supplierId || ''}</td>`;
        rowHtml += `<td>${item.itemType || ''}</td>`;
        rowHtml += `<td>${item.modelNumber || ''}</td>`;
        rowHtml += `<td>${item.quantity || ''}</td>`;
        rowHtml += `<td class="editable-cell" data-id="${item._id}" data-field="cartonQuantity">${item.cartonQuantity || ''}</td>`;
        rowHtml += `<td>${item.weight || ''}</td>`;
        rowHtml += `<td class="editable-cell" data-id="${item._id}" data-field="itemNumber">${item.itemNumber || ''}</td>`;

        // Only include Location column for Inventory and Shipping tabs
        if (type === 'Inventory' || type === 'Shipping') {
            rowHtml += `<td class="editable-cell" data-id="${item._id}" data-field="location">${item.location || ''}</td>`;
        }

        // Actions column (always last)
        let actionButtons = `
            <button class="btn btn-sm btn-primary" onclick="openEditModal('${item._id}', '${type}')">Edit</button>
            <button class="btn btn-sm btn-danger" onclick="deleteInventoryItem('${item._id}', '${type}')">Delete</button>
        `;
        if (type === 'Receiving') {
            actionButtons += `<button class="btn btn-sm btn-success" onclick="moveToInventory('${item._id}')">Received</button>`;
        } else if (type === 'Inventory') {
            actionButtons += `
                <button class="btn btn-sm btn-success" onclick="moveToShipping('${item._id}')">Ship</button>
                <button class="btn btn-sm btn-warning" onclick="moveToReceiving('${item._id}')">Return to Receiving</button>
            `;
        } else if (type === 'Shipping') {
            actionButtons += `<button class="btn btn-sm btn-warning" onclick="moveToInventoryFromShipping('${item._id}')">Return to Inventory</button>`;
        }
        rowHtml += `<td>${actionButtons}</td>`;

        tr.innerHTML = rowHtml;
        tableBody.appendChild(tr);
    });

    // Make itemNumber, location, and cartonQuantity cells editable by click
    tableBody.querySelectorAll('.editable-cell').forEach(cell => {
        cell.addEventListener('click', function (e) {
            if (cell.querySelector('input')) return; // already editing
            const oldValue = cell.textContent;
            const input = document.createElement('input');
            input.type = cell.dataset.field === 'cartonQuantity' ? 'number' : 'text';
            input.value = oldValue;
            input.className = 'form-control form-control-sm';
            input.style.minWidth = '80px';
            cell.textContent = '';
            cell.appendChild(input);
            input.focus();

            input.addEventListener('blur', async function () {
                let newValue = input.value.trim();
                if (cell.dataset.field === 'cartonQuantity') {
                    newValue = newValue === '' ? '' : Number(newValue);
                }
                cell.textContent = newValue;
                if (newValue !== oldValue) {
                    await updateInline(cell.dataset.id, cell.dataset.field, newValue);
                }
            });

            input.addEventListener('keydown', function (ev) {
                if (ev.key === 'Enter') {
                    input.blur();
                } else if (ev.key === 'Escape') {
                    cell.textContent = oldValue;
                }
            });
        });
    });

    // Update page label
    const pageLabelId = {
        Receiving: 'pageReceiving',
        Inventory: 'pageInventory',
        Shipping: 'pageShipping'
    }[type];
    if (pageLabelId) {
        const pageLabel = document.getElementById(pageLabelId);
        if (pageLabel) {
            pageLabel.textContent = `Page ${paginationState[type].currentPage} of ${paginationState[type].totalPages}`;
        }
    }
}

// Add this function to open the Add Item modal
function openAddItemModal() {
    const modalEl = document.getElementById('addItemModal');
    if (!modalEl) return;
    // Clear all fields
    document.getElementById('addSupplier').value = '';
    document.getElementById('addItemType').value = '';
    document.getElementById('addModelNumber').value = '';
    document.getElementById('addQuantity').value = '';
    document.getElementById('addCartonQuantity').value = '';
    document.getElementById('addWeight').value = '';
    document.getElementById('addItemNumber').value = '';
    document.getElementById('addLocation').value = '';
    document.getElementById('addSquareFt').value = '';
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
}

// Add event listener for Add Item form submission
document.addEventListener('DOMContentLoaded', () => {
    // ...existing code...
    const addItemForm = document.getElementById('addItemForm');
    if (addItemForm) {
        addItemForm.onsubmit = async function (e) {
            e.preventDefault();
            if (!selectedProjectKey) {
                showMessage('Please select a project before adding items.', 'error');
                return;
            }
            const item = {
                supplierId: document.getElementById('addSupplier').value.trim(),
                itemType: document.getElementById('addItemType').value.trim(),
                modelNumber: document.getElementById('addModelNumber').value.trim(),
                quantity: Number(document.getElementById('addQuantity').value) || 0,
                cartonQuantity: Number(document.getElementById('addCartonQuantity').value) || 0,
                weight: Number(document.getElementById('addWeight').value) || 0,
                itemNumber: document.getElementById('addItemNumber').value.trim(),
                location: document.getElementById('addLocation').value.trim(),
                squareft: Number(document.getElementById('addSquareFt').value) || 0,
                projectId: selectedProjectKey,
                customer: document.getElementById('customer').value.trim(),
                projectName: document.getElementById('projectName').value.trim(),
                type: 'Receiving'
            };
            try {
                const response = await fetch(`${API_BASE}/inventory`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(item)
                });
                if (!response.ok) throw new Error('Failed to add item');
                showMessage('Item added successfully.', 'success');
                bootstrap.Modal.getInstance(document.getElementById('addItemModal')).hide();
                await loadInventory('Receiving');
                await updateSquareFtSummary();
                updateSidebarSquareFt();
            } catch (err) {
                showMessage('Failed to add item: ' + err.message, 'error');
            }
        };
    }

    // Receipt Confirmation "Generate" button handler
    const generateReceiptBtn = document.getElementById('generateReceiptBtn');
    if (generateReceiptBtn) {
        generateReceiptBtn.onclick = function () {
            const freightCo = document.getElementById('freightCo').value.trim();
            const cartonQty = document.getElementById('cartonQty').value.trim();
            const skidQty = document.getElementById('skidQty').value.trim();
            // Optionally get supplier and PO if needed
            generateReceiptConfirmation({ freightCo, cartonQty, skidQty });
        };
    }
});

function openReceiptConfirmationWithSuppliers() {
    // Get selected inventory item(s)
    const selectedRows = document.querySelectorAll('#inventoryTable input[type="checkbox"]:checked');
    let supplier = '';
    let poNumber = '';
    if (selectedRows.length > 0) {
        const row = selectedRows[0].closest('tr');
        // Supplier is the second <td> (after checkbox)
        const supplierTd = row.querySelectorAll('td')[1];
        if (supplierTd) supplier = supplierTd.textContent.trim();
        // PO Number: if you store it in a column, adjust index accordingly
        // For now, leave blank or add logic if you have a PO column
        poNumber = '';
    }
    document.getElementById('receiptSupplier').value = supplier;
    document.getElementById('receiptPO').value = poNumber;
    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('receiptConfirmationModal'));
    modal.show();
}