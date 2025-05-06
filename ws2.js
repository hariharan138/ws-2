const WebSocket = require('ws');
const { MongoClient } = require('mongodb');

// ---------- MongoDB Setup ----------
const mongoUrl = 'mongodb+srv://hariharan98704:LecKPWQPSqzetLu6@cluster1.lf4un.mongodb.net/?retryWrites=true&w=majority&appName=Cluster1';
const dbName = 'ws2db';
const collectionName = 'messages';

let db, messagesCollection;
MongoClient.connect(mongoUrl, { useUnifiedTopology: true })
  .then(async (client) => {
    db = client.db(dbName);
    messagesCollection = db.collection(collectionName);
    console.log('✅ Connected to MongoDB Atlas');

    // Create unique index on "type" to avoid duplicates
    await messagesCollection.createIndex({ type: 1 }, { unique: true });
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
  }); 
// ---------- WS2 connects to WS1 ----------
const ws1Client = new WebSocket('wss://ws2relayserver.loca.lt');

// ---------- WS2 serves UI clients ----------
const wssToUI = new WebSocket.Server({ port: 7070 }, () => {
  console.log('✅ WS2 running on ws://localhost:7070');
});

const uiClients = new Set();

wssToUI.on('connection', (ws) => {
  console.log('🌐 UI client connected');
  uiClients.add(ws);

  ws.on('close', () => {
    uiClients.delete(ws);
  });
});

// Broadcast to all connected UI clients
function broadcastToUIClients(data) {
  const json = JSON.stringify(data);
  for (const client of uiClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(json);
    }
  }
}

// When WS2 receives data from WS1
ws1Client.on('message', async (data) => {
  try {
    const message = JSON.parse(data);
    console.log('📡 Received from WS1:', message.type);

    if (messagesCollection && message.type) {
      // Replace document based on type, insert if not found
      await messagesCollection.replaceOne(
        { type: message.type },
        { ...message, updatedAt: new Date() },
        { upsert: true }
      );
    }

    // Relay to UI clients
    broadcastToUIClients(message);
  } catch (err) {
    console.error('❌ Failed to parse WS1 message', err);
  }
});

ws1Client.on('open', () => {
  console.log('🔗 Connected to WS1');
});

ws1Client.on('error', (err) => {
  console.error('❌ WS1 connection error:', err.message);
});
