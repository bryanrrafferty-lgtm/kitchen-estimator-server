window.moveToInventoryFromShipping = moveToInventoryFromShipping;
// Global cache for inventory items by type
let inventoryCache = {
    Receiving: [],
    Inventory: [],
    Shipping: []
};
window.inventoryCache = inventoryCache;
// Move item to Shipping from Inventory (stub)
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
window.moveToShipping = moveToShipping;

// Move item to Receiving from Shipping (stub)
async function moveToReceiving(itemId) {
    try {
        const response = await fetch(`${API_BASE}/inventory/${itemId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'Receiving' })
        });
        if (!response.ok) throw new Error('Failed to move item to Receiving');
        showMessage('Item moved to Receiving.', 'success');
        loadInventory('Inventory');
        loadInventory('Receiving');
    } catch (err) {
        showMessage('Error: ' + err.message, 'error');
    }
}
window.moveToReceiving = moveToReceiving;
// Move item to Inventory from Receiving
async function moveToInventory(itemId) {
    try {
        const response = await fetch(`${API_BASE}/inventory/${itemId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'Inventory' })
        });
        if (!response.ok) throw new Error('Failed to move item to Inventory');
        showMessage('Item moved to Inventory.', 'success');
        loadInventory('Receiving');
        loadInventory('Inventory');
    } catch (err) {
        showMessage('Error: ' + err.message, 'error');
    }
}
window.moveToInventory = moveToInventory;
window.moveToShipping = moveToShipping;
window.moveToReceiving = moveToReceiving;
window.moveToInventoryFromShipping = moveToInventoryFromShipping;
window.openAddItemModal = function() {
    const modal = new bootstrap.Modal(document.getElementById('addItemModal'));
    modal.show();
}
window.openReceiptConfirmationWithSuppliers = openReceiptConfirmationWithSuppliers;
window.sendEmailNotification = sendEmailNotification;
import { printBarcodeLabels, printPackingList, generateReceiptConfirmation } from './pdf.js';
import { showMessage, showConfirmModal, openNewProjectModal } from './ui.js';
import { fetchProject, fetchInventory, updateProjectList, importCsv } from './api.js';
import { applySort, sortTable, selectAll } from './inventory.js';
import { updateSidebarSquareFt, saveNewProject, saveProjectDetails, deleteProject } from './project.js';

// Expose all functions used in HTML onclick attributes to window
window.updateProjectList = updateProjectList;
window.loadProjectDetails = loadProjectDetails;
window.loadInventory = loadInventory;
window.printBarcodeLabels = printBarcodeLabels;
window.printPackingList = printPackingList;
window.generateReceiptConfirmation = generateReceiptConfirmation;
window.showMessage = showMessage;
window.showConfirmModal = showConfirmModal;
window.openNewProjectModal = openNewProjectModal;
window.importCsv = importCsv;
window.saveNewProject = saveNewProject;
window.saveProjectDetails = saveProjectDetails;
window.deleteProject = deleteProject;
window.selectAll = selectAll;
window.openEditModal = openEditModal;
window.saveEdit = saveEdit;
window.moveToInventory = moveToInventory;
window.moveToShipping = moveToShipping;
window.moveToReceiving = moveToReceiving;
window.moveToInventoryFromShipping = moveToInventoryFromShipping;
window.openAddItemModal = function() {
    const modal = new bootstrap.Modal(document.getElementById('addItemModal'));
    modal.show();
};
window.openReceiptConfirmationWithSuppliers = openReceiptConfirmationWithSuppliers;
window.sendEmailNotification = sendEmailNotification;
function setSelectedProjectKey(key) {
    selectedProjectKey = key;
    window.selectedProjectKey = key;
}
window.setSelectedProjectKey = setSelectedProjectKey;
window.loadInventory = loadInventory;
window.loadProjectDetails = loadProjectDetails;

// Entry point: import modules and initialize event listeners
window.deleteInventoryItem = deleteInventoryItem;

// ...existing event listeners and initialization code...



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
window.selectedItems = selectedItems;

// Store square footage summary per project
let projectSquareFtSummary = {};
window.projectSquareFtSummary = projectSquareFtSummary;

// --- Default sort state: alphabetize by supplier for all tabs ---
const tableSortState = {
    Receiving: { col: 1, dir: 'asc' },
    Inventory: { col: 1, dir: 'asc' },
    Shipping: { col: 1, dir: 'asc' }
};

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
    document.getElementById('editWeight').value = item.weight || '';
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
            squareft: Number(document.getElementById('editSquareFt').value) || 0,
            weight: Number(document.getElementById('editWeight').value) || 0
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
window.deleteInventoryItem = deleteInventoryItem;
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

// --- Print Packing List ---

// Update sidebar fields (show 2 decimal places, only for selected project)

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

function nextPage(type) {
    if (paginationState[type].currentPage < paginationState[type].totalPages) {
        paginationState[type].currentPage++;
        loadInventory(type);
    }
}
window.nextPage = nextPage;

function prevPage(type) {
    if (paginationState[type].currentPage > 1) {
        paginationState[type].currentPage--;
        loadInventory(type);
    }
}
window.prevPage = prevPage;

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
    // Sort items alphabetically by supplier name
    items = [...items].sort((a, b) => {
        const aName = (a.supplierId || '').toLowerCase();
        const bName = (b.supplierId || '').toLowerCase();
        return aName.localeCompare(bName);
    });
    const tableBody = document.getElementById(`${type.toLowerCase()}Table`);
    if (!tableBody) return;
    // Use global selectedItems to persist selection across pages
    const selectedIds = selectedItems[type];
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
        rowHtml += `<td><input type="checkbox" class="item-check" data-id="${item._id || ''}"></td>`;
        // Supplier, Item, Model, Quantity, Carton Qty, Weight, ITEM #
        rowHtml += `<td>${item.supplierId || ''}</td>`;
        rowHtml += `<td>${item.itemType || ''}</td>`;
        rowHtml += `<td>${item.modelNumber || ''}</td>`;
        rowHtml += `<td>${item.quantity || ''}</td>`;
        rowHtml += `<td class="editable-cell" data-id="${item._id}" data-field="cartonQuantity">${item.cartonQuantity || ''}</td>`;
        rowHtml += `<td>${(item.weight !== undefined && item.weight !== null && !isNaN(item.weight)) ? Number(item.weight).toFixed(2) : ''}</td>`;
        rowHtml += `<td class="editable-cell" data-id="${item._id}" data-field="itemNumber">${item.itemNumber || ''}</td>`;
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

    // After rendering, sync checkbox state and attach event listeners
    tableBody.querySelectorAll('.item-check').forEach(cb => {
        const id = cb.getAttribute('data-id');
        cb.checked = selectedIds.has(id);
        cb.addEventListener('change', function () {
            if (cb.checked) {
                selectedItems[type].add(id);
            } else {
                selectedItems[type].delete(id);
            }
        });
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
    // Expose all functions used in HTML onclick attributes to window

    window.openEditModal = openEditModal;
    window.moveToInventory = moveToInventory;
    window.moveToShipping = moveToShipping;
    window.moveToReceiving = moveToReceiving;
    window.moveToInventoryFromShipping = moveToInventoryFromShipping;
    window.printPackingList = printPackingList;
    window.printBarcodeLabels = printBarcodeLabels;
    window.openReceiptConfirmationWithSuppliers = openReceiptConfirmationWithSuppliers;
    window.sendEmailNotification = sendEmailNotification;
    window.saveEdit = saveEdit;
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
