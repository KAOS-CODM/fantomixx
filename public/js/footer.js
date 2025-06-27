document.addEventListener("DOMContentLoaded", () => {
    fetch(`${API_BASE_URL}/footer`)
    .then(res => res.json())
    .then(data => {
        const footerDiv = document.getElementById('dynamic-footer');
        if (!footerDiv) return;

        const linksHTML = data.links.map(link => 
            `<a href="${link.href}" class="footer-link">${link.label}</a>`
        ).join(" | ");

        footerDiv.innerHTML = `
            <footer class="footer">
                <div class="footer-content"
                    <p>${data.text}</p>
                    <nav>${linksHTML}</nav>
                </div>
            <footer>
        `;
    })
    .catch(err => {
        console.error("Failed to load footer:", err);
    });
});