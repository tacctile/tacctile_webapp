# Ghost Hunter Toolbox Plugins

This directory contains the plugin architecture for Ghost Hunter Toolbox.

## Plugin Structure

### Core Plugins (`/core`)
Essential plugins that provide core functionality to the application. These plugins are automatically loaded at startup.

### Extensions (`/extensions`) 
User-installed plugins that extend the application's capabilities. These plugins can be enabled/disabled by users.

### Examples (`/examples`)
Sample plugin implementations to help developers create their own plugins.

## Plugin Development

### Plugin Manifest (`plugin.json`)
Each plugin must include a `plugin.json` file with the following structure:

```json
{
  "name": "plugin-name",
  "version": "1.0.0",
  "description": "Plugin description",
  "main": "index.js",
  "author": "Author Name",
  "license": "MIT",
  "dependencies": {},
  "permissions": [
    "file-system",
    "network"
  ],
  "ghostHunter": {
    "minVersion": "1.0.0",
    "maxVersion": "2.0.0"
  }
}
```

### Plugin API
Plugins have access to the Ghost Hunter Toolbox API through the global `ghostHunter` object:

```javascript
// Example plugin implementation
module.exports = {
  activate: function(context) {
    // Plugin activation code
    console.log('Plugin activated:', context);
  },
  
  deactivate: function() {
    // Plugin cleanup code
    console.log('Plugin deactivated');
  }
};
```

## Available Permissions

- `file-system`: Access to file system operations
- `network`: Network access for external APIs
- `hardware`: Access to hardware devices (cameras, microphones)
- `evidence`: Access to evidence database
- `investigations`: Access to investigation data
- `ui`: Access to UI modification APIs

## Plugin Loading

Plugins are automatically discovered and loaded from:
1. `/plugins/core` - Always loaded first
2. `/plugins/extensions` - Loaded based on user preferences

For more information, see the Ghost Hunter Toolbox Plugin Development Guide.