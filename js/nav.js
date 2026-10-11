import { auth } from "./firebase.js";
import { signOut } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { onAuthAndRole } from "./auth-helpers.js";
import { showToast } from "./toast.js";
import { clearCart, initCartSync } from "./cart-store.js";

const loginLink = document.getElementById("loginLink");
const logoutBtn = document.getElementById("logoutBtn");
const usersLink = document.getElementById("usersLink");
const profileLink = document.getElementById("profileLink");
const signupPromo = document.getElementById("signupPromo");
const heroDiagonalImage = document.getElementById("heroDiagonalImage");
const heroPhoto = document.getElementById("heroPhoto");
const featuredSection = document.getElementById("featuredSection");

onAuthAndRole(async (user, role, isAdminUser) => {

    if (loginLink) loginLink.style.display = user ? "none" : "inline";
    if (logoutBtn) logoutBtn.style.display = user ? "inline" : "none";
    if (usersLink) usersLink.style.display = isAdminUser ? "inline" : "none";
    if (profileLink) profileLink.style.display = user ? "inline" : "none";
    if (signupPromo) signupPromo.style.display = user ? "none" : "flex";
    if (heroDiagonalImage) heroDiagonalImage.style.display = user ? "block" : "none";
    if (heroPhoto) heroPhoto.style.display = user ? "block" : "none";
    if (featuredSection) featuredSection.style.display = user ? "block" : "none";

    initCartSync(user ? user.uid : null);
});

if (logoutBtn) {
    logoutBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        await signOut(auth);
        clearCart();
        showToast("Odjavljeni ste!", "success");
        setTimeout(() => {
            window.location.href = "index.html";
        }, 600);
    });
}

// =====================
// MOBILE HAMBURGER
// =====================
const navHamburger = document.getElementById("navHamburger");
const navbarEl = document.querySelector(".navbar");

if (navHamburger && navbarEl) {
    navHamburger.addEventListener("click", () => {
        navbarEl.classList.toggle("nav-open");
    });
}

// =====================
// NAVBAR SEARCH
// =====================
const navSearchForm = document.getElementById("navSearchForm");
const navSearchInput = document.getElementById("navSearchInput");
const onShopPage = window.location.pathname.endsWith("shop.html");

if (navSearchForm && navSearchInput) {

    // ako smo stigli na shop preko ?q=, prefill polje
    const existingQuery = new URLSearchParams(window.location.search).get("q");
    if (existingQuery) navSearchInput.value = existingQuery;

    navSearchForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const term = navSearchInput.value.trim();

        if (onShopPage) {
            window.dispatchEvent(new CustomEvent("navsearch", { detail: term }));
        } else {
            window.location.href = `shop.html?q=${encodeURIComponent(term)}`;
        }
    });

    // dok si na shopu, filtrira uživo bez čekanja na Enter
    if (onShopPage) {
        navSearchInput.addEventListener("input", () => {
            window.dispatchEvent(new CustomEvent("navsearch", { detail: navSearchInput.value.trim() }));
        });
    }
}
