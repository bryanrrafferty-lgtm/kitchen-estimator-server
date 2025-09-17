// Show a user-friendly error modal for critical failures
export function showErrorModal(message, title = 'Error') {
    let modalEl = document.getElementById('criticalErrorModal');
    if (!modalEl) {
        modalEl = document.createElement('div');
        modalEl.id = 'criticalErrorModal';
        modalEl.innerHTML = `
            <div class="modal fade" tabindex="-1" aria-labelledby="criticalErrorLabel" aria-modal="true" role="dialog">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header bg-danger text-white">
                            <h5 class="modal-title" id="criticalErrorLabel">${title}</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <div class="alert alert-danger" role="alert">${message}</div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal" aria-label="Close">Close</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modalEl);
    } else {
        modalEl.querySelector('.modal-title').textContent = title;
        modalEl.querySelector('.alert').textContent = message;
    }
    const modal = new bootstrap.Modal(modalEl.querySelector('.modal'));
    modal.show();
    modalEl.addEventListener('hidden.bs.modal', () => {
        // Optionally remove modal from DOM after close
        // document.body.removeChild(modalEl);
    }, { once: true });
}
// UI helpers: modals, toasts, confirmation dialogs
export function showMessage(message, type = 'info', duration = 3500) {
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

export function showConfirmModal(title, message, onConfirm) {
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
                        <button type="button" class="btn btn-primary" id="confirmBtn">Proceed</button>
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

export function openNewProjectModal() {
    const modalEl = document.getElementById('newProjectModal');
    if (!modalEl) {
        return;
    }
    document.getElementById('newCustomer').value = '';
    document.getElementById('newProjectName').value = '';
    const modal = new bootstrap.Modal(modalEl);
    const saveBtn = document.getElementById('saveNewProjectBtn');
    const saveListener = () => {
        window.saveNewProject();
    };
    saveBtn.addEventListener('click', saveListener, { once: true });
    modal.show();
}
