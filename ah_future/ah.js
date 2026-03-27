const API_BASE_URL = "https://bstests.leogib.fr";
const TOKEN_STORAGE_KEYS = ["brainrot_token", "token", "auth_token", "jwt_token", "jwt"];
const PRICE_VARIANCE = 0.20;

const RARITY_ORDER = [
    "commun", "peu commun", "rare", "très rare",
    "légendaire", "épique", "mythique", "ultime",
    "divin", "secret", "ancestral", "éternel"
];

const RARITY_COLORS = window.BRAINROT_RARITY_COLORS || {
    commun: "#a3a3a3",
    "peu-commun": "#22c55e",
    rare: "#3b82f6",
    "tres-rare": "#8b5cf6",
    ancestral: "#3b82f6",
    epique: "#a855f7",
    legendaire: "#f97316",
    mythique: "#ec4899",
    divin: "#eab308",
    ultime: "#ef4444",
    secret: "#a855f7",
    eternel: "#ef4444"
};

const MOCK_SELLERS = ["Skibidi_Lord", "TunaTunaOhOh", "BrainrotKing99", "ZenithPlayer", "CaisseHunter", "LegendaryFarm", "TricoTrico"];

let allCards = [];
let ownedCards = [];
let myListings = [];
let marketListings = [];

let sellModalState = { card: null };
let buyModalState = { listing: null };

const ui = {
    wallet: document.getElementById("ah-wallet"),
    tabs: document.querySelectorAll(".ah-tab"),
    panels: {
        buy: document.getElementById("tab-buy"),
        sell: document.getElementById("tab-sell"),
        "my-listings": document.getElementById("tab-my-listings")
    },
    myListingsCount: document.getElementById("my-listings-count"),
    buySearch: document.getElementById("buy-search"),
    buyFilterRarity: document.getElementById("buy-filter-rarity"),
    buySort: document.getElementById("buy-sort"),
    buyGrid: document.getElementById("buy-listings-grid"),
    sellSearch: document.getElementById("sell-search"),
    sellFilterRarity: document.getElementById("sell-filter-rarity"),
    sellGrid: document.getElementById("sell-cards-grid"),
    myListingsList: document.getElementById("my-listings-list"),
    buyModal: document.getElementById("buy-modal"),
    buyModalOverlay: document.getElementById("buy-modal-overlay"),
    buyModalClose: document.getElementById("buy-modal-close"),
    buyModalImg: document.getElementById("buy-modal-img"),
    buyModalName: document.getElementById("buy-modal-name"),
    buyModalRarity: document.getElementById("buy-modal-rarity"),
    buyModalCps: document.getElementById("buy-modal-cps"),
    buyModalPrice: document.getElementById("buy-modal-price"),
    buyModalRef: document.getElementById("buy-modal-ref"),
    buyModalSeller: document.getElementById("buy-modal-seller"),
    buyModalConfirm: document.getElementById("buy-modal-confirm"),
    sellModal: document.getElementById("sell-modal"),
    sellModalOverlay: document.getElementById("sell-modal-overlay"),
    sellModalClose: document.getElementById("sell-modal-close"),
    sellModalImg: document.getElementById("sell-modal-img"),
    sellModalName: document.getElementById("sell-modal-name"),
    sellModalRarity: document.getElementById("sell-modal-rarity"),
    sellModalCps: document.getElementById("sell-modal-cps"),
    sellPriceSlider: document.getElementById("sell-price-slider"),
    sellPriceDisplay: document.getElementById("sell-price-display"),
    sellRefPrice: document.getElementById("sell-ref-price"),
    sellPriceMin: document.getElementById("sell-price-min"),
    sellPriceMax: document.getElementById("sell-price-max"),
    sellModalConfirm: document.getElementById("sell-modal-confirm")
};

function getAuthToken() {
    for (const key of TOKEN_STORAGE_KEYS) {
        const t = localStorage.getItem(key);
        if (t) return t;
    }
    return window.BrainrotAuth?.getToken?.() || "";
}

function formatCompact(value) {
    const num = Number(value || 0);
    if (num >= 1_000_000_000_000) return `${(num / 1_000_000_000_000).toFixed(2).replace(/\.00$/, "")}T`;
    if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2).replace(/\.00$/, "")}B`;
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2).replace(/\.00$/, "")}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(2).replace(/\.00$/, "")}K`;
    return `${Math.round(num * 100) / 100}`;
}

