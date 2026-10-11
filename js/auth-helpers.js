import { auth, db } from "./firebase.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

// keš po uid-u da nav.js i page-specific skripta na istoj stranici
// ne rade dva odvojena Firestore čitanja za isti podatak
const roleCache = new Map();

// dohvaća role polje ("admin" | "customer") iz users/{uid} dokumenta
export async function getUserRole(uid) {
    if (roleCache.has(uid)) return roleCache.get(uid);

    const promise = getDoc(doc(db, "users", uid)).then((snap) => {
        return snap.exists() ? (snap.data().role || null) : null;
    });

    roleCache.set(uid, promise);
    return promise;
}

export async function isAdmin(user) {
    if (!user) return false;
    const role = await getUserRole(user.uid);
    return role === "admin";
}

// auth.authStateReady() čeka da Firebase definitivno završi provjeru
// spremljene sesije (na učitavanju stranice zna se "okinuti" prvo s
// user=null pa tek onda sa stvarnim korisnikom - authStateReady()
// preskače taj lažni prvi odgovor pa nema treperenja navbara)
export function onAuthAndRole(callback) {
    auth.authStateReady().then(async () => {
        const user = auth.currentUser;
        const role = user ? await getUserRole(user.uid) : null;
        callback(user, role, role === "admin");
    });
}
