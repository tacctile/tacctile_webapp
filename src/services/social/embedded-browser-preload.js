const { contextBridge, ipcRenderer } = require('electron');

// Expose safe IPC methods to the renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // File operations
  selectFile: () => ipcRenderer.invoke('select-file'),
  
  // Navigation
  goBack: () => ipcRenderer.invoke('browser-go-back'),
  goForward: () => ipcRenderer.invoke('browser-go-forward'),
  refresh: () => ipcRenderer.invoke('browser-refresh'),
  
  // Authentication
  saveCredentials: (credentials) => ipcRenderer.invoke('save-browser-credentials', credentials),
  getCredentials: () => ipcRenderer.invoke('get-browser-credentials'),
  
  // Notifications
  showNotification: (title, body) => ipcRenderer.invoke('show-notification', { title, body }),
  
  // Progress tracking
  updateProgress: (progress) => ipcRenderer.invoke('update-upload-progress', progress)
});

// Inject CSS for better UX
const style = document.createElement('style');
style.textContent = `
  /* Hide unnecessary elements for cleaner experience */
  .ghost-hunter-hidden {
    display: none !important;
  }
  
  /* Highlight upload areas */
  .ghost-hunter-upload-zone {
    border: 2px dashed #4CAF50 !important;
    background: rgba(76, 175, 80, 0.1) !important;
  }
  
  /* Progress indicator */
  .ghost-hunter-progress {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: #4CAF50;
    z-index: 9999;
    transition: width 0.3s ease;
  }
`;

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    document.head.appendChild(style);
  });
} else {
  document.head.appendChild(style);
}