// ==================== CONFIG ====================
const DATA_PATH = 'data';
const STORIES_INDEX = `${DATA_PATH}/stories-index.json`;
const CONVERSATIONS_INDEX = `${DATA_PATH}/conversations-index.json`;
const QUESTIONS_INDEX = `${DATA_PATH}/questions-index.json`;

// Cache em memória (evita baixar duas vezes o mesmo arquivo)
const contentCache = new Map();

// Estado global
let storiesIndex = [];
let conversationsIndex = [];
let conversationsCache = []; // diálogos já carregados (necessário para Play/Practice)
let questionsIndex = [];

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

// Busca arquivo JSON com cache
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

// Mostra loader no botão enquanto carrega
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

        // ⭐ Lazy load do texto completo ao clicar
        const btnRead = detalhesDiv.querySelector('.btn-read-story');
        btnRead.addEventListener('click', async (e) => {
            e.stopPropagation();
            setButtonLoading(btnRead, true);
            const data = await fetchJSON(`${DATA_PATH}/${conto.file}`);
            setButtonLoading(btnRead, false);
            if (data && data.textoCompleto) {
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
                    <button class="btn-acessar btn-read-conv" data-id="${conv.id}" data-file="${escapeHTML(conv.file)}" style="margin-left:auto;">
                        <i class="fa-solid fa-book-open-reader"></i> Read full conversation
                    </button>
                </div>
            </div>
        `;

        convDiv.appendChild(header);
        convDiv.appendChild(detalhesDiv);
        container.appendChild(convDiv);

        // ⭐ Lazy load: busca o diálogo na primeira vez que a conversa é aberta
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

            // Merge metadados + diálogo num único objeto (usado em Play/Practice)
            const fullConv = { ...conv, dialogo: data.dialogo };
            conversationsCache.push(fullConv);

            // Renderiza HTML do diálogo
            const dialogueHTML = data.dialogo.map((line, index) => {
                const charClass = index % 2 === 0 ? 'character-a' : 'character-b';
                return `
                    <div class="dialogue-line ${charClass}">
                        <span class="speaker">${escapeHTML(line.speaker)}:</span>
                        <span class="dialogue-text">
                            ${escapeHTML(line.text)}
                            <span class="pt-translation">${escapeHTML(line.translation || '')}</span>
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
            placeholderEl.style.display = 'block';

            // Habilita os botões de áudio
            detalhesDiv.querySelector('.btn-play-all').disabled = false;
            detalhesDiv.querySelector('.btn-practice').disabled = false;
            detalhesDiv.querySelector('.btn-repeat-practice').disabled = false; 

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
            const repeatBtn = detalhesDiv.querySelector('.btn-repeat-practice');
            // Se o repeat estiver rodando, cancela antes
            if (repeatBtn.classList.contains('speaking')) {
                window.speechSynthesis.cancel();
                repeatBtn.classList.remove('speaking');
                repeatBtn.innerHTML = '<i class="fa-solid fa-rotate-right"></i> Repeat Practice (5x)';
            }
            const full = await ensureLoaded();
            if (full) speakFullDialogue(full, e.currentTarget);
        });

        // Practice line by line
        detalhesDiv.querySelector('.btn-practice').addEventListener('click', async (e) => {
            e.stopPropagation();
            const full = await ensureLoaded();
            if (full) practiceLineByLine(full);
        });

        // Repeat Practice (repete o line by line)
        detalhesDiv.querySelector('.btn-repeat-practice').addEventListener('click', async (e) => {
            e.stopPropagation();
            const btn = e.currentTarget;
            const playAllBtn = detalhesDiv.querySelector('.btn-play-all');

            // Cancela Play All se estiver ativo
            if (playAllBtn.classList.contains('speaking')) {
                window.speechSynthesis.cancel();
                playAllBtn.classList.remove('speaking');
                playAllBtn.innerHTML = '<i class="fa-solid fa-play"></i> Play Full Dialogue';
            }

            // Cancela o próprio repeat (toggle)
            if (btn.classList.contains('speaking')) {
                window.speechSynthesis.cancel();
                btn.classList.remove('speaking');
                btn.innerHTML = '<i class="fa-solid fa-rotate-right"></i> Repeat Practice (5x)';
                return;
            }

            const full = await ensureLoaded();
            if (full) repeatFullDialogue(full, btn, 5);
        });

        // Read full conversation (clean mode)
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

// ==================== REPEAT FULL DIALOGUE (N vezes) ====================
function repeatFullDialogue(conv, button, repeatCount = 5) {
    const voices = window.speechSynthesis.getVoices();
    const englishVoice = voices.find(v => v.lang.startsWith('en') && v.name.includes('Google')) ||
                         voices.find(v => v.lang.startsWith('en-US')) ||
                         voices.find(v => v.lang.startsWith('en'));

    const originalLabel = '<i class="fa-solid fa-rotate-right"></i> Repeat Practice (5x)';
    button.classList.add('speaking');
    button.innerHTML = `<i class="fa-solid fa-stop"></i> Stop`;

    // Total de rodadas: 1 leitura inicial + N repetições
    const totalRounds = repeatCount + 1; // 1 + 5 = 6
    let currentRound = 0;
    let cancelled = false;

    // Detecta cancelamento (usuário clicou Stop ou Play All iniciou)
    const cancelCheck = setInterval(() => {
        if (!window.speechSynthesis.speaking && !button.classList.contains('speaking')) {
            cancelled = true;
            clearInterval(cancelCheck);
        }
    }, 300);

    function playRound() {
        if (cancelled) return;
        if (currentRound >= totalRounds) {
            clearInterval(cancelCheck);
            button.classList.remove('speaking');
            button.innerHTML = originalLabel;
            return;
        }

        currentRound++;
        const roundLabel = currentRound === 1
            ? `Rodada inicial (1/${totalRounds})`
            : `Repetição ${currentRound - 1}/${repeatCount}`;
        button.innerHTML = `<i class="fa-solid fa-stop"></i> ${roundLabel}`;

        let lineIndex = 0;

        function speakLine() {
            if (cancelled) return;
            if (lineIndex >= conv.dialogo.length) {
                // Fim da rodada — pausa antes da próxima
                setTimeout(playRound, 1000);
                return;
            }

            const line = conv.dialogo[lineIndex];
            const utterance = new SpeechSynthesisUtterance(line.text);
            utterance.lang = 'en-US';
            utterance.rate = 0.85;
            if (englishVoice) utterance.voice = englishVoice;

            utterance.onend = () => {
                lineIndex++;
                setTimeout(speakLine, 400);
            };
            utterance.onerror = () => {
                clearInterval(cancelCheck);
                button.classList.remove('speaking');
                button.innerHTML = originalLabel;
            };

            window.speechSynthesis.speak(utterance);
        }

        speakLine();
    }

    playRound();
}

/*
function getEnglishVoice() {
    const voices = window.speechSynthesis.getVoices();
    return voices.find(v => v.lang.startsWith('en') && v.name.includes('Google')) ||
           voices.find(v => v.lang.startsWith('en-US')) ||
           voices.find(v => v.lang.startsWith('en')) ||
           null;
}
*/

function getEnglishVoice() {
    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return null;

    // 1. Tenta voz neural da Microsoft (PC)
    const msVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Online')));
    if (msVoice) return msVoice;

    // 2. Tenta voz do Google (Android / Chrome)
    const googleVoice = voices.find(v => v.lang.startsWith('en') && v.name.includes('Google'));
    if (googleVoice) return googleVoice;

    // 3. Tenta voz em inglês americano genérica
    const enUsVoice = voices.find(v => v.lang === 'en-US');
    if (enUsVoice) return enUsVoice;

    // 4. Qualquer voz em inglês (en-GB, en-AU, etc.)
    return voices.find(v => v.lang.startsWith('en')) || null;
}

// ==================== SPEECH SYNTHESIS ====================
function speakFullDialogue(conv, button) {
    // Se já está falando, para
    if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
        button.classList.remove('speaking');
        button.innerHTML = '<i class="fa-solid fa-play"></i> Play Full Dialogue';
        return;
    }

    button.classList.add('speaking');
    button.innerHTML = '<i class="fa-solid fa-stop"></i> Stop';

    const englishVoice = getEnglishVoice();
    console.log('[Play Full] Voz EN:', englishVoice?.name || 'padrão');

    // Fila: apenas inglês
    const queue = [];
    conv.dialogo.forEach(line => {
        queue.push({
            text: line.text,
            lang: 'en-US',
            voice: englishVoice,
            rate: 0.85
        });
    });

    let index = 0;

    function speakNext() {
        if (index >= queue.length) {
            button.classList.remove('speaking');
            button.innerHTML = '<i class="fa-solid fa-play"></i> Play Full Dialogue';
            return;
        }

        const item = queue[index];
        const utterance = new SpeechSynthesisUtterance(item.text);
        utterance.lang = item.lang;
        utterance.rate = item.rate;
        if (item.voice) utterance.voice = item.voice;

        utterance.onend = () => {
            index++;
            // Pausa curta entre as falas (dá tempo de respirar)
            setTimeout(speakNext, 400);
        };

        utterance.onerror = () => {
            button.classList.remove('speaking');
            button.innerHTML = '<i class="fa-solid fa-play"></i> Play Full Dialogue';
        };

        window.speechSynthesis.speak(utterance);
    }

    speakNext();
}

