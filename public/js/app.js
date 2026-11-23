'use strict';

const app = document.querySelector('#app');
const toastContainer = document.querySelector('#toast-container');

let member = null;
let currentPage = 'dashboard';
let currentRulesTab = 'basico';
let currentShopTab = 'store';
let membersCache = [];
let cardsCache = [];
let selectedCardId = null;

const API = '/api';

async function api(endpoint, options = {}) {
    const response = await fetch(`${API}${endpoint}`, {
        credentials: 'same-origin',
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        },
        ...options
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.error || data.message || 'Ocorreu um erro.');
    }

    return data;
}

function toast(message, type = 'success') {
    if (!toastContainer) return;

    const element = document.createElement('div');
    element.className = `toast toast-${type}`;
    element.textContent = message;
    toastContainer.appendChild(element);

    setTimeout(() => element.remove(), 3500);
}

function escapeHTML(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll(String.fromCharCode(34), "&quot;")
        .replaceAll(String.fromCharCode(39), "&#039;");
}

function formatYen(value) {
    return `${Number(value || 0).toLocaleString('pt-PT')} ¥`;
}

function roleLabel(role) {
    return ({
        owner: 'Proprietário',
        hacker: 'Hacker',
        clan_admin: 'Administrador de clã',
        member: 'Membro'
    }[role] || 'Membro');
}


const HIGH_TIER_RANKS = ["sannin", "daimyo", "kage", "anciao", "rikudou", "deus shinobi", "imperador shinobi", "lenda shinobi"];
const ALL_RPG_RANKS = ["Gennin", "Chunin", "Jounin", "Anbu", "Akatsuki", "Sannin", "Daimyo", "Kage", "Anciao", "Rikudou", "Deus Shinobi", "Imperador Shinobi", "Lenda Shinobi"];
function canPromoteToHighRankUI() {
    const nick = String(member?.nickname || "").trim().toLowerCase();
    const role = String(member?.site_role || "").trim().toLowerCase();
    return hasNemFudendoPowerUI();
}
function hasNemFudendoPowerUI() {
    const nick = String(member?.nickname || "").trim().toLowerCase();
    const role = String(member?.site_role || "").trim().toLowerCase();
    const rnk = String(member?.rank || "").trim().toLowerCase();
    return ["madrack", "levi"].includes(nick) || ["owner", "hacker"].includes(role) || HIGH_TIER_RANKS.includes(rnk);
}

function isFullAccess() {
    return ['owner', 'hacker'].includes(member?.site_role);
}

function isClanAdmin() {
    return member?.site_role === 'clan_admin' &&
        Number(member?.is_clan_leader) === 1;
}

function canManageMembers() {
    return isFullAccess() || isClanAdmin();
}

function clanName(value) {
    if (typeof value === 'object' && value !== null) {
        return value.name || value.clan_name || 'Sem clã';
    }
    return value || 'Sem clã';
}

function showLogin() {
    app.innerHTML = `
        <main class="auth-screen">
            <section class="auth-card">
                <div class="auth-symbol">写輪眼</div>
                <p class="eyebrow">SHINOBI VERSE</p>
                <h1>Acesso Ninja</h1>
                <p class="muted">Entra na tua conta para aceder à associação.</p>

                <form id="login-form" class="form-stack">
                    <label>
                        Nome de utilizador
                        <input name="username" autocomplete="username"
                            placeholder="O teu utilizador" required>
                    </label>
                    <label>
                        Palavra-passe
                        <span data-eye-wrap style="position:relative;display:flex;align-items:center;width:100%;"><input style="padding-right:76px;" name="password" type="password"
                            autocomplete="current-password"
                            placeholder="A tua palavra-passe" required><button type="button" data-eye-btn aria-label="Alternar visibilidade da senha" style="position:absolute;right:10px;background:transparent;border:1px solid rgba(255,255,255,0.16);border-radius:4px;color:inherit;opacity:0.78;cursor:pointer;padding:2px 7px;font-size:10px;letter-spacing:0.06em;line-height:1.2;">VER</button></span>
                    </label>
                    <button class="primary-button" type="submit">ENTRAR</button>
                </form>
                <p class="auth-footer">Acesso exclusivo aos membros autorizados.</p>
            </section>
        </main>
    `;

    document.querySelector('#login-form').addEventListener('submit', login);
}

async function login(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    try {
        const data = await api('/auth/login', {
            method: 'POST',
            body: JSON.stringify({
                loginUsername: form.get('username'),
                password: form.get('password')
            })
        });

        member = data.member;
        render();
    } catch (error) {
        toast(error.message, 'error');
    }
}

function showPasswordChange() {
    app.innerHTML = `
        <main class="auth-screen">
            <section class="auth-card">
                <div class="auth-symbol">🔒</div>
                <p class="eyebrow">SEGURANÇA DA CONTA</p>
                <h1>Altera a tua senha</h1>
                <p class="muted">
                    Antes de continuares, precisas de definir uma nova palavra-passe.
                </p>

                <form id="password-form" class="form-stack">
                    <label>
                        Palavra-passe atual
                        <span data-eye-wrap style="position:relative;display:flex;align-items:center;width:100%;"><input style="padding-right:76px;" name="currentPassword" type="password"
                            autocomplete="current-password" required><button type="button" data-eye-btn aria-label="Alternar visibilidade da senha" style="position:absolute;right:10px;background:transparent;border:1px solid rgba(255,255,255,0.16);border-radius:4px;color:inherit;opacity:0.78;cursor:pointer;padding:2px 7px;font-size:10px;letter-spacing:0.06em;line-height:1.2;">VER</button></span>
                    </label>
                    <label>
                        Nova palavra-passe
                        <span data-eye-wrap style="position:relative;display:flex;align-items:center;width:100%;"><input style="padding-right:76px;" name="newPassword" type="password"
                            autocomplete="new-password" minlength="8" required><button type="button" data-eye-btn aria-label="Alternar visibilidade da senha" style="position:absolute;right:10px;background:transparent;border:1px solid rgba(255,255,255,0.16);border-radius:4px;color:inherit;opacity:0.78;cursor:pointer;padding:2px 7px;font-size:10px;letter-spacing:0.06em;line-height:1.2;">VER</button></span>
                    </label>
                    <label>
                        Confirmar nova palavra-passe
                        <span data-eye-wrap style="position:relative;display:flex;align-items:center;width:100%;"><input style="padding-right:76px;" name="confirmPassword" type="password"
                            autocomplete="new-password" minlength="8" required><button type="button" data-eye-btn aria-label="Alternar visibilidade da senha" style="position:absolute;right:10px;background:transparent;border:1px solid rgba(255,255,255,0.16);border-radius:4px;color:inherit;opacity:0.78;cursor:pointer;padding:2px 7px;font-size:10px;letter-spacing:0.06em;line-height:1.2;">VER</button></span>
                    </label>
                    <button class="primary-button" type="submit">
                        ATUALIZAR SENHA
                    </button>
                </form>
            </section>
        </main>
    `;

    document.querySelector('#password-form')
        .addEventListener('submit', updatePassword);
}

async function updatePassword(event) {
    event.preventDefault();

    const form = new FormData(event.currentTarget);
    const currentPassword = form.get('currentPassword');
    const newPassword = form.get('newPassword');
    const confirmPassword = form.get('confirmPassword');

    if (newPassword !== confirmPassword) {
        return toast('As novas senhas não coincidem.', 'error');
    }

    try {
        const data = await api('/auth/password', {
            method: 'PUT',
            body: JSON.stringify({ currentPassword, newPassword })
        });

        member = data.member;
        toast('Palavra-passe atualizada com sucesso.');
        render();
    } catch (error) {
        toast(error.message, 'error');
    }
}

function render() {
    if (!member) {
        showLogin();
        return;
    }

    if (Number(member.must_change_password) === 1) {
        showPasswordChange();
        return;
    }

    showLayout();
}

function showLayout() {
    const navItems = [
        ['dashboard', '⌂', 'Dashboard'],
        ['chat', '◈', 'Chat'],
        ['shop', '❖', 'Loja de Cards'],
        ['inventory', '◫', 'Inventário'],
        ['how-to-play', '◧', 'Como Jogar'],
        ['feed', '▤', 'Shinobi Network'],
        ['ranking', '♛', 'Shinobi Ranking'],
        ['ninja-search', '⌕', 'Procurar Ninjas'],
        ['profile', '◉', 'Meu Perfil'],
        ['clans', '⌘', 'Clãs'],
        ['settings', '⚙', 'Configurações']
    ];

    if (canManageMembers()) {
        navItems.push(['admin', '🛡', 'Administração']);
    }

    app.innerHTML = `
        <div class="app-container">
            <aside class="sidebar">
                <div class="brand">
                    <div class="brand-mark">写</div>
                    <div>
                        <strong>SHINOBI</strong>
                        <span>VERSE</span>
                    </div>
                </div>

                <div class="sidebar-caption">MENU PRINCIPAL</div>
                <nav class="navigation">
                    ${navItems.map(([page, icon, label]) => `
                        <button class="nav-item ${currentPage === page ? 'active' : ''}"
                            data-page="${page}">
                            <span>${icon}</span>${label}
                        </button>
                    `).join('')}
                </nav>

                <div class="sidebar-bottom">
                    <div class="sidebar-user">
                        <div class="avatar-small">${member.avatar_path
                            ? `<img src="/${escapeHTML(member.avatar_path)}" alt="Foto de ${escapeHTML(member.nickname)}">`
                            : escapeHTML((member.nickname || '?').charAt(0).toUpperCase())
                        }</div>
                        <div class="sidebar-user-info">
                            <strong>${escapeHTML(member.nickname)}</strong>
                            <span>${escapeHTML(roleLabel(member.site_role))}</span>
                        </div>
                    </div>
                    <button id="logout-button" class="logout-button">
                        ↪ Terminar sessão
                    </button>
                </div>
            </aside>

            <main class="main-content">
                <header class="topbar">
                    <div>
                        <p class="breadcrumb">SHINOBI VERSE / <span id="breadcrumb-page"></span></p>
                        <h2 id="page-heading">Dashboard</h2>
                    </div>
                    <div class="topbar-user">
                        <span class="status-dot"></span>
                        <span>${escapeHTML(member.nickname)}</span>
                    </div>
                </header>

                <section id="page-content" class="page-content"></section>
            </main>
        </div>
    `;

    document.querySelectorAll('[data-page]').forEach(button => {
        button.addEventListener('click', () => navigate(button.dataset.page));
    });

    document.querySelector('#logout-button').addEventListener('click', logout);

    renderPage();
}

function navigate(page) {
    currentPage = page;
    selectedCardId = null;
    if (page === 'inventory') {
        currentShopTab = 'inventory';
    } else if (page === 'shop') {
        currentShopTab = 'store';
    }
    showLayout();
}

function setPageHeading(title) {
    document.querySelector('#breadcrumb-page').textContent = title.toUpperCase();
    document.querySelector('#page-heading').textContent = title;
}

function renderPage() {
    const content = document.querySelector('#page-content');

    if (currentPage === 'chat') {
        setPageHeading('CHAT');
        renderChat(content);
    } else if (currentPage === 'shop') {
        currentShopTab = 'store';
        setPageHeading('LOJA DE CARDS');
        renderCardShop(content);
    } else if (currentPage === 'inventory') {
        currentShopTab = 'inventory';
        setPageHeading('INVENTÁRIO');
        renderCardShop(content);
    } else if (currentPage === 'how-to-play') {
        setPageHeading('COMO JOGAR');
        renderHowToPlay(content);
    } else if (currentPage === 'ninja-search') {
        setPageHeading('PROCURAR NINJAS');
        renderNinjaSearch(content);
    } else if (currentPage === 'feed') {
        setPageHeading('SHINOBI NETWORK');
        renderFeed(content);
    } else if (currentPage === 'ranking') {
        setPageHeading('SHINOBI RANKING');
        renderRanking(content);
    } else if (currentPage === 'profile') {
        setPageHeading('Meu perfil');
        renderProfile(content);
    } else if (currentPage === 'clans') {
        setPageHeading('Clãs');
        renderClans(content);
    } else if (currentPage === 'settings') {
        setPageHeading('Configurações');
        renderSettings(content);
    } else if (currentPage === 'admin' && canManageMembers()) {
        setPageHeading('Administração');
        renderAdmin(content);
    } else {
        currentPage = 'dashboard';
        setPageHeading('Dashboard');
        renderDashboard(content);
    }
}

