import { db } from "./firebase.js";
import {
    doc,
    getDoc,
    updateDoc,
    setDoc,
    collection,
    getDocs
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { addToCart } from "./cart-store.js";
import { showToast } from "./toast.js";
import { onAuthAndRole } from "./auth-helpers.js";
import { addProductToRoutine } from "./routine-helpers.js";
import { toggleWishlist } from "./wishlist-helpers.js";

const SKIN_TYPE_LABELS = { dry: "suha", oily: "masna", combination: "kombinirana", sensitive: "osjetljiva" };

function renderStars(rating) {
    const rounded = Math.round(rating);
    return "★".repeat(rounded) + "☆".repeat(5 - rounded);
}

document.addEventListener("DOMContentLoaded", async () => {

    const container = document.getElementById("productContainer");

    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");

    if (!id) {
        container.innerHTML = "Proizvod nije pronađen";
        return;
    }

    container.innerHTML = `
        <div class="skeleton-product-detail">
            <div class="skeleton-img skeleton-shine"></div>
            <div class="skeleton-detail-lines">
                <div class="skeleton-line skeleton-shine" style="width:50%;"></div>
                <div class="skeleton-line skeleton-shine" style="width:25%;"></div>
                <div class="skeleton-line skeleton-shine"></div>
                <div class="skeleton-line skeleton-shine" style="width:80%;"></div>
                <div class="skeleton-line skeleton-shine" style="width:40%;"></div>
            </div>
        </div>
    `;

    const productRef = doc(db, "products", id);
    const productSnap = await getDoc(productRef);

    if (!productSnap.exists()) {
        container.innerHTML = "Proizvod nije pronađen";
        return;
    }

    const product = productSnap.data();

    const imageUrl = product.images && product.images[0];
    const imageHtml = imageUrl
        ? `<img src="${imageUrl}" alt="${product.name}">`
        : `<div class="no-image-placeholder">🧴</div>`;

    const avgRating = product.avgRating || 0;
    const reviewCount = product.reviewCount || 0;
    const ratingHtml = reviewCount > 0
        ? `<p class="rating-summary">${renderStars(avgRating)} ${avgRating.toFixed(1)} (${reviewCount} ${reviewCount === 1 ? "recenzija" : "recenzije"})</p>`
        : `<p class="rating-summary rating-summary-empty">Još nema recenzija</p>`;

    // render UI
    container.innerHTML = `
        <div class="product-container">

            <div class="product-image">
                ${imageHtml}
            </div>

            <div class="product-details">

                <h2>${product.name}</h2>

                <p class="price">${product.price} €</p>

                ${ratingHtml}

                <p>${product.description}</p>

                <p><b>Tip kože:</b> ${SKIN_TYPE_LABELS[product.skinType] || product.skinType}</p>

                <div class="qty-selector">
                    <button type="button" id="qtyMinus">−</button>
                    <input type="number" id="qtyInput" min="1" value="1">
                    <button type="button" id="qtyPlus">+</button>
                </div>

                <div class="product-actions-row">
                    <button id="addToCartBtn">Dodaj u košaricu</button>
                    <button type="button" id="wishlistBtn" class="wishlist-btn-inline" style="display:none;">♥ Dodaj u listu želja</button>
                </div>

                <div id="routineQuickAdd" class="routine-quick-add" style="display:none;">
                    <p>Želiš li dodati proizvod u svoju rutinu?</p>
                    <div class="routine-actions">
                        <button type="button" class="routine-btn" data-slot="morning">☀️ Jutro</button>
                        <button type="button" class="routine-btn" data-slot="evening">🌙 Večer</button>
                    </div>
                    <button type="button" id="confirmRoutineBtn" class="secondary-btn">Dodaj</button>
                </div>

            </div>

        </div>

        <div class="reviews-section">
            <h3>Recenzije</h3>
            <div id="reviewsList"></div>
            <div id="reviewFormWrapper"></div>
        </div>
    `;

    document.getElementById("qtyMinus").addEventListener("click", () => {
        const qtyInput = document.getElementById("qtyInput");
        qtyInput.value = Math.max(1, parseInt(qtyInput.value) - 1);
    });

    document.getElementById("qtyPlus").addEventListener("click", () => {
        const qtyInput = document.getElementById("qtyInput");
        qtyInput.value = parseInt(qtyInput.value) + 1;
    });

    document.getElementById("addToCartBtn").addEventListener("click", () => {

        const qty = parseInt(document.getElementById("qtyInput").value) || 1;

        addToCart({
            id,
            name: product.name,
            price: product.price,
            image: (product.images && product.images[0]) || ""
        }, qty);

        showToast("Dodano u košaricu!", "success");
    });

    // =====================
    // REVIEWS
    // =====================
    const reviewsListEl = document.getElementById("reviewsList");
    const reviewFormWrapper = document.getElementById("reviewFormWrapper");

    async function loadReviews() {

        const snapshot = await getDocs(collection(db, "products", id, "reviews"));
        const reviews = snapshot.docs.map((s) => ({ id: s.id, ...s.data() }));

        reviewsListEl.innerHTML = reviews.length === 0
            ? `<p class="empty-state">Još nema recenzija — budi prvi!</p>`
            : "";

        reviews.forEach((review) => {
            const div = document.createElement("div");
            div.classList.add("review-item");
            div.innerHTML = `
                <div class="review-stars">${renderStars(review.rating)}</div>
                <div class="review-author">${review.userName}</div>
                <p class="review-comment">${review.comment}</p>
            `;
            reviewsListEl.appendChild(div);
        });

        return reviews;
    }

    async function recalcRating() {

        const snapshot = await getDocs(collection(db, "products", id, "reviews"));
        const reviews = snapshot.docs.map((s) => s.data());

        const count = reviews.length;
        const avg = count === 0 ? 0 : reviews.reduce((sum, r) => sum + r.rating, 0) / count;

        await updateDoc(productRef, { avgRating: avg, reviewCount: count });

        const summaryEl = document.querySelector(".rating-summary");
        if (summaryEl) {
            summaryEl.classList.remove("rating-summary-empty");
            summaryEl.textContent = count > 0
                ? `${renderStars(avg)} ${avg.toFixed(1)} (${count} ${count === 1 ? "recenzija" : "recenzije"})`
                : "Još nema recenzija";
        }
    }

    function renderReviewForm(user, existingReview) {

        if (!user) {
            reviewFormWrapper.innerHTML = `<p class="empty-state">Za pisanje recenzije se <a href="login.html">prijavi</a>.</p>`;
            return;
        }

        let selectedRating = existingReview ? existingReview.rating : 0;

        reviewFormWrapper.innerHTML = `
            <div class="review-form">
                <h4>${existingReview ? "Uredi svoju recenziju" : "Napiši recenziju"}</h4>
                <div class="star-input" id="starInput">
                    ${[1, 2, 3, 4, 5].map((n) => `<span data-value="${n}">★</span>`).join("")}
                </div>
                <textarea id="reviewComment" placeholder="Podijeli svoje mišljenje...">${existingReview ? existingReview.comment : ""}</textarea>
                <button id="submitReviewBtn" class="secondary-btn">${existingReview ? "Ažuriraj recenziju" : "Objavi recenziju"}</button>
            </div>
        `;

        const starEls = reviewFormWrapper.querySelectorAll(".star-input span");

        function paintStars(value) {
            starEls.forEach((s) => {
                s.classList.toggle("filled", parseInt(s.dataset.value) <= value);
            });
        }

        paintStars(selectedRating);

        starEls.forEach((s) => {
            s.addEventListener("click", () => {
                selectedRating = parseInt(s.dataset.value);
                paintStars(selectedRating);
            });
        });

        document.getElementById("submitReviewBtn").addEventListener("click", async () => {

            const comment = document.getElementById("reviewComment").value.trim();

            if (selectedRating === 0) {
                showToast("Odaberi ocjenu.", "error");
                return;
            }

            if (!comment) {
                showToast("Napiši kratak komentar.", "error");
                return;
            }

            const userSnap = await getDoc(doc(db, "users", user.uid));
            const userName = (userSnap.exists() && userSnap.data().fullName) || user.email.split("@")[0];

            await setDoc(doc(db, "products", id, "reviews", user.uid), {
                userName,
                rating: selectedRating,
                comment,
                createdAt: new Date()
            });

            showToast(existingReview ? "Recenzija ažurirana!" : "Recenzija poslana!", "success");

            const reviews = await loadReviews();
            await recalcRating();

            const myReview = reviews.find((r) => r.id === user.uid);
            renderReviewForm(user, myReview);
        });
    }

    const reviews = await loadReviews();

    const routineQuickAdd = document.getElementById("routineQuickAdd");
    const wishlistBtn = document.getElementById("wishlistBtn");

    onAuthAndRole(async (user) => {

        const myReview = user ? reviews.find((r) => r.id === user.uid) : null;
        renderReviewForm(user, myReview);

        routineQuickAdd.style.display = user ? "block" : "none";
        wishlistBtn.style.display = user ? "inline-block" : "none";

        if (user) {

            const userSnap = await getDoc(doc(db, "users", user.uid));
            let isSaved = ((userSnap.exists() && userSnap.data().wishlist) || []).includes(id);

            function paintWishlistBtn() {
                wishlistBtn.classList.toggle("active", isSaved);
                wishlistBtn.textContent = isSaved ? "♥ U listi želja" : "♥ Dodaj u listu želja";
            }

            paintWishlistBtn();

            wishlistBtn.addEventListener("click", async () => {
                isSaved = await toggleWishlist(user.uid, id, isSaved);
                paintWishlistBtn();
                showToast(isSaved ? "Dodano u listu želja." : "Uklonjeno iz liste želja.", "success");
            });
        }

        if (user) {

            let selectedSlot = null;

            routineQuickAdd.querySelectorAll(".routine-btn").forEach((btn) => {
                btn.addEventListener("click", () => {
                    selectedSlot = btn.dataset.slot;
                    routineQuickAdd.querySelectorAll(".routine-btn").forEach((b) => {
                        b.classList.toggle("active", b === btn);
                    });
                });
            });

            document.getElementById("confirmRoutineBtn").addEventListener("click", async () => {

                if (!selectedSlot) {
                    showToast("Odaberi jutro ili večer.", "error");
                    return;
                }

                const label = selectedSlot === "morning" ? "jutarnju" : "večernju";
                await addProductToRoutine(user.uid, id, selectedSlot);
                showToast(`Dodano u tvoju ${label} rutinu.`, "success");
            });
        }
    });

});
