// Email notification logic matching main(old).js
export async function sendEmailNotification(type) {
    // Use first selected item's supplier for modal
    let supplierName = '';
    // Use global selection, but only for items in the current tab
    const tableBody = document.getElementById(`${type.toLowerCase()}Table`);
    let visibleIds = [];
    if (tableBody) {
        visibleIds = Array.from(tableBody.querySelectorAll('tr')).map(tr => {
            const cb = tr.querySelector('input.item-check');
            return cb ? cb.getAttribute('data-id') : null;
        }).filter(Boolean);
    }
    const selectedIds = Array.from(window.selectedItems[type] || []).filter(id => visibleIds.includes(id));
    if (selectedIds.length > 0 && window.inventoryCache && window.inventoryCache[type]) {
        const item = window.inventoryCache[type].find(i => i._id === selectedIds[0]);
        if (item && item.supplierId) supplierName = item.supplierId;
    }

    const modalEl = document.getElementById('emailNotificationModal');
    if (!modalEl) {
        window.showMessage('Email Notification modal not found.', 'error');
        return;
    }
    const supplierInput = document.getElementById('emailSupplier');
    const poInput = document.getElementById('emailPO');
    const sendBtn = document.getElementById('sendEmailBtn');
    if (!supplierInput || !poInput || !sendBtn) {
        window.showMessage('Email fields not found.', 'error');
        return;
    }

    const modal = new bootstrap.Modal(modalEl);
    modal.show();
    modalEl.addEventListener('shown.bs.modal', function handler() {
        supplierInput.value = supplierName;
        poInput.value = '';
        modalEl.removeEventListener('shown.bs.modal', handler);
    });

    sendBtn.replaceWith(sendBtn.cloneNode(true));
    const newSendBtn = document.getElementById('sendEmailBtn');

    newSendBtn.onclick = async function () {
        const supplierVal = supplierInput.value.trim();
        const poVal = poInput.value.trim();
        if (!supplierVal || !poVal) {
            window.showMessage('Please fill in Supplier and PO Number.', 'error');
            return;
        }
        try {
            if (!window.selectedProjectKey) return window.showMessage('Please select a project.', 'error');
            const API_BASE = '/api';
            const projectResponse = await fetch(`${API_BASE}/projects/${encodeURIComponent(window.selectedProjectKey)}`, {
                headers: { 'Content-Type': 'application/json' }
            });
            if (!projectResponse.ok) {
                const error = await projectResponse.json().catch(() => ({}));
                throw new Error(error.message || 'Failed to fetch project details');
            }
            const project = await projectResponse.json();
            if (!project.email) return window.showMessage('No contact email provided for this project.', 'error');
            if (!project.contact) return window.showMessage('No contact name provided for this project.', 'error');

            const emailBody = [
                `Dear ${project.contact},`,
                '',
                `Supplier: ${supplierVal}`,
                `PO Number: ${poVal}`,
                '',
                `Items for ${project.projectName} have been received, inspected, and placed into inventory. All items received damage free.`,
                'Please see the attached Receipt Confirmation for details. Images are attached or provided in the link below.',
                '',
                `Date Received: ${new Date().toLocaleString('en-US', { timeZone: 'MST' })}`,
            ].join('\r\n');

            const subject = encodeURIComponent(`Inventory Received for ${project.projectName}`);
            const body = encodeURIComponent(emailBody);
            const mailtoLink = `mailto:${project.email}?subject=${subject}&body=${body}`;
            window.location.href = mailtoLink;
            document.activeElement.blur();
            modal.hide();
            window.showMessage('Email opened for sending.', 'success');
        } catch (err) {
            window.showMessage('Failed to send email notification: ' + err.message, 'error');
        }
    };
}
import { createPDFHeader, createPDFTable } from './pdfUtils.js';

