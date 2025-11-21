Real-Time Stock Tracker

A web application that displays live stock price updates, historical price charts, and model-based predictions using a Node.js backend, Socket.IO WebSockets, and a static HTML/JS frontend.

📌 Features
1. Real-Time Price Updates

Uses Socket.IO to subscribe to a stock symbol.

Updates instantly when the backend sends new prices.

Displayed live on a chart.

2. Historical Price Chart

Fetches multiple decades of price data from the backend.

Plots a blue line for the actual closing prices.

3. Price Prediction

Predict button sends a request to the backend.

A simple model returns the predicted future price.

Rendered as a red dot on the chart.

4. Fully Deployable

Backend is deployed on Render.com.

Frontend is static HTML/JS and can run on any web server (including school servers).

📁 Project Structure
project/
 ├── backend/
 │    ├── index.js
 │    ├── package.json
 │    └── (API + WebSocket logic)
 └── frontend_static/
      ├── index.html
      ├── script.js
      ├── styles.css
      └── chart.min.js

🖥️ Technologies Used
Backend

Node.js — JavaScript runtime for server-side logic

Express.js — HTTP API routing

Socket.IO — Real-time WebSocket communication

Axios — Fetching stock data from the API

Finnhub.io API — Provides real stock market data

Render.com — Backend hosting service

Frontend

HTML, CSS, JavaScript

Chart.js — For chart rendering

Socket.IO client — For receiving live updates

⚙️ How the System Works
1. Frontend

User enters a stock symbol (default: AAPL).

Clicking Load:

Fetches historical prices via the backend’s /api/history/:symbol route.

Updates the blue line on the chart.

Renames the dataset label to the symbol.

Clicking Predict:

Sends a request to /api/predict/:symbol.

Adds a red dot representing the model’s predicted price.

Socket.IO connects to:

wss://<your-backend-url>


When the backend pushes a "price" event, the chart updates instantly.

2. Backend

Runs on Node + Express.

Provides two main routes:

(a) Get Historical Prices
GET /api/history/:symbol


Returns cleaned historical price data.

(b) Predict Future Price
GET /api/predict/:symbol


Returns a simple model-based prediction.

(c) Real-Time Updates

Socket.IO handles:

subscribe — client requests live updates for a particular symbol

unsubscribe — stop listening if symbol changes

Backend sends:

socket.emit("price", { symbol, price, time });

🚀 Deployment Instructions
Backend Deployment (Render.com)

Create a free Render account.

“New Web Service” → Connect your GitHub repo (or upload code).

Use:

Build command: npm install

Start command: node index.js

Add environment variable:

FINNHUB_API_KEY = your_api_key_here


Deploy and copy your backend URL.
Example:

https://stock-tracker-backend-xxxx.onrender.com

Frontend Deployment (School Server)

Upload the frontend_static/ folder as-is.

Make sure your host does not try to run Node; it must serve plain files.

Open script.js and set:

const BACKEND_URL = "https://stock-tracker-backend-xxxx.onrender.com";


Visit your hosted page, for example:

http://csci331vm.cs.montana.edu/~yourID/stock-tracker/frontend_static/

📊 Chart Behavior Clarification

Blue line = actual stock prices

Red dot = prediction

Y-axis automatically rescales based on visible data

Pressing Load repeatedly re-fetches live historical data (which may slightly change the scale)

🧪 How to Run Locally
1. Backend
cd backend
npm install
node index.js

2. Frontend

Open index.html in a browser.

📞 Troubleshooting
“Disconnected” appears

Means the WebSocket failed to open.
Check:

Backend URL correct?

Render server awake?

School server blocking WebSockets?

No prediction shown

Backend URL may not be pointing to your Render deployment.

Blue line label wrong

Reload or fix the symbol label logic in script.js.

📚 Summary

This project demonstrates:

Real-time communication with Socket.IO

Backend API design using Node + Express

API consumption using Axios

Clean visualization with Chart.js

Frontend + backend separation for easy deployment
