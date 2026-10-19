# LinkTrack

Shorten links and track clicks, unique visitors, device, OS and browser.

## Run locally
npm install
npm start
Open http://localhost:3000 (set PORT to use another port).

## Structure
server.js          API, redirect and tracking
public/index.html  page
public/css/style.css
public/js/app.js

## Deploy
Push to GitHub and deploy as a Web Service on Render (Build: npm install, Start: npm start).
Note: data is stored in data/links.json, which is erased on free hosting restarts.
