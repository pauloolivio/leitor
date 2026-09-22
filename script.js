// ==================== CONFIG ====================
const DATA_PATH = 'data';
const STORIES_INDEX = `${DATA_PATH}/stories-index.json`;
const CONVERSATIONS_INDEX = `${DATA_PATH}/conversations-index.json`;
const QUESTIONS_INDEX = `${DATA_PATH}/questions-index.json`;

// Cache em memória
const contentCache = new Map();

// Estado global
let storiesIndex = [];
let conversationsIndex = [];
let conversationsCache = [];
let questionsIndex = [];

// ==================== ESTADO DAS NOVAS FEATURES ====================
let currentSpeed = 0.8;            // velocidade atual (0.5, 0.8, 1.0)
let showTranslation = false;       // tradução oculta por padrão
let showConnectedSpeech = true;    // connected speech visível por padrão
const STREAK_STORAGE_KEY = 'english-practice-streak';
const SPEED_STORAGE_KEY = 'english-practice-speed';
const TRANSLATION_STORAGE_KEY = 'english-practice-show-translation';
const CONNECTED_STORAGE_KEY = 'english-practice-show-connected';

// ==================== UTILITY ====================
function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

async function fetchJSON(url) {
    if (contentCache.has(url)) return contentCache.get(url);
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        contentCache.set(url, data);
        return data;
    } catch (err) {
        console.error(`Erro ao carregar ${url}:`, err);
        return null;
    }
}

