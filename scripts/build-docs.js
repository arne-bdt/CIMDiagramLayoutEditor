// Script to convert AsciiDoc files to HTML for use in the application
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import asciidoctor from '@asciidoctor/core';

// Get the directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set up paths
const docsDir = path.join(__dirname, '../docs');
const publicDocsDir = path.join(__dirname, '../public/docs');

// Create the public/docs directory if it doesn't exist
if (!fs.existsSync(publicDocsDir)) {
  fs.mkdirSync(publicDocsDir, { recursive: true });
}

// Initialize asciidoctor
const processor = asciidoctor();

// Convert the user guide
try {
  console.log('Converting user guide to HTML...');
  
  // Read the AsciiDoc file
  const adocPath = path.join(docsDir, 'user-guide.adoc');
  
  if (!fs.existsSync(adocPath)) {
    console.error(`AsciiDoc file not found: ${adocPath}`);
    process.exit(1);
  }
  
  // Convert to HTML - make sure we get a string by using toString()
  const html = processor.convertFile(adocPath, {
    safe: 'safe',
    standalone: true,
    to_file: false, // Important: don't write to file, return string
    attributes: {
      showtitle: true,
      icons: 'font',
      toc: 'left',
      toclevels: 3,
      sectlinks: '',
      experimental: '',
      'favicon': '/favicon.png',
      'stylesheet': '',
      'linkcss': false
    }
  });
  
  // Convert the Document object to a string if needed
  const htmlString = typeof html === 'string' ? html : html.toString();
  
  // Add custom CSS and styles directly in the HTML
  const styledHtml = htmlString.replace('</head>', `
    <style>
      body {
        font-family: Arial, sans-serif;
        line-height: 1.6;
        margin: 0;
        padding: 0;
      }
      
      #header {
        padding: 1em;
        background-color: #f5f5f5;
        border-bottom: 1px solid #ddd;
      }
      
      #toc {
        background-color: #f9f9f9;
        border: 1px solid #ddd;
        padding: 1em;
        margin-bottom: 1em;
        max-width: 300px;
        float: left;
        margin-right: 2em;
      }
      
      .sect1 {
        clear: right;
      }
      
      h1, h2, h3, h4, h5, h6 {
        margin-top: 1em;
        margin-bottom: 0.5em;
        color: #333;
      }
      
      table {
        border-collapse: collapse;
        margin: 1em 0;
        width: 100%;
      }
      
      th, td {
        border: 1px solid #ddd;
        padding: 0.5em;
      }
      
      th {
        background-color: #f5f5f5;
      }
      
      code {
        background-color: #f5f5f5;
        padding: 0.2em 0.4em;
        border-radius: 3px;
        font-family: monospace;
      }
      
      .admonitionblock {
        border-left: 4px solid #4CAF50;
        padding-left: 1em;
        margin: 1em 0;
        background-color: #f9f9f9;
      }
    </style>
  </head>`);
  
  // Write the HTML file
  const htmlPath = path.join(publicDocsDir, 'user-guide.html');
  fs.writeFileSync(htmlPath, styledHtml);
 
  console.log(`Documentation built successfully to: ${htmlPath}`);
} catch (error) {
  console.error('Error building documentation:', error);
  process.exit(1);
}