// ============================================================
// Wikisource to Wiktionary Entry Importer
// 
// விக்கிமூல அகராதிப் பக்கங்களிலிருந்து சொற்களைப் பிரித்தெடுத்து,
// தமிழ் புணர்ச்சி விதிகளின்படி வேற்றுமை வடிவங்களுடன் தமிழ் விக்சனரியில்
// (ta.wiktionary.org) புதிய பக்கங்களை உருவாக்கும் பயனர் ஸ்கிரிப்ட்.
// ============================================================

(function () {
    'use strict';

    // 1. அமைவுகள் (Configuration)
    const TARGET_WIKTIONARY_LANG = 'ta';
    const SCRIPT_RE = /[\u0B80-\u0BFF]/; // தமிழ் எழுத்துகள்

    // 2. தமிழ் புணர்ச்சி (Sandhi) விதிகள்
    function getLinkingConsonant(word) {
        if (!word) return '';
        const last = word.slice(-1);

        if (last === '்') return '';

        if (last === 'இ' || last === 'ஈ' || last === 'ஐ') return 'ய்';
        if (last === 'அ' || last === 'ஆ' || last === 'உ' || last === 'ஊ' || 
            last === 'எ' || last === 'ஏ' || last === 'ஒ' || last === 'ஓ' || last === 'ஔ') return 'வ்';

        if (last === 'ி' || last === 'ீ' || last === 'ை') return 'ய்';
        if (last === 'ு' || last === 'ூ' || last === 'ொ' || last === 'ோ' || last === 'ௌ' || last === 'ா') return 'வ்';
        if (last === 'ெ' || last === 'ே') return 'ய்';

        return '';
    }

    function generateDeclensionForms(word) {
        if (!word) return [];
        const lastTwo = word.slice(-2);
        let forms = [];

        if (lastTwo === 'ம்') {
            const stem = word.slice(0, -2) + 'த்த';
            forms = [
                `${word} + ஐ = ${stem}ை`,
                `${word} + ஆல் = ${stem}ால்`,
                `${word} + கு = ${stem}ிற்கு`,
                `${word} + அது = ${stem}ினது`,
                `${word} + இலிருந்து = ${stem}ிலிருந்து`,
                `${word} + ஓடு = ${stem}ோடு`,
                `${word} + இன் = ${stem}ின்`
            ];
        } else if (lastTwo === 'ன்') {
            const stem = word.slice(0, -2) + 'ன';
            forms = [
                `${word} + ஐ = ${stem}ை`,
                `${word} + ஆல் = ${stem}ால்`,
                `${word} + கு = ${stem}ுக்கு`,
                `${word} + அது = ${stem}ினது`,
                `${word} + இலிருந்து = ${stem}ிலிருந்து`,
                `${word} + ஓடு = ${stem}ோடு`,
                `${word} + இன் = ${stem}ின்`
            ];
        } else if (lastTwo === 'ல்') {
            const stem = word.slice(0, -2) + 'ல';
            forms = [
                `${word} + ஐ = ${stem}ை`,
                `${word} + ஆல் = ${stem}ால்`,
                `${word} + கு = ${stem}ுக்கு`,
                `${word} + அது = ${stem}ினது`,
                `${word} + இலிருந்து = ${stem}ிலிருந்து`,
                `${word} + ஓடு = ${stem}ோடு`,
                `${word} + இன் = ${stem}ின்`
            ];
        } else {
            const link = getLinkingConsonant(word);
            forms = [
                `${word} + ஐ = ${word}${link}ை`,
                `${word} + ஆல் = ${word}${link}ால்`,
                `${word} + கு = ${word}${link}க்கு`,
                `${word} + அது = ${word}${link}ினது`,
                `${word} + இலிருந்து = ${word}${link}ிலிருந்து`,
                `${word} + ஓடு = ${word}${link}ோடு`,
                `${word} + இன் = ${word}${link}ின்`
            ];
        }
        return forms;
    }

    // 3. விக்சனரி வடிவ வார்ப்புருவை உருவாக்குதல்
    function buildWiktionaryPageContent(word, meaning) {
        const declensions = generateDeclensionForms(word);
        const declensionText = declensions.map(d => `: * ${d}`).join('\n');

        const content = `== {{மொழி|ta}} ==
{{விக்கிப்பீடியா-மொழி|ta}}
{{clear}}
__TOC__
=== பொருள் ===
{{பெயர்ச்சொல்-பகுப்பு|ta}}

# ${meaning || '[[பொருள்]] வழங்கப்படவில்லை.'}

==பிற வடிவங்கள்==
{{விக்கிப்பீடியா|வேற்றுமையுருபு}}
* வேற்றுமையுருபுகளால் மாறக்கூடியன.
${declensionText}

{{ஆதாரங்கள்-மொழி|ta}}

[[பகுப்பு:கருவச் சொற்கள்]]
[[பகுப்பு:உறவுச் சொற்கள்]]`;

        return content;
    }

    // 4. நிலை மாறிகள் & API இணைப்புகள்
    let extractedWordsList = [];
    let uncreatedWordsList = [];
    let currentIndex = 0;
    let currentUser = '';
    let skippedCount = 0;

    let wiktionaryApi = null;
    let csrfToken = '';

    function initializeApi() {
        wiktionaryApi = new mw.ForeignApi(`https://${TARGET_WIKTIONARY_LANG}.wiktionary.org/w/api.php`);
    }

    function normalizeWord(text) {
        if (!text) return '';
        return String(text).normalize('NFC').replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
    }

    function containsScript(text) {
        return SCRIPT_RE.test(text || '');
    }

    // 5. பக்கத்திலிருந்து சொற்களைப் பிரித்தெடுத்தல்
    function extractHeadwords() {
        const contentArea = $('#mw-content-text').clone();
        contentArea.find('.printfooter, .mw-editsection, style, script, .prp-page-header, .prp-page-footer').remove();
        
        const words = [];
        const lines = contentArea.text().split(/\r?\n/).map(x => x.trim()).filter(Boolean);

        lines.forEach(line => {
            if (!containsScript(line)) return;
            let parts = line.split('=');
            let candidate = parts[0].trim();
            const m = candidate.match(new RegExp('^(' + SCRIPT_RE.source + '+)'));
            if (m) {
                const norm = normalizeWord(m[1]);
                if (norm) {
                    words.push({
                        word: norm,
                        meaning: parts[1] ? parts[1].trim() : `[[${norm}]] பற்றிய பொருள்.`
                    });
                }
            }
        });

        const uniqueMap = new Map();
        words.forEach(item => {
            if (!uniqueMap.has(item.word)) {
                uniqueMap.set(item.word, item);
            }
        });

        return Array.from(uniqueMap.values());
    }

    // 6. CSRF Token பெறுதல்
    function getWiktionaryToken() {
        return wiktionaryApi.get({
            action: 'query',
            meta: 'tokens',
            type: 'csrf',
            formatversion: 2
        }).then(data => {
            if (data?.query?.tokens?.csrftoken) {
                csrfToken = data.query.tokens.csrftoken;
                return true;
            }
            throw new Error('விக்சனரி CSRF Token பெற முடியவில்லை.');
        });
    }

    // 7. விக்சனரியில் பக்கம் உள்ளதா எனச் சரிபார்த்தல்
    async function filterExistingWiktionaryPages() {
        const results = [];
        for (const item of extractedWordsList) {
            try {
                const data = await wiktionaryApi.get({
                    action: 'query',
                    titles: item.word,
                    formatversion: 2
                });
                const page = data?.query?.pages?.[0];
                if (page && page.missing) {
                    results.push(item);
                }
            } catch (e) {
                results.push(item);
            }
        }
        uncreatedWordsList = results;
    }

    // 8. பொத்தான் செயலாக்கம்
    function addImportButton() {
        if ($('#import-wiktionary-btn').length > 0) return;
        const btn = $('<button>', {
            id: 'import-wiktionary-btn',
            text: 'அகராதிச் சொற்களை விக்சனரியில் இணை'
        }).css({
            'margin': '10px 0',
            'padding': '8px 12px',
            'background-color': '#00a38f',
            'color': '#fff',
            'border': 'none',
            'border-radius': '4px',
            'cursor': 'pointer',
            'font-weight': 'bold',
            'z-index': '9999'
        });
        btn.click(processImportToWiktionary);
        if ($('#bodyContent').length) $('#bodyContent').prepend(btn);
        else $('#mw-content-text').before(btn);
    }

    function processImportToWiktionary() {
        currentUser = mw.config.get('wgUserName');
        if (!currentUser) {
            alert('இந்தப் பங்களிப்பைச் செய்ய நீங்கள் முதலில் உள்நுழைய வேண்டும்.');
            return;
        }

        extractedWordsList = extractHeadwords();
        if (!extractedWordsList.length) {
            alert('அகராதித் தலைப்புச் சொற்கள் எதுவும் கண்டறியப்படவில்லை.');
            return;
        }

        $('#import-wiktionary-btn').text('விக்சனரி சரிபார்க்கப்படுகிறது...').prop('disabled', true);

        initializeApi();

        getWiktionaryToken()
            .then(() => filterExistingWiktionaryPages())
            .then(() => {
                $('#import-wiktionary-btn').text('அகராதிச் சொற்களை விக்சனரியில் இணை').prop('disabled', false);
                if (!uncreatedWordsList.length) {
                    alert('இப்பக்கத்தில் உள்ள அனைத்துச் சொற்களும் ஏற்கனவே விக்சனரியில் உள்ளன!');
                    return;
                }
                showInteractiveModal();
            })
            .catch(err => {
                $('#import-wiktionary-btn').text('அகராதிச் சொற்களை விக்சனரியில் இணை').prop('disabled', false);
                alert('பிழை: ' + (err.message || err));
            });
    }

    // 9. மாதிரி முகப்பு (Modal UI)
    function showInteractiveModal() {
        $('#wiktionary-modal-overlay').remove();
        const modalHTML = `
            <div id="wiktionary-modal-overlay" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:10000; display:flex; align-items:center; justify-content:center; font-family:sans-serif;">
                <div style="background:#fff; width:560px; max-width:92%; max-height:90vh; overflow-y:auto; padding:24px; border-radius:8px; box-shadow:0 4px 12px rgba(0,0,0,0.3); position:relative;">
                    <button id="modal-close-btn" style="position:absolute; top:12px; right:12px; border:none; background:none; font-size:18px; cursor:pointer;">✖</button>

                    <h2 style="margin-top:0; font-size:18px; border-bottom:1px solid #ccc; padding-bottom:8px;">
                        விக்சனரியில் புதிய பக்கம் உருவாக்குதல் (<span id="current-step-num">1</span>/${uncreatedWordsList.length})
                    </h2>

                    <div style="margin-bottom:12px;">
                        <label style="font-weight:bold; display:block; margin-bottom:4px;">தலைப்புச் சொல்:</label>
                        <input type="text" id="input-word" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:4px; box-sizing:border-box;" />
                    </div>

                    <div style="margin-bottom:12px;">
                        <label style="font-weight:bold; display:block; margin-bottom:4px;">பொருள்:</label>
                        <textarea id="input-meaning" rows="3" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:4px; box-sizing:border-box;"></textarea>
                    </div>

                    <details style="font-size:12px; background:#f8f9fa; padding:8px; border-radius:4px; margin-bottom:12px;" open>
                        <summary style="cursor:pointer; font-weight:bold;">விக்கிநடை முன்னோட்டம் (Wikitext Preview):</summary>
                        <pre id="wikitext-preview" style="margin-top:6px; white-space:pre-wrap; font-size:11px; max-height:180px; overflow-y:auto; background:#fff; padding:6px; border:1px solid #eee;"></pre>
                    </details>

                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <button type="button" id="skip-word-btn" style="padding:8px 16px; background:#72777d; color:#fff; border:none; border-radius:4px; cursor:pointer;">தவிர் (Skip)</button>
                        <button type="button" id="submit-word-btn" style="padding:8px 16px; background:#36c; color:#fff; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">பக்கத்தை உருவாக்கு</button>
                    </div>

                    <div id="status-msg" style="margin-top:10px; font-weight:bold; font-size:13px; text-align:center;"></div>
                </div>
            </div>`;

        $('body').append(modalHTML);
        loadCurrentWordToForm();

        $('#modal-close-btn').click(() => $('#wiktionary-modal-overlay').remove());
        $('#submit-word-btn').click(submitCurrentWord);
        $('#skip-word-btn').click(() => { skippedCount++; nextWord(); });

        $('#input-word, #input-meaning').on('input', updatePreviewText);
    }

    function updatePreviewText() {
        const word = $('#input-word').val().trim();
        const meaning = $('#input-meaning').val().trim();
        const text = buildWiktionaryPageContent(word, meaning);
        $('#wikitext-preview').text(text);
    }

    function loadCurrentWordToForm() {
        const item = uncreatedWordsList[currentIndex];
        if (!item) return;

        $('#current-step-num').text(currentIndex + 1);
        $('#input-word').val(item.word);
        $('#input-meaning').val(item.meaning);

        $('#submit-word-btn').prop('disabled', false).text('பக்கத்தை உருவாக்கு');
        $('#skip-word-btn').prop('disabled', false);
        $('#status-msg').text('');

        updatePreviewText();
    }

    // 10. விக்சனரியில் புதிய பக்கத்தை உருவாக்குதல்
    function submitCurrentWord() {
        const word = $('#input-word').val().trim();
        const meaning = $('#input-meaning').val().trim();

        if (!word) {
            alert('சொல்லை உள்ளிடவும்.');
            return;
        }

        const content = buildWiktionaryPageContent(word, meaning);

        $('#submit-word-btn').prop('disabled', true).text('உருவாக்கப்படுகிறது...');
        $('#skip-word-btn').prop('disabled', true);
        $('#status-msg').text('விக்சனரியில் பக்கம் உருவாக்கப்படுகிறது...').css('color', '#00af89');

        wiktionaryApi.post({
            action: 'edit',
            title: word,
            text: content,
            summary: 'விக்கிமூலத்திலிருந்து தானாக இறக்குமதி செய்யப்பட்டது | User: ' + currentUser,
            createonly: true,
            token: csrfToken,
            format: 'json'
        }).then(data => {
            if (data?.edit?.result === 'Success') {
                const url = `https://${TARGET_WIKTIONARY_LANG}.wiktionary.org/wiki/` + encodeURIComponent(word);
                $('#status-msg').html(`வெற்றி: <a href="${url}" target="_blank" style="color:green;">${word}</a> உருவாக்கப்பட்டது!`).css('color', 'green');
                setTimeout(nextWord, 1200);
            } else {
                throw new Error(data?.error?.info || 'பக்கத்தை உருவாக்க முடியவில்லை.');
            }
        }).catch(err => {
            $('#status-msg').text('பிழை: ' + (err.message || err)).css('color', 'red');
            $('#submit-word-btn').prop('disabled', false).text('பக்கத்தை உருவாக்கு');
            $('#skip-word-btn').prop('disabled', false);
        });
    }

    function nextWord() {
        currentIndex++;
        if (currentIndex < uncreatedWordsList.length) {
            loadCurrentWordToForm();
        } else {
            $('#wiktionary-modal-overlay').remove();
            alert('அனைத்துப் புதிய சொற்களும் விக்சனரியில் வெற்றிகரமாக உருவாக்கப்பட்டு முடிவடைந்தன!');
        }
    }

    // 11. துவக்கம் (Initialization)
    mw.loader.using('mediawiki.ForeignApi').then(() => {
        $(document).ready(addImportButton);
    });

})();