function setButtonLoading(btn, loading, labelDefault) {
    if (loading) {
        btn.disabled = true;
        btn.dataset.originalHTML = btn.innerHTML;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Loading...`;
    } else {
        btn.disabled = false;
        btn.innerHTML = btn.dataset.originalHTML || labelDefault;
    }
}

// ==================== VOZ ==================== 
const VOICE_STORAGE_KEY = 'english-practice-voice-gender';
let currentVoiceGender = 'female';

// Lista de hints FEMININAS (incluindo Thalita e vozes Google)
const FEMALE_VOICE_HINTS = [
    'aria', 'female', 'woman', 'girl', 'zira', 'samantha', 'victoria', 'karen',
    'moira', 'tessa', 'fiona', 'serena', 'allison', 'ava', 'susan',
    'joanna', 'salli', 'kimberly', 'ivy', 'kendra', 'jenny',
    'michelle', 'clara', 'emma', 'olivia', 'sophia', 'linda', 'maria',
    'catherine', 'amelie', 'joana', 'luciana', 'fernanda', 'francisca',
    'ana', 'alice', 'isabella', 'mia', 'libby', 'sonia', 'maisie',
    'natasha', 'amber', 'ashley', 'cora', 'elizabeth', 'jane',
    'nancy', 'monica', 'sara', 'tina', 'veena', 'yan', 'yuna', 'xiaoxiao',
    'kalpana', 'heera', 'swara', 'neerja',
    // Google voices (femininas)
    'google us english', 'google uk english female',
    // Microsoft neurais
    'thalita', 'beatriz', 'marina', 'lucia', 'elza'
];

// Lista de hints MASCULINAS
const MALE_VOICE_HINTS = [
    'male', 'man', 'boy', 'david', 'mark', 'george', 'james', 'daniel',
    'alex', 'fred', 'tom', 'oliver', 'ryan', 'guy', 'eric', 'christopher',
    'brian', 'matthew', 'liam', 'william', 'jorge', 'diego', 'ricardo',
    'felipe', 'marcos', 'carlos', 'andrew', 'brandon', 'jason', 'kevin',
    'justin', 'nathan', 'prabhat', 'rishi', 'hemant', 'madhur', 'ravi',
    'yunxi', 'yunyang', 'yunjian', 'kangkang', 'zhiyu', 'aaron', 'arthur',
    'conrad', 'kai', 'luke', 'nathaniel', 'thomas', 'tony',
    // Google voices (masculinas)
    'google uk english male',
    // Microsoft neurais PT/EN
    'antonio', 'humberto', 'fabio', 'julio', 'guy neural', 'davis', 'jason neural'
];

/**
 * Detecta o gênero da voz por heurística de nome.
 * Retorna 'female', 'male' ou 'unknown'.
 */
function detectGender(voice) {
    const name = (voice.name || '').toLowerCase();
    const uri = (voice.voiceURI || '').toLowerCase();
    const haystack = name + ' ' + uri;

    // Prioridade: Thalita é female
    if (haystack.includes('thalita')) return 'female';
    
    // Checa feminino primeiro (mais específico)
    if (FEMALE_VOICE_HINTS.some(h => haystack.includes(h))) return 'female';
    if (MALE_VOICE_HINTS.some(h => haystack.includes(h))) return 'male';
    
    return 'unknown';
}

/**
 * ✅ NOVA FUNÇÃO: Mescla sua prioridade com filtro de gênero.
 * 
 * Hierarquia (dentro do gênero escolhido):
 *   1ª - Voz en* com "Google" no nome
 *   2ª - Qualquer voz en-US
 *   3ª - Qualquer voz en*
 *   4ª - Voz PT-BR (Thalita) se for female
 *   5ª - Voz padrão do sistema
 */
function getEnglishVoice(gender = currentVoiceGender) {
    if (!('speechSynthesis' in window)) return null;
    const voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) return null;

    // 1️⃣ Filtra por gênero primeiro
    const genderVoices = voices.filter(v => detectGender(v) === gender);
    
    // Se não achou voz do gênero, tenta PT-BR (Thalita)
    const fallbackVoices = genderVoices.length > 0 ? genderVoices : voices;

    // 2️⃣ Aplica SUA hierarquia de prioridade dentro do pool filtrado
    // 1ª - Google + en
    const googleEn = fallbackVoices.find(v =>
        v.lang.toLowerCase().startsWith('en') && 
        (v.name || '').toLowerCase().includes('google')
    );
    if (googleEn) return googleEn;

    // 1.5ª - Vozes Neurais/Online (mais naturais que en-US comuns)
    const neuralEn = fallbackVoices.find(v => {
        const n = (v.name || '').toLowerCase();
        return v.lang.toLowerCase().startsWith('en') && 
               (n.includes('neural') || n.includes('online') || n.includes('natural'));
    });
    if (neuralEn) return neuralEn;

    // 2ª - Qualquer en-US
    const enUS = fallbackVoices.find(v => v.lang.toLowerCase().startsWith('en-us'));
    if (enUS) return enUS;

    // 3ª - Qualquer en*
    const enAny = fallbackVoices.find(v => v.lang.toLowerCase().startsWith('en'));
    if (enAny) return enAny;

    // 4ª - PT-BR (fallback especial - Thalita fala inglês com sotaque)
    const ptBR = fallbackVoices.find(v => 
        v.lang.toLowerCase().startsWith('pt-br') &&
        (v.name || '').toLowerCase().includes('thalita')
    );
    if (ptBR) return ptBR;

    // 5ª - Primeira voz do pool
    return fallbackVoices[0] || voices[0] || null;
}

/**
 * Retorna o pitch adequado.
 * Se temos vozes neurais distintas por gênero → 1.0 (natural)
 * Senão → ajusta por pitch
 */
function getPitchForGender(gender) {
    const voices = window.speechSynthesis.getVoices();
    const enVoices = voices.filter(v => v.lang.toLowerCase().startsWith('en'));

    const hasFemale = enVoices.some(v => detectGender(v) === 'female');
    const hasMale = enVoices.some(v => detectGender(v) === 'male');

    // Se existem as duas categorias, pitch natural
    if (hasFemale && hasMale) return 1.0;

    // Se só temos vozes neurais de um gênero, deixa natural
    const hasNeural = enVoices.some(v => {
        const n = (v.name || '').toLowerCase();
        return n.includes('neural') || n.includes('online') || n.includes('natural');
    });
    if (hasNeural) return 1.0;

    // Fallback: diferencia por pitch
    return gender === 'female' ? 1.1 : 0.85;
}

function falarTexto(texto, lang = 'en-US', options = {}) {
    if (!('speechSynthesis' in window)) {
        alert('Seu navegador não suporta leitura em voz alta.');
        return null;
    }
    if (!options.keepQueue) {
        window.speechSynthesis.cancel();
    }
    const utterance = new SpeechSynthesisUtterance(texto);
    utterance.lang = lang;

    // ✅ Usa a nova função integrada
    const voice = getEnglishVoice(currentVoiceGender);
    if (voice) utterance.voice = voice;

    utterance.rate = options.rate !== undefined ? options.rate : currentSpeed;
    utterance.pitch = options.pitch !== undefined
        ? options.pitch
        : getPitchForGender(currentVoiceGender);

    if (options.onstart) utterance.onstart = options.onstart;
    if (options.onend) utterance.onend = options.onend;

    window.speechSynthesis.speak(utterance);
    return utterance;
}

function setupVoiceControl() {
    const selector = document.getElementById('voiceSelector');
    if (!selector) return;

    // Carrega preferência salva
    try {
        const saved = localStorage.getItem(VOICE_STORAGE_KEY);
        if (saved === 'male' || saved === 'female') currentVoiceGender = saved;
    } catch (e) { /* ignore */ }

    // Aplica estado inicial
    selector.querySelectorAll('.voice-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.voice === currentVoiceGender);
    });

    selector.querySelectorAll('.voice-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const gender = btn.dataset.voice;
            if (gender === currentVoiceGender) return;
            currentVoiceGender = gender;

            selector.querySelectorAll('.voice-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            try { localStorage.setItem(VOICE_STORAGE_KEY, gender); } catch (e) { /* ignore */ }

            // Para qualquer áudio em reprodução
            if (window.speechSynthesis.speaking) {
                window.speechSynthesis.cancel();
                unhighlightAllLines();
                document.querySelectorAll('.btn-control.speaking, .btn-line-action.speaking')
                    .forEach(b => b.classList.remove('speaking'));
            }

            // Feedback sonoro
            falarTexto(gender === 'female' ? 'Female voice selected.' : 'Male voice selected.', 'en-US');
        });
    });
}

// ==================== STREAK TRACKER ====================
function getStreakData() {
    try {
        const raw = localStorage.getItem(STREAK_STORAGE_KEY);
        if (!raw) return { date: todayStr(), count: 0, practiced: [] };
        const data = JSON.parse(raw);
        if (data.date !== todayStr()) {
            return { date: todayStr(), count: 0, practiced: [] };
        }
        return data;
    } catch (e) {
        return { date: todayStr(), count: 0, practiced: [] };
    }
}

function todayStr() {
    return new Date().toISOString().slice(0, 10);
}

function markPracticed(id, type) {
    const data = getStreakData();
    const key = `${type}:${id}`;
    if (!data.practiced.includes(key)) {
        data.practiced.push(key);
        data.count = data.practiced.length;
    }
    try {
        localStorage.setItem(STREAK_STORAGE_KEY, JSON.stringify(data));
    } catch (e) { /* ignore */ }
    updateStreakUI();
}

function updateStreakUI() {
    const data = getStreakData();
    const indicator = document.getElementById('streakIndicator');
    const text = document.getElementById('streakText');
    if (!indicator || !text) return;
    if (data.count > 0) {
        indicator.style.display = 'inline-flex';
        text.textContent = `${data.count} ${data.count === 1 ? 'praticado' : 'praticados'} hoje`;
    } else {
        indicator.style.display = 'none';
    }
}

// ==================== RENDER STORIES ====================
function renderizarContos() {
    const container = document.getElementById('contosContainer');
    if (!container) return;
    container.innerHTML = '';

    storiesIndex.forEach(conto => {
        const contoDiv = document.createElement('div');
        contoDiv.className = 'conto-item';
        contoDiv.dataset.id = conto.id;

        const header = document.createElement('div');
        header.className = 'conto-header';
        header.innerHTML = `
            <div class="conto-info">
                <div class="conto-titulo">
                    <i class="fa-regular fa-star"></i> ${escapeHTML(conto.titulo)}
                    <span class="personagem-badge"><i class="fa-regular fa-user"></i> ${escapeHTML(conto.personagens)}</span>
                    <span class="level-badge"><i class="fa-regular fa-flag"></i> ${escapeHTML(conto.level)}</span>
                </div>
            </div>
            <div class="expand-icon">
                <i class="fa-solid fa-chevron-down"></i>
            </div>
        `;

        const vocabHTML = `
            <div class="vocabulary-box">
                <h4><i class="fa-regular fa-book"></i> Key Vocabulary:</h4>
                <ul>${conto.vocabulary.map(w => `<li>${escapeHTML(w)}</li>`).join('')}</ul>
            </div>
        `;

        const detalhesDiv = document.createElement('div');
        detalhesDiv.className = 'conto-detalhes';
        detalhesDiv.innerHTML = `
            <div class="detalhes-content">
                <div class="resumo-texto">
                    <i class="fa-regular fa-message"></i> 
                    ${escapeHTML(conto.resumo).replace(/\n/g, '<br>')}
                </div>
                ${vocabHTML}
                <button class="btn-acessar btn-read-story" data-id="${conto.id}" data-file="${escapeHTML(conto.file)}">
                    <i class="fa-solid fa-book-open"></i> Read full story
                </button>
            </div>
        `;

        contoDiv.appendChild(header);
        contoDiv.appendChild(detalhesDiv);
        container.appendChild(contoDiv);

        header.addEventListener('click', (e) => {
            if (e.target.closest('.btn-acessar')) return;
            contoDiv.classList.toggle('expanded');
        });

        const btnRead = detalhesDiv.querySelector('.btn-read-story');
        btnRead.addEventListener('click', async (e) => {
            e.stopPropagation();
            setButtonLoading(btnRead, true);
            const data = await fetchJSON(`${DATA_PATH}/${conto.file}`);
            setButtonLoading(btnRead, false);
            if (data && data.textoCompleto) {
                markPracticed(conto.id, 'story');
                exibirModal(conto.titulo, data.textoCompleto, 'flag');
            } else {
                alert("Não foi possível carregar a história completa.");
            }
        });
    });
}

// ==================== RENDER CONVERSATIONS ====================
function renderizarConversas() {
    const container = document.getElementById('conversationsContainer');
    if (!container) return;
    container.innerHTML = '';

    conversationsIndex.forEach(conv => {
        const convDiv = document.createElement('div');
        convDiv.className = 'conto-item';
        convDiv.dataset.id = conv.id;

        const header = document.createElement('div');
        header.className = 'conto-header';
        header.innerHTML = `
            <div class="conto-info">
                <div class="conto-titulo">
                    <i class="fa-solid fa-comments"></i> ${escapeHTML(conv.titulo)}
                    <span class="personagem-badge"><i class="fa-solid fa-location-dot"></i> ${escapeHTML(conv.contexto)}</span>
                    <span class="level-badge"><i class="fa-regular fa-flag"></i> ${escapeHTML(conv.level)}</span>
                </div>
            </div>
            <div class="expand-icon">
                <i class="fa-solid fa-chevron-down"></i>
            </div>
        `;

        const vocabHTML = `
            <div class="vocabulary-box">
                <h4><i class="fa-regular fa-book"></i> Key Vocabulary:</h4>
                <ul>${conv.vocabulary.map(w => `<li>${escapeHTML(w)}</li>`).join('')}</ul>
            </div>
        `;

        const tipsHTML = `
            <div class="tips-box">
                <h4><i class="fa-regular fa-lightbulb"></i> Shadowing Tips:</h4>
                <ul>${conv.tips.map(t => `<li>${escapeHTML(t)}</li>`).join('')}</ul>
            </div>
        `;

        const detalhesDiv = document.createElement('div');
        detalhesDiv.className = 'conto-detalhes';
        detalhesDiv.innerHTML = `
            <div class="detalhes-content">
                <div class="dialogue-placeholder" id="dialogue-${conv.id}" style="display:none;"></div>
                <div class="dialogue-loading" id="loading-${conv.id}" style="display:none; text-align:center; padding:1rem; color:#0284c7;">
                    <i class="fa-solid fa-spinner fa-spin"></i> Loading dialogue...
                </div>
                ${vocabHTML}
                ${tipsHTML}
                <div class="audio-controls">
                    <button class="btn-control btn-play-all" data-id="${conv.id}" disabled>
                        <i class="fa-solid fa-play"></i> Play Full Dialogue
                    </button>
                    <button class="btn-control btn-practice" data-id="${conv.id}" disabled>
                        <i class="fa-solid fa-microphone"></i> Practice Line by Line
                    </button>
                    <button class="btn-control btn-repeat-practice" data-id="${conv.id}" disabled title="Lê o diálogo inteiro 1 vez + 5 repetições">
                        <i class="fa-solid fa-rotate-right"></i> Repeat Practice (5x)
                    </button>
                    <button class="btn-control btn-roleplay" data-id="${conv.id}" disabled title="Escolha um personagem e pratique o outro">
                        <i class="fa-solid fa-users"></i> Roleplay Mode
                    </button>
                    <button class="btn-acessar btn-read-conv" data-id="${conv.id}" data-file="${escapeHTML(conv.file)}" style="margin-left:auto;">
                        <i class="fa-solid fa-book-open-reader"></i> Read full conversation
                    </button>
                </div>
                <div class="roleplay-panel" id="roleplay-${conv.id}" style="display:none;"></div>
            </div>
        `;

        convDiv.appendChild(header);
        convDiv.appendChild(detalhesDiv);
        container.appendChild(convDiv);

        let loaded = false;
        async function ensureLoaded() {
            if (loaded) return conversationsCache.find(c => c.id === conv.id);
            const loadingEl = detalhesDiv.querySelector(`#loading-${conv.id}`);
            const placeholderEl = detalhesDiv.querySelector(`#dialogue-${conv.id}`);
            loadingEl.style.display = 'block';

            const data = await fetchJSON(`${DATA_PATH}/${conv.file}`);
            loadingEl.style.display = 'none';

            if (!data || !data.dialogo) {
                placeholderEl.innerHTML = `<p style="color:red;">Erro ao carregar o diálogo.</p>`;
                placeholderEl.style.display = 'block';
                return null;
            }

            const fullConv = { ...conv, dialogo: data.dialogo };
            conversationsCache.push(fullConv);
            renderDialogueHTML(fullConv, placeholderEl);
            placeholderEl.style.display = 'block';

            detalhesDiv.querySelector('.btn-play-all').disabled = false;
            detalhesDiv.querySelector('.btn-practice').disabled = false;
            detalhesDiv.querySelector('.btn-repeat-practice').disabled = false;
            detalhesDiv.querySelector('.btn-roleplay').disabled = false;

            loaded = true;
            return fullConv;
        }

        header.addEventListener('click', async (e) => {
            if (e.target.closest('.btn-control') || e.target.closest('.btn-acessar')) return;
            const expanded = convDiv.classList.toggle('expanded');
            if (expanded) await ensureLoaded();
        });

        // Play full dialogue
        detalhesDiv.querySelector('.btn-play-all').addEventListener('click', async (e) => {
            e.stopPropagation();
            const full = await ensureLoaded();
            if (full) {
                markPracticed(conv.id, 'conversation');
                speakFullDialogue(full, e.currentTarget);
            }
        });

        // Practice line by line
        detalhesDiv.querySelector('.btn-practice').addEventListener('click', async (e) => {
            e.stopPropagation();
            const full = await ensureLoaded();
            if (full) {
                markPracticed(conv.id, 'conversation');
                practiceLineByLine(full, e.currentTarget);
            }
        });

        // Repeat Practice
        detalhesDiv.querySelector('.btn-repeat-practice').addEventListener('click', async (e) => {
            e.stopPropagation();
            const full = await ensureLoaded();
            if (full) {
                markPracticed(conv.id, 'conversation');
                repeatFullDialogue(full, e.currentTarget, 5);
            }
        });

        // Roleplay
        detalhesDiv.querySelector('.btn-roleplay').addEventListener('click', async (e) => {
            e.stopPropagation();
            const full = await ensureLoaded();
            if (full) showRoleplayPanel(full, detalhesDiv, e.currentTarget);
        });

        // Read full conversation
        detalhesDiv.querySelector('.btn-read-conv').addEventListener('click', async (e) => {
            e.stopPropagation();
            const btn = e.currentTarget;
            setButtonLoading(btn, true);
            const full = await ensureLoaded();
            setButtonLoading(btn, false);
            if (full) exibirConversaCompleta(full);
        });
    });
}

