document.addEventListener("DOMContentLoaded", () => {
    const params = new URLSearchParams(window.location.search);
    const genreName = params.get("name");
    const title = document.getElementById("genre-title");
    const list = document.getElementById("genre-comic-list");

    if (!genreName) {
        title.textContent = "Genre not specified";
        return;
    }

    title.textContent = genreName;

    fetch('/api/genres')
    .then(res => res.json())
    .then(data => {
        const comics = data[genreName] || [];

        if (comics.length === 0) {
            list.innerHTML = "<p>No comics found for this genre.</p>";
            return;
        }

        comics.forEach(comic => {
            const card = document.createElement('a');
            card.href = `/chapter?id=${comic.id}`;
            card.className = 'genre-card';
            card.classList.add("comic-card");

            card.setAttribute("data-title", comic.title.toLowerCase());
            card.setAttribute("data-genre", (comic.genre || "").toLowerCase());

            card.innerHTML = `
                <img src="${comic.cover}" alt="${comic.title}">
                <h3>${comic.title}</h3>
            `;

            list.appendChild(card);
        });
    })
    .catch(err => {
        list.innerHTML = "<p>Error loading comics.</p>";
        console.error(err);
    });
});
