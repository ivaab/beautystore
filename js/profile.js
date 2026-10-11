import { db } from "./firebase.js";
import {
    doc,
    getDoc,
    deleteDoc,
    updateDoc,
    collection,
    query,
    where,
    getDocs
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import {
    deleteUser,
    EmailAuthProvider,
    reauthenticateWithCredential,
    updatePassword
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { onAuthAndRole } from "./auth-helpers.js";
import { showToast } from "./toast.js";
import { clearCart } from "./cart-store.js";

let currentUser = null;
let currentFullName = "";

const accessDenied = document.getElementById("accessDenied");
const profileContent = document.getElementById("profileContent");
const profileGreetingEl = document.getElementById("profileGreeting");
const profileAvatarEl = document.getElementById("profileAvatar");
const ordersCountText = document.getElementById("ordersCountText");
const pointsCountText = document.getElementById("pointsCountText");
const wishlistCountText = document.getElementById("wishlistCountText");
const routineSkinTypeText = document.getElementById("routineSkinTypeText");
const cardPointsValue = document.getElementById("cardPointsValue");
const cardMemberName = document.getElementById("cardMemberName");
const cardMemberSince = document.getElementById("cardMemberSince");

const SKIN_LABELS = { dry: "Suha", oily: "Masna", combination: "Kombinirana", sensitive: "Osjetljiva" };
const deleteAccountBtn = document.getElementById("deleteAccountBtn");
const deleteAccountModal = document.getElementById("deleteAccountModal");
const deleteConfirmStep = document.getElementById("deleteConfirmStep");
const deleteReauthStep = document.getElementById("deleteReauthStep");
const cancelDeleteAccountBtn = document.getElementById("cancelDeleteAccountBtn");
const confirmDeleteAccountBtn = document.getElementById("confirmDeleteAccountBtn");
const cancelReauthBtn = document.getElementById("cancelReauthBtn");
const confirmReauthBtn = document.getElementById("confirmReauthBtn");
const deleteReauthPassword = document.getElementById("deleteReauthPassword");
const deleteReauthError = document.getElementById("deleteReauthError");

function closeDeleteModal() {
    deleteAccountModal.style.display = "none";
    deleteConfirmStep.style.display = "block";
    deleteReauthStep.style.display = "none";
    deleteReauthPassword.value = "";
    deleteReauthError.textContent = "";
}

async function finishAccountDeletion() {
    await deleteDoc(doc(db, "users", currentUser.uid));
    await deleteUser(currentUser);

    clearCart();
    closeDeleteModal();
    showToast("Profil je izbrisan.", "success");

    setTimeout(() => {
        window.location.href = "index.html";
    }, 800);
}

deleteAccountBtn.addEventListener("click", () => {
    deleteAccountModal.style.display = "flex";
});

cancelDeleteAccountBtn.addEventListener("click", closeDeleteModal);
cancelReauthBtn.addEventListener("click", closeDeleteModal);

confirmDeleteAccountBtn.addEventListener("click", async () => {

    try {
        await finishAccountDeletion();

    } catch (error) {

        if (error.code === "auth/requires-recent-login") {
            deleteConfirmStep.style.display = "none";
            deleteReauthStep.style.display = "block";
        } else {
            closeDeleteModal();
            showToast("Brisanje profila nije uspjelo. Pokušaj ponovno.", "error");
        }
    }
});

confirmReauthBtn.addEventListener("click", async () => {

    const password = deleteReauthPassword.value;
    deleteReauthError.textContent = "";

    if (!password) {
        deleteReauthError.textContent = "Unesi lozinku.";
        return;
    }

    try {
        const credential = EmailAuthProvider.credential(currentUser.email, password);
        await reauthenticateWithCredential(currentUser, credential);
        await finishAccountDeletion();

    } catch (error) {

        if (error.code === "auth/wrong-password" || error.code === "auth/invalid-credential") {
            deleteReauthError.textContent = "Neispravna lozinka.";
        } else {
            closeDeleteModal();
            showToast("Brisanje profila nije uspjelo. Pokušaj ponovno.", "error");
        }
    }
});

// =====================
// EDIT PROFILE
// =====================
const editProfileBtn = document.getElementById("editProfileBtn");
const editProfileModal = document.getElementById("editProfileModal");
const editProfileStep = document.getElementById("editProfileStep");
const changePasswordStep = document.getElementById("changePasswordStep");
const editFullName = document.getElementById("editFullName");
const editFullNameError = document.getElementById("editFullNameError");
const cancelEditProfileBtn = document.getElementById("cancelEditProfileBtn");
const saveEditProfileBtn = document.getElementById("saveEditProfileBtn");
const showChangePasswordBtn = document.getElementById("showChangePasswordBtn");
const backToEditProfileBtn = document.getElementById("backToEditProfileBtn");
const currentPasswordInput = document.getElementById("currentPasswordInput");
const newPasswordInput = document.getElementById("newPasswordInput");
const changePasswordError = document.getElementById("changePasswordError");
const confirmChangePasswordBtn = document.getElementById("confirmChangePasswordBtn");

function closeEditProfileModal() {
    editProfileModal.style.display = "none";
    editProfileStep.style.display = "block";
    changePasswordStep.style.display = "none";
    editFullNameError.textContent = "";
    changePasswordError.textContent = "";
    currentPasswordInput.value = "";
    newPasswordInput.value = "";
}

editProfileBtn.addEventListener("click", () => {
    editFullName.value = currentFullName;
    editProfileModal.style.display = "flex";
});

cancelEditProfileBtn.addEventListener("click", closeEditProfileModal);

saveEditProfileBtn.addEventListener("click", async () => {

    const newName = editFullName.value.trim();
    editFullNameError.textContent = "";

    if (!newName) {
        editFullNameError.textContent = "Ime i prezime su obavezni.";
        return;
    }

    try {
        await updateDoc(doc(db, "users", currentUser.uid), { fullName: newName });

        currentFullName = newName;
        const firstName = newName.split(" ")[0];
        profileGreetingEl.textContent = `Bok, ${firstName}!`;
        profileAvatarEl.textContent = firstName.charAt(0).toUpperCase();

        closeEditProfileModal();
        showToast("Profil je ažuriran.", "success");

    } catch (error) {
        showToast("Spremanje nije uspjelo. Pokušaj ponovno.", "error");
    }
});

showChangePasswordBtn.addEventListener("click", () => {
    editProfileStep.style.display = "none";
    changePasswordStep.style.display = "block";
});

backToEditProfileBtn.addEventListener("click", () => {
    changePasswordStep.style.display = "none";
    editProfileStep.style.display = "block";
    changePasswordError.textContent = "";
    currentPasswordInput.value = "";
    newPasswordInput.value = "";
});

confirmChangePasswordBtn.addEventListener("click", async () => {

    const currentPassword = currentPasswordInput.value;
    const newPassword = newPasswordInput.value;
    changePasswordError.textContent = "";

    if (!currentPassword || !newPassword) {
        changePasswordError.textContent = "Ispuni oba polja.";
        return;
    }

    if (newPassword.length < 8) {
        changePasswordError.textContent = "Nova lozinka mora imati minimalno 8 znakova.";
        return;
    }

    try {
        const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
        await reauthenticateWithCredential(currentUser, credential);
        await updatePassword(currentUser, newPassword);

        closeEditProfileModal();
        showToast("Lozinka je promijenjena.", "success");

    } catch (error) {

        if (error.code === "auth/wrong-password" || error.code === "auth/invalid-credential") {
            changePasswordError.textContent = "Trenutna lozinka nije točna.";
        } else {
            changePasswordError.textContent = "Promjena nije uspjela. Pokušaj ponovno.";
        }
    }
});

onAuthAndRole(async (user) => {

    currentUser = user;

    if (!user) {
        accessDenied.style.display = "block";
        profileContent.style.display = "none";
        return;
    }

    accessDenied.style.display = "none";
    profileContent.style.display = "block";

    const snap = await getDoc(doc(db, "users", user.uid));
    const userData = snap.exists() ? snap.data() : {};

    currentFullName = userData.fullName || "";
    const firstName = (userData.fullName || "").split(" ")[0] || user.email.split("@")[0];
    profileGreetingEl.textContent = `Bok, ${firstName}!`;
    profileAvatarEl.textContent = firstName.charAt(0).toUpperCase();

    const points = userData.points || 0;
    pointsCountText.textContent = `${points} bodova`;

    cardPointsValue.textContent = String(points).padStart(4, "0");
    cardMemberName.textContent = firstName;
    cardMemberSince.textContent = userData.createdAt?.toDate
        ? userData.createdAt.toDate().toLocaleDateString("hr-HR", { month: "short", year: "numeric" })
        : "—";

    const wishlistCount = (userData.wishlist || []).length;
    wishlistCountText.textContent = wishlistCount === 0
        ? "Još nema spremljenih proizvoda"
        : `${wishlistCount} ${wishlistCount === 1 ? "proizvod" : "proizvoda"}`;

    routineSkinTypeText.textContent = userData.skinType
        ? `Tip kože: ${SKIN_LABELS[userData.skinType] || userData.skinType}`
        : "Riješi kviz za tip kože";

    const ordersQuery = query(collection(db, "orders"), where("userId", "==", user.uid));
    const ordersSnap = await getDocs(ordersQuery);
    const ordersCount = ordersSnap.size;
    ordersCountText.textContent = ordersCount === 0
        ? "Još nema narudžbi"
        : `${ordersCount} ${ordersCount === 1 ? "narudžba" : "narudžbe"}`;
});