function getRarityColor(rarity) {
    if (!rarity) return "#a3a3a3";
    const key = rarity.toLowerCase().replace(/\s+/g, "-").replace(/é/g, "e").replace(/è/g, "e").replace(/ê/g, "e").replace(/à/g, "a").replace(/ù/g, "u");
    return RARITY_COLORS[key] || RARITY_COLORS[rarity] || "#a3a3a3";
}

function getRarityIndex(rarity) {
    const normalized = (rarity || "").toLowerCase().replace(/-/g, " ");
    const idx = RARITY_ORDER.indexOf(normalized);
    return idx === -1 ? RARITY_ORDER.length : idx;
}

function getRefPrice(card) {
    return card.refPrice || card.basePrice || Math.max(100, Math.round((card.goldPerSec || card.cps || 1) * 1000));
}

function getPriceDelta(price, refPrice) {
    return ((price - refPrice) / refPrice) * 100;
}

function mockGenerateListings(cards) {
    return cards.flatMap(card => {
        const count = Math.floor(Math.random() * 3);
        const results = [];
        for (let i = 0; i < count; i++) {
            const ref = getRefPrice(card);
            const variance = (Math.random() * 2 - 1) * PRICE_VARIANCE;
            const price = Math.round(ref * (1 + variance));
            results.push({
                id: `listing-${card.id || card.name}-${i}-${Date.now()}`,
                card,
                price,
                refPrice: ref,
                seller: MOCK_SELLERS[Math.floor(Math.random() * MOCK_SELLERS.length)]
            });
        }
        return results;
    });
}

async function fetchAllCards() {
    try {
        const response = await fetch(`${API_BASE_URL}/user/getAllBrainRot`);
        if (!response.ok) throw new Error("fetch failed");
        const payload = await response.json();
        if (payload?.success && Array.isArray(payload?.result)) {
            return payload.result;
        }
        return [];
    } catch {
        return [];
    }
}

