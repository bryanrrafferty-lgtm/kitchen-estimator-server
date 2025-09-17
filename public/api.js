const API_BASE = '/api';
export async function importCsv(event) {
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
                // If a project is selected, warn before adding
                if (window.selectedProjectKey) {
                    window.showConfirmModal(
                        'Add to Existing Project',
                        'You are about to add CSV data to the selected project. This action cannot be undone. Do you want to proceed?',
                        async () => {
                            await addCsvToProject(rows, headers, customer, projectName, projectKey, window.selectedProjectKey);
                        }
                    );
                } else {
                    window.showConfirmModal(
                        'Create New Project',
                        'You are about to create a new project from this CSV. Do you want to proceed?',
                        async () => {
                            await addCsvToProject(rows, headers, customer, projectName, projectKey, projectKey, true);
                        }
                    );
                }
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

// Helper function to add CSV data to a project
async function addCsvToProject(rows, headers, customer, projectName, projectKey, targetProjectKey, createNew = false) {
    const API_BASE = '/api';
    if (createNew) {
        const projectData = {
            project_key: targetProjectKey,
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
    }
    const supplierIdx = headers.indexOf('supplier');
    const itemTypeIdx = headers.indexOf('itemtype');
    const modelNumberIdx = headers.indexOf('modelnumber');
    const quantityIdx = headers.indexOf('quantity');
    const weightIdx = headers.indexOf('weight');
    const itemNumberIdx = headers.indexOf('itemnumber');
    const squareFtIdx = headers.indexOf('squareft');
    const inventoryItems = [];
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.length < headers.length) continue;
        const quantity = parseInt(row[quantityIdx]);
        const weight = parseFloat(row[weightIdx]);
        if (isNaN(quantity) || isNaN(weight)) continue;
        // Use selected project's key and name if adding to existing project
        let finalProjectId = targetProjectKey;
        let finalProjectName = projectName;
        let finalCustomer = customer;
        if (!createNew && window.selectedProjectKey) {
            finalProjectId = window.selectedProjectKey;
            // Try to get project name and customer from sidebar (if available)
            const selectedProject = document.querySelector('.list-group-item.active');
            if (selectedProject) {
                const parts = selectedProject.textContent.split('/');
                if (parts.length === 2) {
                    finalCustomer = parts[0].trim();
                    finalProjectName = parts[1].trim();
                }
            }
        }
        inventoryItems.push({
            supplierId: row[supplierIdx],
            itemType: row[itemTypeIdx],
            modelNumber: row[modelNumberIdx],
            quantity,
            weight,
            itemNumber: row[itemNumberIdx] || '',
            location: '',
            projectId: finalProjectId,
            customer: finalCustomer,
            projectName: finalProjectName,
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
    window.selectedProjectKey = targetProjectKey;
    await window.updateProjectList();
    await window.loadProjectDetails(targetProjectKey);
    await window.loadInventory('Receiving');
    showMessage('CSV imported successfully.', 'success');
}
// API calls: fetch, CRUD operations
export async function fetchProject(key) {
    const response = await fetch(`/api/projects/${encodeURIComponent(key)}`);
    if (!response.ok) throw new Error('Failed to fetch project');
    return await response.json();
}

export async function fetchInventory(type) {
    const response = await fetch(`/api/inventory/${type}`);
    if (!response.ok) throw new Error('Failed to fetch inventory');
    return await response.json();
}

export async function updateProjectList() {
    const response = await fetch('/api/projects');
    if (!response.ok) throw new Error('Failed to fetch project list');
    const projects = await response.json();
    console.log('Fetched projects for sidebar:', projects);
    const projectList = document.getElementById('projectList');
    projectList.innerHTML = '';
    // Sort projects alphabetically by customer name, then by project name
    const sortedProjects = Object.values(projects).sort((a, b) => {
        const aCustomer = (a.customer || '').toLowerCase();
        const bCustomer = (b.customer || '').toLowerCase();
        if (aCustomer !== bCustomer) {
            return aCustomer.localeCompare(bCustomer);
        }
        const aProject = (a.projectName || '').toLowerCase();
        const bProject = (b.projectName || '').toLowerCase();
        return aProject.localeCompare(bProject);
    });
    const selectedKey = window.selectedProjectKey;
    sortedProjects.forEach(project => {
        const li = document.createElement('li');
        li.className = 'list-group-item list-group-item-action';
        if (project.project_key === selectedKey) {
            li.classList.add('active');
        }
        li.innerHTML = `<strong>${project.customer || ''}</strong> / ${project.projectName || ''}`;
        li.onclick = () => {
            window.setSelectedProjectKey(project.project_key);
            window.loadProjectDetails(project.project_key);
            window.loadInventory('Receiving');
            window.loadInventory('Inventory');
            window.loadInventory('Shipping');
            // Re-render project list to update highlight
            updateProjectList();
        };
        projectList.appendChild(li);
    });
}
