import { db } from "./firebase.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { addToCart } from "./cart-store.js";
import { showToast } from "./toast.js";

const ROW_COUNT = 4;

const featuredContainer = document.getElementById("featuredProducts");
const topRatedContainer = document.getElementById("topRatedProducts");
const topRatedSection = document.getElementById("topRatedSection");

function productImageHtml(product) {
    const url = product.images && product.images[0];
    if (url) {
        return `<div class="product-img-wrap"><img class="product-img" src="${url}" alt="${product.name}"></div>`;
    }
    return `<div class="product-img-wrap"><div class="no-image-placeholder">🧴</div></div>`;
}

function ratingHtml(product) {
    const count = product.reviewCount || 0;
    const rounded = Math.round(product.avgRating || 0);
    const stars = "★".repeat(rounded) + "☆".repeat(5 - rounded);
    return `<p class="rating-summary">${stars} (${count})</p>`;
}

function renderProductRow(container, products) {

    container.innerHTML = "";

    products.forEach((product) => {

        const card = document.createElement("div");
        card.classList.add("card");

        card.addEventListener("click", () => {
            window.location.href = `product.html?id=${product.id}`;
        });

        card.innerHTML = `
            ${productImageHtml(product)}
            <h3>${product.name}</h3>
            <p class="price card-price">${product.price} €</p>
            ${ratingHtml(product)}
            <button class="add-to-cart">Dodaj u košaricu</button>
        `;

        card.querySelector(".add-to-cart").addEventListener("click", (e) => {
            e.stopPropagation();

            addToCart({
                id: product.id,
                name: product.name,
                price: product.price,
                image: (product.images && product.images[0]) || ""
            }, 1);

            showToast("Dodano u košaricu!", "success");
        });

        container.appendChild(card);
    });
}

async function loadHomepageProducts() {

    if (!featuredContainer) return;

    const snapshot = await getDocs(collection(db, "products"));
    const products = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));

    if (products.length === 0) return;

    // "Izdvojeno za tebe" - najnovije dodani proizvodi
    const newest = [...products]
        .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))
        .slice(0, ROW_COUNT);

    renderProductRow(featuredContainer, newest);

    // "Najbolje ocijenjeno" - samo proizvodi koji stvarno imaju recenzije
    const rated = products.filter((p) => (p.reviewCount || 0) > 0);

    if (rated.length === 0) {
        if (topRatedSection) topRatedSection.style.display = "none";
        return;
    }

    const topRated = [...rated]
        .sort((a, b) => (b.avgRating || 0) - (a.avgRating || 0))
        .slice(0, ROW_COUNT);

    renderProductRow(topRatedContainer, topRated);
}

loadHomepageProducts();
