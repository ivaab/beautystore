// Elegantno "fade + slide up" pojavljivanje kartica/naslova dok skrolaš.
// Sav dinamički sadržaj (shop kartice, recenzije...) se dodaje kasnije preko
// innerHTML nakon Firestore odgovora, pa MutationObserver hvata i to,
// ne samo ono što je već u HTML-u pri učitavanju.

const REVEAL_TARGETS = ".card, .section-title, .review-item";

const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
        if (entry.isIntersecting) {
            entry.target.classList.add("reveal-visible");
            observer.unobserve(entry.target);
        }
    });
}, { threshold: 0.1 });

function refreshScrollReveal() {
    document.querySelectorAll(REVEAL_TARGETS).forEach((el) => {
        if (!el.classList.contains("reveal")) {
            el.classList.add("reveal");
            observer.observe(el);
        }
    });
}

refreshScrollReveal();

const mutationObserver = new MutationObserver(() => refreshScrollReveal());
mutationObserver.observe(document.body, { childList: true, subtree: true });