// ==================== RENDER DIALOGUE HTML ====================
function renderDialogueHTML(conv, placeholderEl) {
    const dialogueHTML = conv.dialogo.map((line, index) => {
        const charClass = index % 2 === 0 ? 'character-a' : 'character-b';
        const translation = line.translation || '';
        const connected = line.connected || '';
        return `
            <div class="dialogue-line ${charClass}" data-line-index="${index}" data-speaker="${escapeHTML(line.speaker)}">
                <span class="speaker">${escapeHTML(line.speaker)}:</span>
                <span class="dialogue-text">
                    <span class="line-content">${escapeHTML(line.text)}</span>
                    ${connected ? `<span class="connected-speech" data-connected="${escapeHTML(connected)}">🔗 ${escapeHTML(connected)}</span>` : ''}
                    <span class="pt-translation" data-translation="${escapeHTML(translation)}">${escapeHTML(translation)}</span>
                    <div class="line-actions">
                        <button class="btn-line-action btn-repeat-line" title="Repeat this line 5x">
                            <i class="fa-solid fa-rotate-right"></i> Repeat 5x
                        </button>
                        <button class="btn-line-action btn-play-line" title="Play this line">
                            <i class="fa-solid fa-play"></i> Play
                        </button>
                    </div>
                </span>
            </div>
        `;
    }).join('');

    placeholderEl.innerHTML = `
        <div class="conversation-box">
            <h4><i class="fa-solid fa-comment-dots"></i> Dialogue:</h4>
            ${dialogueHTML}
        </div>
    `;

    // Aplica estado inicial de tradução/connected
    applyTranslationVisibility(placeholderEl);
    applyConnectedVisibility(placeholderEl);

    // Listener para Repeat Line (5x)
    placeholderEl.querySelectorAll('.btn-repeat-line').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const lineEl = btn.closest('.dialogue-line');
            const idx = parseInt(lineEl.dataset.lineIndex, 10);
            repeatSingleLine(conv, idx, btn);
        });
    });

    // Listener para Play Line
    placeholderEl.querySelectorAll('.btn-play-line').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const lineEl = btn.closest('.dialogue-line');
            const idx = parseInt(lineEl.dataset.lineIndex, 10);
            const line = conv.dialogo[idx];
            highlightLine(lineEl);
            falarTexto(line.text, 'en-US', {
                rate: currentSpeed,
                onend: () => unhighlightLine(lineEl)
            });
        });
    });
}

