/**
 * Code Protection Script using Bytenode
 * Compiles sensitive JavaScript files to bytecode for basic obfuscation
 */

import bytenode from 'bytenode';
import fs from 'fs';
import path from 'path';

// Files to protect (typically licensing and payment logic)
const PROTECTED_FILES = [
  'src/licensing/licenseValidator.js',
  'src/licensing/licenseStore.js', 
  'src/licensing/licenseManager.js',
  'src/payments/stripePayments.js',
];

// Output directory for protected files
const PROTECTED_DIR = 'protected';

async function protectFiles() {
  console.log('🔒 Starting code protection with bytenode...');
  
  // Create protected directory
  if (!fs.existsSync(PROTECTED_DIR)) {
    fs.mkdirSync(PROTECTED_DIR, { recursive: true });
  }

  for (const file of PROTECTED_FILES) {
    try {
      const jsFile = file.replace(/\.ts$/, '.js'); // Convert .ts to .js for compiled files
      const inputPath = path.resolve(jsFile);
      
      if (!fs.existsSync(inputPath)) {
        console.warn(`⚠️ File not found: ${inputPath}`);
        continue;
      }

      const basename = path.basename(jsFile, '.js');
      const outputPath = path.join(PROTECTED_DIR, `${basename}.jsc`);
      
      console.log(`🔐 Protecting: ${jsFile} -> ${outputPath}`);
      
      // Compile to bytecode
      bytenode.compileFile(inputPath, outputPath);
      
      // Create loader file that requires the bytecode
      const loaderPath = path.join(PROTECTED_DIR, `${basename}.js`);
      const loaderCode = `
// Protected file loader - loads bytecode version
const bytenode = require('bytenode');
const path = require('path');

// Load the protected bytecode version
module.exports = require(path.join(__dirname, '${basename}.jsc'));
`;
      
      fs.writeFileSync(loaderPath, loaderCode.trim());
      
      console.log(`✅ Protected: ${basename}.js`);
    } catch (error) {
      console.error(`❌ Failed to protect ${file}:`, error.message);
    }
  }
  
  console.log('🎉 Code protection complete!');
  console.log('');
  console.log('To use protected files, require them from the protected/ directory:');
  console.log("const licenseManager = require('./protected/licenseManager');");
}

// Usage instructions
function showUsage() {
  console.log('📖 Bytenode Code Protection');
  console.log('');
  console.log('This script compiles sensitive JavaScript files to bytecode (.jsc files)');
  console.log('to provide basic obfuscation and make reverse engineering more difficult.');
  console.log('');
  console.log('Usage:');
  console.log('  node bytenode-protect.js');
  console.log('');
  console.log('Before running:');
  console.log('  1. Compile TypeScript files: npm run build');
  console.log('  2. Run this script: node bytenode-protect.js');
  console.log('  3. Update imports to use protected/ versions');
  console.log('');
  console.log('Note: This provides only basic protection. For production,');
  console.log('consider additional obfuscation tools and server-side validation.');
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    showUsage();
  } else {
    protectFiles().catch(error => {
      console.error('💥 Code protection failed:', error);
      process.exit(1);
    });
  }
}

module.exports = { protectFiles };