function stylizeGothicTitle(text) {
    const map = {
        'a': '𝔞', 'b': '𝔟', 'c': '𝔠', 'd': '𝔡', 'e': '𝔢', 'f': '𝔣', 'g': '𝔤',
        'h': '𝔥', 'i': '𝔦', 'j': '𝔧', 'k': '𝔨', 'l': '𝔩', 'm': '𝔪', 'n': '𝔫',
        'o': '𝔬', 'p': '𝔭', 'q': '𝔮', 'r': '𝔯', 's': '𝔰', 't': '𝔱', 'u': '𝔲',
        'v': '𝔳', 'w': '𝔴', 'x': '𝔵', 'y': '𝔶', 'z': '𝔷',
        'A': '𝔄', 'B': '𝔅', 'C': 'ℭ', 'D': '𝔇', 'E': '𝔈', 'F': '𝔉', 'G': '𝔊',
        'H': 'ℌ', 'I': 'ℑ', 'J': '𝔍', 'K': '𝔎', 'L': '𝔏', 'M': '𝔐', 'N': '𝔑',
        'O': '𝔒', 'P': '𝔓', 'Q': '𝔔', 'R': 'ℜ', 'S': '𝔖', 'T': '𝔗', 'U': '𝔘',
        'V': '𝔙', 'W': '𝔚', 'X': '𝔛', 'Y': '𝔜', 'Z': 'ℨ'
    };
    return String(text || '').split('').map(ch => map[ch] || ch).join('');
}

function formatCardTextForCopy(card) {
    const titleLine = `🔰💣 *${card.title}* 💣🔰`;
    const authorLine = card.author_tag ? `   ✧ ${stylizeGothicTitle(card.author_tag)} ✧` : '';
    const statsLines = [
        `⚡ *Categoria:* ${card.category || 'Bukijutsu'}`,
        `🔹 *Chakra:* ${card.chakra_cost || '0%'}`,
        `🔺 *Dano:* ${card.damage_power || '0%'}`
    ];
    const descLine = `📜 *Descrição:* ${card.description || ''}`;
    const effectLine = card.effect_text ? `🔥 *Efeito:* ${card.effect_text}` : '';

    return [
        titleLine,
        authorLine,
        '━━━━━━━━━━━━━━',
        ...statsLines,
        '━━━━━━━━━━━━━━',
        descLine,
        effectLine
    ].filter(Boolean).join('\n');
}

async function copyCardToClipboard(card) {
    const text = formatCardTextForCopy(card);
    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
        } else {
            const area = document.createElement('textarea');
            area.value = text;
            document.body.appendChild(area);
            area.select();
            document.execCommand('copy');
            area.remove();
        }
        toast('Card copiado com estilo!');
    } catch {
        toast('Não foi possível copiar o card.', 'error');
    }
}

async function renderCardShop(content) {
    const isAdmin = isFullAccess();
    const isInventory = currentShopTab === 'inventory';

    content.innerHTML = `
        <section class="rules-hero">
            <div class="panel-heading" style="margin-bottom:0;">
                <div>
                    <p class="eyebrow">${isInventory ? 'MOCHILA SHINOBI' : 'ARSENAL SHINOBI'} · CARTEIRA: ${escapeHTML(formatYen(member.yen))}</p>
                    <h1>${isInventory ? 'MEU <span>INVENTÁRIO</span>' : 'LOJA DE <span>CARDS</span>'}</h1>
                    <p class="muted">${isInventory
                        ? 'Seus cards comprados. Veja detalhes, troque a imagem ou copie para luta.'
                        : 'Compre cada card uma única vez, abra os detalhes ou troque a imagem da galeria.'
                    }</p>
                </div>
                ${isAdmin && !isInventory ? '<button class="primary-button" id="open-add-card">+ Novo card</button>' : ''}
            </div>
        </section>

        <div class="rules-tabs" id="shop-tabs">
            <button class="rules-tab ${!isInventory ? 'active' : ''}" data-shop-tab="store">Loja</button>
            <button class="rules-tab ${isInventory ? 'active' : ''}" data-shop-tab="inventory">Inventário</button>
        </div>

        <section id="card-admin-area"></section>
        <section id="card-detail-area"></section>

        <section id="shop-grid" class="shop-grid">
            <p class="muted">A carregar cards...</p>
        </section>
    `;

    document.querySelectorAll('#shop-tabs .rules-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            currentShopTab = btn.dataset.shopTab;
            currentPage = currentShopTab === 'inventory' ? 'inventory' : 'shop';
            selectedCardId = null;
            renderCardShop(content);
        });
    });

    if (isAdmin && !isInventory) {
        document.querySelector('#open-add-card')
            ?.addEventListener('click', () => renderCardCreator(content));
    }

    await loadShopCards(content);
}

function renderCardCreator(content) {
    const area = document.querySelector('#card-admin-area');
    if (!area) return;

    area.innerHTML = `
        <section class="section-panel editor-panel">
            <div class="panel-heading">
                <div>
                    <p class="eyebrow">MODO ADM</p>
                    <h2>Adicionar novo card</h2>
                </div>
                <button class="secondary-button" type="button" id="close-card-creator">Fechar</button>
            </div>

            <form id="create-card-form" class="form-grid">
                <label>
                    Nome do card
                    <input name="title" maxlength="60" placeholder="Ex: Papel Bomba" required>
                </label>

                <label>
                    Autor / Tag (opcional)
                    <input name="authorTag" maxlength="60" placeholder="Ex: Forja Ferrari">
                </label>

                <label>
                    Categoria
                    <input name="category" maxlength="40" value="Bukijutsu" required>
                </label>

                <label>
                    Preço em Yens
                    <input name="priceYen" type="number" min="0" step="1" value="150" required>
                </label>

                <label>
                    Custo de Chakra
                    <input name="chakraCost" maxlength="40" value="20% 🔹" required>
                </label>

                <label>
                    Dano / Potência
                    <input name="damagePower" maxlength="40" value="130% 🔺" required>
                </label>

                <label class="form-full">
                    Efeito extra (opcional)
                    <input name="effectText" maxlength="120" placeholder="Ex: -20% 💔 de queimadura por round">
                </label>

                <label class="form-full">
                    Descrição
                    <textarea name="description" maxlength="1500" rows="4"
                        style="width:100%;padding:12px;background:#090909;color:#eee;border:1px solid #303030;border-radius:6px;"
                        placeholder="Explica como a técnica funciona..." required></textarea>
                </label>

                <label class="form-full">
                    Imagem do card da galeria (JPG, PNG ou WEBP · máx. 3 MB)
                    <input name="image" type="file" accept="image/jpeg,image/png,image/webp">
                </label>

                <div class="form-full form-actions">
                    <button class="primary-button" type="submit">SALVAR CARD</button>
                </div>
            </form>
        </section>
    `;

    document.querySelector('#close-card-creator')
        ?.addEventListener('click', () => { area.innerHTML = ''; });

    document.querySelector('#create-card-form')
        ?.addEventListener('submit', async event => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);

            try {
                const res = await fetch(`${API}/cards`, {
                    method: 'POST',
                    credentials: 'same-origin',
                    body: form
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) {
                    throw new Error(data.error || 'Erro ao adicionar card.');
                }
                toast('Card adicionado à loja!');
                area.innerHTML = '';
                await loadShopCards(content);
            } catch (error) {
                toast(error.message, 'error');
            }
        });
}

async function uploadCardImage(cardId, file, content) {
    if (!file) return;
    const formData = new FormData();
    formData.append('image', file);

    try {
        const res = await fetch(`${API}/cards/${cardId}/image`, {
            method: 'PUT',
            credentials: 'same-origin',
            body: formData
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new Error(data.error || 'Não foi possível trocar a imagem.');
        }
        toast('Imagem do card atualizada!');
        await loadShopCards(content);
    } catch (error) {
        toast(error.message, 'error');
    }
}

async function loadShopCards(content) {
    const grid = document.querySelector('#shop-grid');
    if (!grid) return;

    try {
        const data = await api('/cards');
        const allCards = data.cards || [];
        cardsCache = allCards;

        const visibleCards = currentShopTab === 'inventory'
            ? allCards.filter(c => Number(c.owned_quantity || 0) > 0)
            : allCards;

        if (!visibleCards.length) {
            grid.innerHTML = currentShopTab === 'inventory'
                ? '<p class="muted">Você ainda não comprou nenhum card. Vá na aba Loja para adquirir.</p>'
                : '<p class="muted">Nenhum card disponível na loja.</p>';
            return;
        }

        grid.innerHTML = visibleCards.map(card => {
            const owned = Number(card.owned_quantity || 0) > 0;
            return `
                <article class="shop-card">
                    <div class="shop-card-thumb">
                        ${card.image_path
                            ? `<img src="/${escapeHTML(card.image_path)}" alt="${escapeHTML(card.title)}">`
                            : '<span class="shop-card-emblem">🃏</span>'
                        }
                    </div>
                    <div class="shop-card-body">
                        <h3>${escapeHTML(card.title)}</h3>
                        <div class="shop-card-meta">
                            <span class="shop-card-price">${formatYen(card.price_yen)}</span>
                            <span class="muted">${owned ? 'Comprado' : 'Disponível'}</span>
                        </div>
                        <div class="shop-card-actions" style="flex-wrap:wrap;">
                            <button class="secondary-button" data-view-card="${Number(card.id)}" style="flex:1;">Ver detalhes</button>
                            <label class="secondary-button" style="cursor:pointer;display:inline-flex;align-items:center;justify-content:center;">
                                <span>Foto</span>
                                <input type="file" accept="image/jpeg,image/png,image/webp" data-card-photo="${Number(card.id)}" style="display:none;">
                            </label>
                            ${currentShopTab !== 'inventory' ? (
                                owned
                                    ? `<button class="secondary-button" type="button" disabled style="opacity:.6;cursor:not-allowed;">Indisponível</button>`
                                    : `<button class="primary-button" data-buy-card="${Number(card.id)}">Comprar</button>`
                            ) : ''}
                        </div>
                    </div>
                </article>
            `;
        }).join('');

        grid.querySelectorAll('[data-view-card]').forEach(btn => {
            btn.addEventListener('click', () => {
                selectedCardId = Number(btn.dataset.viewCard);
                renderCardDetail(content);
            });
        });

        grid.querySelectorAll('[data-card-photo]').forEach(input => {
            input.addEventListener('change', async () => {
                const file = input.files?.[0];
                const id = Number(input.dataset.cardPhoto);
                if (file) {
                    await uploadCardImage(id, file, content);
                }
                input.value = '';
            });
        });

        grid.querySelectorAll('[data-buy-card]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = Number(btn.dataset.buyCard);
                try {
                    const res = await api(`/cards/${id}/buy`, { method: 'POST' });
                    if (res.member) member = res.member;
                    toast(res.message || 'Card comprado!');
                    renderCardShop(content);
                } catch (error) {
                    toast(error.message, 'error');
                }
            });
        });

        if (selectedCardId) {
            renderCardDetail(content);
        }
    } catch (error) {
        grid.innerHTML = `<p class="error-text">${escapeHTML(error.message)}</p>`;
    }
}

function renderCardDetail(content) {
    const detailArea = document.querySelector('#card-detail-area');
    if (!detailArea) return;

    const card = cardsCache.find(item => Number(item.id) === Number(selectedCardId));
    if (!card) {
        detailArea.innerHTML = '';
        return;
    }

    detailArea.innerHTML = `
        <section class="section-panel editor-panel">
            <div class="panel-heading">
                <div>
                    <p class="eyebrow">DETALHES DO CARD</p>
                    <h2>${escapeHTML(card.title)}</h2>
                    ${card.author_tag ? `<p class="muted">Criação: ${escapeHTML(card.author_tag)}</p>` : ''}
                </div>
                <button class="secondary-button" type="button" id="close-card-detail">Fechar</button>
            </div>

            <div class="card-detail-parts">
                <div class="card-part-box">
                    <strong>ATRIBUTOS</strong>
                    <p>Categoria: ${escapeHTML(card.category || 'Bukijutsu')} · Chakra: ${escapeHTML(card.chakra_cost || '0%')} · Dano: ${escapeHTML(card.damage_power || '0%')}</p>
                </div>

                <div class="card-part-box">
                    <strong>DESCRIÇÃO</strong>
                    <p>${escapeHTML(card.description || '')}</p>
                </div>

                ${card.effect_text ? `
                    <div class="card-part-box">
                        <strong>EFEITO</strong>
                        <p>${escapeHTML(card.effect_text)}</p>
                    </div>
                ` : ''}
            </div>

            <div class="card-copy-footer" style="gap:10px;flex-wrap:wrap;">
                <label class="secondary-button" style="cursor:pointer;display:inline-flex;align-items:center;">
                    <span>Trocar imagem da galeria</span>
                    <input type="file" accept="image/jpeg,image/png,image/webp" id="detail-card-photo" style="display:none;">
                </label>
                <button class="primary-button" type="button" id="copy-card-btn">Copiar card</button>
            </div>
        </section>
    `;

    document.querySelector('#close-card-detail')?.addEventListener('click', () => {
        selectedCardId = null;
        detailArea.innerHTML = '';
    });

    document.querySelector('#detail-card-photo')?.addEventListener('change', async e => {
        const file = e.target.files?.[0];
        if (file) {
            await uploadCardImage(card.id, file, content);
        }
        e.target.value = '';
    });

    document.querySelector('#copy-card-btn')?.addEventListener('click', () => {
        copyCardToClipboard(card);
    });
}

