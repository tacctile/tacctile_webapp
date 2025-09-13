import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FONTS_DIR = path.join(__dirname, '..', 'src', 'assets', 'fonts', 'manrope');

// Manrope font URLs from Google Fonts CDN
const FONT_URLS = {
  '200': 'https://fonts.gstatic.com/s/manrope/v15/xn7_YHE41ni1AdIRqAuZuw1Bx9mbZk79FO_F87jxeN7B.woff2',
  '300': 'https://fonts.gstatic.com/s/manrope/v15/xn7_YHE41ni1AdIRqAuZuw1Bx9mbZk4XFO_F87jxeN7B.woff2',
  '400': 'https://fonts.gstatic.com/s/manrope/v15/xn7_YHE41ni1AdIRqAuZuw1Bx9mbZk59FO_F87jxeN7B.woff2',
  '500': 'https://fonts.gstatic.com/s/manrope/v15/xn7_YHE41ni1AdIRqAuZuw1Bx9mbZk5PFO_F87jxeN7B.woff2',
  '600': 'https://fonts.gstatic.com/s/manrope/v15/xn7_YHE41ni1AdIRqAuZuw1Bx9mbZk6XE-_F87jxeN7B.woff2',
  '700': 'https://fonts.gstatic.com/s/manrope/v15/xn7_YHE41ni1AdIRqAuZuw1Bx9mbZk6uE-_F87jxeN7B.woff2',
  '800': 'https://fonts.gstatic.com/s/manrope/v15/xn7_YHE41ni1AdIRqAuZuw1Bx9mbZk7dE-_F87jxeN7B.woff2'
};

// Ensure fonts directory exists
if (!fs.existsSync(FONTS_DIR)) {
  fs.mkdirSync(FONTS_DIR, { recursive: true });
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(dest, (unlinkErr) => {
        if (unlinkErr) console.warn(`Failed to delete file: ${unlinkErr.message}`);
      }); // Delete the file on error
      reject(err);
    });
  });
}

async function downloadFonts() {
  console.log('Downloading Manrope font variants...');
  
  for (const [weight, url] of Object.entries(FONT_URLS)) {
    const fileName = `manrope-${weight}.woff2`;
    const filePath = path.join(FONTS_DIR, fileName);
    
    try {
      await downloadFile(url, filePath);
      console.log(`✓ Downloaded Manrope weight ${weight}`);
    } catch (error) {
      console.error(`✗ Failed to download weight ${weight}:`, error.message);
    }
  }
  
  // Generate CSS file
  generateCSS();
  console.log('✓ Generated CSS file');
  console.log('All fonts downloaded successfully!');
}

function generateCSS() {
  let css = `/* Manrope Font Face Declarations */
/* Downloaded from Google Fonts for offline use */

`;
  
  for (const weight of Object.keys(FONT_URLS)) {
    css += `@font-face {
  font-family: 'Manrope';
  font-style: normal;
  font-weight: ${weight};
  font-display: swap;
  src: url('./manrope/manrope-${weight}.woff2') format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}

`;
  }
  
  // Add utility classes
  css += `/* Utility Classes */
.font-manrope {
  font-family: 'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.font-extralight { font-weight: 200; }
.font-light { font-weight: 300; }
.font-normal { font-weight: 400; }
.font-medium { font-weight: 500; }
.font-semibold { font-weight: 600; }
.font-bold { font-weight: 700; }
.font-extrabold { font-weight: 800; }
`;
  
  const cssPath = path.join(__dirname, '..', 'src', 'assets', 'fonts', 'manrope.css');
  fs.writeFileSync(cssPath, css);
}

// Run the download
downloadFonts().catch(console.error);