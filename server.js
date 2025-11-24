const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 8000;

const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.png': 'image/png',
  '.jpg': 'image/jpeg'
};

const server = http.createServer((req, res) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  
  // Parse URL
  const parsedUrl = url.parse(req.url);
  let pathname = parsedUrl.pathname;
  
  // Default to index.html
  if (pathname === '/') {
    pathname = '/index.html';
  }
  
  // Get file path
  const filePath = path.join(__dirname, pathname);
  
  // Get file extension
  const extname = path.extname(filePath).toLowerCase();
  
  // Check if file exists
  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // File not found
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>404 - File Not Found</h1>');
      } else {
        // Server error
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end('<h1>500 - Internal Server Error</h1>');
      }
    } else {
      // Success - send file
      const contentType = mimeTypes[extname] || 'text/plain';
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    }
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Jean's Club server running at http://localhost:${PORT}`);
  console.log('📁 Serving files from:', __dirname);
  console.log('🛑 Press Ctrl+C to stop the server');
  
  // Try to open browser automatically
  const { exec } = require('child_process');
  const platform = process.platform;
  let command;
  
  if (platform === 'win32') {
    command = `start http://localhost:${PORT}`;
  } else if (platform === 'darwin') {
    command = `open http://localhost:${PORT}`;
  } else {
    command = `xdg-open http://localhost:${PORT}`;
  }
  
  exec(command, (error) => {
    if (error) {
      console.log(`✅ Please open: http://localhost:${PORT}`);
    }
  });
});
