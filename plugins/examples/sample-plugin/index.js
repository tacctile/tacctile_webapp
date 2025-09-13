/**
 * Sample Tacctile Plugin
 * Demonstrates basic plugin structure and API usage
 */

module.exports = {
  /**
   * Plugin activation function
   * Called when the plugin is loaded and activated
   */
  activate: function(context) {
    console.log('Sample Plugin: Activated');
    console.log('Context:', context);
    
    // Register a custom menu item
    if (context.api && context.api.menu) {
      context.api.menu.addItem({
        label: 'Sample Plugin',
        submenu: [
          {
            label: 'Show Sample Dialog',
            click: () => this.showSampleDialog(context)
          },
          {
            label: 'Process Evidence',
            click: () => this.processEvidence(context)
          }
        ]
      });
    }
    
    // Register keyboard shortcut
    if (context.api && context.api.shortcuts) {
      context.api.shortcuts.register('Ctrl+Shift+S', () => {
        this.showSampleDialog(context);
      });
    }
    
    return Promise.resolve();
  },
  
  /**
   * Plugin deactivation function
   * Called when the plugin is being disabled or unloaded
   */
  deactivate: function() {
    console.log('Sample Plugin: Deactivated');
    
    // Clean up resources, event listeners, etc.
    return Promise.resolve();
  },
  
  /**
   * Show a sample dialog
   */
  showSampleDialog: function(context) {
    if (context.api && context.api.dialog) {
      context.api.dialog.showMessageBox({
        type: 'info',
        title: 'Sample Plugin',
        message: 'Hello from the Sample Plugin!',
        detail: 'This is a demonstration of the Tacctile plugin API.',
        buttons: ['OK']
      });
    }
  },
  
  /**
   * Process evidence data
   */
  processEvidence: function(context) {
    if (context.api && context.api.evidence) {
      // Get current investigation
      const investigation = context.api.evidence.getCurrentInvestigation();
      
      if (investigation) {
        console.log('Processing evidence for investigation:', investigation.name);
        
        // Example: Add metadata to evidence
        const evidenceList = context.api.evidence.getEvidenceList();
        evidenceList.forEach(evidence => {
          // Add sample plugin metadata
          context.api.evidence.addMetadata(evidence.id, {
            'sample-plugin-processed': new Date().toISOString(),
            'sample-plugin-version': '1.0.0'
          });
        });
        
        // Show notification
        if (context.api.notifications) {
          context.api.notifications.show({
            title: 'Sample Plugin',
            message: `Processed ${evidenceList.length} evidence items`,
            type: 'success'
          });
        }
      }
    }
  }
};