// Attach PDF utils to window for compatibility with legacy code
window.createPDFHeader = createPDFHeader;
window.createPDFTable = createPDFTable;
// PDF/barcode/packing list generation
export async function printBarcodeLabels(type) {
    const { jsPDF } = window.jspdf;
    const API_BASE = '/api';
    try {
        // Use all checked items from the Inventory tab (multi-page selection)
        const checked = Array.from(window.selectedItems[type] || []);
        if (checked.length === 0) {
            window.showMessage('No items selected.', 'error');
            return;
        }
        // jsPDF uses inches for 'in' unit, 4x6 label
        const doc = new jsPDF({ unit: 'in', format: [4, 6] });
        let first = true;
        for (const id of checked) {
            const response = await fetch(`${API_BASE}/inventory/${type}/${id}`, {
                headers: { 'Content-Type': 'application/json' }
            });
            if (!response.ok) continue;
            const item = await response.json();
            if (!item.itemNumber) {
                window.showMessage(`Please assign an ITEM # for ${item.itemType} before generating label.`, 'error');
                continue;
            }
            // Use cartonQuantity if present and valid, otherwise use quantity
            const numLabels = (item.cartonQuantity != null && !isNaN(item.cartonQuantity) && item.cartonQuantity > 0)
                ? item.cartonQuantity
                : item.quantity;
            for (let n = 1; n <= numLabels; n++) {
                if (!first) doc.addPage([4, 6]);
                first = false;
                // Barcode (random code, CODE128, no displayValue)
                const code = Math.random().toString(36).substring(2, 10).toUpperCase();
                const canvas = document.createElement('canvas');
                window.JsBarcode(canvas, code, { format: 'CODE128', displayValue: false, height: 60, width: 2 });
                doc.addImage(canvas.toDataURL('image/png'), 'PNG', 0.5, 0.5, 3, 1);

                // Item number on its own line
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(24);
                doc.text(`ITEM # ${item.itemNumber ? item.itemNumber.toUpperCase() : ''}`, 0.5, 2, { maxWidth: 3 });

                // Project name on the next line, flush left
                doc.setFontSize(24);
                doc.text(`${item.projectName ? item.projectName.toUpperCase() : ''}`, 0.5, 2.5, { maxWidth: 3 });

                // Customer name in bold above supplier
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(16);
                doc.text(`${item.customer ? item.customer.toUpperCase() : ''}`, 0.5, 3.0, { maxWidth: 3 });

                // Set font and size ONCE for all the following lines
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(12);

                // Reduce line spacing by half for these lines
                const baseY = 3.25;
                const lineSpacing = 0.25;

                // Supplier
                doc.text(`${(item.supplierId || '').toUpperCase()}`, 0.5, baseY, { maxWidth: 3 });
                // Description
                doc.text(`${(item.itemType || '').toUpperCase()}`, 0.5, baseY + lineSpacing, { maxWidth: 3 });
                // Model (no spaces)
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

                // x of x line, same font size as item number
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(24);
                doc.text(`${n} OF ${numLabels}`, 0.5, baseY + lineSpacing * 6, { maxWidth: 3 });
            }
        }
        doc.save('barcode_labels.pdf');
        window.showMessage('Barcode labels generated successfully.', 'success');
    } catch (err) {
        window.showMessage('Failed to generate barcode labels: ' + err.message, 'error');
    }
}

