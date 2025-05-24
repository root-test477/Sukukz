// Script to test webhook reception
require('dotenv').config();
const http = require('http');

// Create a simple HTTP server to debug webhook requests
const server = http.createServer((req, res) => {
  console.log(`Received request: ${req.method} ${req.url}`);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  
  let body = '';
  req.on('data', (chunk) => {
    body += chunk.toString();
  });
  
  req.on('end', () => {
    if (body) {
      try {
        const data = JSON.parse(body);
        console.log('Request body:', JSON.stringify(data, null, 2));
      } catch (e) {
        console.log('Raw body:', body.substring(0, 1000)); // Show first 1000 chars
      }
    }
    
    // Always respond with 200 OK
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', received: new Date().toISOString() }));
  });
});

const PORT = process.env.PORT || 10001;
server.listen(PORT, () => {
  console.log(`Debug webhook server running on port ${PORT}`);
  console.log('Use ngrok or a similar tool to expose this server to the internet');
  console.log('Then register the webhook URL with Telegram using:');
  console.log('https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=<YOUR_PUBLIC_URL>');
});
