/**
 * Icon Generator Script
 * Creates platform-specific icons from a base SVG
 */

const fs = require('fs');
const path = require('path');

// Create a simple ghost icon SVG
const svgIcon = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="ghostGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#8b5cf6;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#6d28d9;stop-opacity:1" />
    </linearGradient>
  </defs>
  <!-- Ghost body -->
  <path d="M256 64C167.6 64 96 135.6 96 224v160c0 17.7 14.3 32 32 32 8.8 0 16.8-3.6 22.6-9.4l9.4-9.4 9.4 9.4c11.2 11.2 29.4 11.2 40.6 0l18.7-18.7 18.7 18.7c11.2 11.2 29.4 11.2 40.6 0l18.7-18.7 18.7 18.7c11.2 11.2 29.4 11.2 40.6 0l9.4-9.4 9.4 9.4c5.8 5.8 13.8 9.4 22.6 9.4 17.7 0 32-14.3 32-32V224C416 135.6 344.4 64 256 64z" 
        fill="url(#ghostGrad)" stroke="#4c1d95" stroke-width="4"/>
  <!-- Eyes -->
  <circle cx="200" cy="200" r="24" fill="#1f2937"/>
  <circle cx="312" cy="200" r="24" fill="#1f2937"/>
  <circle cx="208" cy="192" r="8" fill="#ffffff"/>
  <circle cx="320" cy="192" r="8" fill="#ffffff"/>
  <!-- EMF sensor -->
  <rect x="220" y="280" width="72" height="40" rx="8" fill="#1f2937" stroke="#374151" stroke-width="2"/>
  <rect x="232" y="290" width="48" height="20" rx="4" fill="#22d3ee"/>
  <circle cx="240" cy="300" r="3" fill="#ffffff" opacity="0.8">
    <animate attributeName="opacity" values="0.8;1;0.8" dur="2s" repeatCount="indefinite"/>
  </circle>
</svg>`;

// Create ICO file (Windows) - simplified placeholder
const createIco = () => {
  // For a real implementation, use a library like 'png-to-ico'
  // This is a placeholder that creates a simple text file
  const icoPlaceholder = 'Windows Icon Placeholder - Replace with actual .ico file';
  fs.writeFileSync(path.join(__dirname, '..', 'assets', 'icon.ico'), icoPlaceholder);
  console.log('Created placeholder icon.ico (replace with actual icon)');
};

// Create ICNS file (macOS) - simplified placeholder
const createIcns = () => {
  // For a real implementation, use a library like 'png2icns'
  // This is a placeholder that creates a simple text file
  const icnsPlaceholder = 'macOS Icon Placeholder - Replace with actual .icns file';
  fs.writeFileSync(path.join(__dirname, '..', 'assets', 'icon.icns'), icnsPlaceholder);
  console.log('Created placeholder icon.icns (replace with actual icon)');
};

// Create PNG files (Linux and general use)
const createPng = () => {
  // Save the SVG as a placeholder for PNG generation
  fs.writeFileSync(path.join(__dirname, '..', 'assets', 'icon.svg'), svgIcon);
  console.log('Created icon.svg (use an SVG to PNG converter for actual PNG files)');
  
  // Create placeholder PNGs
  const sizes = [16, 32, 64, 128, 256, 512, 1024];
  sizes.forEach(size => {
    const pngPlaceholder = `PNG ${size}x${size} Placeholder`;
    fs.writeFileSync(
      path.join(__dirname, '..', 'assets', `icon-${size}x${size}.png`),
      pngPlaceholder
    );
  });
  
  // Create main PNG placeholder
  fs.writeFileSync(
    path.join(__dirname, '..', 'assets', 'icon.png'),
    'PNG Main Icon Placeholder'
  );
  console.log('Created PNG placeholders (convert SVG to PNG for actual files)');
};

// Create tray icon
const createTrayIcon = () => {
  const trayIconSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
  <path d="M8 2C5.2 2 3 4.2 3 7v5c0 0.6 0.4 1 1 1l1-1 1 1c0.4 0.4 1 0.4 1.4 0L8 12.4l0.6 0.6c0.4 0.4 1 0.4 1.4 0l1-1 1 1c0.6 0 1-0.4 1-1V7C13 4.2 10.8 2 8 2z" 
        fill="#8b5cf6"/>
  <circle cx="6" cy="6" r="1" fill="#1f2937"/>
  <circle cx="10" cy="6" r="1" fill="#1f2937"/>
</svg>`;
  
  fs.writeFileSync(path.join(__dirname, '..', 'assets', 'tray-icon.svg'), trayIconSvg);
  fs.writeFileSync(path.join(__dirname, '..', 'assets', 'tray-icon.png'), 'Tray Icon PNG Placeholder');
  console.log('Created tray icon placeholders');
};

// Main execution
const main = () => {
  // Ensure assets directory exists
  const assetsDir = path.join(__dirname, '..', 'assets');
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }
  
  console.log('Generating icon placeholders...');
  console.log('Note: These are placeholders. Use proper icon generation tools for production:');
  console.log('- Windows: Use png-to-ico or similar');
  console.log('- macOS: Use iconutil or png2icns');
  console.log('- Linux: Use ImageMagick or similar to convert SVG to PNG');
  
  createIco();
  createIcns();
  createPng();
  createTrayIcon();
  
  console.log('\nIcon generation complete!');
  console.log('Replace placeholder files with actual icons before building for production.');
};

main();