// ==================== HIGHLIGHT / ACTIVE LINE ====================
function highlightLine(lineEl) {
    document.querySelectorAll('.dialogue-line.speaking-line').forEach(el => {
        el.classList.remove('speaking-line');
    });
    if (lineEl) lineEl.classList.add('speaking-line');
}

function unhighlightLine(lineEl) {
    if (lineEl) lineEl.classList.remove('speaking-line');
}

function unhighlightAllLines() {
    document.querySelectorAll('.dialogue-line.speaking-line').forEach(el => {
        el.classList.remove('speaking-line');
    });
}

// ==================== REPEAT SINGLE LINE ====================
function repeatSingleLine(conv, index, button, times = 5) {
    const lineEl = document.querySelector(`.dialogue-line[data-line-index="${index}"]`);
    if (!lineEl) return;

    const originalHTML = button.innerHTML;
    // Cancela qualquer leitura anterior
    window.speechSynthesis.cancel();
    button.classList.add('speaking');
    button.innerHTML = `<i class="fa-solid fa-stop"></i> Stop`;

    let count = 0;
    let cancelled = false;

    // Detectar cancelamento
    const checkCancel = setInterval(() => {
        if (!window.speechSynthesis.speaking && !button.classList.contains('speaking')) {
            cancelled = true;
            clearInterval(checkCancel);
        }
    }, 300);

    function speakOnce() {
        if (cancelled) return;
        if (count >= times) {
            clearInterval(checkCancel);
            button.classList.remove('speaking');
            button.innerHTML = originalHTML;
            unhighlightLine(lineEl);
            return;
        }
        count++;
        button.innerHTML = `<i class="fa-solid fa-stop"></i> ${count}/${times}`;
        highlightLine(lineEl);

        const utterance = falarTexto(conv.dialogo[index].text, 'en-US', {
            rate: currentSpeed,
            keepQueue: true,
            onend: () => {
                setTimeout(speakOnce, 600);
            },
            onerror: () => {
                clearInterval(checkCancel);
                button.classList.remove('speaking');
                button.innerHTML = originalHTML;
                unhighlightLine(lineEl);
            }
        });
    }

    // Toggle: se clicar de novo no mesmo botão, para
    button.addEventListener('click', function stopHandler(e) {
        if (button.classList.contains('speaking') && cancelled === false && window.speechSynthesis.speaking) {
            // Já tratado no início - este listener é apenas fallback
        }
    }, { once: true });

    // Para o repeat ao clicar novamente
    const stopOnClick = (e) => {
        if (button.classList.contains('speaking')) {
            e.stopPropagation();
            cancelled = true;
            window.speechSynthesis.cancel();
            clearInterval(checkCancel);
            button.classList.remove('speaking');
            button.innerHTML = originalHTML;
            unhighlightLine(lineEl);
            button.removeEventListener('click', stopOnClick, true);
        }
    };
    button.addEventListener('click', stopOnClick, true);

    speakOnce();
}

// ==================== APPLY VISIBILITY ====================
function applyTranslationVisibility(scope) {
    const root = scope || document;
    root.querySelectorAll('.pt-translation').forEach(el => {
        if (showTranslation) {
            el.classList.remove('translation-hidden');
        } else {
            el.classList.add('translation-hidden');
        }
    });
}

function applyConnectedVisibility(scope) {
    const root = scope || document;
    root.querySelectorAll('.connected-speech').forEach(el => {
        if (showConnectedSpeech) {
            el.classList.remove('connected-hidden');
        } else {
            el.classList.add('connected-hidden');
        }
    });
}

// ==================== REPEAT FULL DIALOGUE ====================
function repeatFullDialogue(conv, button, repeatCount = 5) {
    const originalLabel = '<i class="fa-solid fa-rotate-right"></i> Repeat Practice (5x)';

    // Toggle stop
    if (button.classList.contains('speaking')) {
        window.speechSynthesis.cancel();
        button.classList.remove('speaking');
        button.innerHTML = originalLabel;
        unhighlightAllLines();
        return;
    }

    button.classList.add('speaking');
    button.innerHTML = `<i class="fa-solid fa-stop"></i> Stop`;

    const totalRounds = repeatCount + 1;
    let currentRound = 0;
    let cancelled = false;

    function playRound() {
        if (cancelled) return;
        if (currentRound >= totalRounds) {
            button.classList.remove('speaking');
            button.innerHTML = originalLabel;
            unhighlightAllLines();
            return;
        }

        currentRound++;
        const roundLabel = currentRound === 1
            ? `Inicial (1/${totalRounds})`
            : `Rep. ${currentRound - 1}/${repeatCount}`;
        button.innerHTML = `<i class="fa-solid fa-stop"></i> ${roundLabel}`;

        let lineIndex = 0;

        function speakLine() {
            if (cancelled) return;
            if (lineIndex >= conv.dialogo.length) {
                setTimeout(playRound, 1000);
                return;
            }

            const line = conv.dialogo[lineIndex];
            const lineEl = document.querySelector(`.dialogue-line[data-line-index="${lineIndex}"]`);
            highlightLine(lineEl);

            const utterance = falarTexto(line.text, 'en-US', {
                rate: currentSpeed,
                keepQueue: true,
                onend: () => {
                    lineIndex++;
                    setTimeout(speakLine, 400);
                },
                onerror: () => {
                    cancelled = true;
                    button.classList.remove('speaking');
                    button.innerHTML = originalLabel;
                    unhighlightAllLines();
                }
            });
        }

        speakLine();
    }

    // Stop listener
    const stopHandler = (e) => {
        if (!button.classList.contains('speaking')) return;
        e.stopPropagation();
        cancelled = true;
        window.speechSynthesis.cancel();
        button.classList.remove('speaking');
        button.innerHTML = originalLabel;
        unhighlightAllLines();
    };
    button.addEventListener('click', stopHandler, true);

    playRound();
}

// ==================== SPEAK FULL DIALOGUE ====================
function speakFullDialogue(conv, button) {
    if (window.speechSynthesis.speaking || button.classList.contains('speaking')) {
        window.speechSynthesis.cancel();
        button.classList.remove('speaking');
        button.innerHTML = '<i class="fa-solid fa-play"></i> Play Full Dialogue';
        unhighlightAllLines();
        return;
    }

    button.classList.add('speaking');
    button.innerHTML = '<i class="fa-solid fa-stop"></i> Stop';

    let index = 0;

    function speakNext() {
        if (index >= conv.dialogo.length) {
            button.classList.remove('speaking');
            button.innerHTML = '<i class="fa-solid fa-play"></i> Play Full Dialogue';
            unhighlightAllLines();
            return;
        }

        const line = conv.dialogo[index];
        const lineEl = document.querySelector(`.dialogue-line[data-line-index="${index}"]`);
        highlightLine(lineEl);

        falarTexto(line.text, 'en-US', {
            rate: currentSpeed,
            keepQueue: true,
            onend: () => {
                index++;
                setTimeout(speakNext, 400);
            },
            onerror: () => {
                button.classList.remove('speaking');
                button.innerHTML = '<i class="fa-solid fa-play"></i> Play Full Dialogue';
                unhighlightAllLines();
            }
        });
    }

    // Stop listener
    const stopHandler = (e) => {
        if (!button.classList.contains('speaking')) return;
        e.stopPropagation();
        window.speechSynthesis.cancel();
        button.classList.remove('speaking');
        button.innerHTML = '<i class="fa-solid fa-play"></i> Play Full Dialogue';
        unhighlightAllLines();
    };
    button.addEventListener('click', stopHandler, true);

    speakNext();
}

