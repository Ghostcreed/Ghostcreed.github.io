// app.js
let BACKEND = 'https://stock-tracker-backend-7mjp.onrender.com'; // Render backend
let socket = null;
let chart = null;
let mergedPoints = [];
let symbol = 'AAPL';

const symbolInput = document.getElementById('symbolInput');
const loadBtn = document.getElementById('loadBtn');
const predictBtn = document.getElementById('predictBtn');
const statusEl = document.getElementById('status');
const predictionSummary = document.getElementById('predictionSummary');

loadBtn.addEventListener('click', () => {
  symbol = (symbolInput.value || 'AAPL').toUpperCase();
  connectSocketAndLoad(symbol);
});

predictBtn.addEventListener('click', () => {
  const preds = computePrediction(mergedPoints);
  showPrediction(preds);
});

connectSocketAndLoad(symbol);

function createChart() {
  const ctx = document.getElementById('chart').getContext('2d');
  if (chart) chart.destroy();
  chart = new Chart(ctx, {
    type: 'line',
    data: {
      datasets: [
        { 
          label: `${symbol} Price`,
          data: [], 
          borderColor: 'blue', 
          borderWidth: 1.5, 
          tension: 0.2, 
          pointRadius: 0 
        },
        { 
          label: 'Prediction', 
          data: [], 
          borderColor: 'red', 
          borderDash: [6,4], 
          borderWidth: 1, 
          tension: 0.2, 
          pointRadius: 0 
        }
      ]
    },
    options: {
      animation: false,
      parsing: false,
      plugins: { 
        tooltip: { mode: 'index' },
        legend: { display: true }
      },
      scales: { 
        x: { type: 'time', time: { unit: 'minute' } }, 
        y: { beginAtZero: false } 
      }
    }
  });
}

async function connectSocketAndLoad(sym) {
  symbol = sym.toUpperCase();
  statusEl.textContent = 'Connecting...';

  // Update chart label for new symbol
  if(chart){
    chart.data.datasets[0].label = `${symbol} Price`;
    chart.data.datasets[0].data = [];
    chart.data.datasets[1].data = [];
    chart.update();
  }

  if (socket) {
    try { socket.emit('unsubscribe', symbol); socket.disconnect(); } catch(e){}
    socket = null;
  }

  // Setup WebSocket
  try {
    socket = io(BACKEND, { transports: ['websocket'], autoConnect: true });
    socket.on('connect', () => {
      statusEl.textContent = 'Connected';
      socket.emit('subscribe', symbol);
    });
    socket.on('disconnect', () => { statusEl.textContent = 'Disconnected'; });
    socket.on('price', (data) => {
      if (!data || data.symbol !== symbol) return;
      addLivePoint({ t: data.ts, price: data.price });
    });
  } catch (err) {
    console.error('socket err', err);
    statusEl.textContent = 'Socket error';
  }

  // Fetch historical data
  try {
    const res = await fetch(`${BACKEND}/api/history?symbol=${encodeURIComponent(symbol)}&range=1d`);
    const j = await res.json();
    const hist = j.history || [];
    mergedPoints = hist.map(p => ({ t: p.t, price: p.price }));
    if (mergedPoints.length > 500) mergedPoints = mergedPoints.slice(-500);
    renderChart();
  } catch (err) {
    console.error('history fetch err', err);
    const now = Date.now();
    mergedPoints = [];
    let p = Math.random() * 200 + 20;
    for (let i = 120; i >= 0; i--) {
      p = randomWalk(p);
      mergedPoints.push({ t: now - i * 60000, price: p });
    }
    renderChart();
  }
}

function addLivePoint(pt) {
  mergedPoints.push({ t: pt.t, price: pt.price });
  if (mergedPoints.length > 500) mergedPoints.shift();
  updateChart();
}

function renderChart() {
  if (!chart) createChart();
  chart.data.datasets[0].data = mergedPoints.map(p => ({ x: p.t, y: p.price }));
  chart.data.datasets[1].data = [];
  chart.update();
}

function updateChart() {
  if (!chart) createChart();
  chart.data.datasets[0].data = mergedPoints.map(p => ({ x: p.t, y: p.price }));
  chart.update('none');
}

function computePrediction(points) {
  if (!points || points.length < 5) return [];
  const pts = points.map((p, i) => [i, p.price]);
  const result = regression.linear(pts);
  const slope = result.equation[0];
  const intercept = result.equation[1];
  const lastTime = points[points.length - 1].t;
  const interval = points.length >= 2 ? (points[points.length - 1].t - points[points.length - 2].t) : 60000;
  const preds = [];
  for (let k = 1; k <= 10; k++) {
    const x = points.length - 1 + k;
    const y = slope * x + intercept;
    preds.push({ t: lastTime + k * interval, price: Number(y.toFixed(2)) });
  }
  return preds;
}

function showPrediction(preds) {
  if (!preds || preds.length === 0) {
    predictionSummary.innerHTML = 'Not enough data for prediction';
    return;
  }
  if (!chart) createChart();
  chart.data.datasets[1].data = preds.map(p => ({ x: p.t, y: p.price }));
  chart.update();
  predictionSummary.innerHTML = `<strong>Prediction (next):</strong> ${preds[0].price} → ${preds[preds.length-1].price}`;
}

function randomWalk(prev, volatility = 0.01) {
  const changePct = (Math.random() - 0.5) * volatility * 2;
  return +(prev * (1 + changePct)).toFixed(2);
}