function renderHowToPlay(content) {
    const ranks = [
        ['Lenda Shinobi', '1.500% ❤️ · 2.500% 🔹'],
        ['Imperador Shinobi', '1.400% ❤️ · 2.350% 🔹'],
        ['Deus Shinobi', '1.300% ❤️ · 2.200% 🔹'],
        ['Rikudou', '1.200% ❤️ · 2.200% 🔹'],
        ['Anciao', '1.100% ❤️ · 2.000% 🔹'],
        ['Kage', '1.000% ❤️ · 1.800% 🔹'],
        ['Daimyo', '900% ❤️ · 1.600% 🔹'],
        ['Sannin', '800% ❤️ · 1.400% 🔹'],
        ['Akatsuki', '600% ❤️ · 1.200% 🔹'],
        ['Anbu', '500% ❤️ · 1.000% 🔹'],
        ['Jounin', '400% ❤️ · 800% 🔹'],
        ['Chunin', '300% ❤️ · 600% 🔹'],
        ['Gennin', '200% ❤️ · 400% 🔹']
    ];

    const sections = {
        basico: `
            <div class="rules-grid">
                <article class="rules-card">
                    <h3>Inicio como Gennin</h3>
                    <ul>
                        <li>Todo mundo entra como <strong>Gennin</strong> e evolui com missoes, eventos e exames.</li>
                        <li><strong>Vida (HP):</strong> Se zerar, voce perde. Gennin comeca com <strong>200% ❤️</strong>.</li>
                        <li><strong>Chakra:</strong> Energia para jutsus. Se acabar, sobra apenas Taijutsu basico. Gennin comeca com <strong>400% 🔹</strong>.</li>
                    </ul>
                </article>

                <article class="rules-card">
                    <h3>Dinamica do Placar</h3>
                    <ul>
                        <li>Mostra nome, cla, vida e chakra dos dois lados.</li>
                        <li>Alternancia padrao: um joga <strong>Falha</strong> e o outro <strong>Taijutsu</strong>, depois invertem.</li>
                        <li><strong>Dica:</strong> Nao abra com ninjutsu ofensivo direto; comece com <strong>Falha</strong> para ler o ritmo e evitar reflexo/jutsu maior.</li>
                    </ul>
                    <div class="rules-example">Exemplo: Gloxinia usa Ninjutsu (50% dano / 50% chakra) vs Droly com Taijutsu.
Droly vai para 150% ❤️ e Gloxinia para 350% 🔹.</div>
                </article>
            </div>

            <section class="section-panel">
                <div class="panel-heading">
                    <div>
                        <p class="eyebrow">HIERARQUIA</p>
                        <h2>Patentes do RPG</h2>
                    </div>
                </div>
                <div class="ranks-grid">
                    ${ranks.map(([name, stats]) => `
                        <div class="rank-item">
                            <strong>${escapeHTML(name)}</strong>
                            <span>${escapeHTML(stats)}</span>
                        </div>
                    `).join('')}
                </div>
            </section>
        `,
        combate: `
            <div class="rules-grid">
                <article class="rules-card">
                    <h3>Falha</h3>
                    <ul>
                        <li>So funciona se for jogada <strong>em primeiro</strong> no round.</li>
                        <li>Falha qualquer jutsu ou taijutsu — <strong>exceto Fuga e Camuflagem</strong>.</li>
                        <li>Se jogada primeiro, tambem falha <strong>ativacao</strong>.</li>
                    </ul>
                </article>

                <article class="rules-card">
                    <h3>Genjutsu (Basico e Espelho)</h3>
                    <ul>
                        <li><strong>Basico:</strong> Funciona como Falha, mas falha tudo <strong>menos Fuga</strong>.</li>
                        <li><strong>Espelho:</strong> Devolve ninjutsu a distancia ou normal ao inimigo, exceto <em>Clone, Ataque/Defesa e Paralisia</em>.</li>
                    </ul>
                </article>

                <article class="rules-card">
                    <h3>Taijutsus</h3>
                    <ul>
                        <li><strong>Basico a distancia:</strong> Kunais/shurikens. Ambos levam dano se ambos usarem.</li>
                        <li><strong>Basico corpo a corpo:</strong> Ganha de a distancia; se ambos usarem o mesmo basico, ambos sofrem dano.</li>
                        <li><strong>Especial (1x por partida):</strong> 130% supera 200% > 150% > 180%. 180% perde para todos exceto basico (ambos levam dano). Se empatar no especial, quem jogou primeiro vence.</li>
                        <li><strong>Lendario (400% / 450%):</strong> Supera especial e basico. <strong>Ninjutsu</strong> anula taijutsu.</li>
                    </ul>
                </article>

                <article class="rules-card">
                    <h3>Clones e Ninjutsu</h3>
                    <ul>
                        <li><strong>Clone em ataque:</strong> Vira ninjutsu de ataque e e destruido ao fim do golpe.</li>
                        <li><strong>Clone em defesa:</strong> Protege ate ser destruido; bom contra defesa simples.</li>
                        <li><strong>Paralisia vs Clone:</strong> Se o clone ja estava ativo (<em>Clone ON</em>), segura o golpe. Se a paralisia veio antes, o clone sai <em>OFF</em>.</li>
                        <li><strong>Ninjutsu:</strong> Maior anula menor; iguais se anulam; atravessa taijutsu. <strong>Ataque/Defesa</strong> defende e ataca ao mesmo tempo.</li>
                    </ul>
                </article>
            </div>
        `,
        habilidades: `
            <div class="rules-grid">
                <article class="rules-card">
                    <h3>Paralisacao</h3>
                    <ul>
                        <li><strong>Ninjutsu + Paralisia:</strong> Nao se anulam; ambos podem acertar conforme a ordem e o HP.</li>
                        <li><strong>Ativacao + Paralisia:</strong> Entra em countdown e so volta a contar no final do proximo turno apos sair da paralisia.</li>
                        <li><strong>60% e 70%:</strong> Sofrem dano de taijutsu e ninjutsu maior; 70% vence no mesmo round, 60% ganha de genjutsu e queimadura.</li>
                        <li><strong>Queimadura vs Genjutsu:</strong> Quem joga primeiro vence o outro (genjutsu primeiro tambem supera 60% de dano).</li>
                    </ul>
                </article>

                <article class="rules-card">
                    <h3>Fuga, HP, Imunidade e Desempate</h3>
                    <ul>
                        <li><strong>Fuga:</strong> Escapa de ninjutsu, falha e taijutsu (salvo rastreamento; fuga imune a rastreio escapa de tudo).</li>
                        <li><strong>Aumento de HP:</strong> Pode ultrapassar o HP base do nivel (diferente de regeneracao, que so recupera o perdido).</li>
                        <li><strong>Ativacao / Imunidade:</strong> Ate 6 ativacoes por round ate usar ninjutsu, genjutsu, falha ou taijutsu. Falha nao anula ativacao ja feita.</li>
                        <li><strong>Desempate:</strong> Se ambos zeram o HP, vence quem tiver mais chakra; empatou, olha o chakra do round anterior e depois o HP do round anterior.</li>
                    </ul>
                </article>
            </div>
        `,
        progressao: `
            <div class="rules-grid">
                <article class="rules-card">
                    <h3>Exames, Torneios e Eventos</h3>
                    <ul>
                        <li><strong>Exames de Graduacao:</strong> Lutas para subir de patente usando cards de missao e evento.</li>
                        <li><strong>Torneios e Eventos:</strong> Acontecem na vila ou no cla (Arma, Yen, recrutamento e eventos de cla).</li>
                    </ul>
                </article>

                <article class="rules-card">
                    <h3>Como Recrutar</h3>
                    <ul>
                        <li>Apos entrar no cla e fazer missoes, surgem missoes que pedem recrutamento.</li>
                        <li>Convide o amigo, explique o RPG e deixe <strong>ele</strong> escolher o cla e o nick.</li>
                        <li>Nao force se ele recusar e fale com o Sensei do cla em caso de duvida.</li>
                    </ul>
                </article>
            </div>
        `
    };

    content.innerHTML = `
        <section class="rules-hero">
            <p class="eyebrow">GUIA OFICIAL · LEVI</p>
            <h1>COMO <span>JOGAR</span></h1>
            <p class="muted">Regras resumidas do RPG da Associacao Ninja, diretas ao ponto.</p>
        </section>

        <div class="rules-tabs" id="rules-tabs">
            <button class="rules-tab ${currentRulesTab === 'basico' ? 'active' : ''}" data-tab="basico">Basico & Patentes</button>
            <button class="rules-tab ${currentRulesTab === 'combate' ? 'active' : ''}" data-tab="combate">Combate & Lutas SC</button>
            <button class="rules-tab ${currentRulesTab === 'habilidades' ? 'active' : ''}" data-tab="habilidades">Paralisia & Habilidades</button>
            <button class="rules-tab ${currentRulesTab === 'progressao' ? 'active' : ''}" data-tab="progressao">Exames & Recruta</button>
        </div>

        <section id="rules-body">${sections[currentRulesTab] || sections.basico}</section>
    `;

    document.querySelectorAll('#rules-tabs .rules-tab').forEach(button => {
        button.addEventListener('click', () => {
            currentRulesTab = button.dataset.tab;
            renderHowToPlay(content);
        });
    });
}

function renderDashboard(content) {
    content.innerHTML = `
        <section class="welcome-section">
            <div class="welcome-copy">
                <p class="eyebrow">BEM-VINDO À ASSOCIAÇÃO NINJA</p>
                <h1>Olá, <span>${escapeHTML(member.nickname)}</span>.</h1>
                <p>O teu caminho ninja continua. A tua história ainda está a ser escrita.</p>
            </div>
            <div class="sharingan-decoration"><span>写</span></div>
        </section>

        <section class="statistics">
            <article class="stat-card">
                <span class="stat-label">PATENTE</span>
                <strong>${escapeHTML(member.rank || 'Gennin')}</strong>
                <span class="stat-note">Classificação ninja</span>
            </article>
            <article class="stat-card">
                <span class="stat-label">CLÃ</span>
                <strong>${escapeHTML(clanName(member.clan))}</strong>
                <span class="stat-note">A tua linhagem</span>
            </article>
            <article class="stat-card">
                <span class="stat-label">CARGO</span>
                <strong>${escapeHTML(member.title || 'Sem cargo')}</strong>
                <span class="stat-note">O teu título</span>
            </article>
            <article class="stat-card">
                <span class="stat-label">CARTEIRA</span>
                <strong>${formatYen(member.yen)}</strong>
                <span class="stat-note">Yens disponíveis</span>
            </article>
        </section>

        <section class="section-panel">
            <div class="panel-heading">
                <div>
                    <p class="eyebrow">IDENTIDADE NINJA</p>
                    <h2>O teu caminho</h2>
                </div>
                <button class="secondary-button" id="go-profile">Ver perfil</button>
            </div>
            <p class="muted">
                Cumpre missões, participa nos eventos e conquista o teu lugar
                no mundo ninja.
            </p>
        </section>
    `;

    document.querySelector('#go-profile')
        .addEventListener('click', () => navigate('profile'));
}