// ==================== PRACTICE LINE BY LINE ====================
function practiceLineByLine(conv, button) {
    if (button && button.classList.contains('speaking')) {
        window.speechSynthesis.cancel();
        button.classList.remove('speaking');
        button.innerHTML = '<i class="fa-solid fa-microphone"></i> Practice Line by Line';
        unhighlightAllLines();
        return;
    }

    if (button) {
        button.classList.add('speaking');
        button.innerHTML = '<i class="fa-solid fa-stop"></i> Stop';
    }

    let index = 0;

    function speakLine() {
        if (index >= conv.dialogo.length) {
            if (button) {
                button.classList.remove('speaking');
                button.innerHTML = '<i class="fa-solid fa-microphone"></i> Practice Line by Line';
            }
            unhighlightAllLines();
            alert('Practice complete! Great job! 🎉');
            return;
        }

        const line = conv.dialogo[index];
        const lineEl = document.querySelector(`.dialogue-line[data-line-index="${index}"]`);
        highlightLine(lineEl);

        falarTexto(line.text, 'en-US', {
            rate: currentSpeed,
            keepQueue: true,
            onend: () => {
                setTimeout(() => {
                    index++;
                    speakLine();
                }, 2000);
            },
            onerror: () => {
                if (button) {
                    button.classList.remove('speaking');
                    button.innerHTML = '<i class="fa-solid fa-microphone"></i> Practice Line by Line';
                }
                unhighlightAllLines();
            }
        });
    }

    speakLine();
}

// ==================== ROLEPLAY MODE ====================
function showRoleplayPanel(conv, detalhesDiv, button) {
    const panel = detalhesDiv.querySelector(`#roleplay-${conv.id}`);
    if (panel.style.display === 'block') {
        panel.style.display = 'none';
        return;
    }

    // Descobre os speakers únicos
    const speakers = [...new Set(conv.dialogo.map(l => l.speaker))];
    const speakerA = speakers[0] || 'A';
    const speakerB = speakers[1] || 'B';

    panel.innerHTML = `
        <div class="roleplay-content">
            <h4><i class="fa-solid fa-users"></i> Roleplay Mode — Choose your character:</h4>
            <p class="roleplay-hint">The system will speak the <strong>other</strong> character's lines and pause for you to read yours aloud.</p>
            <div class="roleplay-buttons">
                <button class="btn-roleplay-char" data-char="${escapeHTML(speakerA)}">
                    <i class="fa-solid fa-user"></i> I am ${escapeHTML(speakerA)} <small>(sistema lê ${escapeHTML(speakerB)})</small>
                </button>
                <button class="btn-roleplay-char" data-char="${escapeHTML(speakerB)}">
                    <i class="fa-solid fa-user"></i> I am ${escapeHTML(speakerB)} <small>(sistema lê ${escapeHTML(speakerA)})</small>
                </button>
                <button class="btn-roleplay-stop" style="display:none;">
                    <i class="fa-solid fa-stop"></i> Stop Roleplay
                </button>
            </div>
            <div class="roleplay-status" style="display:none;">
                <i class="fa-solid fa-circle-info"></i> Your turn! Read the highlighted line aloud...
            </div>
        </div>
    `;
    panel.style.display = 'block';

    const stopBtn = panel.querySelector('.btn-roleplay-stop');
    const statusEl = panel.querySelector('.roleplay-status');

    panel.querySelectorAll('.btn-roleplay-char').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const myChar = btn.dataset.char;
            startRoleplay(conv, myChar, statusEl, stopBtn, panel);
        });
    });

    stopBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        window.speechSynthesis.cancel();
        stopBtn.style.display = 'none';
        statusEl.style.display = 'none';
        panel.querySelectorAll('.btn-roleplay-char').forEach(b => b.disabled = false);
        unhighlightAllLines();
    });
}

function startRoleplay(conv, myCharacter, statusEl, stopBtn, panel) {
    window.speechSynthesis.cancel();
    panel.querySelectorAll('.btn-roleplay-char').forEach(b => b.disabled = true);
    stopBtn.style.display = 'inline-flex';
    statusEl.style.display = 'block';

    let index = 0;
    let stopped = false;

    function processLine() {
        if (stopped) return;
        if (index >= conv.dialogo.length) {
            statusEl.innerHTML = '<i class="fa-solid fa-check"></i> Roleplay complete! Great job! 🎉';
            stopBtn.style.display = 'none';
            panel.querySelectorAll('.btn-roleplay-char').forEach(b => b.disabled = false);
            unhighlightAllLines();
            return;
        }

        const line = conv.dialogo[index];
        const lineEl = document.querySelector(`.dialogue-line[data-line-index="${index}"]`);
        const isMyLine = line.speaker === myCharacter;

        highlightLine(lineEl);

        if (isMyLine) {
            // É a vez do usuário - mostra a linha e aguarda
            statusEl.innerHTML = `<i class="fa-solid fa-user"></i> <strong>Your turn (${escapeHTML(line.speaker)})!</strong> Read aloud, then click "Next" to continue.`;
            
            // Adiciona botão Next temporário
            let nextBtn = lineEl.querySelector('.btn-roleplay-next');
            if (!nextBtn) {
                nextBtn = document.createElement('button');
                nextBtn.className = 'btn-line-action btn-roleplay-next';
                nextBtn.innerHTML = '<i class="fa-solid fa-arrow-right"></i> Next';
                nextBtn.style.marginTop = '6px';
                lineEl.querySelector('.line-actions').appendChild(nextBtn);
            }
            nextBtn.style.display = 'inline-flex';
            
            const advance = () => {
                nextBtn.style.display = 'none';
                nextBtn.removeEventListener('click', advance);
                index++;
                processLine();
            };
            nextBtn.addEventListener('click', advance);
        } else {
            // É a vez do sistema
            statusEl.innerHTML = `<i class="fa-solid fa-volume-high"></i> Listening... (${escapeHTML(line.speaker)})`;
            falarTexto(line.text, 'en-US', {
                rate: currentSpeed,
                keepQueue: true,
                onend: () => {
                    setTimeout(() => {
                        index++;
                        processLine();
                    }, 500);
                },
                onerror: () => {
                    stopped = true;
                    stopBtn.style.display = 'none';
                    panel.querySelectorAll('.btn-roleplay-char').forEach(b => b.disabled = false);
                    unhighlightAllLines();
                }
            });
        }
    }

    // Monitorar se o usuário cancelou
    const checkStop = setInterval(() => {
        if (stopBtn.style.display === 'none' || !stopBtn.isConnected) {
            stopped = true;
            clearInterval(checkStop);
        }
    }, 500);

    processLine();
}

// ==================== ESTADO DA SELEÇÃO ====================
const selectedQuestions = new Set(); // guarda os IDs selecionados
let isPlayingSelection = false;

