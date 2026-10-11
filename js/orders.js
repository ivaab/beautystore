import { db } from "./firebase.js";
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { onAuthAndRole } from "./auth-helpers.js";

const accessDenied = document.getElementById("accessDenied");
const ordersPage = document.getElementById("ordersPage");
const ordersListEl = document.getElementById("ordersList");

function formatDate(timestamp) {
    if (!timestamp || !timestamp.toDate) return "";
    return timestamp.toDate().toLocaleDateString("hr-HR", {
        day: "2-digit", month: "2-digit", year: "numeric"
    });
}

function thumbHtml(item) {
    if (item.image) {
        return `<img class="order-thumb" src="${item.image}" alt="${item.name}" title="${item.name} x${item.qty}">`;
    }
    return `<div class="order-thumb order-thumb-placeholder" title="${item.name} x${item.qty}">🧴</div>`;
}

async function loadOrders(uid) {

    const ordersQuery = query(collection(db, "orders"), where("userId", "==", uid));
    const snapshot = await getDocs(ordersQuery);

    const orders = snapshot.docs
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
        .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));

    ordersListEl.innerHTML = "";

    if (orders.length === 0) {
        ordersListEl.innerHTML = `
            <div class="empty-state">
                <span class="empty-state-icon">📦</span>
                <span class="empty-state-title">Još nemaš nijednu narudžbu</span>
                <p><a href="shop.html">Pregledaj proizvode</a> i naruči nešto lijepo za sebe.</p>
            </div>
        `;
        return;
    }

    orders.forEach((order) => {

        const totalItems = order.items.reduce((sum, i) => sum + i.qty, 0);

        const card = document.createElement("div");
        card.classList.add("order-card");

        card.innerHTML = `
            <div class="order-card-header">
                <div>
                    <span class="order-status-pill">Dovršeno</span>
                    <div class="order-date">${formatDate(order.createdAt)} · ${totalItems} ${totalItems === 1 ? "proizvod" : "proizvoda"}</div>
                </div>
                <div class="order-total">${(order.total || 0).toFixed(2)} €</div>
            </div>

            <div class="order-thumbs">
                ${order.items.map(thumbHtml).join("")}
            </div>

            <button type="button" class="order-toggle-btn">Prikaži detalje narudžbe ▾</button>

            <div class="order-details" style="display:none;">
                <table class="admin-table order-items-table">
                    <thead><tr><th>Proizvod</th><th>Kol.</th><th>Cijena</th></tr></thead>
                    <tbody>
                        ${order.items.map((i) => `<tr><td>${i.name}</td><td>x${i.qty}</td><td>${(i.price * i.qty).toFixed(2)} €</td></tr>`).join("")}
                    </tbody>
                </table>
                <p>Međuzbroj: ${(order.subtotal || 0).toFixed(2)} €</p>
                ${order.discountCode ? `<p>Popust kod: <b>${order.discountCode}</b></p>` : ""}
                ${order.pointsRedeemed ? `<p>Iskorišteno bodova: ${order.pointsRedeemed}</p>` : ""}
                <p>Dostava: ${order.shipping === 0 ? "Besplatno" : `${(order.shipping || 0).toFixed(2)} €`}</p>
                ${order.pointsEarned ? `<p>Osvojeno bodova: +${order.pointsEarned}</p>` : ""}
                <p class="order-details-total">Ukupno plaćeno: ${(order.total || 0).toFixed(2)} €</p>
            </div>
        `;

        const toggleBtn = card.querySelector(".order-toggle-btn");
        const details = card.querySelector(".order-details");

        toggleBtn.addEventListener("click", () => {
            const isHidden = details.style.display === "none";
            details.style.display = isHidden ? "block" : "none";
            toggleBtn.textContent = isHidden ? "Sakrij detalje narudžbe ▴" : "Prikaži detalje narudžbe ▾";
        });

        ordersListEl.appendChild(card);
    });
}

onAuthAndRole(async (user) => {

    if (!user) {
        accessDenied.style.display = "block";
        ordersPage.style.display = "none";
        return;
    }

    accessDenied.style.display = "none";
    ordersPage.style.display = "block";

    await loadOrders(user.uid);
});