function practiceLineByLine(conv) {
    let index = 0;
    function speakLine() {
        if (index >= conv.dialogo.length) {
            alert('Practice complete! Great job! 🎉');
            return;
        }
        const line = conv.dialogo[index];
        const utterance = new SpeechSynthesisUtterance(line.text);
        utterance.lang = 'en-US';
        utterance.rate = 0.8;
        const voices = window.speechSynthesis.getVoices();
        const englishVoice = voices.find(v => v.lang.startsWith('en') && v.name.includes('Google')) ||
                             voices.find(v => v.lang.startsWith('en-US')) ||
                             voices.find(v => v.lang.startsWith('en'));
        if (englishVoice) utterance.voice = englishVoice;
        utterance.onend = () => { setTimeout(() => { index++; speakLine(); }, 2000); };
        utterance.onerror = () => alert('Speech error. Please try again.');
        window.speechSynthesis.speak(utterance);
    }
    speakLine();
}

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

            // Chips de vocabulário
            const vocabHTML = `
                <ul class="vocab-chips">
                    ${(q.vocabulary || []).map(w => `<li>${escapeHTML(w)}</li>`).join('')}
                </ul>
            `;

            // Dicas
            const tipsHTML = q.tips && q.tips.length ? `
                <div class="tips-mini">
                    <strong><i class="fa-regular fa-lightbulb"></i> Pronunciation tips:</strong>
                    <ul>${q.tips.map(t => `<li>${escapeHTML(t)}</li>`).join('')}</ul>
                </div>
            ` : '';

            qDiv.innerHTML = `
                <div class="question-header">
                    <div class="question-text">
                        <i class="fa-solid fa-question"></i> ${escapeHTML(q.question)}
                        <span class="question-translation">${escapeHTML(q.translation || '')}</span>
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
            `;

            catDiv.appendChild(qDiv);

            // Botão Listen (só inglês)
            qDiv.querySelector('.btn-listen').addEventListener('click', (e) => {
                e.stopPropagation();
                speakQuestion(q.question, e.currentTarget);
            });

            // Botão "Q + Answer" — lê pergunta + resposta-modelo
            qDiv.querySelector('.btn-read-qa').addEventListener('click', (e) => {
                e.stopPropagation();
                speakQuestionAndAnswer(q, e.currentTarget);
            });

            // Botão Reveal (mostra/esconde resposta)
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

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.85;

    const englishVoice = getEnglishVoice();
    if (englishVoice) utterance.voice = englishVoice;

    utterance.onend = () => {
        button.classList.remove('speaking');
        button.innerHTML = '<i class="fa-solid fa-volume-high"></i> Listen';
    };

    utterance.onerror = () => {
        button.classList.remove('speaking');
        button.innerHTML = '<i class="fa-solid fa-volume-high"></i> Listen';
    };

    window.speechSynthesis.speak(utterance);
}

