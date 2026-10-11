import { auth } from "./firebase.js";
import {
    signInWithEmailAndPassword,
    sendPasswordResetEmail,
    sendEmailVerification,
    signOut
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { showToast } from "./toast.js";

const loginForm = document.getElementById("loginForm");
const forgotPasswordLink = document.getElementById("forgotPasswordLink");

const emailError = document.getElementById("emailError");
const passwordError = document.getElementById("passwordError");

function clearErrors() {
    emailError.textContent = "";
    passwordError.textContent = "";
}

loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    clearErrors();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    let hasError = false;

    if (email === "") {
        emailError.textContent = "Email je obavezan.";
        hasError = true;
    }

    if (password === "") {
        passwordError.textContent = "Lozinka je obavezna.";
        hasError = true;
    }

    if (hasError) return;

    try {

        const userCredential = await signInWithEmailAndPassword(auth, email, password);

        const verificationExemptEmails = ["admin@gmail.com", "test1@gmail.com"];
        const isExemptFromVerification = verificationExemptEmails.includes(email.toLowerCase());

        if (!isExemptFromVerification && !userCredential.user.emailVerified) {
            await sendEmailVerification(userCredential.user);
            await signOut(auth);
            passwordError.textContent = "";
            emailError.textContent = "Prvo moraš potvrditi svoj email. Poslali smo ti novu poveznicu za potvrdu — provjeri inbox (i neželjenu poštu).";
            return;
        }

        showToast("Prijava uspješna!", "success");

        setTimeout(() => {
            window.location.href = "index.html";
        }, 600);

    } catch (error) {

        if (
            error.code === "auth/invalid-credential" ||
            error.code === "auth/user-not-found" ||
            error.code === "auth/wrong-password"
        ) {
            passwordError.textContent = "Neispravan email ili lozinka.";
        }
        else if (error.code === "auth/invalid-email") {
            emailError.textContent = "Unesi ispravnu email adresu.";
        }
        else {
            showToast("Prijava nije uspjela. Pokušaj ponovno.", "error");
        }

    }
});

forgotPasswordLink.addEventListener("click", async (e) => {
    e.preventDefault();

    clearErrors();

    const email = document.getElementById("email").value.trim();

    if (email === "") {
        emailError.textContent = "Upiši svoj email pa klikni ponovno da ti pošaljemo poveznicu za resetiranje.";
        return;
    }

    try {
        await sendPasswordResetEmail(auth, email);
        showToast("Poslali smo ti email s poveznicom za resetiranje lozinke. Provjeri i neželjenu poštu.", "success");
    } catch (error) {

        if (error.code === "auth/invalid-email") {
            emailError.textContent = "Unesi ispravnu email adresu.";
        } else {
            showToast("Poslali smo ti email s poveznicom za resetiranje lozinke ako račun postoji.", "success");
        }
    }
});
