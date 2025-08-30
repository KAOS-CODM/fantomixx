document.addEventListener("DOMContentLoaded", () => {
    const container = document.getElementById("updates-container");

    fetch(`${API_BASE_URL}/comics`)
      .then(res => res.json())
      .then(comics => {
        container.innerHTML = "";


        const shuffled = comics.sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, 4);

        selected.forEach(comic => {
          const card = document.createElement("div");
          card.className = "update-card";
          card.innerHTML = `
            <a href="/chapter?id=${comic.id}" style="color:#ffccff;">
            <img src="${comic.cover || 'assets/default-cover.jpg'}" alt="${comic.title}"></a>
            <h3>${comic.title}</h3>
          `;
          container.appendChild(card);
        });
      })
      .catch(() => {
        container.innerHTML = "<p>Could not load featured comics.</p>";
      });
  });