export async function printPackingList(type) {
    const { jsPDF } = window.jspdf;
    const API_BASE = '/api';
    try {
        const response = await fetch(`${API_BASE}/inventory/${type}`, {
            headers: { 'Content-Type': 'application/json' }
        });
        if (!response.ok) throw new Error('Failed to fetch inventory');
        let items = await response.json();
        if (window.selectedProjectKey) {
            items = items.filter(item => item.projectId === window.selectedProjectKey);
        }
        // Only include checked items in the Shipping tab (multi-page selection)
        const checked = Array.from(window.selectedItems['Shipping'] || []);
        if (checked.length > 0) {
            items = items.filter(item => checked.includes(item._id));
        }
        let projectName = '', customer = '', address = '', address2 = '', city = '', state = '', zip = '', phone = '';
        if (window.selectedProjectKey) {
            const projectResponse = await fetch(`${API_BASE}/projects/${encodeURIComponent(window.selectedProjectKey)}`, {
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
    window.showMessage('Generating Packing List PDF...', 'info');
    doc.autoTable({
            startY: 80,
            head: [[
                'ITEM #', 'Supplier', 'Item', 'Model', 'Quantity', 'Weight (lbs)', 'Location'
            ]],
            body: items.map(item => [
                item.itemNumber || '',
                item.supplierId || '',
                item.itemType || '',
                item.modelNumber || '',
                item.quantity,
                (item.weight !== undefined && item.weight !== null && !isNaN(item.weight)) ? Number(item.weight).toFixed(1) : '',
                item.location || ''
            ]),
            theme: 'grid',
            headStyles: {
                fillColor: [205, 191, 170], // PMS 872 gold at 30%
                textColor: [0, 0, 0],
                fontStyle: 'bold',
                fontSize: 10
            },
            bodyStyles: {
                font: 'helvetica',
                fontSize: 10,
                textColor: [0, 0, 0] // 100% black for all items
            },
            styles: {
                cellPadding: 2,
                halign: 'center',
                valign: 'middle',
                font: 'helvetica',
                fontSize: 10
            },
            columnStyles: {
                0: { halign: 'left' },   // ITEM #
                1: { halign: 'left' },   // Supplier
                2: { halign: 'left' },   // Item
                3: { halign: 'left' },   // Model
                4: { halign: 'center' }, // Quantity
                5: { halign: 'center' }, // Weight (lbs)
                6: { halign: 'left' }    // Location
            }
        });
        const finalY = doc.lastAutoTable.finalY || 80;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        const dateStr = new Date().toLocaleDateString('en-US', { timeZone: 'MST' });
        doc.text('Signature: ______________________________________________', 14, finalY + 20, { align: 'left' });
        doc.text(dateStr, pageWidth - 14, finalY + 20, { align: 'right' });
    window.showMessage('Packing List PDF generated.', 'success');
    console.log('PDF generation: calling doc.save');
    doc.save('packing-list.pdf');
    } catch (err) {
        window.showMessage('Failed to generate packing list: ' + err.message, 'error');
    }
}

export async function generateReceiptConfirmation(data) {
    const { jsPDF } = window.jspdf;
    const API_BASE = '/api';
    const { freightCo, cartonQty, skidQty } = data;
    try {
        if (!window.selectedProjectKey) {
            window.showMessage('Please select a project.', 'error');
            return;
        }
        // Use all checked items from the Inventory tab (multi-page selection)
        const checked = Array.from(window.selectedItems['Inventory'] || []);
        if (checked.length === 0) {
            window.showMessage('No items selected.', 'error');
            return;
        }
        const projectResponse = await fetch(`${API_BASE}/projects/${window.selectedProjectKey}`, {
            headers: { 'Content-Type': 'application/json' }
        });
        if (!projectResponse.ok) {
            const error = await projectResponse.json().catch(() => ({}));
            throw new Error(error.message || 'Failed to fetch project details');
        }
        const project = await projectResponse.json();

        // Fetch inventory items and filter by selected project and checked items
        const inventoryResponse = await fetch(`${API_BASE}/inventory/Inventory`, {
            headers: { 'Content-Type': 'application/json' }
        });
        if (!inventoryResponse.ok) {
            const error = await inventoryResponse.json().catch(() => ({}));
            throw new Error(error.message || 'Failed to fetch inventory');
        }
        let allItems = await inventoryResponse.json();
        if (window.selectedProjectKey) {
            allItems = allItems.filter(item =>
                (item.projectId && item.projectId === window.selectedProjectKey) ||
                (item.project_key && item.project_key === window.selectedProjectKey) ||
                (item.projectKey && item.projectKey === window.selectedProjectKey)
            );
        }
        const items = allItems.filter(item => checked.includes(item._id));
        if (items.length === 0) return window.showMessage('No items selected.', 'error');

        // Get Supplier and PO Number from modal fields
        const supplier = document.getElementById('receiptSupplier').value.trim();
        const poNumber = document.getElementById('receiptPO').value.trim();

        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
        const marginLeft = 16;
        const marginRight = 16;
        const pageWidth = doc.internal.pageSize.getWidth();

        // Header block
        let y = window.createPDFHeader(doc, project.customer, project.projectName, [
            project.address,
            project.address2,
            [project.city, project.state, project.zip].filter(Boolean).join(', ')
        ]);

        // Title
        const infoBlockStartY = y + 8 + 25.4; // move down by 1 inch (25.4 mm)
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(15);
        doc.text(`Receipt Confirmation for Project: ${project.projectName}`, marginLeft, infoBlockStartY);

        // Info table (Freight, Carton, Skid, PO)
        // Match the width of the item list table (sum of cellWidths: 25+35+50+25+15+15+25 = 190)
        doc.autoTable({
            startY: infoBlockStartY + 7,
            head: [['Freight Co', 'Carton Qty', 'Skid Qty', 'PO Number']],
            body: [[freightCo, cartonQty, skidQty, poNumber]],
            theme: 'grid',
            headStyles: {
                fillColor: [205, 191, 170], // PMS 872 gold at 30%
                textColor: [0, 0, 0],
                fontStyle: 'bold',
                fontSize: 10 // match item table header font size
            },
            bodyStyles: {
                font: 'helvetica',
                fontSize: 10, // match item table body font size
                textColor: [0, 0, 0] // 100% black for all items
            },
            alternateRowStyles: { fillColor: [245, 245, 245] },
            styles: {
                cellPadding: 2,
                halign: 'center',
                valign: 'middle',
                font: 'helvetica',
                fontSize: 10 // match item table body font size
            },
            columnStyles: {
                0: { halign: 'left' },   // Freight Co
                1: { halign: 'center' }, // Carton Qty
                2: { halign: 'center' }, // Skid Qty
                3: { halign: 'left' }    // PO Number
            },
            margin: { left: marginLeft, right: marginRight }
        });

        // Main items table (single declaration, 100% black text)
        const tableRows = items.map(item => [
            item.itemNumber || '',
            item.supplierId || '',
            item.itemType || '',
            item.modelNumber || '',
            item.quantity,
            (item.weight !== undefined && item.weight !== null && !isNaN(item.weight)) ? Number(item.weight).toFixed(1) : ''
        ]);
        const infoTableY = doc.lastAutoTable.finalY || (infoBlockStartY + 18);
        doc.autoTable({
            startY: infoTableY + 7,
            head: [['ITEM #', 'Supplier', 'Item', 'Model', 'Quantity', 'Weight (lbs)']],
            body: tableRows,
            theme: 'grid',
            headStyles: {
                fillColor: [205, 191, 170], // PMS 872 gold at 30%
                textColor: [0, 0, 0],
                fontStyle: 'bold',
                fontSize: 10
            },
            bodyStyles: {
                font: 'helvetica',
                fontSize: 10,
                textColor: [0, 0, 0] // 100% black for all items
            },
            styles: {
                cellPadding: 2,
                halign: 'center',
                valign: 'middle',
                font: 'helvetica',
                fontSize: 10
            },
            columnStyles: {
                0: { halign: 'left' },   // ITEM #
                1: { halign: 'left' },   // Supplier
                2: { halign: 'left' },   // Item
                3: { halign: 'left' },   // Model
                4: { halign: 'center' }, // Quantity
                5: { halign: 'center' }, // Weight (lbs)
            },
            margin: { left: marginLeft, right: marginRight }
        });
        // Close modal if open
        const receiptModal = document.getElementById('receiptConfirmationModal');
        if (receiptModal) {
            const modalInstance = bootstrap.Modal.getInstance(receiptModal);
            if (modalInstance) modalInstance.hide();
        }
        window.showMessage('Receipt Confirmation PDF generated.', 'success');
        console.log('PDF generation: calling doc.save');
        doc.save('receipt-confirmation.pdf');
    } catch (err) {
        window.showMessage('Failed to generate receipt confirmation: ' + err.message, 'error');
    }
}