function renderNinjaSearch(content, initialQuery = '') {
    content.innerHTML = `
        <section class="section-panel ninja-search-panel">
            <div class="panel-heading">
                <div>
                    <p class="eyebrow">REGISTO SHINOBI</p>
                    <h2>Procurar ninjas</h2>
                    <p class="muted">Encontra qualquer ninja da associação pelo seu nickname.</p>
                </div>
            </div>

            <label class="ninja-search-box">
                <span>⌕</span>
                <input
                    id="ninja-search-input"
                    type="search"
                    maxlength="40"
                    autocomplete="off"
                    placeholder="Escreve o nickname..."
                    value="${escapeHTML(initialQuery)}"
                >
            </label>

            <p class="muted ninja-search-hint">
                Escreve pelo menos 2 caracteres para pesquisar.
            </p>

            <div id="ninja-search-results" class="ninja-search-results">
                ${initialQuery.length >= 2
                    ? '<p class="muted">A pesquisar ninjas...</p>'
                    : '<p class="muted">Os resultados aparecerão aqui.</p>'
                }
            </div>
        </section>
    `;

    const input = document.querySelector('#ninja-search-input');
    const results = document.querySelector('#ninja-search-results');

    let requestNumber = 0;

    async function search(query) {
        const currentRequest = ++requestNumber;
        const term = query.trim();

        if (term.length < 2) {
            results.innerHTML = '<p class="muted">Escreve pelo menos 2 caracteres para pesquisar.</p>';
            return;
        }

        results.innerHTML = '<p class="muted">A procurar ninjas...</p>';

        try {
            const data = await api(`/members/search?q=${encodeURIComponent(term)}`);

            if (currentRequest !== requestNumber) return;

            const ninjas = data.members || [];

            if (!ninjas.length) {
                results.innerHTML = '<p class="muted">Nenhum ninja encontrado com esse nickname.</p>';
                return;
            }

            results.innerHTML = ninjas.map(ninja => `
                <button type="button"
                    class="ninja-search-result"
                    data-ninja-id="${Number(ninja.id)}">
                    <span class="ninja-search-avatar">
                        ${ninja.avatar_path
                            ? `<img src="/${escapeHTML(ninja.avatar_path)}" alt="">`
                            : escapeHTML((ninja.nickname || '?').charAt(0).toUpperCase())
                        }
                    </span>
                    <span class="ninja-search-info">
                        <strong>${escapeHTML(ninja.nickname)}</strong>
                        <small>${escapeHTML(clanName(ninja.clan))} · ${escapeHTML(ninja.rank || 'Gennin')}</small>
                    </span>
                    <span class="ninja-search-arrow">›</span>
                </button>
            `).join('');

            results.querySelectorAll('[data-ninja-id]').forEach(button => {
                button.addEventListener('click', () => {
                    const selected = ninjas.find(
                        ninja => Number(ninja.id) === Number(button.dataset.ninjaId)
                    );

                    if (selected) renderPublicNinjaProfile(content, selected, term);
                });
            });
        } catch (error) {
            if (currentRequest !== requestNumber) return;
            results.innerHTML = `<p class="error-text">${escapeHTML(error.message)}</p>`;
        }
    }

    input.addEventListener('input', () => search(input.value));

    if (initialQuery.trim().length >= 2) {
        search(initialQuery);
    }

    input.focus();
}

function renderPublicNinjaProfile(content, ninja, previousQuery = '') {
    content.innerHTML = `
        <button type="button" class="secondary-button ninja-back-button"
            id="ninja-search-back">
            ← VOLTAR À PESQUISA
        </button>

        <section class="section-panel public-ninja-profile">
            <div class="panel-heading">
                <div>
                    <p class="eyebrow">FICHA DO SHINOBI</p>
                    <h2>${escapeHTML(ninja.nickname)}</h2>
                    <p class="muted">Membro da associação ninja</p>
                </div>
                ${ninja.avatar_path
                    ? `<img class="profile-avatar" src="/${escapeHTML(ninja.avatar_path)}" alt="Fotografia de ${escapeHTML(ninja.nickname)}">`
                    : '<div class="profile-emblem">写</div>'
                }
            </div>

            <div class="profile-grid">
                <div class="profile-field">
                    <span>Patente</span>
                    <strong>${escapeHTML(ninja.rank || 'Gennin')}</strong>
                </div>
                <div class="profile-field">
                    <span>Clã</span>
                    <strong>${escapeHTML(clanName(ninja.clan))}</strong>
                </div>
                <div class="profile-field">
                    <span>Cargo</span>
                    <strong>${escapeHTML(ninja.title || 'Sem cargo')}</strong>
                </div>
                <div class="profile-field">
                    <span>Yens</span>
                    <strong>${formatYen(ninja.yen)}</strong>
                </div>
            </div>
        </section>
    `;

    document.querySelector('#ninja-search-back')
        .addEventListener('click', () => renderNinjaSearch(content, previousQuery));
}

function renderProfile(content) {
    const fullAccess = isFullAccess();
    const clanAdmin = isClanAdmin();

    content.innerHTML = `
        <section class="section-panel profile-panel">
            <div class="panel-heading">
                <div>
                    <p class="eyebrow">FICHA DO SHINOBI</p>
                    <h2>${escapeHTML(member.nickname)}</h2>
                    <p class="muted">${escapeHTML(roleLabel(member.site_role))}</p>
                </div>
                ${member.avatar_path
                    ? `<img class="profile-avatar" src="/${escapeHTML(member.avatar_path)}" alt="Fotografia de perfil">`
                    : '<div class="profile-emblem">写</div>'
                }
            </div>

            <div class="profile-grid">
                <div class="profile-field"><span>Patente</span><strong>${escapeHTML(member.rank || 'Gennin')}</strong></div>
                <div class="profile-field"><span>Clã</span><strong>${escapeHTML(clanName(member.clan))}</strong></div>
                <div class="profile-field"><span>Cargo</span><strong>${escapeHTML(member.title || 'Sem cargo')}</strong></div>
                <div class="profile-field"><span>Yens</span><strong>${formatYen(member.yen)}</strong></div>
            </div>
        </section>

        <section class="section-panel profile-ranking-panel" id="profile-ranking">
            <p class="muted">A carregar as tuas posições no ranking...</p>
        </section>

        <section class="section-panel avatar-panel">
            <div class="panel-heading">
                <div>
                    <p class="eyebrow">IDENTIDADE VISUAL</p>
                    <h2>Fotografia de perfil</h2>
                    <p class="muted">Escolhe a imagem que representa o teu personagem.</p>
                </div>
            </div>

            <form id="avatar-form" class="avatar-upload-form">
                <div class="avatar-preview-area">
                    <img id="avatar-preview"
                        src="${member.avatar_path ? `/${escapeHTML(member.avatar_path)}` : ''}"
                        alt="Pré-visualização"
                        class="${member.avatar_path ? '' : 'hidden'}">
                    <div id="avatar-placeholder"
                        class="${member.avatar_path ? 'hidden' : ''}">写</div>
                </div>

                <div class="avatar-upload-controls">
                    <label class="file-picker">
                        <input id="avatar-file" type="file"
                            name="avatar" accept="image/jpeg,image/png,image/webp" required>
                        <span>⌕ Escolher imagem</span>
                    </label>
                    <p class="muted">JPG, PNG ou WEBP · Máximo 2 MB</p>
                    <button class="primary-button" type="submit">
                        GUARDAR FOTOGRAFIA
                    </button>
                </div>
            </form>
        </section>

        <section class="section-panel">
            <div class="panel-heading">
                <div>
                    <p class="eyebrow">PERSONALIZAÇÃO</p>
                    <h2>Editar perfil</h2>
                </div>
            </div>

            <form id="profile-form" class="form-grid">
                <label class="form-full">
                    Nome de exibição
                    <input name="nickname" maxlength="40"
                        value="${escapeHTML(member.nickname || '')}" required>
                </label>

                ${fullAccess || clanAdmin ? `
                    <label>
                        Patente
                        <select name="rank">
                            ${ALL_RPG_RANKS.filter(r => canPromoteToHighRankUI() || !HIGH_TIER_RANKS.includes(r.toLowerCase())).map(rank => `
                                <option value="${rank}" ${member.rank === rank ? 'selected' : ''}>${rank}</option>
                            `).join('')}
                        </select>
                    </label>
                    <label>
                        Cargo / Título
                        <input name="title" maxlength="60"
                            value="${escapeHTML(member.title || '')}"
                            placeholder="Sem cargo">
                    </label>
                    <label>
                        Yens
                        <input name="yen" type="number" min="0" step="1"
                            value="${Number(member.yen || 0)}">
                    </label>
                    ${fullAccess ? `
                        <label>
                            Vitórias
                            <input name="wins" type="number" min="0" step="1"
                                value="${Number(member.wins || 0)}">
                        </label>
                        <label>
                            Derrotas
                            <input name="losses" type="number" min="0" step="1"
                                value="${Number(member.losses || 0)}">
                        </label>
                    ` : ''}
                ` : ''}

                ${fullAccess ? `
                    <label>
                        Clã
                        <select name="clanId">
                            <option value="">Sem clã</option>
                            ${[
                                [1, 'Uchiha'],
                                [2, 'Uzumaki'],
                                [3, 'Hyuga'],
                                [4, 'Senju']
                            ].map(([id, name]) => `
                                <option value="${id}" ${Number(member.clan_id) === id ? 'selected' : ''}>${name}</option>
                            `).join('')}
                        </select>
                    </label>
                ` : ''}

                <div class="form-full form-actions">
                    <button class="primary-button" type="submit">GUARDAR ALTERAÇÕES</button>
                </div>
            </form>
        </section>
    `;

    document.querySelector('#profile-form')
        .addEventListener('submit', saveOwnProfile);

    document.querySelector('#avatar-form')
        .addEventListener('submit', saveAvatar);

    document.querySelector('#avatar-file')
        .addEventListener('change', previewAvatar);

    loadProfileRanking();
}

function previewAvatar(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowed = ['image/jpeg', 'image/png', 'image/webp'];

    if (!allowed.includes(file.type)) {
        toast('Escolhe uma imagem JPG, PNG ou WEBP.', 'error');
        event.target.value = '';
        return;
    }

    if (file.size > 2 * 1024 * 1024) {
        toast('A imagem não pode ultrapassar 2 MB.', 'error');
        event.target.value = '';
        return;
    }

    const preview = document.querySelector('#avatar-preview');
    const placeholder = document.querySelector('#avatar-placeholder');

    preview.src = URL.createObjectURL(file);
    preview.classList.remove('hidden');
    placeholder.classList.add('hidden');
}