async function fetchOwnedCards() {
    const token = getAuthToken();
    if (!token) return [];
    try {
        const response = await fetch(`${API_BASE_URL}/user/cards`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (!response.ok) return [];
        const payload = await response.json();
        if (!payload?.success) return [];
        return Array.isArray(payload?.cards) ? payload.cards : [];
    } catch {
        return [];
    }
}

function populateRarityFilters() {
    const rarities = [...new Set(allCards.map(c => c.rarity).filter(Boolean))]
        .sort((a, b) => getRarityIndex(a) - getRarityIndex(b));

    [ui.buyFilterRarity, ui.sellFilterRarity].forEach(sel => {
        sel.innerHTML = '<option value="all">Toutes raretés</option>';
        rarities.forEach(r => {
            const opt = document.createElement("option");
            opt.value = r;
            opt.textContent = r.replace(/-/g, " ").toUpperCase();
            sel.appendChild(opt);
        });
    });
}

function getFilteredListings() {
    const search = ui.buySearch.value.trim().toLowerCase();
    const rarity = ui.buyFilterRarity.value;
    const sort = ui.buySort.value;

    let list = [...marketListings];

    if (search) list = list.filter(l => l.card.name?.toLowerCase().includes(search));
    if (rarity !== "all") list = list.filter(l => l.card.rarity === rarity);

    if (sort === "price-asc") list.sort((a, b) => a.price - b.price);
    else if (sort === "price-desc") list.sort((a, b) => b.price - a.price);
    else if (sort === "cps-desc") list.sort((a, b) => (b.card.goldPerSec || 0) - (a.card.goldPerSec || 0));
    else if (sort === "rarity-desc") list.sort((a, b) => getRarityIndex(b.card.rarity) - getRarityIndex(a.card.rarity));

    return list;
}

function getFilteredSellCards() {
    const search = ui.sellSearch.value.trim().toLowerCase();
    const rarity = ui.sellFilterRarity.value;

    let list = [...ownedCards];
    if (search) list = list.filter(c => (c.name || c.card?.name || "").toLowerCase().includes(search));
    if (rarity !== "all") list = list.filter(c => (c.rarity || c.card?.rarity) === rarity);
    return list;
}

function renderBuyGrid() {
    const listings = getFilteredListings();
    ui.buyGrid.innerHTML = "";

    if (!listings.length) {
        ui.buyGrid.innerHTML = `<div class="ah-empty-state"><div class="ah-empty-state-icon">🔍</div><span>Aucune annonce trouvée.</span></div>`;
        lucide.createIcons();
        return;
    }

    listings.forEach(listing => {
        const card = listing.card;
        const color = getRarityColor(card.rarity);
        const delta = getPriceDelta(listing.price, listing.refPrice);
        const deltaClass = delta > 1 ? "up" : delta < -1 ? "down" : "neutral";
        const deltaLabel = `${delta > 0 ? "+" : ""}${delta.toFixed(1)}%`;
        const img = card.link || card.imageUrl || card.image || "";

        const el = document.createElement("div");
        el.className = "ah-listing-card";
        el.style.borderColor = `${color}55`;
        el.style.boxShadow = `0 8px 24px ${color}18, var(--card-shadow)`;
        el.innerHTML = `
            <div class="ah-listing-card-img-wrap">
                ${img
                    ? `<img class="ah-listing-card-img" src="${img}" alt="${card.name}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
                    : ""}
                <div class="ah-listing-card-img-fallback" style="${img ? "display:none" : ""}">${card.emoji || "🃏"}</div>
                <div class="ah-listing-rarity-dot" style="background:${color};color:${color}"></div>
            </div>
            <div class="ah-listing-card-name">${card.name}</div>
            <div class="ah-listing-card-rarity" style="color:${color}">${(card.rarity || "").replace(/-/g, " ")}</div>
            <div class="ah-listing-card-cps"><i data-lucide="zap"></i>${formatCompact(card.goldPerSec || 0)}/s</div>
            <div class="ah-listing-card-price">
                <span class="ah-listing-price-value">${formatCompact(listing.price)} 💰</span>
                <span class="ah-listing-price-delta ${deltaClass}">${deltaLabel}</span>
            </div>
            <div class="ah-listing-seller"><i data-lucide="user"></i>${listing.seller}</div>
        `;

        el.addEventListener("click", () => openBuyModal(listing));
        ui.buyGrid.appendChild(el);
    });

    lucide.createIcons();
}

function renderSellGrid() {
    const cards = getFilteredSellCards();
    ui.sellGrid.innerHTML = "";

    if (!cards.length) {
        ui.sellGrid.innerHTML = `<div class="ah-empty-state"><div class="ah-empty-state-icon">📭</div><span>Aucune carte dans votre collection.</span></div>`;
        lucide.createIcons();
        return;
    }

    cards.forEach(entry => {
        const card = allCards.find(c => c.id === (entry.cardId || entry.id) || c.name === (entry.name || entry.card?.name)) || entry.card || entry;
        if (!card) return;

        const color = getRarityColor(card.rarity);
        const ref = getRefPrice(card);
        const img = card.link || card.imageUrl || card.image || "";

        const el = document.createElement("div");
        el.className = "ah-sell-card";
        el.style.borderColor = `${color}44`;
        el.innerHTML = `
            <div class="ah-sell-card-top">
                <div class="ah-sell-card-thumb">
                    ${img
                        ? `<img src="${img}" alt="${card.name}" onerror="this.style.display='none'">`
                        : `<div class="ah-sell-card-thumb-fallback">${card.emoji || "🃏"}</div>`}
                </div>
                <div class="ah-sell-card-meta">
                    <div class="ah-sell-card-name">${card.name}</div>
                    <div class="ah-sell-card-rarity" style="color:${color}">${(card.rarity || "").replace(/-/g, " ").toUpperCase()}</div>
                    <div class="ah-sell-card-ref">Réf. : ${formatCompact(ref)} 💰</div>
                </div>
            </div>
            <button class="ah-sell-card-btn" type="button">
                <i data-lucide="tag"></i>
                Mettre en vente
            </button>
        `;

        el.querySelector(".ah-sell-card-btn").addEventListener("click", () => openSellModal(card));
        ui.sellGrid.appendChild(el);
    });

    lucide.createIcons();
}

function renderMyListings() {
    ui.myListingsList.innerHTML = "";

    if (!myListings.length) {
        ui.myListingsList.innerHTML = `<div class="ah-empty-state"><div class="ah-empty-state-icon">📋</div><span>Vous n'avez aucune annonce active.</span></div>`;
        lucide.createIcons();
        updateMyListingsCount();
        return;
    }

    myListings.forEach(listing => {
        const card = listing.card;
        const color = getRarityColor(card.rarity);
        const img = card.link || card.imageUrl || card.image || "";

        const el = document.createElement("div");
        el.className = "ah-my-listing-row";
        el.style.borderColor = `${color}44`;
        el.innerHTML = `
            <div class="ah-my-listing-thumb">
                ${img
                    ? `<img src="${img}" alt="${card.name}" onerror="this.style.display='none'">`
                    : (card.emoji || "🃏")}
            </div>
            <div class="ah-my-listing-info">
                <div class="ah-my-listing-name">${card.name}</div>
                <div class="ah-my-listing-meta">
                    <span style="color:${color}">${(card.rarity || "").replace(/-/g, " ")}</span>
                    <span>Réf. : ${formatCompact(listing.refPrice)} 💰</span>
                </div>
            </div>
            <div class="ah-my-listing-price">${formatCompact(listing.price)} 💰</div>
            <button class="ah-my-listing-cancel" type="button">
                <i data-lucide="x"></i>
                Annuler
            </button>
        `;

        el.querySelector(".ah-my-listing-cancel").addEventListener("click", () => {
            myListings = myListings.filter(l => l.id !== listing.id);
            renderMyListings();
        });

        ui.myListingsList.appendChild(el);
    });

    lucide.createIcons();
    updateMyListingsCount();
}

function updateMyListingsCount() {
    const count = myListings.length;
    ui.myListingsCount.textContent = count;
    ui.myListingsCount.classList.toggle("hidden", count === 0);
}

function openBuyModal(listing) {
    buyModalState.listing = listing;
    const card = listing.card;
    const color = getRarityColor(card.rarity);
    const img = card.link || card.imageUrl || card.image || "";

    ui.buyModalImg.src = img;
    ui.buyModalImg.style.display = img ? "block" : "none";
    ui.buyModalName.textContent = card.name;
    ui.buyModalRarity.textContent = (card.rarity || "").replace(/-/g, " ").toUpperCase();
    ui.buyModalRarity.style.color = color;
    ui.buyModalCps.textContent = `⚡ ${formatCompact(card.goldPerSec || 0)}/s`;
    ui.buyModalPrice.textContent = `${formatCompact(listing.price)} 💰`;
    ui.buyModalRef.textContent = `Prix de référence : ${formatCompact(listing.refPrice)} 💰`;
    ui.buyModalSeller.textContent = listing.seller;

    ui.buyModal.classList.remove("hidden");
    document.body.classList.add("no-scroll");
    lucide.createIcons();
}

function closeBuyModal() {
    ui.buyModal.classList.add("hidden");
    updateBodyScroll();
}

function openSellModal(card) {
    sellModalState.card = card;
    const color = getRarityColor(card.rarity);
    const ref = getRefPrice(card);
    const img = card.link || card.imageUrl || card.image || "";
    const minPrice = Math.round(ref * (1 - PRICE_VARIANCE));
    const maxPrice = Math.round(ref * (1 + PRICE_VARIANCE));

    ui.sellModalImg.src = img;
    ui.sellModalImg.style.display = img ? "block" : "none";
    ui.sellModalName.textContent = card.name;
    ui.sellModalRarity.textContent = (card.rarity || "").replace(/-/g, " ").toUpperCase();
    ui.sellModalRarity.style.color = color;
    ui.sellModalCps.textContent = `⚡ ${formatCompact(card.goldPerSec || 0)}/s`;
    ui.sellRefPrice.textContent = `Prix de référence : ${formatCompact(ref)} 💰`;
    ui.sellPriceMin.textContent = `${formatCompact(minPrice)} 💰`;
    ui.sellPriceMax.textContent = `${formatCompact(maxPrice)} 💰`;
    ui.sellPriceSlider.value = 50;
    updateSellPriceDisplay(card);

    ui.sellModal.classList.remove("hidden");
    document.body.classList.add("no-scroll");
    lucide.createIcons();
}

function closeSellModal() {
    ui.sellModal.classList.add("hidden");
    updateBodyScroll();
}

function updateBodyScroll() {
    const buyOpen = !ui.buyModal.classList.contains("hidden");
    const sellOpen = !ui.sellModal.classList.contains("hidden");
    if (buyOpen || sellOpen) {
        document.body.classList.add("no-scroll");
    } else {
        document.body.classList.remove("no-scroll");
    }
}

function getSellPrice(card) {
    const ref = getRefPrice(card);
    const slider = Number(ui.sellPriceSlider.value);
    const factor = (slider / 100) * 2 * PRICE_VARIANCE - PRICE_VARIANCE;
    return Math.round(ref * (1 + factor));
}

function updateSellPriceDisplay(card) {
    const price = getSellPrice(card || sellModalState.card);
    ui.sellPriceDisplay.textContent = `${formatCompact(price)} 💰`;
}

function confirmBuy() {
    const listing = buyModalState.listing;
    if (!listing) return;
    marketListings = marketListings.filter(l => l.id !== listing.id);
    closeBuyModal();
    renderBuyGrid();
}

function confirmSell() {
    const card = sellModalState.card;
    if (!card) return;
    const price = getSellPrice(card);
    const ref = getRefPrice(card);

    myListings.push({
        id: `my-${card.id || card.name}-${Date.now()}`,
        card,
        price,
        refPrice: ref,
        seller: "Moi"
    });

    closeSellModal();
    renderMyListings();
}

function switchTab(tabName) {
    ui.tabs.forEach(t => t.classList.toggle("active", t.dataset.tab === tabName));
    Object.entries(ui.panels).forEach(([name, panel]) => {
        panel.classList.toggle("hidden", name !== tabName);
    });
}

async function init() {
    GlobalLoader.show();

    try {
        const token = await window.BrainrotAuth.waitUntilReady();
        allCards = await fetchAllCards();

        if (allCards.length === 0) {
            allCards = generateMockCards();
        }

        if (token) {
            const raw = await fetchOwnedCards();
            ownedCards = raw.length > 0 ? raw : allCards.slice(0, Math.floor(allCards.length * 0.3));
        } else {
            ownedCards = allCards.slice(0, Math.floor(allCards.length * 0.3));
        }

        marketListings = mockGenerateListings(allCards);
        populateRarityFilters();
        renderBuyGrid();
        renderSellGrid();
        renderMyListings();

    } catch (err) {
        console.error("Erreur init marché:", err);
    } finally {
        GlobalLoader.hide(true);
    }
}

function generateMockCards() {
    const names = ["Tralalelo Tralala", "Bombardiro Crocodilo", "Tung Tung Tung Sahur", "Brrr Brrr Patapim", "Glorbo Frikandel", "Chimpanzini Bananini", "La Vache Cosmique", "Skibidi Phonk", "Ohio Rizz", "Ligma Steve", "Sus Impostor", "NPC Walking"];
    const rarities = ["commun", "rare", "épique", "légendaire", "mythique"];
    return names.map((name, i) => ({
        id: `mock-${i}`,
        name,
        emoji: ["🐊","🦁","🐘","🦊","🐧","🦋","🌊","⚡","🔥","💎","🌙","⭐"][i % 12],
        rarity: rarities[Math.floor(Math.random() * rarities.length)],
        goldPerSec: Math.round(Math.random() * 5000 + 100),
        link: ""
    }));
}

document.addEventListener("DOMContentLoaded", () => {
    lucide.createIcons();

    ui.tabs.forEach(tab => {
        tab.addEventListener("click", () => switchTab(tab.dataset.tab));
    });

    ui.buySearch.addEventListener("input", renderBuyGrid);
    ui.buyFilterRarity.addEventListener("change", renderBuyGrid);
    ui.buySort.addEventListener("change", renderBuyGrid);
    ui.sellSearch.addEventListener("input", renderSellGrid);
    ui.sellFilterRarity.addEventListener("change", renderSellGrid);

    ui.buyModalClose.addEventListener("click", closeBuyModal);
    ui.buyModalOverlay.addEventListener("click", closeBuyModal);
    ui.buyModalConfirm.addEventListener("click", confirmBuy);

    ui.sellModalClose.addEventListener("click", closeSellModal);
    ui.sellModalOverlay.addEventListener("click", closeSellModal);
    ui.sellModalConfirm.addEventListener("click", confirmSell);

    ui.sellPriceSlider.addEventListener("input", () => updateSellPriceDisplay(sellModalState.card));

    document.addEventListener("keydown", e => {
        if (e.key !== "Escape") return;
        if (!ui.sellModal.classList.contains("hidden")) { closeSellModal(); return; }
        if (!ui.buyModal.classList.contains("hidden")) closeBuyModal();
    });

    init();
});