// ==================== RENDER QUESTIONS ====================
function renderizarQuestoes() {
    const container = document.getElementById('questionsContainer');
    if (!container) return;
    container.innerHTML = '';

    if (!questionsIndex || questionsIndex.length === 0) {
        container.innerHTML = `<p style="text-align:center; color:#7ba9c4;">Nenhuma pergunta carregada.</p>`;
        return;
    }

    questionsIndex.forEach(category => {
        const catDiv = document.createElement('div');
        catDiv.className = 'question-category';

        const catTitle = document.createElement('div');
        catTitle.className = 'question-category-title';
        catTitle.innerHTML = `<i class="fa-solid ${escapeHTML(category.icon || 'fa-folder')}"></i> ${escapeHTML(category.name)}`;
        catDiv.appendChild(catTitle);

        category.questions.forEach(q => {
            const qDiv = document.createElement('div');
            qDiv.className = 'question-item';
            qDiv.dataset.id = q.id;

            const vocabHTML = `
                <ul class="vocab-chips">
                    ${(q.vocabulary || []).map(w => `<li>${escapeHTML(w)}</li>`).join('')}
                </ul>
            `;

            const tipsHTML = q.tips && q.tips.length ? `
                <div class="tips-mini">
                    <strong><i class="fa-regular fa-lightbulb"></i> Pronunciation tips:</strong>
                    <ul>${q.tips.map(t => `<li>${escapeHTML(t)}</li>`).join('')}</ul>
                </div>
            ` : '';

            // ✅ Novo layout: checkbox + conteúdo
            qDiv.innerHTML = `
                <div class="question-content">
                    <div class="question-header">
                        <div class="question-text">
                            <span class="question-checkbox" data-id="${q.id}" title="Selecionar para ouvir em sequência" role="checkbox" aria-checked="false" tabindex="0">
                                <i class="fa-solid fa-check"></i>
                            </span>
                            <i class="fa-solid fa-question question-icon"></i>
                            <span class="question-main">
                                ${escapeHTML(q.question)}
                                <span class="question-translation">${escapeHTML(q.translation || '')}</span>
                            </span>
                        </div>
                        <div class="question-actions">
                            <button class="btn-listen" title="Listen to the question">
                                <i class="fa-solid fa-volume-high"></i> Listen
                            </button>
                            <button class="btn-read-qa" title="Read question + sample answer">
                                <i class="fa-solid fa-headphones"></i> Q + Answer
                            </button>
                            <button class="btn-reveal" title="Show sample answer">
                                <i class="fa-solid fa-eye"></i> Sample Answer
                            </button>
                        </div>
                    </div>
                    <div class="question-body">
                        <span class="section-label">💬 Sample Answer:</span>
                        <div class="sample-answer">
                            ${escapeHTML(q.sampleAnswer || '')}
                            ${q.sampleAnswerTranslation ? `<span class="sample-answer-translation">${escapeHTML(q.sampleAnswerTranslation)}</span>` : ''}
                        </div>
                        <span class="section-label">📚 Key Vocabulary:</span>
                        ${vocabHTML}
                        ${tipsHTML}
                    </div>
                </div>
            `;

            catDiv.appendChild(qDiv);

            // ✅ Checkbox: clique + teclado
            const checkbox = qDiv.querySelector('.question-checkbox');
            const toggleSelection = (e) => {
                e?.stopPropagation();
                const id = checkbox.dataset.id;
                if (selectedQuestions.has(id)) {
                    selectedQuestions.delete(id);
                    checkbox.classList.remove('checked');
                    checkbox.setAttribute('aria-checked', 'false');
                } else {
                    selectedQuestions.add(id);
                    checkbox.classList.add('checked');
                    checkbox.setAttribute('aria-checked', 'true');
                }
                updateQuestionsToolbar();
            };
            checkbox.addEventListener('click', toggleSelection);
            checkbox.addEventListener('keydown', (e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault();
                    toggleSelection();
                }
            });

            qDiv.querySelector('.btn-listen').addEventListener('click', (e) => {
                e.stopPropagation();
                speakQuestion(q.question, e.currentTarget);
            });

            qDiv.querySelector('.btn-read-qa').addEventListener('click', (e) => {
                e.stopPropagation();
                speakQuestionAndAnswer(q, e.currentTarget);
            });

            const btnReveal = qDiv.querySelector('.btn-reveal');
            btnReveal.addEventListener('click', (e) => {
                e.stopPropagation();
                const revealed = qDiv.classList.toggle('revealed');
                btnReveal.classList.toggle('revealed', revealed);
                btnReveal.innerHTML = revealed
                    ? '<i class="fa-solid fa-eye-slash"></i> Hide'
                    : '<i class="fa-solid fa-eye"></i> Sample Answer';
            });
        });

        container.appendChild(catDiv);
    });

    updateQuestionsToolbar();
}

// ==================== TOOLBAR STATE ====================
function updateQuestionsToolbar() {
    const counter = document.getElementById('selectionCounter');
    const playBtn = document.getElementById('btnPlaySelected');
    if (!counter || !playBtn) return;

    const n = selectedQuestions.size;
    counter.innerHTML = `<i class="fa-solid fa-list-check"></i> ${n} ${n === 1 ? 'selecionada' : 'selecionadas'}`;
    counter.classList.toggle('active', n > 0);
    playBtn.disabled = n === 0 || isPlayingSelection;
}