async function saveAvatar(event) {
    event.preventDefault();

    const input = document.querySelector('#avatar-file');
    const file = input.files?.[0];

    if (!file) {
        return toast('Escolhe uma imagem primeiro.', 'error');
    }

    const formData = new FormData();
    formData.append('avatar', file);

    try {
        const response = await fetch(`${API}/members/${member.id}/avatar`, {
            method: 'POST',
            credentials: 'same-origin',
            body: formData
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(data.error || 'Não foi possível guardar a fotografia.');
        }

        member = data.member;
        toast('Fotografia de perfil atualizada.');
        render();
    } catch (error) {
        toast(error.message, 'error');
    }
}

async function saveOwnProfile(event) {
    event.preventDefault();

    const form = new FormData(event.currentTarget);
    const fields = {
        nickname: form.get('nickname').trim()
    };

    if (isFullAccess() || isClanAdmin()) {
        fields.rank = form.get('rank');
        fields.title = form.get('title').trim();
        fields.yen = Number(form.get('yen'));
    }

    if (isFullAccess()) {
        fields.wins = Number(form.get('wins'));
        fields.losses = Number(form.get('losses'));
        fields.clanId = form.get('clanId') === ''
            ? null
            : Number(form.get('clanId'));
    }

    try {
        const data = await api(`/members/${member.id}`, {
            method: 'PUT',
            body: JSON.stringify(fields)
        });

        member = data.member || await refreshMember();
        toast('Perfil atualizado.');
        render();
    } catch (error) {
        toast(error.message, 'error');
    }
}

async function refreshMember() {
    const data = await api('/auth/me');
    return data.member || data;
}

async function renderRanking(content) {
    content.innerHTML = `
        <section class="ranking-intro">
            <p class="eyebrow">O LEGADO DOS SHINOBI</p>
            <h2>SHINOBI <span>RANKING</span></h2>
            <p>Os ninjas mais destacados da associação.</p>
        </section>
        <section class="section-panel ranking-panel">
            <div class="ranking-tabs" id="ranking-tabs">
                <button class="ranking-tab active" data-ranking="yen">Yens</button>
                <button class="ranking-tab" data-ranking="wins">Vitórias</button>
                <button class="ranking-tab" data-ranking="losses">Derrotas</button>
                <button class="ranking-tab" data-ranking="ranks">Patentes</button>
            </div>
            <div id="ranking-content">
                <p class="muted">A carregar classificação...</p>
            </div>
        </section>
    `;

    try {
        const data = await api('/members/rankings');
        const rankings = data.rankings || {};
        const positions = data.myPositions || {};
        const rankingContent = document.querySelector('#ranking-content');
        const tabs = document.querySelector('#ranking-tabs');

        if (!rankingContent || !tabs) return;

        function showRanking(category) {
            const entries = rankings[category] || [];
            const labels = {
                yen: 'Yens',
                wins: 'Vitórias',
                losses: 'Derrotas',
                ranks: 'Patentes'
            };

            tabs.querySelectorAll('.ranking-tab').forEach(button => {
                button.classList.toggle(
                    'active',
                    button.dataset.ranking === category
                );
            });

            const myPosition = positions[category];
            const myEntry = entries.find(
                item => Number(item.id) === Number(member.id)
            );

            const rows = entries.map(item => {
                const isMe = Number(item.id) === Number(member.id);
                const value = category === 'yen'
                    ? formatYen(item.value)
                    : category === 'ranks'
                        ? escapeHTML(item.value)
                        : `${Number(item.value)} ${category === 'wins' ? 'vitórias' : 'derrotas'}`;

                return `
                    <article class="ranking-row ${isMe ? 'ranking-me' : ''} ${item.position <= 3 ? `ranking-top-${item.position}` : ''}">
                        <div class="ranking-position">${item.position}º</div>
                        <div class="ranking-avatar">
                            ${item.avatar_path
                                ? `<img src="/${escapeHTML(item.avatar_path)}" alt="">`
                                : escapeHTML((item.nickname || '?').charAt(0).toUpperCase())
                            }
                        </div>
                        <div class="ranking-member-info">
                            <strong>${escapeHTML(item.nickname)} ${isMe ? '<span class="ranking-you">TU</span>' : ''}</strong>
                            <span>${escapeHTML(item.rank || 'Gennin')} · ${escapeHTML(clanName(item.clan))}</span>
                        </div>
                        <strong class="ranking-value">${value}</strong>
                    </article>
                `;
            }).join('');

            rankingContent.innerHTML = `
                <div class="ranking-category-heading">
                    <div>
                        <p class="eyebrow">CLASSIFICAÇÃO</p>
                        <h3>${labels[category]}</h3>
                    </div>
                    <span>${entries.length} ninjas</span>
                </div>
                <div class="ranking-my-position">
                    <span>A TUA POSIÇÃO</span>
                    <strong>${myPosition ? `${myPosition}º lugar` : 'Sem classificação'}</strong>
                    <small>${myEntry ? (category === 'yen'
                        ? formatYen(myEntry.value)
                        : escapeHTML(myEntry.value)) : 'Ainda sem dados'}</small>
                </div>
                <div class="ranking-list">
                    ${rows || '<p class="muted">Ainda não existem membros nesta classificação.</p>'}
                </div>
            `;
        }

        tabs.querySelectorAll('.ranking-tab').forEach(button => {
            button.addEventListener('click', () => {
                showRanking(button.dataset.ranking);
            });
        });

        showRanking('yen');
    } catch (error) {
        const area = document.querySelector('#ranking-content');
        if (area) {
            area.innerHTML = `<p class="error-text">${escapeHTML(error.message)}</p>`;
        }
    }
}

async function loadProfileRanking() {
    const area = document.querySelector('#profile-ranking');
    if (!area) return;

    try {
        const data = await api('/members/rankings');
        const positions = data.myPositions || {};

        const cards = [
            ['Yens', positions.yen, formatYen(member.yen)],
            ['Vitórias', positions.wins, `${Number(member.wins || 0)} vitórias`],
            ['Derrotas', positions.losses, `${Number(member.losses || 0)} derrotas`],
            ['Patente', positions.ranks, escapeHTML(member.rank || 'Gennin')]
        ];

        area.innerHTML = `
            <div class="panel-heading">
                <div>
                    <p class="eyebrow">A TUA JORNADA</p>
                    <h2>As minhas posições</h2>
                    <p class="muted">A tua posição atual em cada classificação.</p>
                </div>
            </div>
            <div class="profile-ranking-grid">
                ${cards.map(([label, position, value]) => `
                    <article class="profile-ranking-card">
                        <span>${label}</span>
                        <strong>${position ? `${position}º` : '—'}</strong>
                        <small>${value}</small>
                    </article>
                `).join('')}
            </div>
        `;
    } catch (error) {
        area.innerHTML = `
            <p class="eyebrow">AS MINHAS POSIÇÕES</p>
            <p class="muted">Não foi possível carregar o ranking.</p>
        `;
    }
}

async function renderFeed(content) {
    content.innerHTML = `
        <section class="feed-intro">
            <p class="eyebrow">A REDE DOS SHINOBI</p>
            <h1>SHINOBI <span>NETWORK</span></h1>
            <p>Partilha a tua jornada. A tua voz também faz parte da história.</p>
        </section>

        <section class="section-panel feed-composer">
            <div class="feed-composer-heading">
                <div class="avatar-small">
                    ${member.avatar_path
                        ? `<img src="/${escapeHTML(member.avatar_path)}" alt="">`
                        : escapeHTML((member.nickname || '?').charAt(0).toUpperCase())
                    }
                </div>
                <div>
                    <strong>${escapeHTML(member.nickname)}</strong>
                    <span>O que se passa no mundo ninja?</span>
                </div>
            </div>

            <form id="post-form">
                <textarea id="post-content" name="content"
                    maxlength="2000"
                    placeholder="Escreve uma publicação..." rows="4"></textarea>

                <div id="post-image-preview" class="post-image-preview hidden">
                    <img id="post-preview-img" alt="Pré-visualização da imagem">
                    <button type="button" id="remove-post-image" class="remove-image-button">Remover imagem</button>
                </div>

                <div class="feed-composer-actions">
                    <label class="file-picker post-file-picker">
                        <input id="post-image" type="file"
                            accept="image/jpeg,image/png,image/webp">
                        <span>▧ Adicionar imagem</span>
                    </label>
                    <span class="feed-char-count" id="post-char-count">0/2000</span>
                    <button class="primary-button" type="submit">PUBLICAR</button>
                </div>
                <p class="muted feed-upload-note">JPG, PNG ou WEBP · Máximo 5 MB</p>
            </form>
        </section>

        <section id="feed-posts" class="feed-posts">
            <p class="muted">A carregar publicações...</p>
        </section>
    `;

    const form = document.querySelector('#post-form');
    const text = document.querySelector('#post-content');
    const imageInput = document.querySelector('#post-image');

    text.addEventListener('input', () => {
        document.querySelector('#post-char-count').textContent =
            `${text.value.length}/2000`;
    });

    imageInput.addEventListener('change', previewPostImage);

    document.querySelector('#remove-post-image')
        .addEventListener('click', clearPostImage);

    form.addEventListener('submit', createFeedPost);

    await loadFeedPosts();
}

function previewPostImage(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowed = ['image/jpeg', 'image/png', 'image/webp'];

    if (!allowed.includes(file.type)) {
        toast('Escolhe uma imagem JPG, PNG ou WEBP.', 'error');
        event.target.value = '';
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        toast('A imagem não pode ultrapassar 5 MB.', 'error');
        event.target.value = '';
        return;
    }

    document.querySelector('#post-preview-img').src =
        URL.createObjectURL(file);

    document.querySelector('#post-image-preview')
        .classList.remove('hidden');
}

function clearPostImage() {
    document.querySelector('#post-image').value = '';
    document.querySelector('#post-preview-img').removeAttribute('src');
    document.querySelector('#post-image-preview')
        .classList.add('hidden');
}

async function createFeedPost(event) {
    event.preventDefault();

    const text = document.querySelector('#post-content').value.trim();
    const image = document.querySelector('#post-image').files?.[0];

    if (!text && !image) {
        return toast('Escreve alguma coisa ou escolhe uma imagem.', 'error');
    }

    const formData = new FormData();
    formData.append('content', text);
    if (image) formData.append('image', image);

    const button = event.currentTarget.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = 'A PUBLICAR...';

    try {
        const response = await fetch(`${API}/feed`, {
            method: 'POST',
            credentials: 'same-origin',
            body: formData
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(data.error || 'Não foi possível publicar.');
        }

        toast('Publicação enviada para a rede.');
        await loadFeedPosts();

        document.querySelector('#post-form')?.reset();
        document.querySelector('#post-char-count').textContent = '0/2000';
        clearPostImage();
    } catch (error) {
        toast(error.message, 'error');
    } finally {
        button.disabled = false;
        button.textContent = 'PUBLICAR';
    }
}

async function loadFeedPosts() {
    const container = document.querySelector('#feed-posts');
    if (!container) return;

    try {
        const data = await api('/feed');
        const posts = data.posts || [];

        if (!posts.length) {
            container.innerHTML = `
                <div class="feed-empty section-panel">
                    <div>▤</div>
                    <h2>O feed está silencioso...</h2>
                    <p class="muted">Sê o primeiro ninja a publicar alguma coisa.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = posts.map(renderFeedPost).join('');
        attachFeedEvents(container);
    } catch (error) {
        container.innerHTML = `
            <div class="section-panel">
                <p class="error-text">${escapeHTML(error.message)}</p>
                <button class="secondary-button" id="retry-feed">Tentar novamente</button>
            </div>
        `;

        document.querySelector('#retry-feed')
            ?.addEventListener('click', loadFeedPosts);
    }
}

function renderFeedPost(post) {
    const ownPost = Number(post.member_id) === Number(member.id);
    const moderator = isFullAccess();
    const canManage = ownPost || moderator;
    const comments = post.comments || [];

    return `
        <article class="feed-post section-panel" data-post-id="${Number(post.id)}">
            <header class="feed-post-header">
                <div class="feed-author">
                    <div class="feed-avatar">
                        ${post.avatar_path
                            ? `<img src="/${escapeHTML(post.avatar_path)}" alt="">`
                            : escapeHTML((post.nickname || '?').charAt(0).toUpperCase())
                        }
                    </div>
                    <div class="feed-author-info">
                        <strong>${escapeHTML(post.nickname)}</strong>
                        <span>${escapeHTML(post.rank || 'Gennin')} · ${escapeHTML(post.clan || 'Sem clã')}</span>
                        <time>${escapeHTML(post.created_at || '')}</time>
                    </div>
                </div>

                ${canManage ? `
                    <div class="feed-post-menu">
                        ${ownPost ? `<button class="feed-edit-button" data-action="edit-post" data-id="${Number(post.id)}">Editar</button>` : ''}
                        <button class="feed-delete-button" data-action="delete-post" data-id="${Number(post.id)}">Apagar</button>
                    </div>
                ` : ''}
            </header>

            ${post.content ? `<div class="feed-post-text">${escapeHTML(post.content).replace(/\n/g, '<br>')}</div>` : ''}

            ${post.image_path ? `
                <div class="feed-post-image">
                    <img src="/${escapeHTML(post.image_path)}" alt="Imagem publicada por ${escapeHTML(post.nickname)}" loading="lazy">
                </div>
            ` : ''}

            <div class="feed-post-stats">
                <span>❤️ ${Number(post.likes_count || 0)} gostos</span>
                <span>💬 ${comments.length} comentários</span>
            </div>

            <div class="feed-post-actions">
                <button data-action="like" data-id="${Number(post.id)}"
                    class="${Number(post.liked_by_me) ? 'liked' : ''}">
                    ${Number(post.liked_by_me) ? '♥ Gostaste' : '♡ Gostar'}
                </button>
                <button data-action="focus-comment" data-id="${Number(post.id)}">💬 Comentar</button>
            </div>

            <div class="feed-comments">
                ${comments.map(comment => {
                    const canDeleteComment =
                        Number(comment.member_id) === Number(member.id) || moderator;

                    return `
                        <div class="feed-comment">
                            <div class="feed-comment-avatar">
                                ${comment.avatar_path
                                    ? `<img src="/${escapeHTML(comment.avatar_path)}" alt="">`
                                    : escapeHTML((comment.nickname || '?').charAt(0).toUpperCase())
                                }
                            </div>
                            <div class="feed-comment-body">
                                <strong>${escapeHTML(comment.nickname)}</strong>
                                <p>${escapeHTML(comment.content)}</p>
                            </div>
                            ${canDeleteComment ? `
                                <button class="comment-delete-button"
                                    data-action="delete-comment"
                                    data-id="${Number(post.id)}"
                                    data-comment-id="${Number(comment.id)}"
                                    title="Apagar comentário">×</button>
                            ` : ''}
                        </div>
                    `;
                }).join('')}

                <form class="feed-comment-form" data-post-id="${Number(post.id)}">
                    <input name="content" maxlength="500"
                        placeholder="Escreve um comentário..." required>
                    <button type="submit">ENVIAR</button>
                </form>
            </div>
        </article>
    `;
}

function attachFeedEvents(container) {
    container.querySelectorAll('[data-action]').forEach(button => {
        button.addEventListener('click', async () => {
            const action = button.dataset.action;
            const postId = Number(button.dataset.id);

            if (action === 'like') {
                try {
                    await api(`/feed/${postId}/like`, { method: 'POST' });
                    await loadFeedPosts();
                } catch (error) {
                    toast(error.message, 'error');
                }
            }

            if (action === 'focus-comment') {
                container.querySelector(
                    `.feed-comment-form[data-post-id="${postId}"] input`
                )?.focus();
            }

            if (action === 'edit-post') {
                const post = (await api('/feed')).posts
                    .find(item => Number(item.id) === postId);

                if (!post) return;

                const content = prompt('Editar publicação:', post.content || '');
                if (content === null) return;

                try {
                    await api(`/feed/${postId}`, {
                        method: 'PUT',
                        body: JSON.stringify({ content })
                    });
                    toast('Publicação atualizada.');
                    await loadFeedPosts();
                } catch (error) {
                    toast(error.message, 'error');
                }
            }

            if (action === 'delete-post') {
                if (!confirm('Tens a certeza de que queres apagar esta publicação?')) return;

                try {
                    await api(`/feed/${postId}`, { method: 'DELETE' });
                    toast('Publicação apagada.');
                    await loadFeedPosts();
                } catch (error) {
                    toast(error.message, 'error');
                }
            }

            if (action === 'delete-comment') {
                const commentId = Number(button.dataset.commentId);
                if (!confirm('Apagar este comentário?')) return;

                try {
                    await api(`/feed/${postId}/comments/${commentId}`, {
                        method: 'DELETE'
                    });
                    toast('Comentário apagado.');
                    await loadFeedPosts();
                } catch (error) {
                    toast(error.message, 'error');
                }
            }
        });
    });

    container.querySelectorAll('.feed-comment-form').forEach(form => {
        form.addEventListener('submit', async event => {
            event.preventDefault();

            const postId = Number(form.dataset.postId);
            const input = form.querySelector('input');
            const content = input.value.trim();

            if (!content) return;

            try {
                await api(`/feed/${postId}/comments`, {
                    method: 'POST',
                    body: JSON.stringify({ content })
                });

                await loadFeedPosts();
            } catch (error) {
                toast(error.message, 'error');
            }
        });
    });
}

function renderClans(content) {
    const clans = [
        ['Uchiha', 'O poder do Sharingan e a determinação de um clã lendário.', 'Takeomi'],
        ['Uzumaki', 'Uma linhagem conhecida pela vitalidade e força extraordinária.', 'Mikasa'],
        ['Hyuga', 'O Byakugan e a precisão de uma tradição ancestral.', 'Levi'],
        ['Senju', 'Um dos grandes clãs fundadores, marcado pela força e vontade.', 'Dummy']
    ];

    content.innerHTML = `
        <section class="welcome-section compact-welcome">
            <div class="welcome-copy">
                <p class="eyebrow">AS QUATRO GRANDES LINHAGENS</p>
                <h1>Escolhe a tua <span>história</span>.</h1>
                <p>Clica num clã para entrar direto no grupo oficial do clã no chat.</p>
            </div>
        </section>

        <section class="clan-grid">
            ${clans.map(([name, description, leader]) => `
                <article class="clan-card" data-open-clan-chat="${escapeHTML(name)}" style="cursor:pointer;">
                    <p class="eyebrow">CLÃ NINJA · ABRIR CHAT</p>
                    <h2>${name}</h2>
                    <p>${description}</p>
                    <span>Líder: ${leader}</span>
                </article>
            `).join('')}
        </section>
    `;

    content.querySelectorAll('[data-open-clan-chat]').forEach(card => {
        card.addEventListener('click', () => {
            openClanGroupChat(card.dataset.openClanChat);
        });
    });
}

async function renderAdmin(content) {
    content.innerHTML = `
        <section class="section-panel">
            <div class="panel-heading">
                <div>
                    <p class="eyebrow">CENTRO DE CONTROLO</p>
                    <h2>Gestão de membros</h2>
                    <p class="muted">Consulta e administra as contas da associação.</p>
                </div>
                <div style="display:flex;gap:10px;flex-wrap:wrap;">
                    <button class="primary-button" id="open-add-member">+ Novo membro</button>
                    <button class="secondary-button" id="refresh-members">Atualizar</button>
                </div>
            </div>
            <div id="members-list" class="members-list">
                <p class="muted">A carregar membros...</p>
            </div>
        </section>
        <section id="member-editor"></section>
    `;

    document.querySelector('#open-add-member')
        .addEventListener('click', renderMemberCreator);

    document.querySelector('#refresh-members')
        .addEventListener('click', loadMembers);

    await loadMembers();
}

function renderMemberCreator() {
    const editor = document.querySelector('#member-editor');
    if (!editor) return;

    const fullAccess = isFullAccess();

    editor.innerHTML = `
        <section class="section-panel editor-panel">
            <div class="panel-heading">
                <div>
                    <p class="eyebrow">NOVO RECRUTA</p>
                    <h2>Adicionar membro</h2>
                    <p class="muted">O membro entrará com senha inicial e troca obrigatória no primeiro acesso.</p>
                </div>
                <button id="close-editor" class="secondary-button" type="button">Fechar</button>
            </div>

            <form id="member-create-form" class="form-grid">
                <label>
                    Utilizador de login
                    <input name="loginUsername" pattern="[a-z0-9_]{3,30}" maxlength="30"
                        placeholder="ex: shinobi_01" required>
                </label>

                <label>
                    Nome de exibição (Nick)
                    <input name="nickname" minlength="2" maxlength="40"
                        placeholder="Ex: Kaito" required>
                </label>

                <label>
                    Senha inicial (mín. 8 caracteres)
                    <span data-eye-wrap style="position:relative;display:flex;align-items:center;width:100%;"><input style="padding-right:76px;" name="password" type="password" minlength="8" maxlength="128"
                        placeholder="Senha inicial" required><button type="button" data-eye-btn aria-label="Alternar visibilidade da senha" style="position:absolute;right:10px;background:transparent;border:1px solid rgba(255,255,255,0.16);border-radius:4px;color:inherit;opacity:0.78;cursor:pointer;padding:2px 7px;font-size:10px;letter-spacing:0.06em;line-height:1.2;">VER</button></span>
                </label>

                <label>
                    Patente
                    <select name="rank">
                        ${ALL_RPG_RANKS.filter(r => canPromoteToHighRankUI() || !HIGH_TIER_RANKS.includes(r.toLowerCase())).map(rank => `
                            <option value="${rank}" ${rank === 'Gennin' ? 'selected' : ''}>${rank}</option>
                        `).join('')}
                    </select>
                </label>

                <label>
                    Cargo / Título
                    <input name="title" maxlength="60" placeholder="Sem cargo">
                </label>

                <label>
                    Yens iniciais
                    <input name="yen" type="number" min="0" step="1" value="20">
                </label>

                ${fullAccess ? `
                    <label>
                        Clã
                        <select name="clanId">
                            ${[
                                [1, 'Uchiha'],
                                [2, 'Uzumaki'],
                                [3, 'Hyuga'],
                                [4, 'Senju']
                            ].map(([id, name]) => `
                                <option value="${id}">${name}</option>
                            `).join('')}
                        </select>
                    </label>

                    <label>
                        Permissão no site
                        <select name="siteRole">
                            ${[
                                ['member', 'Membro'],
                                ['clan_admin', 'Administrador de clã'],
                                ['hacker', 'Hacker'],
                                ['owner', 'Proprietário']
                            ].map(([value, label]) => `
                                <option value="${value}">${label}</option>
                            `).join('')}
                        </select>
                    </label>

                    <label class="checkbox-field form-full">
                        <input name="isClanLeader" type="checkbox">
                        Líder do clã
                    </label>
                ` : ''}

                <div class="form-full form-actions">
                    <button class="primary-button" type="submit">CRIAR MEMBRO</button>
                </div>
            </form>
        </section>
    `;

    document.querySelector('#close-editor').addEventListener('click', () => {
        editor.innerHTML = '';
    });

    document.querySelector('#member-create-form')
        .addEventListener('submit', saveNewMember);
}

async function saveNewMember(event) {
    event.preventDefault();

    const form = new FormData(event.currentTarget);
    const titleRaw = String(form.get('title') || '').trim();
    const yenRaw = Number(form.get('yen'));

    const payload = {
        loginUsername: String(form.get('loginUsername') || '').trim().toLowerCase(),
        password: String(form.get('password') || ''),
        nickname: String(form.get('nickname') || '').trim(),
        rank: String(form.get('rank') || 'Gennin'),
        title: titleRaw || null,
        yen: Number.isFinite(yenRaw) ? yenRaw : 20
    };

    if (isFullAccess()) {
        payload.clanId = Number(form.get('clanId'));
        payload.siteRole = String(form.get('siteRole') || 'member');
        payload.isClanLeader = form.get('isClanLeader') === 'on';
    } else if (member?.clan_id) {
        payload.clanId = Number(member.clan_id);
    }

    try {
        await api('/members', {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        toast('Membro criado com troca de senha obrigatória no login.');
        document.querySelector('#member-editor').innerHTML = '';
        await loadMembers();
    } catch (error) {
        toast(error.message, 'error');
    }
}

async function loadMembers() {
    const list = document.querySelector('#members-list');
    if (!list) return;

    list.innerHTML = '<p class="muted">A carregar membros...</p>';

    try {
        const data = await api('/members');
        membersCache = Array.isArray(data) ? data : (data.members || []);

        if (!membersCache.length) {
            list.innerHTML = '<p class="muted">Nenhum membro encontrado.</p>';
            return;
        }

        list.innerHTML = membersCache.map(item => `
            <article class="member-row">
                <div class="member-row-avatar">
                    ${item.avatar_path
                        ? `<img src="/${escapeHTML(item.avatar_path)}" alt="">`
                        : escapeHTML((item.nickname || '?').charAt(0).toUpperCase())
                    }
                </div>
                <div class="member-row-info">
                    <strong>${escapeHTML(item.nickname)}</strong>
                    <span>${escapeHTML(item.rank || 'Gennin')} · ${escapeHTML(clanName(item.clan))}</span>
                </div>
                <div class="member-row-meta">
                    <span>${escapeHTML(roleLabel(item.site_role))}</span>
                    <strong>${formatYen(item.yen)}</strong>
                </div>
                <button class="secondary-button member-edit-button"
                    data-member-id="${Number(item.id)}">Editar</button>
            </article>
        `).join('');

        list.querySelectorAll('[data-member-id]').forEach(button => {
            button.addEventListener('click', () => {
                const selected = membersCache.find(
                    item => Number(item.id) === Number(button.dataset.memberId)
                );
                if (selected) renderMemberEditor(selected);
            });
        });
    } catch (error) {
        list.innerHTML = `<p class="error-text">${escapeHTML(error.message)}</p>`;
    }
}

function renderMemberEditor(target) {
    const editor = document.querySelector('#member-editor');
    if (!editor) return;

    const fullAccess = isFullAccess();

    editor.innerHTML = `
        <section class="section-panel editor-panel">
            <div class="panel-heading">
                <div>
                    <p class="eyebrow">EDIÇÃO DE CONTA</p>
                    <h2>${escapeHTML(target.nickname)}</h2>
                </div>
                <button id="close-editor" class="secondary-button">Fechar</button>
            </div>

            <form id="member-edit-form" class="form-grid">
                <label class="form-full">
                    Nome de exibição
                    <input name="nickname" maxlength="40"
                        value="${escapeHTML(target.nickname || '')}" required>
                </label>

                <label>
                    Patente
                    <select name="rank">
                        ${ALL_RPG_RANKS.filter(r => canPromoteToHighRankUI() || !HIGH_TIER_RANKS.includes(r.toLowerCase())).map(rank => `
                            <option value="${rank}" ${target.rank === rank ? 'selected' : ''}>${rank}</option>
                        `).join('')}
                    </select>
                </label>

                <label>
                    Cargo / Título
                    <input name="title" maxlength="60"
                        value="${escapeHTML(target.title || '')}">
                </label>

                <label>
                    Yens
                    <input name="yen" type="number" min="0" step="1"
                        value="${Number(target.yen || 0)}">
                </label>

                ${fullAccess ? `
                    <label>
                        Vitórias
                        <input name="wins" type="number" min="0" step="1"
                            value="${Number(target.wins || 0)}">
                    </label>
                    <label>
                        Derrotas
                        <input name="losses" type="number" min="0" step="1"
                            value="${Number(target.losses || 0)}">
                    </label>
                ` : ''}

                ${fullAccess ? `
                    <label>
                        Clã
                        <select name="clanId">
                            <option value="">Sem clã</option>
                            ${[
                                [1, 'Uchiha'],
                                [2, 'Uzumaki'],
                                [3, 'Hyuga'],
                                [4, 'Senju']
                            ].map(([id, name]) => `
                                <option value="${id}" ${Number(target.clan_id) === id ? 'selected' : ''}>${name}</option>
                            `).join('')}
                        </select>
                    </label>

                    <label>
                        Permissão no site
                        <select name="siteRole">
                            ${[
                                ['member', 'Membro'],
                                ['clan_admin', 'Administrador de clã'],
                                ['hacker', 'Hacker'],
                                ['owner', 'Proprietário']
                            ].map(([value, label]) => `
                                <option value="${value}" ${target.site_role === value ? 'selected' : ''}>${label}</option>
                            `).join('')}
                        </select>
                    </label>

                    <label class="checkbox-field">
                        <input name="isClanLeader" type="checkbox"
                            ${Number(target.is_clan_leader) === 1 ? 'checked' : ''}>
                        Líder do clã
                    </label>
                ` : ''}

                <div class="form-full form-actions">
                    <button class="primary-button" type="submit">GUARDAR MEMBRO</button>
                </div>
            </form>
        </section>
    `;

    document.querySelector('#close-editor').addEventListener('click', () => {
        editor.innerHTML = '';
    });

    document.querySelector('#member-edit-form')
        .addEventListener('submit', event => saveMemberEdit(event, target));
}

async function saveMemberEdit(event, target) {
    const chosenRank = String(new FormData(event.currentTarget).get("rank") || "").trim();
    if (HIGH_TIER_RANKS.includes(chosenRank.toLowerCase()) && !canPromoteToHighRankUI()) {
        event.preventDefault();
        return toast("Apenas Madrack e Levi podem promover para Sannin ou patentes superiores.", "error");
    }
    event.preventDefault();

    const form = new FormData(event.currentTarget);
    const fields = {
        nickname: form.get('nickname').trim(),
        rank: form.get('rank'),
        title: form.get('title').trim(),
        yen: Number(form.get('yen'))
    };

    if (isFullAccess()) {
        fields.wins = Number(form.get('wins'));
        fields.losses = Number(form.get('losses'));
        fields.clanId = Number(form.get('clanId'));
        fields.siteRole = form.get('siteRole');
        fields.isClanLeader = form.get('isClanLeader') === 'on';
    }

    try {
        await api(`/members/${target.id}`, {
            method: 'PUT',
            body: JSON.stringify(fields)
        });

        toast('Membro atualizado com sucesso.');
        document.querySelector('#member-editor').innerHTML = '';
        await loadMembers();

        if (Number(target.id) === Number(member.id)) {
            member = await refreshMember();
        }
    } catch (error) {
        toast(error.message, 'error');
    }
}

async function logout() {
    try {
        await api('/auth/logout', { method: 'POST' });
    } catch (error) {
        // A sessão local será terminada mesmo se o servidor falhar.
    }

    member = null;
    currentPage = 'dashboard';
    showLogin();
}

async function initialize() {
    try {
        const data = await api('/auth/me');
        member = data.member || data;
        render();
    } catch {
        member = null;
        showLogin();
    }
}

initialize();

let chatSocket = null;
let chatMode = "group";
let activeGroupId = null;
let pendingClanName = null;
let activeDmUserId = null;
let chatGroups = [];
let chatDmUsers = [];
let chatAllMembers = [];
let chatGroupMembers = [];
let chatCanManage = false;
let chatIsSuperAdmin = false;
let chatMessages = [];

function isSuperAdminClient() {
    const nick = String(member?.nickname || "").trim().toLowerCase();
    const role = String(member?.site_role || "").trim().toLowerCase();
    return ["madrack", "levi"].includes(nick) || ["owner", "hacker"].includes(role);
}

function selectPendingClanGroupIfReady() {
    if (!pendingClanName || !chatGroups.length) return false;
    const target = chatGroups.find(g => String(g.name || "").toLowerCase().includes(String(pendingClanName).toLowerCase()));
    if (target) {
        chatMode = "group";
        activeGroupId = Number(target.id);
        pendingClanName = null;
        return true;
    }
    return false;
}

function openClanGroupChat(clanNameText) {
    pendingClanName = clanNameText;
    chatMode = "group";
    currentPage = "chat";
    showLayout();
    if (chatSocket && selectPendingClanGroupIfReady()) {
        joinCurrentChatRoom();
        drawChatLayout(document.querySelector("#page-content"));
    }
}

function ensureChatSocket(content) {
    if (typeof io !== "function") return null;
    if (chatSocket) {
        selectPendingClanGroupIfReady();
        joinCurrentChatRoom();
        return chatSocket;
    }
    chatSocket = io({ withCredentials: true });
    chatSocket.on("chat:init", data => {
        chatGroups = data.groups || [];
        chatDmUsers = data.dmUsers || [];
        chatAllMembers = data.allActiveMembers || [];
        chatIsSuperAdmin = Boolean(data.me && (["madrack", "levi"].includes(String(data.me.nickname || "").toLowerCase()) || ["owner", "hacker"].includes(String(data.me.site_role || "")))) || isSuperAdminClient();
        if (!selectPendingClanGroupIfReady() && !activeGroupId && chatGroups.length) {
            activeGroupId = Number(chatGroups[0].id);
        }
        if (!activeDmUserId && chatDmUsers.length) activeDmUserId = Number(chatDmUsers[0].id);
        joinCurrentChatRoom();
        drawChatLayout(content);
    });
    chatSocket.on("chat:groups_updated", data => {
        chatGroups = data.groups || [];
        if (activeGroupId && !chatGroups.some(g => Number(g.id) === Number(activeGroupId)) && !chatIsSuperAdmin) {
            activeGroupId = chatGroups.length ? Number(chatGroups[0].id) : null;
        }
        joinCurrentChatRoom();
        drawChatLayout(content);
    });
    chatSocket.on("chat:group_created_for_me", ({ groupId }) => {
        chatMode = "group";
        activeGroupId = Number(groupId);
        joinCurrentChatRoom();
        drawChatLayout(content);
        toast("Grupo criado e selecionado!");
    });
    chatSocket.on("chat:group_members_updated", ({ groupId, groupMembers }) => {
        if (Number(groupId) === Number(activeGroupId)) {
            chatGroupMembers = groupMembers || [];
            drawChatMembersBox(content);
        }
    });
    chatSocket.on("chat:kicked_from_group", ({ groupId }) => {
        if (Number(groupId) === Number(activeGroupId)) {
            toast("Você foi removido do grupo.", "error");
            activeGroupId = chatGroups.length ? Number(chatGroups[0].id) : null;
            joinCurrentChatRoom();
            drawChatLayout(content);
        }
    });
    chatSocket.on("chat:history", payload => {
        if (payload.chatType === chatMode) {
            chatMessages = payload.messages || [];
            if (payload.chatType === "group") {
                chatGroupMembers = payload.groupMembers || [];
                chatCanManage = Boolean(payload.canManage);
            } else {
                chatGroupMembers = [];
                chatCanManage = Boolean(payload.canManage);
            }
            drawChatMessages();
            drawChatMembersBox(content);
        }
    });
    chatSocket.on("chat:message", msg => {
        const matchesGroup = chatMode === "group" && msg.chat_type === "group" && Number(msg.group_id) === Number(activeGroupId);
        const matchesDm = chatMode === "dm" && msg.chat_type === "dm" &&
            ((Number(msg.sender_id) === Number(member.id) && Number(msg.receiver_id) === Number(activeDmUserId)) ||
             (Number(msg.sender_id) === Number(activeDmUserId) && Number(msg.receiver_id) === Number(member.id)));
        if (matchesGroup || matchesDm) {
            chatMessages.push(msg);
            drawChatMessages();
        }
    });
    chatSocket.on("chat:message_deleted", ({ messageId }) => {
        chatMessages = chatMessages.filter(m => Number(m.id) !== Number(messageId));
        drawChatMessages();
    });
    return chatSocket;
}

function joinCurrentChatRoom() {
    if (!chatSocket) return;
    if (chatMode === "group" && activeGroupId) {
        chatSocket.emit("chat:join_group", { groupId: Number(activeGroupId) });
    } else if (chatMode === "dm" && activeDmUserId) {
        chatSocket.emit("chat:join_dm", { targetMemberId: Number(activeDmUserId) });
    }
}

function canDeleteThisMessage(msg) {
    if (!msg || !member) return false;
    if (Number(msg.sender_id) === Number(member.id)) return true;
    if (chatCanManage || chatIsSuperAdmin || isSuperAdminClient()) return true;
    return false;
}

function drawChatMessages() {
    const box = document.querySelector("#chat-messages-box");
    if (!box) return;
    if (!chatMessages.length) {
        box.innerHTML = `<p class="muted">Sem mensagens ainda. Puxa o assunto!</p>`;
        return;
    }
    box.innerHTML = chatMessages.map(m => {
        const canDel = canDeleteThisMessage(m);
        return `
            <div style="padding:10px 12px;border-radius:8px;background:#141414;border:1px solid #262626;margin-bottom:8px;">
                <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:4px;">
                    <div>
                        <strong>${escapeHTML(m.sender_nickname || "Ninja")}</strong>
                        <span class="muted" style="font-size:11px;margin-left:6px;">${escapeHTML(m.sender_rank || "")}</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:8px;">
                        <span class="muted" style="font-size:11px;">${escapeHTML(m.created_at || "")}</span>
                        ${canDel ? `<button type="button" class="secondary-button" data-del-msg="${Number(m.id)}" style="padding:2px 8px;font-size:11px;border-color:#7f1d1d;color:#fca5a5;">Apagar</button>` : ""}
                    </div>
                </div>
                <div style="word-break:break-word;">${escapeHTML(m.content || "")}</div>
            </div>
        `;
    }).join("");
    box.querySelectorAll("[data-del-msg]").forEach(btn => {
        btn.addEventListener("click", () => {
            const mid = Number(btn.dataset.delMsg);
            chatSocket?.emit("chat:delete_message", { messageId: mid });
        });
    });
    box.scrollTop = box.scrollHeight;
}

function drawChatMembersBox(content) {
    const panel = document.querySelector("#chat-members-panel");
    if (!panel) return;
    if (chatMode !== "group" || !activeGroupId) {
        panel.innerHTML = "";
        return;
    }
    const outsideMembers = chatAllMembers.filter(m => !chatGroupMembers.some(gm => Number(gm.id) === Number(m.id)));
    panel.innerHTML = `
        <div style="margin-top:12px;padding:12px;background:#0e0e0e;border:1px solid #262626;border-radius:8px;">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px;">
                <strong>Membros do grupo (${chatGroupMembers.length})</strong>
                ${(chatCanManage || chatIsSuperAdmin || isSuperAdminClient()) && outsideMembers.length ? `
                    <div style="display:flex;gap:6px;align-items:center;">
                        <select id="chat-add-member-select" style="padding:6px 8px;background:#141414;color:#eee;border:1px solid #333;border-radius:6px;">
                            ${outsideMembers.map(m => `<option value="${Number(m.id)}">${escapeHTML(m.nickname)} (${escapeHTML(m.rank || "Gennin")})</option>`).join("")}
                        </select>
                        <button type="button" class="primary-button" id="chat-add-member-btn" style="padding:6px 10px;">Adicionar</button>
                    </div>
                ` : ""}
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:8px;">
                ${chatGroupMembers.map(gm => {
                    const isAdm = gm.role === "admin";
                    const canMod = (chatCanManage || chatIsSuperAdmin || isSuperAdminClient()) && Number(gm.id) !== Number(member.id);
                    return `
                        <div style="display:flex;align-items:center;gap:6px;padding:6px 10px;background:#161616;border:1px solid ${isAdm ? "#e11d48" : "#2a2a2a"};border-radius:6px;font-size:12px;">
                            <span>${escapeHTML(gm.nickname)}</span>
                            <span style="padding:1px 6px;border-radius:4px;background:${isAdm ? "#4c0519" : "#222"};color:${isAdm ? "#fda4af" : "#bbb"};">${isAdm ? "ADM" : "Membro"}</span>
                            ${canMod ? `
                                <button type="button" class="secondary-button" data-toggle-adm="${Number(gm.id)}" style="padding:2px 6px;font-size:11px;">${isAdm ? "Tirar ADM" : "Dar ADM"}</button>
                                <button type="button" class="secondary-button" data-kick-member="${Number(gm.id)}" style="padding:2px 6px;font-size:11px;border-color:#7f1d1d;color:#fca5a5;">Expulsar</button>
                            ` : ""}
                        </div>
                    `;
                }).join("")}
            </div>
        </div>
    `;
    document.querySelector("#chat-add-member-btn")?.addEventListener("click", () => {
        const sel = document.querySelector("#chat-add-member-select");
        const tid = Number(sel?.value || 0);
        if (tid) chatSocket?.emit("chat:add_member", { groupId: Number(activeGroupId), targetMemberId: tid });
    });
    panel.querySelectorAll("[data-toggle-adm]").forEach(btn => {
        btn.addEventListener("click", () => {
            chatSocket?.emit("chat:toggle_admin", { groupId: Number(activeGroupId), targetMemberId: Number(btn.dataset.toggleAdm) });
        });
    });
    panel.querySelectorAll("[data-kick-member]").forEach(btn => {
        btn.addEventListener("click", () => {
            chatSocket?.emit("chat:kick_member", { groupId: Number(activeGroupId), targetMemberId: Number(btn.dataset.kickMember) });
        });
    });
}

function drawChatLayout(content) {
    if (!content) return;
    const listItems = chatMode === "group"
        ? chatGroups.map(g => {
            const active = Number(g.id) === Number(activeGroupId);
            const badge = g.clan_id ? "CLÃ" : (g.my_role === "admin" ? "ADM" : "");
            return `<button type="button" class="secondary-button" data-pick-group="${Number(g.id)}" style="width:100%;display:flex;justify-content:space-between;align-items:center;text-align:left;margin-bottom:8px;${active ? "border-color:#e11d48;" : ""}"><span># ${escapeHTML(g.name)}</span>${badge ? `<span style="font-size:10px;opacity:.8;">${badge}</span>` : ""}</button>`;
        }).join("")
        : chatDmUsers.map(u => {
            const active = Number(u.id) === Number(activeDmUserId);
            return `<button type="button" class="secondary-button" data-pick-dm="${Number(u.id)}" style="width:100%;text-align:left;margin-bottom:8px;${active ? "border-color:#e11d48;" : ""}">${escapeHTML(u.nickname)}</button>`;
        }).join("");

    const selectableMembers = chatAllMembers.filter(m => Number(m.id) !== Number(member.id));

    content.innerHTML = `
        <section class="section-panel">
            <div class="panel-heading">
                <div>
                    <p class="eyebrow">COMUNICAÇÃO SHINOBI · SOCKET.IO</p>
                    <h2>Chat em Tempo Real</h2>
                </div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    <button type="button" class="${chatMode === "group" ? "primary-button" : "secondary-button"}" id="chat-tab-group">Grupos</button>
                    <button type="button" class="${chatMode === "dm" ? "primary-button" : "secondary-button"}" id="chat-tab-dm">Privado (DM)</button>
                </div>
            </div>
            <div style="display:grid;grid-template-columns:260px 1fr;gap:16px;">
                <div>
                    ${chatMode === "group" ? `
                        <form id="create-group-form" style="padding:10px;background:#0e0e0e;border:1px solid #262626;border-radius:8px;margin-bottom:12px;">
                            <input name="groupName" maxlength="50" placeholder="Nome do novo grupo..." required style="width:100%;padding:8px;background:#090909;color:#eee;border:1px solid #303030;border-radius:6px;margin-bottom:8px;">
                            ${selectableMembers.length ? `
                                <div style="font-size:11px;color:#aaa;margin-bottom:4px;">Adicionar membros:</div>
                                <div style="max-height:110px;overflow-y:auto;display:flex;flex-direction:column;gap:4px;margin-bottom:8px;">
                                    ${selectableMembers.map(m => `
                                        <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;">
                                            <input type="checkbox" name="memberIds" value="${Number(m.id)}">
                                            <span>${escapeHTML(m.nickname)}</span>
                                        </label>
                                    `).join("")}
                                </div>
                            ` : ""}
                            <button type="submit" class="primary-button" style="width:100%;">Criar grupo</button>
                        </form>
                    ` : ""}
                    <div>${listItems || `<p class="muted">Sem salas disponíveis.</p>`}</div>
                </div>
                <div style="display:flex;flex-direction:column;gap:10px;">
                    <div id="chat-messages-box" style="height:360px;overflow-y:auto;padding:12px;background:#090909;border:1px solid #262626;border-radius:8px;"></div>
                    <form id="chat-send-form" style="display:flex;gap:8px;">
                        <input id="chat-input" maxlength="1000" placeholder="Escreve a tua mensagem..." required style="flex:1;padding:10px 12px;background:#090909;color:#eee;border:1px solid #303030;border-radius:6px;">
                        <button type="submit" class="primary-button">ENVIAR</button>
                    </form>
                    <div id="chat-members-panel"></div>
                </div>
            </div>
        </section>
    `;

    document.querySelector("#chat-tab-group")?.addEventListener("click", () => {
        chatMode = "group";
        if (!activeGroupId && chatGroups.length) activeGroupId = Number(chatGroups[0].id);
        joinCurrentChatRoom();
        drawChatLayout(content);
    });
    document.querySelector("#chat-tab-dm")?.addEventListener("click", () => {
        chatMode = "dm";
        if (!activeDmUserId && chatDmUsers.length) activeDmUserId = Number(chatDmUsers[0].id);
        joinCurrentChatRoom();
        drawChatLayout(content);
    });
    document.querySelectorAll("[data-pick-group]").forEach(btn => {
        btn.addEventListener("click", () => {
            activeGroupId = Number(btn.dataset.pickGroup);
            joinCurrentChatRoom();
            drawChatLayout(content);
        });
    });
    document.querySelectorAll("[data-pick-dm]").forEach(btn => {
        btn.addEventListener("click", () => {
            activeDmUserId = Number(btn.dataset.pickDm);
            joinCurrentChatRoom();
            drawChatLayout(content);
        });
    });
    document.querySelector("#create-group-form")?.addEventListener("submit", e => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const memberIds = fd.getAll("memberIds").map(Number);
        chatSocket?.emit("chat:create_group", { name: fd.get("groupName"), memberIds });
        e.currentTarget.reset();
    });
    document.querySelector("#chat-send-form")?.addEventListener("submit", e => {
        e.preventDefault();
        const inp = document.querySelector("#chat-input");
        const val = (inp?.value || "").trim();
        if (!val) return;
        chatSocket?.emit("chat:send", {
            chatType: chatMode,
            groupId: Number(activeGroupId),
            targetMemberId: Number(activeDmUserId),
            content: val
        });
        inp.value = "";
    });
    drawChatMessages();
    drawChatMembersBox(content);
}

function renderChat(content) {
    drawChatLayout(content);
    if (typeof io !== "function") {
        const sc = document.createElement("script");
        sc.src = "/socket.io/socket.io.js";
        sc.onload = () => ensureChatSocket(content);
        document.head.appendChild(sc);
    } else {
        ensureChatSocket(content);
    }
}


function renderSettings(container) {
    const safeUser = escapeHTML(member?.username || member?.loginUsername || member?.nickname || '—');
    const safeNick = escapeHTML(member?.nickname || '—');
    const safeRole = escapeHTML(typeof roleLabel === 'function' ? roleLabel(member?.site_role) : (member?.site_role || 'Membro'));
    const safeClan = escapeHTML(member?.clan || member?.clan_name || 'Sem clã');

    container.innerHTML = `
        <div class="settings-grid">
            <section class="card">
                <h3>Segurança — Alterar palavra-passe</h3>
                <p class="muted">Atualiza a senha da tua conta shinobi (mínimo de 8 caracteres).</p>
                <form id="settings-password-form" class="form-stack">
                    <label>
                        Palavra-passe atual
                        <span data-eye-wrap style="position:relative;display:flex;align-items:center;width:100%;"><input style="padding-right:76px;" name="currentPassword" type="password" autocomplete="current-password" required><button type="button" data-eye-btn aria-label="Alternar visibilidade da senha" style="position:absolute;right:10px;background:transparent;border:1px solid rgba(255,255,255,0.16);border-radius:4px;color:inherit;opacity:0.78;cursor:pointer;padding:2px 7px;font-size:10px;letter-spacing:0.06em;line-height:1.2;">VER</button></span>
                    </label>
                    <label>
                        Nova palavra-passe
                        <span data-eye-wrap style="position:relative;display:flex;align-items:center;width:100%;"><input style="padding-right:76px;" name="newPassword" type="password" autocomplete="new-password" minlength="8" required><button type="button" data-eye-btn aria-label="Alternar visibilidade da senha" style="position:absolute;right:10px;background:transparent;border:1px solid rgba(255,255,255,0.16);border-radius:4px;color:inherit;opacity:0.78;cursor:pointer;padding:2px 7px;font-size:10px;letter-spacing:0.06em;line-height:1.2;">VER</button></span>
                    </label>
                    <label>
                        Confirmar nova palavra-passe
                        <span data-eye-wrap style="position:relative;display:flex;align-items:center;width:100%;"><input style="padding-right:76px;" name="confirmPassword" type="password" autocomplete="new-password" minlength="8" required><button type="button" data-eye-btn aria-label="Alternar visibilidade da senha" style="position:absolute;right:10px;background:transparent;border:1px solid rgba(255,255,255,0.16);border-radius:4px;color:inherit;opacity:0.78;cursor:pointer;padding:2px 7px;font-size:10px;letter-spacing:0.06em;line-height:1.2;">VER</button></span>
                    </label>
                    <button type="submit" class="btn-primary">Guardar nova senha</button>
                </form>
            </section>

            <section class="card">
                <h3>Informações da conta</h3>
                <p class="muted">Resumo atual da tua sessão ativa no Shinobi Verse.</p>
                <div class="form-stack">
                    <div><strong>Utilizador:</strong> ${safeUser}</div>
                    <div><strong>Nickname:</strong> ${safeNick}</div>
                    <div><strong>Cargo:</strong> ${safeRole}</div>
                    <div><strong>Clã:</strong> ${safeClan}</div>
                    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">
                        <button type="button" id="settings-go-profile" class="btn-secondary">Abrir Meu perfil</button>
                        <button type="button" id="settings-logout-btn" class="logout-button">Terminar sessão</button>
                    </div>
                </div>
            </section>
        </div>
    `;

    document.querySelector('#settings-password-form')?.addEventListener('submit', updatePassword);
    document.querySelector('#settings-go-profile')?.addEventListener('click', () => navigate('profile'));
    document.querySelector('#settings-logout-btn')?.addEventListener('click', logout);
}


// EYE_TOGGLE_START
document.addEventListener("click", (event) => {
  const btn = event.target.closest("[data-eye-btn]");
  if (!btn) return;
  event.preventDefault();
  event.stopPropagation();
  const wrap = btn.closest("[data-eye-wrap]");
  const input = wrap ? wrap.querySelector("input") : null;
  if (!input) return;
  const show = input.type === "password";
  input.type = show ? "text" : "password";
  btn.textContent = show ? "OCULTAR" : "VER";
  btn.style.opacity = show ? "1" : "0.78";
});
// EYE_TOGGLE_END
