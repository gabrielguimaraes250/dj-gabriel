// PERSONALIZE AQUI: coloque seu número com código do país e DDD, somente números.
// Exemplo de formato: 5541999999999. Não use espaços, +, parênteses ou traços.
const WHATSAPP_NUMBER = "55419987090188";

const themeToggle = document.getElementById("themeToggle");
const menuToggle = document.getElementById("menuToggle");
const nav = document.querySelector(".desktop-nav");

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeToggle.querySelector(".theme-icon").textContent = theme === "dark" ? "☼" : "☾";
  themeToggle.setAttribute("aria-label", theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro");
  try { localStorage.setItem("dj-gabriel-theme", theme); } catch (error) {}
}

let savedTheme = "dark";
try { savedTheme = localStorage.getItem("dj-gabriel-theme") || "dark"; } catch (error) {}
setTheme(savedTheme);

themeToggle.addEventListener("click", () => {
  setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
});

menuToggle.addEventListener("click", () => {
  const isOpen = nav.classList.toggle("open");
  menuToggle.setAttribute("aria-expanded", String(isOpen));
});
nav.querySelectorAll("a").forEach(link => link.addEventListener("click", () => {
  nav.classList.remove("open");
  menuToggle.setAttribute("aria-expanded", "false");
}));

document.getElementById("year").textContent = new Date().getFullYear();

document.getElementById("contactForm").addEventListener("submit", (event) => {
  event.preventDefault();
  

  const form = new FormData(event.currentTarget);
  const name = form.get("name").trim();
  const eventType = form.get("event");
  const date = form.get("date") || "Ainda não definida";
  const message = form.get("message").trim() || "Gostaria de conversar sobre os serviços.";
  const text = `Olá, DJ Gabriel! Meu nome é ${name}.%0A%0ATipo de evento: ${eventType}%0AData: ${date}%0A%0A${message}`;
  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${text}`, "_blank", "noopener,noreferrer");
});

/* =====================================
   GALERIA - ALTERNAR FOTOS E VÍDEOS
===================================== */

document.addEventListener("DOMContentLoaded", function () {

    const tabFotos = document.getElementById("tabFotos");
    const tabVideos = document.getElementById("tabVideos");

    const fotosPanel = document.getElementById("fotosPanel");
    const videosPanel = document.getElementById("videosPanel");

    if (!tabFotos || !tabVideos || !fotosPanel || !videosPanel) {
        return;
    }

    function mostrarGaleria(tipo) {

        const mostrarFotos = tipo === "fotos";

        fotosPanel.hidden = !mostrarFotos;
        videosPanel.hidden = mostrarFotos;

        tabFotos.classList.toggle("active", mostrarFotos);
        tabVideos.classList.toggle("active", !mostrarFotos);

        tabFotos.setAttribute("aria-selected", String(mostrarFotos));
        tabVideos.setAttribute("aria-selected", String(!mostrarFotos));

        // Pausa os vídeos ao sair da aba
        if (mostrarFotos) {
            videosPanel.querySelectorAll("video").forEach(video => {
                video.pause();
            });
        }
    }

    tabFotos.addEventListener("click", () => {
        mostrarGaleria("fotos");
    });

    tabVideos.addEventListener("click", () => {
        mostrarGaleria("videos");
    });

});


/* =====================================
   AVALIAÇÕES COM TURNSTILE + APROVAÇÃO
===================================== */
const reviewForm = document.getElementById("reviewForm");
const reviewStatus = document.getElementById("reviewStatus");
const approvedReviews = document.getElementById("approvedReviews");

function renderApprovedReviews(reviews) {
  if (!approvedReviews) return;
  approvedReviews.replaceChildren();

  if (!reviews.length) {
    const empty = document.createElement("p");
    empty.className = "reviews-loading";
    empty.textContent = "As primeiras avaliações aprovadas aparecerão aqui.";
    approvedReviews.appendChild(empty);
    return;
  }

  reviews.forEach((review) => {
    const card = document.createElement("article");
    card.className = "approved-review-card";
    const stars = document.createElement("div");
    stars.className = "approved-review-stars";
    stars.setAttribute("aria-label", `${review.rating} de 5 estrelas`);
    stars.textContent = "★".repeat(review.rating) + "☆".repeat(5 - review.rating);
    const message = document.createElement("p");
    message.textContent = review.message;
    const author = document.createElement("strong");
    author.textContent = review.name;
    card.append(stars, message, author);
    approvedReviews.appendChild(card);
  });
}

async function loadApprovedReviews() {
  if (!approvedReviews) return;
  try {
    const response = await fetch("/api/reviews", { headers: { "Accept": "application/json" } });
    if (!response.ok) throw new Error("Não foi possível carregar as avaliações.");
    const data = await response.json();
    renderApprovedReviews(Array.isArray(data.reviews) ? data.reviews : []);
  } catch (error) {
    approvedReviews.replaceChildren();
    const message = document.createElement("p");
    message.className = "reviews-loading";
    message.textContent = "As avaliações estarão disponíveis assim que o site estiver publicado.";
    approvedReviews.appendChild(message);
  }
}

if (reviewForm) {
  reviewForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!reviewStatus) return;

    const submitButton = reviewForm.querySelector('button[type="submit"]');
    const formData = new FormData(reviewForm);
    const token = formData.get("cf-turnstile-response");

    if (!token) {
      reviewStatus.textContent = "Confirme a verificação de segurança antes de enviar.";
      return;
    }

    const payload = {
      name: String(formData.get("name") || "").trim(),
      rating: Number(formData.get("rating")),
      message: String(formData.get("message") || "").trim(),
      token,
      website: String(formData.get("website") || "")
    };

    submitButton.disabled = true;
    reviewStatus.textContent = "Enviando sua avaliação...";

    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Não foi possível enviar. Tente novamente.");

      reviewForm.reset();
      if (window.turnstile) window.turnstile.reset();
      reviewStatus.textContent = "Avaliação recebida! Ela ficará aguardando sua aprovação antes de aparecer no site. Obrigado!";
    } catch (error) {
      reviewStatus.textContent = error.message || "Ocorreu um erro. Tente novamente.";
      if (window.turnstile) window.turnstile.reset();
    } finally {
      submitButton.disabled = false;
    }
  });
}

loadApprovedReviews();
