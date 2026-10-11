import { db } from "./firebase.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { FREE_SHIPPING_THRESHOLD } from "./shipping.js";

const ROTATE_MS = 4000;

const banner = document.getElementById("promoBanner");

if (banner) {

    const messages = [`🚚 Besplatna dostava za narudžbe iznad ${FREE_SHIPPING_THRESHOLD} €`];

    getDocs(collection(db, "discountCodes")).then((snapshot) => {

        const now = new Date();

        const activeCodes = snapshot.docs
            .map((docSnap) => ({ code: docSnap.id, ...docSnap.data() }))
            .filter((c) => c.active && c.expiresAt && c.expiresAt.toDate() > now);

        activeCodes.forEach((c) => {
            messages.push(`🎉 Iskoristi kod <strong>${c.code}</strong> za ${c.percent}% popusta — vrijedi do ${c.expiresAt.toDate().toLocaleDateString()}`);
        });

        banner.classList.add("promo-banner");

        let index = 0;

        function showMessage() {
            banner.innerHTML = `<span class="promo-banner-text">${messages[index]}</span>`;
        }

        showMessage();

        if (messages.length > 1) {
            setInterval(() => {
                banner.classList.add("promo-banner-fade");

                setTimeout(() => {
                    index = (index + 1) % messages.length;
                    showMessage();
                    banner.classList.remove("promo-banner-fade");
                }, 300);

            }, ROTATE_MS);
        }
    });
}
