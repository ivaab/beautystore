import { db } from "./firebase.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { onAuthAndRole } from "./auth-helpers.js";

const accessDenied = document.getElementById("accessDenied");
const usersSection = document.getElementById("usersSection");

onAuthAndRole((user, role, isAdminUser) => {

    if (!isAdminUser) {
        accessDenied.style.display = "block";
        usersSection.style.display = "none";
        return;
    }

    accessDenied.style.display = "none";
    usersSection.style.display = "block";

    loadUsers();
});

async function loadUsers() {

    const tbody = document.getElementById("usersTableBody");

    const snapshot = await getDocs(collection(db, "users"));

    tbody.innerHTML = "";

    snapshot.forEach((docSnap) => {

        const u = docSnap.data();

        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${u.fullName || "-"}</td>
            <td>${u.email || "-"}</td>
            <td>${u.role || "-"}</td>
        `;

        tbody.appendChild(row);
    });
}