// ==================== PLAY SELECTED QUESTIONS ====================
function playSelectedQuestions() {
    if (selectedQuestions.size === 0) return;

    // Coleta as questões na ordem em que aparecem no DOM
    const allItems = document.querySelectorAll('.question-item[data-id]');
    const queue = [];
    allItems.forEach(item => {
        const id = item.dataset.id;
        if (!selectedQuestions.has(id)) return;
        // Procura os dados originais
        let found = null;
        for (const cat of questionsIndex) {
            const q = cat.questions.find(x => x.id === id);
            if (q) { found = q; break; }
        }
        if (found) queue.push(found);
    });

    if (queue.length === 0) return;

    // UI: modo tocando
    isPlayingSelection = true;
    const playBtn = document.getElementById('btnPlaySelected');
    const stopBtn = document.getElementById('btnStopSelected');
    playBtn.style.display = 'none';
    stopBtn.style.display = 'inline-flex';
    updateQuestionsToolbar();

    let cancelled = false;

    // Handler global de cancelamento via botão Stop
    const cancelHandler = () => {
        cancelled = true;
        window.speechSynthesis.cancel();
        cleanupPlayback();
    };
    stopBtn.addEventListener('click', cancelHandler, { once: true });

    // Também cancela se o usuário clicar Play All em outro lugar
    const checkCancelInterval = setInterval(() => {
        if (!window.speechSynthesis.speaking && !cancelled && !isPlayingSelection) {
            clearInterval(checkCancelInterval);
        }
    }, 500);

    let index = 0;

    function cleanupPlayback() {
        clearInterval(checkCancelInterval);
        isPlayingSelection = false;
        playBtn.style.display = 'inline-flex';
        stopBtn.style.display = 'none';
        stopBtn.removeEventListener('click', cancelHandler);
        document.querySelectorAll('.question-item.playing-question').forEach(el => {
            el.classList.remove('playing-question');
        });
        updateQuestionsToolbar();
    }

    function highlightCurrent(qId) {
        document.querySelectorAll('.question-item.playing-question').forEach(el => {
            el.classList.remove('playing-question');
        });
        const el = document.querySelector(`.question-item[data-id="${qId}"]`);
        if (el) {
            el.classList.add('playing-question');
            // Rolagem suave para o item ativo
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    function speakNext() {
        if (cancelled) return;
        if (index >= queue.length) {
            cleanupPlayback();
            return;
        }

        const q = queue[index];
        highlightCurrent(q.id);

        // Etapa 1: pergunta
        falarTexto(q.question, 'en-US', {
            rate: currentSpeed,
            keepQueue: true,
            onend: () => {
                if (cancelled) return;
                // Pausa entre pergunta e resposta
                setTimeout(() => {
                    if (cancelled) return;
                    // Etapa 2: resposta
                    const answer = q.sampleAnswer || '';
                    if (!answer.trim()) {
                        // Sem resposta → próxima pergunta
                        index++;
                        setTimeout(speakNext, 800);
                        return;
                    }
                    falarTexto(answer, 'en-US', {
                        rate: currentSpeed,
                        keepQueue: true,
                        onend: () => {
                            if (cancelled) return;
                            index++;
                            // Pausa entre questões
                            setTimeout(speakNext, 1200);
                        },
                        onerror: () => { cleanupPlayback(); }
                    });
                }, 900);
            },
            onerror: () => { cleanupPlayback(); }
        });
    }

    speakNext();
}

// ==================== SETUP TOOLBAR ====================
function setupQuestionsToolbar() {
    const selectAllBtn = document.getElementById('btnSelectAll');
    const clearBtn = document.getElementById('btnClearSelection');
    const playBtn = document.getElementById('btnPlaySelected');
    const stopBtn = document.getElementById('btnStopSelected');

    if (!selectAllBtn || !playBtn) return;

    selectAllBtn.addEventListener('click', () => {
        document.querySelectorAll('.question-item[data-id]').forEach(item => {
            const id = item.dataset.id;
            selectedQuestions.add(id);
            const cb = item.querySelector('.question-checkbox');
            if (cb) {
                cb.classList.add('checked');
                cb.setAttribute('aria-checked', 'true');
            }
        });
        updateQuestionsToolbar();
    });

    clearBtn?.addEventListener('click', () => {
        selectedQuestions.clear();
        document.querySelectorAll('.question-checkbox.checked').forEach(cb => {
            cb.classList.remove('checked');
            cb.setAttribute('aria-checked', 'false');
        });
        updateQuestionsToolbar();
    });

    playBtn.addEventListener('click', () => {
        if (isPlayingSelection) return;
        playSelectedQuestions();
    });

    // Botão Stop (também é criado on-the-fly no playSelectedQuestions, mas mantemos fallback)
    stopBtn?.addEventListener('click', () => {
        window.speechSynthesis.cancel();
        document.querySelectorAll('.question-item.playing-question').forEach(el => {
            el.classList.remove('playing-question');
        });
        isPlayingSelection = false;
        stopBtn.style.display = 'none';
        playBtn.style.display = 'inline-flex';
        updateQuestionsToolbar();
    });
}

// ==================== SPEAK QUESTION ====================
function speakQuestion(text, button) {
    if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
        button.classList.remove('speaking');
        button.innerHTML = '<i class="fa-solid fa-volume-high"></i> Listen';
        return;
    }

    button.classList.add('speaking');
    button.innerHTML = '<i class="fa-solid fa-stop"></i> Stop';

    const utterance = falarTexto(text, 'en-US', {
        rate: currentSpeed,
        onend: () => {
            button.classList.remove('speaking');
            button.innerHTML = '<i class="fa-solid fa-volume-high"></i> Listen';
        },
        onerror: () => {
            button.classList.remove('speaking');
            button.innerHTML = '<i class="fa-solid fa-volume-high"></i> Listen';
        }
    });
}

// ==================== SPEAK QUESTION + ANSWER ====================
function speakQuestionAndAnswer(q, button) {
    if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
        button.classList.remove('speaking');
        button.innerHTML = '<i class="fa-solid fa-headphones"></i> Q + Answer';
        return;
    }

    button.classList.add('speaking');
    button.innerHTML = '<i class="fa-solid fa-stop"></i> Stop';

    const queue = [
        { text: q.question, pauseAfter: 900 },
        { text: q.sampleAnswer || '', pauseAfter: 0 }
    ].filter(item => item.text && item.text.trim());

    let index = 0;

    function speakNext() {
        if (index >= queue.length) {
            button.classList.remove('speaking');
            button.innerHTML = '<i class="fa-solid fa-headphones"></i> Q + Answer';
            return;
        }

        const item = queue[index];
        falarTexto(item.text, 'en-US', {
            rate: currentSpeed,
            keepQueue: true,
            onend: () => {
                index++;
                setTimeout(speakNext, item.pauseAfter);
            },
            onerror: () => {
                button.classList.remove('speaking');
                button.innerHTML = '<i class="fa-solid fa-headphones"></i> Q + Answer';
            }
        });
    }

    speakNext();
}

// ==================== MODAL ====================
function exibirModal(titulo, textoCompleto, iconType) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const modalCard = document.createElement('div');
    modalCard.className = 'modal-card';
    const iconClass = iconType === 'flag' ? 'fa-regular fa-flag' : 'fa-solid fa-comments';
    modalCard.innerHTML = `
        <div class="modal-header">
            <h2><i class="${iconClass}"></i> ${escapeHTML(titulo)}</h2>
            <button class="modal-close" id="closeModalBtn"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="modal-body">${escapeHTML(textoCompleto).replace(/\n/g, '<br><br>')}</div>
        <div class="modal-footer">📖 Use your browser's text-to-speech feature to practice pronunciation</div>
    `;
    overlay.appendChild(modalCard);
    document.body.appendChild(overlay);
    modalCard.querySelector('#closeModalBtn').addEventListener('click', () => document.body.removeChild(overlay));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) document.body.removeChild(overlay); });
}

function exibirConversaCompleta(conv) {
    const cleanText = conv.dialogo.map(line => `<p>${escapeHTML(line.text)}</p>`).join('');
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const modalCard = document.createElement('div');
    modalCard.className = 'modal-card';
    modalCard.innerHTML = `
        <div class="modal-header">
            <div>
                <h2><i class="fa-solid fa-comments"></i> ${escapeHTML(conv.titulo)}</h2>
                <div class="modal-subtitle"><i class="fa-solid fa-microphone"></i> Shadowing mode — no names, no translation</div>
            </div>
            <button class="modal-close" id="closeModalBtn"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="modal-body"><div class="clean-dialogue">${cleanText}</div></div>
        <div class="modal-footer">🎤 Read each line aloud, then shadow yourself!</div>
    `;
    overlay.appendChild(modalCard);
    document.body.appendChild(overlay);
    modalCard.querySelector('#closeModalBtn').addEventListener('click', () => document.body.removeChild(overlay));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) document.body.removeChild(overlay); });
}

// ==================== TABS ====================
function setupTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.dataset.tab;
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`${targetTab}-tab`).classList.add('active');
        });
    });
}

// ==================== BACK BUTTON ====================
function setupVoltarButton() {
    const btnVoltar = document.getElementById('btnVoltarInicio');
    if (btnVoltar) btnVoltar.addEventListener('click', () => window.location.href = 'index.html');
}

// ==================== FONT SIZE ====================
const FONT_STORAGE_KEY = 'english-practice-font-scale';
const FONT_MIN = 70;
const FONT_MAX = 180;
const FONT_STEP = 10;

let currentFontScale = 100;

