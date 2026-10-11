import { auth, db } from "./firebase.js";
import {
    createUserWithEmailAndPassword,
    sendEmailVerification
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { showToast } from "./toast.js";

const registerForm = document.getElementById("registerForm");

const fullNameError = document.getElementById("fullNameError");
const emailError = document.getElementById("emailError");
const passwordError = document.getElementById("passwordError");
const termsError = document.getElementById("termsError");
const termsCheckbox = document.getElementById("termsCheckbox");
const newsletterCheckbox = document.getElementById("newsletterCheckbox");

const openTermsLink = document.getElementById("openTermsLink");
const closeTermsModal = document.getElementById("closeTermsModal");
const termsModal = document.getElementById("termsModal");

openTermsLink.addEventListener("click", (e) => {
    e.preventDefault();
    termsModal.style.display = "flex";
});

closeTermsModal.addEventListener("click", () => {
    termsModal.style.display = "none";
});

function clearErrors() {
    fullNameError.textContent = "";
    emailError.textContent = "";
    passwordError.textContent = "";
    termsError.textContent = "";
}

registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    clearErrors();

    const fullName = document.getElementById("fullName").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    let hasError = false;

    if (fullName === "") {
        fullNameError.textContent = "Ime i prezime su obavezni.";
        hasError = true;
    }

    if (email === "") {
        emailError.textContent = "Email je obavezan.";
        hasError = true;
    }

    if (password === "") {
        passwordError.textContent = "Lozinka je obavezna.";
        hasError = true;
    } else if (password.length < 8) {
        passwordError.textContent = "Lozinka mora imati minimalno 8 znakova.";
        hasError = true;
    }

    if (!termsCheckbox.checked) {
        termsError.textContent = "Moraš prihvatiti Uvjete korištenja da bi se registrirao/la.";
        hasError = true;
    }

    if (hasError) return;

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);

        // svaki novi korisnik dobiva profil dokument u Firestore-u s ulogom "customer"
        await setDoc(doc(db, "users", userCredential.user.uid), {
            fullName,
            email,
            role: "customer",
            usedCodes: [],
            routine: { morning: [], evening: [] },
            points: 250,
            newsletter: newsletterCheckbox.checked,
            createdAt: serverTimestamp()
        });

        await sendEmailVerification(userCredential.user);

        showToast("Registracija uspješna! Poslali smo ti email za potvrdu adrese (provjeri i neželjenu poštu) — potvrdi ga prije prijave. Poklonili smo ti i 250 bodova dobrodošlice.", "success", 6000);

        setTimeout(() => {
            window.location.href = "login.html";
        }, 6000);

    } catch (error) {

        if (error.code === "auth/email-already-in-use") {
            emailError.textContent = "Račun s ovim emailom već postoji.";
        }
        else if (error.code === "auth/invalid-email") {
            emailError.textContent = "Unesi ispravnu email adresu.";
        }
        else if (error.code === "auth/weak-password") {
            passwordError.textContent = "Lozinka mora imati minimalno 8 znakova.";
        }
        else {
            showToast("Registracija nije uspjela. Pokušaj ponovno.", "error");
        }
    }
});
