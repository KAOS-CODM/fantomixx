import PocketBase from "https://unpkg.com/pocketbase@0.21.0/dist/pocketbase.es.mjs";

const pb = new PocketBase("http://127.0.0.1:8090");

document.getElementById("loginBtn").addEventListener("click", async () => {
  const email = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();
  const error = document.getElementById("errorMsg");

  try {
    if (!email || !password) {
      error.textContent = "Email and password required";
      return;
    }

    // Attempt login via server (which uses PocketBase)
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      credentials: "include", // Include cookies for session
      body: JSON.stringify({
        email,
        password
      })
    });

    if (!response.ok) {
      error.textContent = "Invalid credentials";
      console.error("Login failed:", response.statusText);
      return;
    }

    const result = await response.json();
    
    // Store token in localStorage if provided
    if (result.token) {
      localStorage.setItem("pb_token", result.token);
    }

    // Also try to authenticate with PocketBase directly for client-side operations
    try {
      await pb.admins.authWithPassword(email, password);
      console.log("PocketBase admins auth successful");
      localStorage.setItem("pb_auth", JSON.stringify(pb.authStore.exportToCookie()));
    } catch (pbErr) {
      console.warn("PocketBase admins auth failed (this is okay if using session auth):", pbErr);
    }

    // Success - redirect to admin panel
    window.location.href = "/admin";

  } catch (e) {
    error.textContent = "Login error - please try again";
    console.error("Login error:", e);
  }
});