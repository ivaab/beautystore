import { db } from "./firebase.js";
import {
    collection,
    getDocs,
    addDoc,
    deleteDoc,
    doc,
    getDoc,
    updateDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

import { onAuthAndRole } from "./auth-helpers.js";
import { addToCart } from "./cart-store.js";
import { showToast } from "./toast.js";
import { toggleWishlist } from "./wishlist-helpers.js";

let allProducts = [];
let currentUser = null;
let userWishlist = [];
let isAdminUser = false;
let activeFilter = "all";
let sortMode = "default";
let searchTerm = "";
let editingId = null;

const container = document.getElementById("productsContainer");
const noResults = document.getElementById("noResults");
const resultsCount = document.getElementById("resultsCount");
const addBtn = document.getElementById("openAddModal");

const NEW_BADGE_DAYS = 14;

const SKIN_TYPE_LABELS = { dry: "suha", oily: "masna", combination: "kombinirana", sensitive: "osjetljiva" };

function isNewProduct(product) {
    if (!product.createdAt || !product.createdAt.toDate) return false;
    const ageDays = (Date.now() - product.createdAt.toDate().getTime()) / (1000 * 60 * 60 * 24);
    return ageDays <= NEW_BADGE_DAYS;
}

function wishlistBtnHtml(product) {
    if (!currentUser) return "";
    const active = userWishlist.includes(product.id) ? "active" : "";
    return `<button type="button" class="wishlist-btn ${active}" data-id="${product.id}">♥</button>`;
}

function productImageHtml(product) {
    const url = product.images && product.images[0];
    const badge = isNewProduct(product) ? `<span class="product-badge">Novo</span>` : "";

    if (url) {
        return `<div class="product-img-wrap">${badge}${wishlistBtnHtml(product)}<img class="product-img" src="${url}" alt="${product.name}"></div>`;
    }

    return `<div class="product-img-wrap">${badge}${wishlistBtnHtml(product)}<div class="no-image-placeholder">🧴</div></div>`;
}

function ratingHtml(product) {
    const count = product.reviewCount || 0;
    const rounded = Math.round(product.avgRating || 0);
    const stars = "★".repeat(rounded) + "☆".repeat(5 - rounded);
    return `<p class="rating-summary">${stars} (${count})</p>`;
}

function renderProducts() {

    const searchWords = searchTerm.split(/\s+/).filter(Boolean);

    let filtered = allProducts.filter((product) => {
        const matchesFilter = activeFilter === "all" ||
            (product.skinType || "").toLowerCase() === activeFilter;

        const haystack = `${product.name || ""} ${product.description || ""}`.toLowerCase();
        const matchesSearch = searchWords.length === 0 ||
            searchWords.every((word) => haystack.includes(word));

        return matchesFilter && matchesSearch;
    });

    if (sortMode === "price-asc") {
        filtered = [...filtered].sort((a, b) => a.price - b.price);
    } else if (sortMode === "price-desc") {
        filtered = [...filtered].sort((a, b) => b.price - a.price);
    }

    container.innerHTML = "";
    noResults.style.display = filtered.length === 0 ? "block" : "none";

    resultsCount.textContent = filtered.length === 0
        ? ""
        : `${filtered.length} ${filtered.length === 1 ? "proizvod" : "proizvoda"}`;

    filtered.forEach((product) => {

        const card = document.createElement("div");
        card.classList.add("card");

        card.addEventListener("click", () => {
            window.location.href = `product.html?id=${product.id}`;
        });

        card.innerHTML = `
            ${productImageHtml(product)}
            <h3>${product.name}</h3>
            <p class="card-skintype">${SKIN_TYPE_LABELS[product.skinType] || product.skinType || ""}</p>
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

        const wishlistBtn = card.querySelector(".wishlist-btn");
        if (wishlistBtn) {
            wishlistBtn.addEventListener("click", async (e) => {
                e.stopPropagation();

                const wasSaved = userWishlist.includes(product.id);
                const nowSaved = await toggleWishlist(currentUser.uid, product.id, wasSaved);

                if (nowSaved) {
                    userWishlist.push(product.id);
                    showToast("Dodano u listu želja.", "success");
                } else {
                    userWishlist = userWishlist.filter((id) => id !== product.id);
                    showToast("Uklonjeno iz liste želja.", "success");
                }

                wishlistBtn.classList.toggle("active", nowSaved);
            });
        }

        if (isAdminUser) {

            const editBtn = document.createElement("button");
            editBtn.textContent = "Uredi";

            editBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                openEditModal(product);
            });

            const deleteBtn = document.createElement("button");
            deleteBtn.textContent = "Izbriši";

            deleteBtn.addEventListener("click", async (e) => {
                e.stopPropagation();
                await deleteDoc(doc(db, "products", product.id));
                showToast("Proizvod izbrisan.", "success");
                allProducts = allProducts.filter((p) => p.id !== product.id);
                renderProducts();
            });

            card.appendChild(editBtn);
            card.appendChild(deleteBtn);
        }

        container.appendChild(card);
    });
}

function renderSkeleton() {
    container.innerHTML = Array.from({ length: 6 }).map(() => `
        <div class="card skeleton-card">
            <div class="skeleton-img skeleton-shine"></div>
            <div class="skeleton-line skeleton-shine"></div>
            <div class="skeleton-line short skeleton-shine"></div>
        </div>
    `).join("");
}

async function loadProducts() {
    renderSkeleton();

    const snapshot = await getDocs(collection(db, "products"));

    allProducts = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
    }));

    renderProducts();
}

// =====================
// AUTH
// =====================
onAuthAndRole(async (user, role, isAdmin) => {
    currentUser = user;
    isAdminUser = isAdmin;
    addBtn.style.display = isAdminUser ? "block" : "none";

    if (user) {
        const snap = await getDoc(doc(db, "users", user.uid));
        userWishlist = (snap.exists() && snap.data().wishlist) || [];
    }

    await loadProducts();
});

// =====================
// FILTERS
// =====================
document.querySelectorAll(".filter").forEach((btn) => {
    btn.addEventListener("click", () => {

        const group = btn.closest(".filters");
        group.querySelectorAll(".filter").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");

        activeFilter = btn.dataset.skin;

        renderProducts();
    });
});

// =====================
// SORT
// =====================
document.getElementById("sortSelect").addEventListener("change", (e) => {
    sortMode = e.target.value;
    renderProducts();
});

// =====================
// SEARCH (navbar, vidi js/nav.js)
// =====================
searchTerm = (new URLSearchParams(window.location.search).get("q") || "").trim().toLowerCase();

window.addEventListener("navsearch", (e) => {
    searchTerm = e.detail.toLowerCase();
    renderProducts();
});

// =====================
// MODAL (ADD + EDIT)
// =====================
const modal = document.getElementById("addModal");
const modalTitle = document.getElementById("modalTitle");
const closeBtn = document.getElementById("closeModal");
const nameInput = document.getElementById("name");
const priceInput = document.getElementById("price");
const imageUrlInput = document.getElementById("imageUrl");
const imagePreview = document.getElementById("imagePreview");
const skinTypeInput = document.getElementById("skinType");
const descriptionInput = document.getElementById("description");

function updateImagePreview() {
    const url = imageUrlInput.value.trim();

    if (url) {
        imagePreview.src = url;
        imagePreview.style.display = "block";
    } else {
        imagePreview.style.display = "none";
    }
}

imageUrlInput.addEventListener("input", updateImagePreview);

function openAddModal() {
    editingId = null;
    modalTitle.textContent = "Dodaj proizvod";
    nameInput.value = "";
    priceInput.value = "";
    imageUrlInput.value = "";
    skinTypeInput.value = "";
    descriptionInput.value = "";
    updateImagePreview();
    modal.style.display = "flex";
}

function openEditModal(product) {
    editingId = product.id;
    modalTitle.textContent = "Uredi proizvod";
    nameInput.value = product.name || "";
    priceInput.value = product.price || "";
    imageUrlInput.value = (product.images && product.images[0]) || "";
    skinTypeInput.value = product.skinType || "";
    descriptionInput.value = product.description || "";
    updateImagePreview();
    modal.style.display = "flex";
}

addBtn.addEventListener("click", openAddModal);

closeBtn.addEventListener("click", () => {
    modal.style.display = "none";
});

modal.addEventListener("click", (e) => {
    if (e.target === modal) {
        modal.style.display = "none";
    }
});

document.getElementById("addProductBtn").addEventListener("click", async () => {

    const name = nameInput.value.trim();
    const price = parseFloat(priceInput.value);
    const imageUrl = imageUrlInput.value.trim();
    const skinType = skinTypeInput.value;
    const description = descriptionInput.value.trim();

    if (!name || !price || !skinType || !description) {
        showToast("Ispuni sva polja.", "error");
        return;
    }

    const images = imageUrl ? [imageUrl] : [];

    if (editingId) {

        await updateDoc(doc(db, "products", editingId), {
            name,
            price,
            images,
            skinType,
            description
        });

        const index = allProducts.findIndex((p) => p.id === editingId);
        if (index !== -1) {
            allProducts[index] = { ...allProducts[index], name, price, images, skinType, description };
        }

        showToast("Proizvod ažuriran!", "success");

    } else {

        const docRef = await addDoc(collection(db, "products"), {
            name,
            price,
            images,
            skinType,
            description,
            createdAt: serverTimestamp()
        });

        allProducts.push({ id: docRef.id, name, price, images, skinType, description, createdAt: { toDate: () => new Date() } });

        showToast("Proizvod dodan!", "success");
    }

    modal.style.display = "none";
    renderProducts();
});
