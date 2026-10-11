// Jedini izvor istine za košaricu. Sprema se u localStorage (brzo, radi i za
// neprijavljene korisnike), a za prijavljene korisnike se dodatno sinkronizira
// s Firestore-om (users/{uid}.cart) da košarica ostane dostupna na svakom uređaju.
// Svaki item ima oblik: { id, name, price, image, qty }

import { db } from "./firebase.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const STORAGE_KEY = "cart";

let currentUserId = null;

function readCart() {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
}

function syncToFirestore(cart) {
    if (!currentUserId) return;
    setDoc(doc(db, "users", currentUserId), { cart }, { merge: true });
}

function writeCart(cart) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    syncToFirestore(cart);
}

// poziva se na svakoj stranici (iz nav.js) - ali samo PRVI put u sesiji
// stvarno spaja lokalnu košaricu s onom spremljenom na profilu. Bez ove
// zaštite, spajanje bi se ponavljalo pri svakoj promjeni stranice i
// zbrajalo iste količine iznova i iznova.
const SYNC_FLAG_KEY = "cartSyncedFor";

export async function initCartSync(uid) {

    currentUserId = uid;

    if (!uid) return;

    if (sessionStorage.getItem(SYNC_FLAG_KEY) === uid) return;

    const snap = await getDoc(doc(db, "users", uid));
    const remoteCart = (snap.exists() && snap.data().cart) || [];
    const localCart = readCart();

    const merged = [...localCart];

    remoteCart.forEach((remoteItem) => {
        const existing = merged.find((item) => item.id === remoteItem.id);
        if (existing) {
            existing.qty += remoteItem.qty;
        } else {
            merged.push(remoteItem);
        }
    });

    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    syncToFirestore(merged);

    sessionStorage.setItem(SYNC_FLAG_KEY, uid);
}

export function getCart() {
    return readCart();
}

export function addToCart(product, qty = 1) {
    const cart = readCart();
    const existing = cart.find((item) => item.id === product.id);

    if (existing) {
        existing.qty += qty;
    } else {
        cart.push({
            id: product.id,
            name: product.name,
            price: Number(product.price),
            image: product.image || "",
            qty
        });
    }

    writeCart(cart);
}

export function removeFromCart(id) {
    const cart = readCart().filter((item) => item.id !== id);
    writeCart(cart);
}

export function setQty(id, qty) {
    if (qty <= 0) {
        removeFromCart(id);
        return;
    }

    const cart = readCart();
    const item = cart.find((item) => item.id === id);
    if (item) item.qty = qty;

    writeCart(cart);
}

export function getTotal() {
    return readCart().reduce((sum, item) => sum + item.price * item.qty, 0);
}

export function clearCart() {
    localStorage.removeItem(STORAGE_KEY);
    if (currentUserId) {
        setDoc(doc(db, "users", currentUserId), { cart: [] }, { merge: true });
    }
}
