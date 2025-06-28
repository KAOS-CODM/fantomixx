document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("genres-container");

  fetch('/api/genres')
    .then(res => res.json())
    .then(data => {
      const genres = Object.keys(data).sort();

      genres.forEach(genre => {
        const card = document.createElement('a');
        card.href = `/genre?name=${encodeURIComponent(genre)}`;
        card.className = 'genre-card';
        card.textContent = genre;

        card.setAttribute("data-genre", genre.toLowerCase());

        container.appendChild(card);
      });
    })
    .catch(err => {
      console.error("Failed to load genres", err);
      container.innerHTML = "<p>Failed to load genres.</p>";
    });
});
