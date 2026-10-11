import { db } from "./firebase.js";
import {
    doc,
    getDoc,
    updateDoc,
    collection,
    query,
    where,
    getDocs
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { onAuthAndRole } from "./auth-helpers.js";
import { showToast } from "./toast.js";
import { addProductToRoutine } from "./routine-helpers.js";

const SKIN_LABELS = { dry: "Suha", oily: "Masna", combination: "Kombinirana", sensitive: "Osjetljiva" };

let currentUser = null;
let currentSkinType = null;
let routine = { morning: [], evening: [] };

const accessDenied = document.getElementById("accessDenied");
const routineContent = document.getElementById("routineContent");
const profileSkinTypeEl = document.getElementById("profileSkinType");
const morningProductsEl = document.getElementById("morningProducts");
const eveningProductsEl = document.getElementById("eveningProducts");
const showSkinTypeProductsBtn = document.getElementById("showSkinTypeProductsBtn");
const skinTypeProductsModal = document.getElementById("skinTypeProductsModal");
const closeSkinTypeModal = document.getElementById("closeSkinTypeModal");
const skinTypeProductsList = document.getElementById("skinTypeProductsList");

function productImageHtml(product) {
    const url = product.images && product.images[0];

    if (url) {
        return `<img class="product-img" src="${url}" alt="${product.name}">`;
    }

    return `<div class="no-image-placeholder">🧴</div>`;
}

async function renderSlot(slot, ids, container) {

    container.innerHTML = "";

    if (ids.length === 0) {
        container.innerHTML = `<p class="empty-state">Niste odabrali proizvod.</p>`;
        return;
    }

    for (const id of ids) {

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
            <button class="remove-from-routine">Ukloni</button>
        `;

        card.querySelector(".remove-from-routine").addEventListener("click", async (e) => {
            e.stopPropagation();

            routine[slot] = routine[slot].filter((pid) => pid !== id);

            await updateDoc(doc(db, "users", currentUser.uid), { routine });

            showToast("Uklonjeno iz rutine.", "success");
            renderRoutine();
        });

        container.appendChild(card);
    }
}

async function renderRoutine() {

    const morning = routine.morning || [];
    const evening = routine.evening || [];

    await renderSlot("morning", morning, morningProductsEl);
    await renderSlot("evening", evening, eveningProductsEl);
}

async function loadSkinTypeProducts() {

    skinTypeProductsList.innerHTML = "";

    const productsQuery = query(collection(db, "products"), where("skinType", "==", currentSkinType));
    const snapshot = await getDocs(productsQuery);
    const products = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));

    if (products.length === 0) {
        skinTypeProductsList.innerHTML = `<p class="empty-state">Trenutno nema proizvoda za tvoj tip kože.</p>`;
        return;
    }

    products.forEach((product) => {

        const card = document.createElement("div");
        card.classList.add("card");

        card.innerHTML = `
            ${productImageHtml(product)}
            <h3>${product.name}</h3>
            <p class="price card-price">${product.price} €</p>
            <div class="routine-actions">
                <button type="button" class="routine-btn" data-slot="morning">☀️ Jutro</button>
                <button type="button" class="routine-btn" data-slot="evening">🌙 Večer</button>
            </div>
        `;

        card.querySelectorAll(".routine-btn").forEach((btn) => {
            btn.addEventListener("click", async () => {

                const slot = btn.dataset.slot;
                const label = slot === "morning" ? "Jutro" : "Večer";

                card.querySelectorAll(".routine-btn").forEach((b) => {
                    b.classList.remove("active");
                    b.textContent = b.dataset.slot === "morning" ? "☀️ Jutro" : "🌙 Večer";
                });

                btn.classList.add("active");
                btn.textContent = `✓ ${label}`;

                await addProductToRoutine(currentUser.uid, product.id, slot);

                const snap = await getDoc(doc(db, "users", currentUser.uid));
                routine = (snap.exists() && snap.data().routine) || { morning: [], evening: [] };

                showToast(`Dodano u tvoju ${slot === "morning" ? "jutarnju" : "večernju"} rutinu.`, "success");
                renderRoutine();
            });
        });

        skinTypeProductsList.appendChild(card);
    });
}

showSkinTypeProductsBtn.addEventListener("click", async () => {
    skinTypeProductsModal.style.display = "flex";
    await loadSkinTypeProducts();
});

closeSkinTypeModal.addEventListener("click", () => {
    skinTypeProductsModal.style.display = "none";
});

skinTypeProductsModal.addEventListener("click", (e) => {
    if (e.target === skinTypeProductsModal) {
        skinTypeProductsModal.style.display = "none";
    }
});

onAuthAndRole(async (user) => {

    currentUser = user;

    if (!user) {
        accessDenied.style.display = "block";
        routineContent.style.display = "none";
        return;
    }

    accessDenied.style.display = "none";
    routineContent.style.display = "block";

    const snap = await getDoc(doc(db, "users", user.uid));
    const userData = snap.exists() ? snap.data() : {};
    routine = userData.routine || { morning: [], evening: [] };

    currentSkinType = userData.skinType || null;

    profileSkinTypeEl.textContent = currentSkinType
        ? `Moj tip kože: ${SKIN_LABELS[currentSkinType] || currentSkinType}`
        : "Još nisi riješio/la kviz za tip kože.";

    showSkinTypeProductsBtn.style.display = currentSkinType ? "inline-block" : "none";

    renderRoutine();
});
