import { getCart, removeFromCart, setQty, getTotal, clearCart } from "./cart-store.js";
import { db } from "./firebase.js";
import {
    collection,
    getDocs,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    addDoc,
    arrayUnion,
    increment,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { onAuthAndRole } from "./auth-helpers.js";
import { showToast } from "./toast.js";
import { FREE_SHIPPING_THRESHOLD, SHIPPING_FEE } from "./shipping.js";
import { POINTS_PER_EURO_SPENT, POINTS_PER_EURO_REDEEM } from "./points.js";

let currentUser = null;
let isAdminUser = false;
let appliedCode = null;
let appliedPercent = 0;
let userPoints = 0;
let pointsToRedeem = 0;

const cartContainer = document.getElementById("cartContainer");
const adminCodesSection = document.getElementById("adminCodesSection");
const adminCodesList = document.getElementById("adminCodesList");
const orderConfirmation = document.getElementById("orderConfirmation");
const orderConfirmationText = document.getElementById("orderConfirmationText");

// =====================
// CART RENDER
// =====================
function loadCart() {

    if (!cartContainer) return;

    const cart = getCart();

    cartContainer.innerHTML = "";

    if (cart.length === 0) {
        cartContainer.innerHTML = `
            <div class="empty-cart">
                <span class="empty-state-icon">🛒</span>
                <span class="empty-state-title">Tvoja košarica je prazna</span>
                <a href="shop.html">Pregledaj proizvode</a>
            </div>
        `;
        return;
    }

    cart.forEach((item) => {
        const div = document.createElement("div");
        div.classList.add("cart-item");

        const imageHtml = item.image
            ? `<img class="cart-item-img" src="${item.image}" alt="${item.name}">`
            : `<div class="cart-item-img no-image-placeholder">🧴</div>`;

        div.innerHTML = `
            <div class="cart-item-main">
                ${imageHtml}
                <div>
                    <h3>${item.name}</h3>
                    <p>${item.price.toFixed(2)} €</p>
                </div>
            </div>
            <div class="cart-item-controls">
                <input type="number" class="qty-input" min="1" value="${item.qty}">
                <button class="remove-btn">Ukloni</button>
            </div>
        `;

        div.querySelector(".qty-input").addEventListener("change", (e) => {
            setQty(item.id, parseInt(e.target.value) || 1);
            loadCart();
        });

        div.querySelector(".remove-btn").addEventListener("click", () => {
            removeFromCart(item.id);
            appliedCode = null;
            appliedPercent = 0;
            loadCart();
        });

        cartContainer.appendChild(div);
    });

    renderSummary();
}

function renderSummary() {

    const subtotal = getTotal();
    const discountAmount = subtotal * (appliedPercent / 100);
    const afterCode = subtotal - discountAmount;

    const maxRedeemable = Math.min(userPoints, Math.floor(afterCode * POINTS_PER_EURO_REDEEM));
    const redeemed = Math.min(pointsToRedeem, maxRedeemable);
    const pointsDiscount = redeemed / POINTS_PER_EURO_REDEEM;

    const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
    const total = afterCode - pointsDiscount + shipping;

    const summary = document.createElement("div");
    summary.classList.add("cart-summary");

    summary.innerHTML = `
        <p>Međuzbroj: ${subtotal.toFixed(2)} €</p>
        ${appliedCode ? `<p class="discount-line">Kod "${appliedCode}" primijenjen: -${discountAmount.toFixed(2)} € (${appliedPercent}%)</p>` : ""}
        ${redeemed > 0 ? `<p class="discount-line">Iskorišteno ${redeemed} bodova: -${pointsDiscount.toFixed(2)} €</p>` : ""}
        <p>Dostava: ${shipping === 0 ? "Besplatno" : shipping.toFixed(2) + " €"}</p>
        <h3>Ukupno: ${total.toFixed(2)} €</h3>

        <div class="promo-code-row">
            <input type="text" id="promoCodeInput" placeholder="Popust kod" value="${appliedCode || ""}">
            <button type="button" id="applyCodeBtn" class="secondary-btn">Primijeni</button>
        </div>
        <p id="promoMessage" class="promo-message"></p>

        ${currentUser && userPoints > 0 ? `
            <div class="points-row">
                <label for="pointsInput">Iskoristi bodove (imaš ${userPoints}, za ovu narudžbu max ${maxRedeemable}):</label>
                <div class="points-input-row">
                    <input type="number" id="pointsInput" min="0" max="${maxRedeemable}" value="${redeemed}">
                    <button type="button" id="useMaxPointsBtn" class="secondary-btn">Iskoristi sve</button>
                </div>
            </div>
        ` : ""}

        <button class="checkout-btn" id="placeOrderBtn">Naruči</button>
    `;

    cartContainer.appendChild(summary);

    document.getElementById("applyCodeBtn").addEventListener("click", applyPromoCode);
    document.getElementById("placeOrderBtn").addEventListener("click", placeOrder);

    const pointsInput = document.getElementById("pointsInput");
    if (pointsInput) {
        pointsInput.addEventListener("change", (e) => {
            const max = parseInt(e.target.max) || 0;
            const value = parseInt(e.target.value) || 0;
            pointsToRedeem = Math.min(Math.max(value, 0), max);
            loadCart();
        });
    }

    const useMaxPointsBtn = document.getElementById("useMaxPointsBtn");
    if (useMaxPointsBtn) {
        useMaxPointsBtn.addEventListener("click", () => {
            pointsToRedeem = maxRedeemable;
            loadCart();
        });
    }
}

// =====================
// PROMO CODE
// =====================
async function applyPromoCode() {

    const input = document.getElementById("promoCodeInput");
    const messageEl = document.getElementById("promoMessage");
    const code = input.value.trim().toUpperCase();

    messageEl.textContent = "";
    messageEl.className = "promo-message";

    if (!currentUser) {
        messageEl.textContent = "Prijavi se za korištenje popust koda.";
        messageEl.classList.add("error");
        return;
    }

    if (!code) {
        messageEl.textContent = "Prvo unesi kod.";
        messageEl.classList.add("error");
        return;
    }

    const codeSnap = await getDoc(doc(db, "discountCodes", code));

    if (!codeSnap.exists() || !codeSnap.data().active) {
        messageEl.textContent = "Ovaj kod ne postoji ili više nije aktivan.";
        messageEl.classList.add("error");
        return;
    }

    const codeData = codeSnap.data();

    if (codeData.expiresAt && codeData.expiresAt.toDate() < new Date()) {
        messageEl.textContent = "Ovom kodu je istekao rok trajanja.";
        messageEl.classList.add("error");
        return;
    }

    const userSnap = await getDoc(doc(db, "users", currentUser.uid));
    const usedCodes = (userSnap.exists() && userSnap.data().usedCodes) || [];

    if (usedCodes.includes(code)) {
        messageEl.textContent = "Ovaj kod si već iskoristio/la.";
        messageEl.classList.add("error");
        return;
    }

    appliedCode = code;
    appliedPercent = codeData.percent;

    loadCart();
    showToast(`Kod "${code}" primijenjen!`, "success");
}

// =====================
// PLACE ORDER
// =====================
async function placeOrder() {

    if (!currentUser) {
        showToast("Prijavi se za slanje narudžbe.", "error");
        return;
    }

    const cart = getCart();

    if (cart.length === 0) {
        showToast("Tvoja košarica je prazna.", "error");
        return;
    }

    const subtotal = getTotal();
    const discountAmount = subtotal * (appliedPercent / 100);
    const afterCode = subtotal - discountAmount;

    const maxRedeemable = Math.min(userPoints, Math.floor(afterCode * POINTS_PER_EURO_REDEEM));
    const redeemedPoints = Math.min(pointsToRedeem, maxRedeemable);
    const pointsDiscount = redeemedPoints / POINTS_PER_EURO_REDEEM;

    const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
    const total = afterCode - pointsDiscount + shipping;

    const pointsEarned = Math.floor((afterCode - pointsDiscount) * POINTS_PER_EURO_SPENT);

    await addDoc(collection(db, "orders"), {
        userId: currentUser.uid,
        items: cart.map((item) => ({
            productId: item.id,
            name: item.name,
            price: item.price,
            qty: item.qty,
            image: item.image || ""
        })),
        subtotal,
        discountCode: appliedCode,
        pointsRedeemed: redeemedPoints,
        pointsEarned,
        shipping,
        total,
        createdAt: serverTimestamp()
    });

    const userUpdate = { points: increment(pointsEarned - redeemedPoints) };
    if (appliedCode) userUpdate.usedCodes = arrayUnion(appliedCode);

    await updateDoc(doc(db, "users", currentUser.uid), userUpdate);

    clearCart();
    appliedCode = null;
    appliedPercent = 0;
    pointsToRedeem = 0;
    userPoints += pointsEarned - redeemedPoints;

    cartContainer.style.display = "none";
    orderConfirmationText.textContent = `Ukupno plaćeno: ${total.toFixed(2)} €. Osvojio/la si ${pointsEarned} bodova. Hvala na kupnji kod Vellure!`;
    orderConfirmation.style.display = "block";
}

// =====================
// AUTH
// =====================
onAuthAndRole(async (user, role, isAdmin) => {
    currentUser = user;
    isAdminUser = isAdmin;
    adminCodesSection.style.display = isAdminUser ? "block" : "none";

    if (user) {
        const snap = await getDoc(doc(db, "users", user.uid));
        userPoints = (snap.exists() && snap.data().points) || 0;
    }

    loadCart();
    if (isAdminUser) loadAdminCodes();
});

// =====================
// ADMIN: DISCOUNT CODES
// =====================
async function loadAdminCodes() {

    adminCodesList.innerHTML = "";

    const snapshot = await getDocs(collection(db, "discountCodes"));

    snapshot.forEach((codeSnap) => {

        const code = codeSnap.id;
        const data = codeSnap.data();
        const expiryText = data.expiresAt ? data.expiresAt.toDate().toLocaleDateString() : "bez roka";
        const isExpired = data.expiresAt && data.expiresAt.toDate() < new Date();

        let statusText = "Neaktivan";
        if (data.active) statusText = isExpired ? "Istekao" : "Aktivan";

        const item = document.createElement("div");
        item.classList.add("admin-code-item");

        item.innerHTML = `
            <div class="admin-code-info">
                ${code} — ${data.percent}% popusta
                <div class="admin-code-meta">Ističe ${expiryText} · ${statusText}</div>
            </div>
            <div class="admin-code-actions"></div>
        `;

        const toggleBtn = document.createElement("button");
        toggleBtn.type = "button";
        toggleBtn.className = "secondary-btn";
        toggleBtn.textContent = data.active ? "Deaktiviraj" : "Aktiviraj";
        toggleBtn.addEventListener("click", async () => {
            await updateDoc(doc(db, "discountCodes", code), { active: !data.active });
            loadAdminCodes();
        });

        const deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.className = "remove-btn";
        deleteBtn.textContent = "Izbriši";
        deleteBtn.addEventListener("click", async () => {
            await deleteDoc(doc(db, "discountCodes", code));
            showToast("Kod izbrisan.", "success");
            loadAdminCodes();
        });

        item.querySelector(".admin-code-actions").appendChild(toggleBtn);
        item.querySelector(".admin-code-actions").appendChild(deleteBtn);

        adminCodesList.appendChild(item);
    });
}

document.getElementById("addCodeBtn").addEventListener("click", async () => {

    const code = document.getElementById("newCodeText").value.trim().toUpperCase();
    const percent = parseFloat(document.getElementById("newCodePercent").value);
    const expiryValue = document.getElementById("newCodeExpiry").value;

    if (!code || !percent || !expiryValue) {
        showToast("Unesi kod, postotak i datum isteka.", "error");
        return;
    }

    await setDoc(doc(db, "discountCodes", code), {
        percent,
        expiresAt: new Date(expiryValue),
        active: true,
        createdAt: serverTimestamp()
    });

    document.getElementById("newCodeText").value = "";
    document.getElementById("newCodePercent").value = "";
    document.getElementById("newCodeExpiry").value = "";

    showToast("Popust kod dodan!", "success");
    loadAdminCodes();
});