// ==================== SPEAK QUESTION + SAMPLE ANSWER ====================
function speakQuestionAndAnswer(q, button) {
    // Toggle: se já está falando, cancela
    if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
        button.classList.remove('speaking');
        button.innerHTML = '<i class="fa-solid fa-headphones"></i> Q + Answer';
        return;
    }

    button.classList.add('speaking');
    button.innerHTML = '<i class="fa-solid fa-stop"></i> Stop';

    const englishVoice = getEnglishVoice();

    // Fila: [pergunta, resposta]
    const queue = [
        { text: q.question, rate: 0.85, pauseAfter: 900 },
        { text: q.sampleAnswer || '', rate: 0.85, pauseAfter: 0 }
    ].filter(item => item.text && item.text.trim());

    let index = 0;

    function speakNext() {
        if (index >= queue.length) {
            button.classList.remove('speaking');
            button.innerHTML = '<i class="fa-solid fa-headphones"></i> Q + Answer';
            return;
        }

        const item = queue[index];
        const utterance = new SpeechSynthesisUtterance(item.text);
        utterance.lang = 'en-US';
        utterance.rate = item.rate;
        if (englishVoice) utterance.voice = englishVoice;

        utterance.onend = () => {
            index++;
            setTimeout(speakNext, item.pauseAfter);
        };

        utterance.onerror = () => {
            button.classList.remove('speaking');
            button.innerHTML = '<i class="fa-solid fa-headphones"></i> Q + Answer';
        };

        window.speechSynthesis.speak(utterance);
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

// ==================== FONT SIZE CONTROL ====================
const FONT_STORAGE_KEY = 'english-practice-font-scale';
const FONT_MIN = 70;
const FONT_MAX = 180;
const FONT_STEP = 10; // passo dos botões A- / A+

let currentFontScale = 100; // valor em %

function applyFontScale(value) {
    // Clamp entre min e max
    value = Math.max(FONT_MIN, Math.min(FONT_MAX, value));
    currentFontScale = value;

    // Aplica como variável CSS (0.7 a 1.8)
    const scaleFactor = value / 100;
    document.documentElement.style.setProperty('--dialogue-font-scale', scaleFactor);

    // Atualiza UI
    const label = document.getElementById('fontValueLabel');
    const slider = document.getElementById('fontSlider');
    if (label) label.textContent = `${value}%`;
    if (slider) slider.value = value;

    // Muda a cor do label conforme o valor
    if (label) {
        if (value === 100) label.style.color = '#0284c7';
        else if (value < 100) label.style.color = '#b45309';
        else label.style.color = '#15803d';
    }

    // Persiste
    try {
        localStorage.setItem(FONT_STORAGE_KEY, value);
    } catch (e) { /* ignore */ }
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

    // Carrega preferência salva
    try {
        const saved = localStorage.getItem(FONT_STORAGE_KEY);
        if (saved) {
            currentFontScale = parseInt(saved, 10) || 100;
        }
    } catch (e) { /* ignore */ }
    applyFontScale(currentFontScale);

    // Toggle painel
    toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = panel.classList.toggle('open');
        toggleBtn.classList.toggle('active', isOpen);
        panel.setAttribute('aria-hidden', String(!isOpen));
    });

    // Fechar
    closeBtn?.addEventListener('click', () => {
        panel.classList.remove('open');
        toggleBtn.classList.remove('active');
        panel.setAttribute('aria-hidden', 'true');
    });

    // Fechar ao clicar fora
    document.addEventListener('click', (e) => {
        if (!panel.classList.contains('open')) return;
        if (panel.contains(e.target) || toggleBtn.contains(e.target)) return;
        panel.classList.remove('open');
        toggleBtn.classList.remove('active');
        panel.setAttribute('aria-hidden', 'true');
    });

    // Fechar com ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && panel.classList.contains('open')) {
            panel.classList.remove('open');
            toggleBtn.classList.remove('active');
            panel.setAttribute('aria-hidden', 'true');
        }
    });

    // Botões A+ / A-
    increaseBtn?.addEventListener('click', () => {
        applyFontScale(currentFontScale + FONT_STEP);
    });
    decreaseBtn?.addEventListener('click', () => {
        applyFontScale(currentFontScale - FONT_STEP);
    });

    // Reset
    resetBtn?.addEventListener('click', () => {
        applyFontScale(100);
    });

    // Slider
    slider?.addEventListener('input', (e) => {
        applyFontScale(parseInt(e.target.value, 10));
    });
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

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', async () => {
    setupTabs();
    setupVoltarButton();
    setupFontControl();

    // Carrega vozes em segundo plano e dados da aplicação em paralelo
    const [, storiesData, conversationsData, questionsData] = await Promise.all([
        initVoices(),
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
});