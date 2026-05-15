const $ = (id) => document.getElementById(id);

/* =========================
   AUTH GUARD (SESSION ONLY)
========================= */
async function checkAuth() {
  try {
    const res = await fetch("/api/admin/session", {
      credentials: "include",
    });

    if (!res.ok) {
      window.location.href = "/admin-login";
    }
  } catch (err) {
    console.error("Auth check failed:", err);
    window.location.href = "/admin-login";
  }
}

/* =========================
   API WRAPPER (SESSION SAFE)
========================= */
async function api(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || "Request failed");
  }

  return res.json();
}

/* =========================
   LOAD COMICS
========================= */
async function loadComics() {
  $("listMsg").textContent = "Loading...";

  try {
    const comics = await api("/api/admin/comics");

    const tbody = $("comicsTable").querySelector("tbody");
    tbody.innerHTML = "";

    comics.forEach((c) => {
      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td>${c.id}</td>
        <td>${c.title || ""}</td>
        <td>${c.status || ""}</td>
        <td>${c.author || ""}</td>
        <td>
          <a href="#" class="viewChapters" data-id="${c.id}">View</a>
        </td>
        <td>
          <button class="fillBtn" data-id="${c.id}">Fill</button>
          <button class="deleteComicBtn" data-id="${c.id}" style="background:#b00020;">
            Delete
          </button>
        </td>
      `;

      tbody.appendChild(tr);
    });

    $("listMsg").textContent = "";
  } catch (err) {
    console.error(err);
    $("listMsg").textContent = "Failed to load comics";
  }
}

/* =========================
   SAVE COMIC
========================= */
async function handleSaveComic() {
  const payload = {
    id: $("c_id").value.trim(),
    title: $("c_title").value.trim(),
    status: $("c_status").value.trim(),
    author: $("c_author").value.trim(),
    penciller: $("c_penciller").value.trim(),
    source: $("c_source").value.trim(),
    genre: $("c_genre").value.trim(),
    description: $("c_description").value.trim(),
    shortdescription: $("c_shortdescription").value.trim(),
  };

  // For new comics, allow PocketBase to generate the record ID.
  if (!payload.id) {
    delete payload.id;
  }

  try {
    $("comicMsg").textContent = "Saving...";

    const result = await api("/api/admin/comics", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    if (result?.record?.id) {
      $("c_id").value = result.record.id;
      $("comicMsg").textContent = "Saved ✔ (ID set)";
    } else {
      $("comicMsg").textContent = "Saved ✔";
    }

    loadComics();
  } catch (err) {
    console.error(err);
    $("comicMsg").textContent = "Save failed";
  }
}

/* =========================
   DELETE COMIC
========================= */
async function deleteComic(id) {
  if (!confirm(`Delete comic "${id}"?`)) return;

  try {
    await api(`/api/admin/comics/${id}`, {
      method: "DELETE",
    });

    loadComics();
  } catch (err) {
    alert("Delete failed");
    console.error(err);
  }
}

async function deleteChapter(comicId, chapterId) {
  if (!confirm(`Delete chapter "${chapterId}" from comic "${comicId}"?`)) return;

  try {
    await api(`/api/admin/comics/${comicId}/chapters/${chapterId}`, {
      method: "DELETE",
    });

    showChaptersPopup(comicId);
    loadComics();
  } catch (err) {
    alert("Delete chapter failed");
    console.error(err);
  }
}

/* =========================
   EVENT DELEGATION
========================= */
document.body.addEventListener("click", (e) => {
  if (e.target.classList.contains("deleteComicBtn")) {
    deleteComic(e.target.dataset.id);
  }

  if (e.target.classList.contains("fillBtn")) {
    fillComicForm(e.target.dataset.id);
  }

  if (e.target.classList.contains("deleteChapterBtn")) {
    deleteChapter(e.target.dataset.comic, e.target.dataset.chapter);
  }

  if (e.target.closest("#closePopup") || e.target.id === "popup") {
    const popup = document.getElementById("popup");
    if (popup) popup.style.display = "none";
  }

  if (e.target.classList.contains("viewChapters")) {
    e.preventDefault();
    showChaptersPopup(e.target.dataset.id);
  }
});

/* =========================
   FILL FORM
========================= */
async function fillComicForm(id) {
  try {
    const comic = await api(`/api/admin/comics/${id}`);

    $("c_id").value = comic.id || "";
    $("c_title").value = comic.title || "";
    $("c_status").value = comic.status || "";
    $("c_author").value = comic.author || "";
    $("c_penciller").value = comic.penciller || "";
    $("c_source").value = comic.source || "";
    $("c_genre").value = comic.genre || "";
    $("c_description").value = comic.description || "";
    $("c_shortdescription").value = comic.shortdescription || "";

    $("comicMsg").textContent = "Loaded ✔";
  } catch (err) {
    console.error(err);
    $("comicMsg").textContent = "Load failed";
  }
}

/* =========================
   CHAPTER POPUP
========================= */
async function showChaptersPopup(id) {
  try {
    const comic = await api(`/api/admin/comics/${id}`);

    const ul = $("chapterList");
    ul.innerHTML = "";
    $("popupTitle").textContent = `Chapters for ${comic.title || id}`;

    (comic.chapters || []).forEach((ch) => {
      const li = document.createElement("li");
      li.innerHTML = `
        <span>${ch.id} - ${ch.title || "No title"}</span>
        <button data-comic="${id}" data-chapter="${ch.id}" class="deleteChapterBtn">
          Delete
        </button>
      `;
      ul.appendChild(li);
    });

    const popup = document.getElementById("popup");
    if (popup) popup.style.display = "flex";
  } catch (err) {
    console.error(err);
  }
}

async function handleUploadChapters() {
  const comicId = $("u_comic_id").value.trim();
  const files = $("cbzFiles").files;
  const meta = $("chaptersMeta").value.trim();
  const resultEl = $("uploadResults");

  if (!comicId) {
    $("uploadMsg").textContent = "Comic ID is required.";
    return;
  }

  if (!files.length) {
    $("uploadMsg").textContent = "Select at least one CBZ file.";
    return;
  }

  const formData = new FormData();
  formData.append("comic_id", comicId);

  if (meta) {
    formData.append("chaptersMeta", meta);
  }

  for (const file of files) {
    formData.append("chapters", file, file.name);
  }

  try {
    $("uploadMsg").textContent = "Uploading...";
    resultEl.textContent = "";

    const res = await fetch("/api/admin/chapters/upload", {
      method: "POST",
      body: formData,
      credentials: "include",
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error || JSON.stringify(data));
    }

    $("uploadMsg").textContent = "Upload complete.";
    resultEl.textContent = JSON.stringify(data.results, null, 2);
    loadComics();
  } catch (err) {
    console.error(err);
    $("uploadMsg").textContent = "Upload failed.";
    resultEl.textContent = err.message;
  }
}

async function handleUploadCover() {
  const comicId = $("c_id").value.trim();
  const file = $("coverFile").files[0];

  if (!comicId) {
    $("coverMsg").textContent = "Comic ID is required to upload a cover.";
    return;
  }

  if (!file) {
    $("coverMsg").textContent = "Select a cover image first.";
    return;
  }

  const formData = new FormData();
  formData.append("cover", file, file.name);

  try {
    $("coverMsg").textContent = "Uploading cover...";

    const res = await fetch(`/api/admin/comics/${comicId}/cover`, {
      method: "POST",
      body: formData,
      credentials: "include",
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error || JSON.stringify(data));
    }

    $("coverMsg").textContent = "Cover uploaded successfully.";
    loadComics();
  } catch (err) {
    console.error(err);
    $("coverMsg").textContent = "Cover upload failed.";
  }
}

/* =========================
   INIT
========================= */
window.addEventListener("DOMContentLoaded", async () => {
  await checkAuth();

  loadComics();

  $("saveComic").addEventListener("click", handleSaveComic);
  $("refreshList").addEventListener("click", loadComics);
  $("uploadChBtn").addEventListener("click", handleUploadChapters);
  $("uploadCoverBtn").addEventListener("click", handleUploadCover);

  $("logoutBtn").addEventListener("click", async () => {
    await fetch("/api/admin/logout", {
      method: "POST",
      credentials: "include",
    });

    window.location.href = "/admin-login";
  });
});