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
const statusContainer = document.getElementById('statusContainer');
const predictionSummary = document.getElementById('predictionSummary');
const priceInfo = document.getElementById('priceInfo');
const currentPriceEl = document.getElementById('currentPrice');
const priceChangeEl = document.getElementById('priceChange');
const lastUpdateEl = document.getElementById('lastUpdate');

let firstPrice = null; // Track opening price for change calculation

loadBtn.addEventListener('click', () => {
    symbol = (symbolInput.value || 'AAPL').toUpperCase();
    connectSocketAndLoad(symbol);
});

predictBtn.addEventListener('click', () => {
    const preds = computePrediction(mergedPoints);
    showPrediction(preds);
});

connectSocketAndLoad(symbol);

function updateStatus(status) {
    statusEl.textContent = status;
    statusContainer.classList.remove('connected', 'connecting');

    if (status === 'Connected') {
        statusContainer.classList.add('connected');
    } else if (status === 'Connecting...') {
        statusContainer.classList.add('connecting');
    }
}

function updatePriceInfo(price) {
    if (!firstPrice && mergedPoints.length > 0) {
        firstPrice = mergedPoints[0].price;
    }

    currentPriceEl.textContent = `$${price.toFixed(2)}`;

    if (firstPrice) {
        const change = price - firstPrice;
        const changePercent = ((change / firstPrice) * 100).toFixed(2);
        const arrow = change >= 0 ? '▲' : '▼';
        priceChangeEl.innerHTML = `${arrow} $${Math.abs(change).toFixed(2)} (${Math.abs(changePercent)}%)`;
        priceChangeEl.className = change >= 0 ? 'price-change positive' : 'price-change negative';
    }

    lastUpdateEl.textContent = new Date().toLocaleTimeString();
    priceInfo.style.display = 'flex';
}

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
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true,
                    pointRadius: 0,
                    pointHoverRadius: 6,
                    pointHoverBackgroundColor: '#667eea',
                    pointHoverBorderColor: 'white',
                    pointHoverBorderWidth: 2
                },
                {
                    label: 'Prediction',
                    data: [],
                    borderColor: '#f5576c',
                    backgroundColor: 'rgba(245, 87, 108, 0.1)',
                    borderDash: [6, 4],
                    borderWidth: 2,
                    tension: 0.4,
                    fill: false,
                    pointRadius: 4,
                    pointBackgroundColor: '#f5576c',
                    pointBorderColor: 'white',
                    pointBorderWidth: 2
                }
            ]
        },
        options: {
            animation: false,
            parsing: false,
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                tooltip: {
                    mode: 'index',
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    titleFont: {
                        size: 14,
                        weight: 'bold'
                    },
                    bodyFont: {
                        size: 13
                    },
                    cornerRadius: 8,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += '$' + context.parsed.y.toFixed(2);
                            }
                            return label;
                        }
                    }
                },
                legend: {
                    display: true,
                    labels: {
                        font: {
                            size: 14,
                            weight: '600'
                        },
                        color: '#4a5568',
                        padding: 20,
                        usePointStyle: true
                    }
                }
            },
            scales: {
                x: {
                    type: 'time',
                    time: { unit: 'minute' },
                    grid: {
                        display: false
                    },
                    ticks: {
                        font: {
                            size: 12
                        },
                        color: '#718096'
                    }
                },
                y: {
                    beginAtZero: false,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    },
                    ticks: {
                        font: {
                            size: 12
                        },
                        color: '#718096',
                        callback: function(value) {
                            return '$' + value.toFixed(2);
                        }
                    }
                }
            }
        }
    });
}

async function connectSocketAndLoad(sym) {
    symbol = sym.toUpperCase();
    updateStatus('Connecting...');
    firstPrice = null; // Reset for new symbol

    if (socket) {
        try { socket.emit('unsubscribe', symbol); socket.disconnect(); } catch(e){}
        socket = null;
    }

    // Setup WebSocket
    try {
        socket = io(BACKEND, { transports: ['websocket'], autoConnect: true });
        socket.on('connect', () => {
            updateStatus('Connected');
            socket.emit('subscribe', symbol);
        });
        socket.on('disconnect', () => {
            updateStatus('Disconnected');
        });
        socket.on('price', (data) => {
            if (!data || data.symbol !== symbol) return;
            addLivePoint({ t: data.ts, price: data.price });
            updatePriceInfo(data.price);
        });
    } catch (err) {
        console.error('socket err', err);
        updateStatus('Socket error');
    }

    // Fetch historical data
    try {
        const res = await fetch(`${BACKEND}/api/history?symbol=${encodeURIComponent(symbol)}&range=1d`);
        const j = await res.json();
        const hist = j.history || [];
        mergedPoints = hist.map(p => ({ t: p.t, price: p.price }));
        if (mergedPoints.length > 500) mergedPoints = mergedPoints.slice(-500);

        // Update price info with latest historical price
        if (mergedPoints.length > 0) {
            const latestPrice = mergedPoints[mergedPoints.length - 1].price;
            updatePriceInfo(latestPrice);
        }

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

        // Update price info with demo data
        if (mergedPoints.length > 0) {
            const latestPrice = mergedPoints[mergedPoints.length - 1].price;
            updatePriceInfo(latestPrice);
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

    // Always update label dynamically
    chart.data.datasets[0].label = `${symbol} Price`;

    chart.data.datasets[0].data = mergedPoints.map(p => ({ x: p.t, y: p.price }));
    chart.data.datasets[1].data = [];
    chart.update();
}

function updateChart() {
    if (!chart) createChart();

    // Keep label updated when adding live points
    chart.data.datasets[0].label = `${symbol} Price`;

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

    const currentPrice = mergedPoints[mergedPoints.length - 1].price;
    const predictedPrice = preds[preds.length - 1].price;
    const change = predictedPrice - currentPrice;
    const changePercent = ((change / currentPrice) * 100).toFixed(2);
    const arrow = change >= 0 ? '↑' : '↓';
    const changeColor = change >= 0 ? '#48bb78' : '#f56565';

    predictionSummary.innerHTML = `
    <strong>Prediction:</strong> 
    Next price point: <strong>$${preds[0].price.toFixed(2)}</strong> → 
    Future estimate: <strong>$${predictedPrice.toFixed(2)}</strong>
    <span style="color: ${changeColor}; font-weight: 600;"> ${arrow} ${Math.abs(changePercent)}%</span>
  `;
}

function randomWalk(prev, volatility = 0.01) {
    const changePct = (Math.random() - 0.5) * volatility * 2;
    return +(prev * (1 + changePct)).toFixed(2);
}