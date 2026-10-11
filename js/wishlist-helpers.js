import { db } from "./firebase.js";
import { doc, updateDoc, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

// vraća novo stanje (true = sad je u listi želja, false = maknuto)
export async function toggleWishlist(uid, productId, isCurrentlySaved) {

    const userRef = doc(db, "users", uid);

    await updateDoc(userRef, {
        wishlist: isCurrentlySaved ? arrayRemove(productId) : arrayUnion(productId)
    });

    return !isCurrentlySaved;
}
