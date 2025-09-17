// Inventory table logic, sorting, rendering, selection
export function applySort(type) {
    // ...existing code from main.js...
    // (Move the full applySort implementation here)
}

export function sortTable(tableId, col) {
    // ...existing code from main.js...
    // (Move the full sortTable implementation here)
}

export function selectAll(type, checked) {
    // Select/deselect all items for the given type (Inventory or Shipping) across all pages
    if (window.inventoryCache && window.selectedItems) {
        const items = window.inventoryCache[type] || [];
        if (checked) {
            items.forEach(item => window.selectedItems[type].add(item._id));
        } else {
            window.selectedItems[type].clear();
        }
    }
    // Update current page checkboxes visually
    const tableId = type.toLowerCase() + 'Table';
    const table = document.getElementById(tableId);
    if (table) {
        const checkboxes = table.querySelectorAll('input.item-check[type="checkbox"]');
        checkboxes.forEach(cb => {
            cb.checked = checked;
        });
    }
}
