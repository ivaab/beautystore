import { db } from "./firebase.js";
import { doc, getDoc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

export const POINTS_PER_EURO_SPENT = 2;    // koliko bodova korisnik dobije za svaki potrošeni euro
export const POINTS_PER_EURO_REDEEM = 100; // koliko bodova vrijedi 1 € popusta
export const DAILY_LOGIN_BONUS = 2;        // bodovi za prvu posjetu stranici tog dana

function todayString() {
    return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

// poziva se jednom po posjeti stranice (iz nav.js) - ako korisnik danas
// još nije dobio dnevni bonus, dodaje mu se i vraća broj dodanih bodova
export async function claimDailyLoginBonus(uid) {

    const userRef = doc(db, "users", uid);
    const snap = await getDoc(userRef);
    const lastBonusDate = snap.exists() ? snap.data().lastLoginBonusDate : null;

    const today = todayString();
    if (lastBonusDate === today) return 0;

    await updateDoc(userRef, {
        points: increment(DAILY_LOGIN_BONUS),
        lastLoginBonusDate: today
    });

    return DAILY_LOGIN_BONUS;
}
