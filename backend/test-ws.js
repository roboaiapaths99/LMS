const WebSocket = require('ws');

const ws = new WebSocket('ws://127.0.0.1:4000/api/v1/notifications/ws?token=fake_token');

ws.on('open', () => {
  console.log('Connected to WS');
  ws.close();
});

ws.on('error', (err) => {
  console.error('WS Error:', err.message);
});

ws.on('unexpected-response', (req, res) => {
  console.error('Unexpected response:', res.statusCode);
});
