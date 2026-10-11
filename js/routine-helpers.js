import { db } from "./firebase.js";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

export async function addProductToRoutine(uid, productId, slot) {
    const userRef = doc(db, "users", uid);
    const snap = await getDoc(userRef);
    const routine = (snap.exists() && snap.data().routine) || { morning: [], evening: [] };

    const morning = (routine.morning || []).filter((id) => id !== productId);
    const evening = (routine.evening || []).filter((id) => id !== productId);

    if (slot === "morning") morning.push(productId);
    else evening.push(productId);

    await updateDoc(userRef, { routine: { morning, evening } });
}
