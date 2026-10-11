import { db } from "./firebase.js";
import {
    collection,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    query,
    where
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { onAuthAndRole } from "./auth-helpers.js";
import { showToast } from "./toast.js";

const SKIN_TYPES = ["dry", "oily", "combination", "sensitive"];
const SKIN_LABELS = { dry: "Suha", oily: "Masna", combination: "Kombinirana", sensitive: "Osjetljiva" };

let questions = [];
let selectedAnswers = {};
let currentUser = null;
let isAdminUser = false;
let recommendedProducts = [];
let routineSelection = {};
let currentSkinType = null;
let editingQuestionId = null;

const quizQuestionsEl = document.getElementById("quizQuestions");
const quizProgressWrap = document.getElementById("quizProgressWrap");
const quizProgressFill = document.getElementById("quizProgressFill");
const quizProgressText = document.getElementById("quizProgressText");
const getRecommendationBtn = document.getElementById("getRecommendationBtn");
const resultsSection = document.getElementById("resultsSection");
const resultSkinTypeEl = document.getElementById("resultSkinType");
const recommendedProductsEl = document.getElementById("recommendedProducts");
const saveRoutineBtn = document.getElementById("saveRoutineBtn");
const adminQuizSection = document.getElementById("adminQuizSection");
const adminQuestionsList = document.getElementById("adminQuestionsList");

// =====================
// RENDER QUIZ
// =====================
function updateQuizProgress() {
    const total = questions.length;
    const answered = Object.keys(selectedAnswers).length;
    const percent = total === 0 ? 0 : Math.round((answered / total) * 100);

    quizProgressFill.style.width = `${percent}%`;
    quizProgressText.textContent = `${answered}/${total} odgovoreno`;
}

function renderQuestions() {
    quizQuestionsEl.innerHTML = "";

    if (questions.length === 0) {
        quizProgressWrap.style.display = "none";
        quizQuestionsEl.innerHTML = `
            <div class="empty-state">
                <span class="empty-state-icon">📝</span>
                <span class="empty-state-title">Kviz još nije postavljen</span>
                <p>Svrati uskoro!</p>
            </div>
        `;
        return;
    }

    quizProgressWrap.style.display = "block";
    updateQuizProgress();

    questions.forEach((q) => {

        const div = document.createElement("div");
        div.classList.add("quiz-question");

        const p = document.createElement("p");
        p.textContent = q.question;
        div.appendChild(p);

        q.answers.forEach((answer) => {

            const btn = document.createElement("button");
            btn.type = "button";
            btn.textContent = answer.text;

            btn.addEventListener("click", () => {
                selectedAnswers[q.id] = answer.skinType;
                div.querySelectorAll("button").forEach((b) => b.classList.remove("selected"));
                btn.classList.add("selected");
                updateQuizProgress();
            });

            div.appendChild(btn);
        });

        quizQuestionsEl.appendChild(div);
    });
}

async function loadQuestions() {

    const snapshot = await getDocs(collection(db, "quizQuestions"));

    questions = snapshot.docs
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
        .sort((a, b) => (a.order || 0) - (b.order || 0));

    selectedAnswers = {};
    renderQuestions();

    if (isAdminUser) renderAdminQuestions();
}

// =====================
// SCORING + RECOMMENDATION
// =====================
function computeTopSkinType() {

    const counts = { dry: 0, oily: 0, combination: 0, sensitive: 0 };

    Object.values(selectedAnswers).forEach((skinType) => {
        if (counts[skinType] !== undefined) counts[skinType]++;
    });

    let top = SKIN_TYPES[0];
    let topCount = -1;

    SKIN_TYPES.forEach((type) => {
        if (counts[type] > topCount) {
            topCount = counts[type];
            top = type;
        }
    });

    return top;
}

function productImageHtml(product) {
    const url = product.images && product.images[0];

    if (url) {
        return `<img class="product-img" src="${url}" alt="${product.name}">`;
    }

    return `<div class="no-image-placeholder">🧴</div>`;
}

function renderRecommendations() {

    recommendedProductsEl.innerHTML = "";

    if (recommendedProducts.length === 0) {
        recommendedProductsEl.innerHTML = `
            <div class="empty-state">
                <span class="empty-state-icon">✨</span>
                <span class="empty-state-title">Još nema odgovarajućih proizvoda</span>
                <p>Svrati uskoro!</p>
            </div>
        `;
        saveRoutineBtn.style.display = "none";
        return;
    }

    recommendedProducts.forEach((product) => {

        const card = document.createElement("div");
        card.classList.add("card");

        card.innerHTML = `
            ${productImageHtml(product)}
            <h3>${product.name}</h3>
            <p class="price card-price">${product.price} €</p>
            <div class="routine-actions">
                <button type="button" class="routine-btn" data-slot="morning">☀️ Jutro</button>
                <button type="button" class="routine-btn" data-slot="evening">🌙 Večer</button>
            </div>
        `;

        card.querySelectorAll(".routine-btn").forEach((btn) => {
            btn.addEventListener("click", () => {

                if (!currentUser) {
                    showToast("Prijavi se da bi spremio/la proizvode u rutinu.", "error");
                    return;
                }

                const slot = btn.dataset.slot;
                const wasActive = btn.classList.contains("active");
                const label = slot === "morning" ? "Jutro" : "Večer";

                card.querySelectorAll(".routine-btn").forEach((b) => {
                    b.classList.remove("active");
                    b.textContent = b.dataset.slot === "morning" ? "☀️ Jutro" : "🌙 Večer";
                });

                if (wasActive) {
                    delete routineSelection[product.id];
                    showToast(`Uklonjeno iz rutine.`, "success");
                } else {
                    btn.classList.add("active");
                    btn.textContent = `✓ ${label}`;
                    routineSelection[product.id] = slot;
                    showToast(`Dodano u tvoju ${slot === "morning" ? "jutarnju" : "večernju"} rutinu.`, "success");
                }
            });
        });

        recommendedProductsEl.appendChild(card);
    });

    saveRoutineBtn.style.display = "inline-block";
}

getRecommendationBtn.addEventListener("click", async () => {

    if (questions.length === 0) {
        showToast("Još nema pitanja za kviz.", "error");
        return;
    }

    if (Object.keys(selectedAnswers).length < questions.length) {
        showToast("Odgovori na sva pitanja.", "error");
        return;
    }

    const topSkinType = computeTopSkinType();
    currentSkinType = topSkinType;

    if (currentUser) {
        await updateDoc(doc(db, "users", currentUser.uid), { skinType: topSkinType });
    }

    const productsQuery = query(collection(db, "products"), where("skinType", "==", topSkinType));
    const snapshot = await getDocs(productsQuery);

    recommendedProducts = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
    routineSelection = {};

    resultSkinTypeEl.textContent = `Tvoj tip kože: ${SKIN_LABELS[topSkinType]}`;
    renderRecommendations();

    resultsSection.style.display = "block";
    resultsSection.scrollIntoView({ behavior: "smooth" });
});

saveRoutineBtn.addEventListener("click", async () => {

    if (!currentUser) {
        showToast("Prijavi se za spremanje rutine.", "error");
        return;
    }

    const morning = Object.entries(routineSelection)
        .filter(([, slot]) => slot === "morning")
        .map(([id]) => id);

    const evening = Object.entries(routineSelection)
        .filter(([, slot]) => slot === "evening")
        .map(([id]) => id);

    if (morning.length === 0 && evening.length === 0) {
        showToast("Odaberi barem jedan proizvod za rutinu.", "error");
        return;
    }

    await updateDoc(doc(db, "users", currentUser.uid), {
        routine: { morning, evening },
        skinType: currentSkinType
    });

    showToast("Rutina spremljena! Provjeri svoj profil.", "success");
});

// =====================
// AUTH
// =====================
onAuthAndRole((user, role, isAdmin) => {
    currentUser = user;
    isAdminUser = isAdmin;
    adminQuizSection.style.display = isAdminUser ? "block" : "none";
    loadQuestions();
});

// =====================
// ADMIN: MANAGE QUESTIONS
// =====================
function renderAdminQuestions() {

    adminQuestionsList.innerHTML = "";

    questions.forEach((q) => {

        const item = document.createElement("div");
        item.classList.add("admin-question-item");

        item.innerHTML = `
            <div>
                <div class="admin-question-text">${q.question}</div>
                <div class="admin-question-meta">${q.answers.length} odgovora</div>
            </div>
            <div class="admin-question-actions"></div>
        `;

        const editBtn = document.createElement("button");
        editBtn.type = "button";
        editBtn.textContent = "Uredi";
        editBtn.addEventListener("click", () => openEditQuestionModal(q));

        const deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.textContent = "Izbriši";
        deleteBtn.addEventListener("click", async () => {
            await deleteDoc(doc(db, "quizQuestions", q.id));
            showToast("Pitanje izbrisano.", "success");
            await loadQuestions();
        });

        item.querySelector(".admin-question-actions").appendChild(editBtn);
        item.querySelector(".admin-question-actions").appendChild(deleteBtn);

        adminQuestionsList.appendChild(item);
    });
}

const questionModal = document.getElementById("questionModal");
const questionModalTitle = document.getElementById("questionModalTitle");
const questionTextInput = document.getElementById("questionText");
const answersListEl = document.getElementById("answersList");
const addAnswerRowBtn = document.getElementById("addAnswerRowBtn");
const closeQuestionModalBtn = document.getElementById("closeQuestionModal");
const saveQuestionBtn = document.getElementById("saveQuestionBtn");
const openAddQuestionModalBtn = document.getElementById("openAddQuestionModal");

function addAnswerRow(text = "", skinType = "dry") {

    const row = document.createElement("div");
    row.classList.add("answer-row");

    row.innerHTML = `
        <input class="answer-text" placeholder="Tekst odgovora" value="${text}">
        <select class="answer-skintype">
            <option value="dry">Suha</option>
            <option value="oily">Masna</option>
            <option value="combination">Kombinirana</option>
            <option value="sensitive">Osjetljiva</option>
        </select>
        <button type="button" class="remove-answer-btn">✕</button>
    `;

    row.querySelector(".answer-skintype").value = skinType;
    row.querySelector(".remove-answer-btn").addEventListener("click", () => row.remove());

    answersListEl.appendChild(row);
}

addAnswerRowBtn.addEventListener("click", () => addAnswerRow());

function openAddQuestionModal() {
    editingQuestionId = null;
    questionModalTitle.textContent = "Dodaj pitanje";
    questionTextInput.value = "";
    answersListEl.innerHTML = "";
    addAnswerRow();
    addAnswerRow();
    questionModal.style.display = "flex";
}

function openEditQuestionModal(q) {
    editingQuestionId = q.id;
    questionModalTitle.textContent = "Uredi pitanje";
    questionTextInput.value = q.question;
    answersListEl.innerHTML = "";
    q.answers.forEach((a) => addAnswerRow(a.text, a.skinType));
    questionModal.style.display = "flex";
}

openAddQuestionModalBtn.addEventListener("click", openAddQuestionModal);

closeQuestionModalBtn.addEventListener("click", () => {
    questionModal.style.display = "none";
});

questionModal.addEventListener("click", (e) => {
    if (e.target === questionModal) {
        questionModal.style.display = "none";
    }
});

saveQuestionBtn.addEventListener("click", async () => {

    const questionText = questionTextInput.value.trim();

    const answers = Array.from(answersListEl.querySelectorAll(".answer-row"))
        .map((row) => ({
            text: row.querySelector(".answer-text").value.trim(),
            skinType: row.querySelector(".answer-skintype").value
        }))
        .filter((a) => a.text !== "");

    if (!questionText || answers.length < 2) {
        showToast("Unesi pitanje i barem 2 odgovora.", "error");
        return;
    }

    if (editingQuestionId) {

        await updateDoc(doc(db, "quizQuestions", editingQuestionId), {
            question: questionText,
            answers
        });

        showToast("Pitanje ažurirano!", "success");

    } else {

        await addDoc(collection(db, "quizQuestions"), {
            question: questionText,
            answers,
            order: questions.length
        });

        showToast("Pitanje dodano!", "success");
    }

    questionModal.style.display = "none";
    await loadQuestions();
});
