import { db } from "./firebase.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { onAuthAndRole } from "./auth-helpers.js";
import { showToast } from "./toast.js";
import { addToCart } from "./cart-store.js";
import { toggleWishlist } from "./wishlist-helpers.js";

const accessDenied = document.getElementById("accessDenied");
const wishlistPage = document.getElementById("wishlistPage");
const wishlistProductsEl = document.getElementById("wishlistProducts");

let currentUser = null;
let wishlistIds = [];

function productImageHtml(product) {
    const url = product.images && product.images[0];

    if (url) {
        return `<img class="product-img" src="${url}" alt="${product.name}">`;
    }

    return `<div class="no-image-placeholder">🧴</div>`;
}

async function renderWishlist() {

    wishlistProductsEl.innerHTML = "";

    if (wishlistIds.length === 0) {
        wishlistProductsEl.innerHTML = `
            <div class="empty-state">
                <span class="empty-state-title">Lista želja ti je prazna</span>
                <p><a href="shop.html">Pregledaj proizvode</a> i klikni na ♥ na onima koji ti se sviđaju.</p>
            </div>
        `;
        return;
    }

    for (const id of wishlistIds) {

        const snap = await getDoc(doc(db, "products", id));
        if (!snap.exists()) continue;

        const product = snap.data();

        const card = document.createElement("div");
        card.classList.add("card");

        card.addEventListener("click", () => {
            window.location.href = `product.html?id=${id}`;
        });

        card.innerHTML = `
            ${productImageHtml(product)}
            <h3>${product.name}</h3>
            <p class="price card-price">${product.price} €</p>
            <button class="add-to-cart">Dodaj u košaricu</button>
            <button type="button" class="wishlist-btn-inline active">♥ Ukloni s liste</button>
        `;

        card.querySelector(".add-to-cart").addEventListener("click", (e) => {
            e.stopPropagation();

            addToCart({
                id,
                name: product.name,
                price: product.price,
                image: (product.images && product.images[0]) || ""
            }, 1);

            showToast("Dodano u košaricu!", "success");
        });

        card.querySelector(".wishlist-btn-inline").addEventListener("click", async (e) => {
            e.stopPropagation();

            await toggleWishlist(currentUser.uid, id, true);
            wishlistIds = wishlistIds.filter((wid) => wid !== id);

            showToast("Uklonjeno iz liste želja.", "success");
            renderWishlist();
        });

        wishlistProductsEl.appendChild(card);
    }
}

onAuthAndRole(async (user) => {

    currentUser = user;

    if (!user) {
        accessDenied.style.display = "block";
        wishlistPage.style.display = "none";
        return;
    }

    accessDenied.style.display = "none";
    wishlistPage.style.display = "block";

    const snap = await getDoc(doc(db, "users", user.uid));
    wishlistIds = (snap.exists() && snap.data().wishlist) || [];

    await renderWishlist();
});
