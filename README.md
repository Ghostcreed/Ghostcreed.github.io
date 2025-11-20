
Stock Tracker — Full Stack project bundle
========================================

This package contains a complete full-stack stock-tracker you can deploy for your class submission.

Folders:
- backend/       Node.js + Express + Socket.IO backend (connects to Finnhub WS or simulates)
- frontend_static/  Static frontend (no npm/build required) ready to upload to school server

Important:
- Put your FINNHUB_KEY into backend/.env or in your host environment variables.
- Deploy backend to Render/Railway/Fly (instructions below) and upload frontend_static to your school webspace.

Deployment quick steps (Render):
1. Push backend/ to GitHub.
2. Create new Web Service on Render, connect to repo and point to backend folder.
3. Set environment variable FINNHUB_KEY.
4. Deploy. Use produced HTTPS URL as Backend URL in frontend page.

If you cannot host backend externally, convert backend to PHP endpoints (I can generate these on request).


Submission text (copy to assignment):
-------------------------------------
URL of hosted site: https://REPLACE-WITH-YOUR-BACKEND-AND-FRONTEND-URL
Screenshots: included in screenshots/ directory of this package.
Contributions & Achievements: see CONTRIBUTION.md included.

Self-evaluation: see SELF_EVAL_TEMPLATE.md included.