function applyFontScale(value) {
    value = Math.max(FONT_MIN, Math.min(FONT_MAX, value));
    currentFontScale = value;
    const scaleFactor = value / 100;
    document.documentElement.style.setProperty('--dialogue-font-scale', scaleFactor);

    const label = document.getElementById('fontValueLabel');
    const slider = document.getElementById('fontSlider');
    if (label) label.textContent = `${value}%`;
    if (slider) slider.value = value;

    if (label) {
        if (value === 100) label.style.color = '#0284c7';
        else if (value < 100) label.style.color = '#b45309';
        else label.style.color = '#15803d';
    }

    try { localStorage.setItem(FONT_STORAGE_KEY, value); } catch (e) { /* ignore */ }
}

function setupFontControl() {
    const toggleBtn = document.getElementById('fontToggleBtn');
    const panel = document.getElementById('fontPanel');
    const closeBtn = document.getElementById('fontPanelClose');
    const increaseBtn = document.getElementById('fontIncrease');
    const decreaseBtn = document.getElementById('fontDecrease');
    const resetBtn = document.getElementById('fontReset');
    const slider = document.getElementById('fontSlider');

    if (!toggleBtn || !panel) return;

    try {
        const saved = localStorage.getItem(FONT_STORAGE_KEY);
        if (saved) currentFontScale = parseInt(saved, 10) || 100;
    } catch (e) { /* ignore */ }
    applyFontScale(currentFontScale);

    toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = panel.classList.toggle('open');
        toggleBtn.classList.toggle('active', isOpen);
        panel.setAttribute('aria-hidden', String(!isOpen));
    });

    closeBtn?.addEventListener('click', () => {
        panel.classList.remove('open');
        toggleBtn.classList.remove('active');
        panel.setAttribute('aria-hidden', 'true');
    });

    document.addEventListener('click', (e) => {
        if (!panel.classList.contains('open')) return;
        if (panel.contains(e.target) || toggleBtn.contains(e.target)) return;
        panel.classList.remove('open');
        toggleBtn.classList.remove('active');
        panel.setAttribute('aria-hidden', 'true');
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && panel.classList.contains('open')) {
            panel.classList.remove('open');
            toggleBtn.classList.remove('active');
            panel.setAttribute('aria-hidden', 'true');
        }
    });

    increaseBtn?.addEventListener('click', () => applyFontScale(currentFontScale + FONT_STEP));
    decreaseBtn?.addEventListener('click', () => applyFontScale(currentFontScale - FONT_STEP));
    resetBtn?.addEventListener('click', () => applyFontScale(100));
    slider?.addEventListener('input', (e) => applyFontScale(parseInt(e.target.value, 10)));
}

// ==================== SPEED CONTROL ====================
function setupSpeedControl() {
    const selector = document.getElementById('speedSelector');
    if (!selector) return;

    // Carrega preferência salva
    try {
        const saved = localStorage.getItem(SPEED_STORAGE_KEY);
        if (saved) {
            const parsed = parseFloat(saved);
            if ([0.5, 0.8, 1.0].includes(parsed)) currentSpeed = parsed;
        }
    } catch (e) { /* ignore */ }

    selector.querySelectorAll('.speed-btn').forEach(btn => {
        btn.classList.toggle('active', parseFloat(btn.dataset.speed) === currentSpeed);
        btn.addEventListener('click', () => {
            const speed = parseFloat(btn.dataset.speed);
            currentSpeed = speed;
            selector.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            try { localStorage.setItem(SPEED_STORAGE_KEY, speed); } catch (e) { /* ignore */ }
            // Reinicia qualquer áudio em reprodução para aplicar a nova velocidade
            if (window.speechSynthesis.speaking) {
                window.speechSynthesis.cancel();
                unhighlightAllLines();
                document.querySelectorAll('.btn-control.speaking').forEach(b => {
                    b.classList.remove('speaking');
                });
            }
        });
    });
}

// ==================== TRANSLATION TOGGLE ====================
function setupTranslationToggle() {
    const btn = document.getElementById('toggleTranslation');
    if (!btn) return;

    // Carrega preferência
    try {
        const saved = localStorage.getItem(TRANSLATION_STORAGE_KEY);
        if (saved !== null) showTranslation = saved === 'true';
    } catch (e) { /* ignore */ }

    updateTranslationButton(btn);

    btn.addEventListener('click', () => {
        showTranslation = !showTranslation;
        try { localStorage.setItem(TRANSLATION_STORAGE_KEY, showTranslation); } catch (e) { /* ignore */ }
        updateTranslationButton(btn);
        applyTranslationVisibility();
    });
}

function updateTranslationButton(btn) {
    if (showTranslation) {
        btn.classList.add('active');
        btn.innerHTML = '<i class="fa-solid fa-eye"></i> <span>Visível</span>';
    } else {
        btn.classList.remove('active');
        btn.innerHTML = '<i class="fa-solid fa-eye-slash"></i> <span>Oculta</span>';
    }
}

// ==================== CONNECTED SPEECH TOGGLE ====================
function setupConnectedToggle() {
    const btn = document.getElementById('toggleConnected');
    if (!btn) return;

    try {
        const saved = localStorage.getItem(CONNECTED_STORAGE_KEY);
        if (saved !== null) showConnectedSpeech = saved === 'true';
    } catch (e) { /* ignore */ }

    updateConnectedButton(btn);

    btn.addEventListener('click', () => {
        showConnectedSpeech = !showConnectedSpeech;
        try { localStorage.setItem(CONNECTED_STORAGE_KEY, showConnectedSpeech); } catch (e) { /* ignore */ }
        updateConnectedButton(btn);
        applyConnectedVisibility();
    });
}

function updateConnectedButton(btn) {
    if (showConnectedSpeech) {
        btn.classList.add('active');
        btn.innerHTML = '<i class="fa-solid fa-eye"></i> <span>Visível</span>';
    } else {
        btn.classList.remove('active');
        btn.innerHTML = '<i class="fa-solid fa-eye-slash"></i> <span>Oculto</span>';
    }
}

// ==================== VOICE INITIALIZATION ====================
function initVoices() {
    return new Promise((resolve) => {
        if (!('speechSynthesis' in window)) {
            resolve([]);
            return;
        }
        let voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
            resolve(voices);
            return;
        }
        window.speechSynthesis.onvoiceschanged = () => {
            voices = window.speechSynthesis.getVoices();
            resolve(voices);
        };
    });
}

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', async () => {
    setupTabs();
    setupVoltarButton();
    setupFontControl();
    setupSpeedControl();
    setupVoiceControl();          
    setupTranslationToggle();
    setupConnectedToggle();
    setupQuestionsToolbar(); 
    updateStreakUI();

    const [storiesData, conversationsData, questionsData] = await Promise.all([
        fetchJSON(STORIES_INDEX),
        fetchJSON(CONVERSATIONS_INDEX),
        fetchJSON(QUESTIONS_INDEX)
    ]);

    storiesIndex = storiesData ? storiesData.stories : [];
    conversationsIndex = conversationsData ? conversationsData.conversations : [];
    questionsIndex = questionsData ? questionsData.categories : [];

    renderizarContos();
    renderizarConversas();
    renderizarQuestoes();

    await initVoices();
    console.log('[Init] Vozes carregadas:', window.speechSynthesis.getVoices().length);
    console.log('[Init] Velocidade atual:', currentSpeed);
    console.log('[Init] Tradução visível:', showTranslation);
    console.log('[Init] Connected speech visível:', showConnectedSpeech);
    console.log('[Init] Voz atual:', currentVoiceGender);
});