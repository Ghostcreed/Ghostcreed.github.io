require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const axios = require('axios');
const WebSocket = require('ws');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

const PORT = process.env.PORT || 4000;
const FINNHUB_KEY = process.env.FINNHUB_KEY || '';
const FINNHUB_WS_URL = 'wss://ws.finnhub.io?token=' + FINNHUB_KEY;

// In-memory state
const subscribers = new Map();
const socketToSymbols = new Map();
const lastPrice = {};

let fhWs = null;
function startFinnhubWs() {
  if (!FINNHUB_KEY) {
    console.log('No FINNHUB_KEY provided — backend will simulate prices.');
    return;
  }
  fhWs = new WebSocket(FINNHUB_WS_URL);

  fhWs.on('open', () => {
    console.log('Connected to Finnhub WS');
  });

  fhWs.on('message', (msg) => {
    try {
      const data = JSON.parse(msg);
      if (data.type === 'trade' && Array.isArray(data.data)) {
        data.data.forEach((trade) => {
          const sym = trade.s.toUpperCase();
          const price = trade.p;
          lastPrice[sym] = price;
          io.to(sym).emit('price', { symbol: sym, price, ts: trade.t || Date.now() });
        });
      }
    } catch (err) {
      console.error('WS msg parse err', err);
    }
  });

  fhWs.on('close', () => {
    console.log('Finnhub WS closed — reconnecting in 3s');
    setTimeout(startFinnhubWs, 3000);
  });

  fhWs.on('error', (err) => {
    console.error('Finnhub WS error', err.message || err);
  });
}
startFinnhubWs();

function sendFinnhubWsSubscribe(action, symbol) {
  if (!fhWs || fhWs.readyState !== WebSocket.OPEN) return;
  try {
    const msg = JSON.stringify({ type: action, symbol });
    fhWs.send(msg);
  } catch (err) {
    console.error('failed to send fh subscribe', err);
  }
}

function randomWalk(prev, volatility = 0.01) {
  const changePct = (Math.random() - 0.5) * volatility * 2;
  return +(prev * (1 + changePct)).toFixed(2);
}
setInterval(() => {
  if (FINNHUB_KEY) return;
  for (const sym of Object.keys(lastPrice)) {
    const p = randomWalk(lastPrice[sym] || (Math.random() * 200 + 20));
    lastPrice[sym] = p;
    io.to(sym).emit('price', { symbol: sym, price: p, ts: Date.now() });
  }
}, 1000);

io.on('connection', (socket) => {
  console.log('Client connected', socket.id);

  socket.on('subscribe', (symbolRaw) => {
    if (!symbolRaw) return;
    const symbol = symbolRaw.toUpperCase();
    socket.join(symbol);
    if (!subscribers.has(symbol)) subscribers.set(symbol, new Set());
    subscribers.get(symbol).add(socket.id);
    if (!socketToSymbols.has(socket.id)) socketToSymbols.set(socket.id, new Set());
    socketToSymbols.get(socket.id).add(symbol);

    if (FINNHUB_KEY) {
      if (subscribers.get(symbol).size === 1) {
        sendFinnhubWsSubscribe('subscribe', symbol);
      }
    } else {
      if (!lastPrice[symbol]) lastPrice[symbol] = +(Math.random() * 200 + 10).toFixed(2);
    }

    socket.emit('price', { symbol, price: lastPrice[symbol] || null, ts: Date.now() });
    console.log(`socket ${socket.id} subscribed ${symbol}`);
  });

  socket.on('unsubscribe', (symbolRaw) => {
    if (!symbolRaw) return;
    const symbol = symbolRaw.toUpperCase();
    socket.leave(symbol);
    if (subscribers.has(symbol)) {
      subscribers.get(symbol).delete(socket.id);
      if (subscribers.get(symbol).size === 0 && FINNHUB_KEY) {
        sendFinnhubWsSubscribe('unsubscribe', symbol);
      }
    }
    if (socketToSymbols.has(socket.id)) {
      socketToSymbols.get(socket.id).delete(symbol);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected', socket.id);
    const syms = socketToSymbols.get(socket.id) || new Set();
    syms.forEach(symbol => {
      if (subscribers.has(symbol)) {
        subscribers.get(symbol).delete(socket.id);
        if (subscribers.get(symbol).size === 0 && FINNHUB_KEY) {
          sendFinnhubWsSubscribe('unsubscribe', symbol);
        }
      }
    });
    socketToSymbols.delete(socket.id);
  });
});

app.get('/api/history', async (req, res) => {
  const symbol = (req.query.symbol || 'AAPL').toUpperCase();
  const range = req.query.range || '1d';

  if (FINNHUB_KEY) {
    try {
      const to = Math.floor(Date.now() / 1000);
      let from = to - 60 * 60 * 6;
      let resolution = '1';
      if (range === '1d') { from = to - 60 * 60 * 6; resolution = '1'; }
      if (range === '5d') { from = to - 60 * 60 * 24 * 5; resolution = '60'; }
      if (range === '1m') { from = to - 60 * 60 * 24 * 30; resolution = '60'; }
      const url = `https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(symbol)}&resolution=${resolution}&from=${from}&to=${to}&token=${FINNHUB_KEY}`;
      const r = await axios.get(url, { timeout: 8000 });
      const d = r.data;
      if (d && d.s === 'ok' && Array.isArray(d.c) && Array.isArray(d.t)) {
        const hist = d.t.map((ts, i) => ({ t: ts * 1000, price: d.c[i] }));
        return res.json({ symbol, range, history: hist });
      } else {
        console.warn('Finnhub candle returned no ok status; falling back to synthetic');
      }
    } catch (err) {
      console.error('history fetch err', err.message || err);
    }
  }

  function makeSyntheticHistory(seedPrice, points = 120) {
    const arr = [];
    let price = seedPrice;
    const now = Date.now();
    const stepMs = 60_000;
    for (let i = points - 1; i >= 0; --i) {
      price = randomWalk(price, 0.015);
      arr.push({
        t: now - i * stepMs,
        price
      });
    }
    return arr;
  }

  const seed = lastPrice[symbol] || (Math.random() * 300).toFixed(2);
  const history = makeSyntheticHistory(Number(seed), 300);
  return res.json({ symbol, range, history });
});

server.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
});
