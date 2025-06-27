const isLocalhost = window.location.hostname === "localhost";

const API_BASE_URL = isLocalhost
  ? "http://localhost:3000/api"
  : "https://fantomixx.onrender.com/api"