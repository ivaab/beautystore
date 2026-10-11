import { db } from "./firebase.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { onAuthAndRole } from "./auth-helpers.js";
import { showToast } from "./toast.js";
import { claimDailyLoginBonus, DAILY_LOGIN_BONUS, POINTS_PER_EURO_REDEEM } from "./points.js";

let currentUser = null;
let currentPoints = 0;

const accessDenied = document.getElementById("accessDenied");
const pointsPage = document.getElementById("pointsPage");
const pointsBalanceEl = document.getElementById("pointsBalance");
const pointsValueTextEl = document.getElementById("pointsValueText");
const dailyBonusAmountEl = document.getElementById("dailyBonusAmount");
const claimDailyBtn = document.getElementById("claimDailyBtn");
const claimDailyDateEl = document.getElementById("claimDailyDate");
const claimDailyStatusEl = document.getElementById("claimDailyStatus");

dailyBonusAmountEl.textContent = DAILY_LOGIN_BONUS;

function renderBalance() {
    pointsBalanceEl.textContent = `${currentPoints} bodova`;
    pointsValueTextEl.textContent = `Vrijednost: ${(currentPoints / POINTS_PER_EURO_REDEEM).toFixed(2)} €`;
}

function todayFormatted() {
    return new Date().toLocaleDateString("hr-HR", { weekday: "long", day: "numeric", month: "long" });
}

claimDailyBtn.addEventListener("click", async () => {

    const bonus = await claimDailyLoginBonus(currentUser.uid);

    if (bonus > 0) {
        currentPoints += bonus;
        renderBalance();
        claimDailyBtn.classList.add("claimed");
        claimDailyBtn.disabled = true;
        claimDailyStatusEl.textContent = `Pokupljeno! +${bonus} bodova.`;
        showToast(`🎉 +${bonus} bodova za današnji dan!`, "success");
    } else {
        claimDailyBtn.classList.add("claimed");
        claimDailyBtn.disabled = true;
        claimDailyStatusEl.textContent = "Već si danas pokupio/la svoj bonus. Vrati se sutra!";
    }
});

onAuthAndRole(async (user) => {

    currentUser = user;

    if (!user) {
        accessDenied.style.display = "block";
        pointsPage.style.display = "none";
        return;
    }

    accessDenied.style.display = "none";
    pointsPage.style.display = "block";

    const snap = await getDoc(doc(db, "users", user.uid));
    const userData = snap.exists() ? snap.data() : {};

    currentPoints = userData.points || 0;
    renderBalance();

    claimDailyDateEl.textContent = todayFormatted();

    const today = new Date().toISOString().slice(0, 10);
    const alreadyClaimed = userData.lastLoginBonusDate === today;

    if (alreadyClaimed) {
        claimDailyBtn.classList.add("claimed");
        claimDailyBtn.disabled = true;
        claimDailyStatusEl.textContent = "Već si danas pokupio/la svoj bonus. Vrati se sutra!";
    }
});
