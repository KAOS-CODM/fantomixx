// public/js/config.js

const isLocalhost = window.location.hostname === "localhost";

const API_BASE_URL = isLocalhost
  ? "http://localhost:3000/api"  // Your local dev server
  : "https://fantomixx.onrender.com/api"  // Replace with your deployed domain
