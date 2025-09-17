// Delete a project by key (stub implementation)
export async function deleteProject(projectKey) {
    if (!projectKey) {
        window.showMessage('No project selected.', 'error');
        return;
    }
    window.showConfirmModal('Delete Project', 'Are you sure you want to delete this project and all its inventory?', async () => {
        try {
            const response = await fetch(`/api/projects/${encodeURIComponent(projectKey)}`, {
                method: 'DELETE'
            });
            if (!response.ok) throw new Error('Failed to delete project');
            await fetch(`/api/inventory/project/${encodeURIComponent(projectKey)}`, {
                method: 'DELETE'
            });
            window.showMessage('Project and its inventory deleted.', 'success');
            window.selectedProjectKey = null;
            await window.updateProjectList();
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
            window.loadInventory('Receiving');
            window.loadInventory('Inventory');
            window.loadInventory('Shipping');
        } catch (err) {
            window.showMessage('Failed to delete project: ' + err.message, 'error');
        }
    });
}
// Project CRUD, sidebar updates
export async function saveNewProject() {
    // ...existing code from main.js...
    // (Move the full saveNewProject implementation here)
}

export function saveProjectDetails() {
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

    if (!window.selectedProjectKey) {
        window.showMessage('No project selected.', 'error');
        return;
    }
    // Enforce required fields
    if (!customer) {
        window.showMessage('Customer is required.', 'error');
        return;
    }
    if (!projectName) {
        window.showMessage('Project Name is required.', 'error');
        return;
    }
    if (!contact) {
        window.showMessage('Contact is required.', 'error');
        return;
    }
    if (!email) {
        window.showMessage('Email is required.', 'error');
        return;
    }

    fetch(`/api/projects/${window.selectedProjectKey}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            customer, projectName, address, address2, city, state, zip, phone, contact, email
        })
    })
    .then(response => {
        if (!response.ok) throw new Error('Failed to update project details');
        window.showMessage('Project details updated successfully.', 'success');
    })
    .catch(err => {
        window.showMessage('Failed to update project details: ' + err.message, 'error');
    });
}

export async function updateSidebarSquareFt() {
    // Ensure selectedProjectKey and projectSquareFtSummary are accessible
    const key = window.selectedProjectKey;
    const summary = window.projectSquareFtSummary || {};
    const data = summary[key] || { total: 0, received: 0 };
    // Calculate balance
    const balance = data.total - data.received;
    // Update sidebar fields (show 2 decimal places)
    const totalEl = document.getElementById('sidebarTotalSqFt');
    const receivedEl = document.getElementById('sidebarReceivedSqFt');
    const balanceEl = document.getElementById('sidebarBalance');
    if (totalEl) totalEl.textContent = data.total.toFixed(2);
    if (receivedEl) receivedEl.textContent = data.received.toFixed(2);
    if (balanceEl) balanceEl.textContent = balance.toFixed(2);
}
