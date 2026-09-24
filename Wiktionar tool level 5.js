// ============================================================
// Wikisource to Wiktionary Entry Importer (Grammar & Category Fix)
// ============================================================

(function () {
    'use strict';

    const TARGET_WIKTIONARY_LANG = 'ta';
    const SCRIPT_RE = /[\u0B80-\u0BFF]/;

    // 1. மேம்படுத்தப்பட்ட தமிழ் புணர்ச்சி (Sandhi) விதிகள்
    function generateDeclensionForms(word) {
        if (!word) return [];
        const lastTwo = word.slice(-2);
        const lastChar = word.slice(-1);
        let forms = [];

        // ம் - இறுதி (எ.கா. மரம் -> மரத்தை, மரத்திற்கு)
        if (lastTwo === 'ம்') {
            const stem = word.slice(0, -2) + 'த்த';
            forms = [
                word + ' + ஐ = ' + stem + 'ை',
                word + ' + ஆல் = ' + stem + 'ால்',
                word + ' + கு = ' + stem + 'ிற்கு',
                word + ' + அது = ' + stem + 'ினது',
                word + ' + இலிருந்து = ' + stem + 'ிலிருந்து',
                word + ' + ஓடு = ' + stem + 'ோடு',
                word + ' + இன் = ' + stem + 'ின்'
            ];
        } 
        // ன் / ல் - இறுதி
        else if (lastTwo === 'ன்' || lastTwo === 'ல்') {
            const stem = word.slice(0, -2) + (lastTwo === 'ன்' ? 'ன' : 'ல');
            forms = [
                word + ' + ஐ = ' + stem + 'ை',
                word + ' + ஆல் = ' + stem + 'ால்',
                word + ' + கு = ' + stem + 'ுக்கு',
                word + ' + அது = ' + stem + 'ினது',
                word + ' + இலிருந்து = ' + stem + 'ிலிருந்து',
                word + ' + ஓடு = ' + stem + 'ோடு',
                word + ' + இன் = ' + stem + 'ின்'
            ];
        } 
        // உ / ு - இறுதி (உயிரீற்றுப் புணர்ச்சி) (எ.கா. முன்மைச்சுட்டு -> முன்மைச்சுட்டுக்கு)
        else if (lastChar === 'உ' || lastChar === 'ு') {
            forms = [
                word + ' + ஐ = ' + word + 'வை',
                word + ' + ஆல் = ' + word + 'வால்',
                word + ' + கு = ' + word + 'க்கு',
                word + ' + அது = ' + word + 'ினது',
                word + ' + இலிருந்து = ' + word + 'ிலிருந்து',
                word + ' + ஓடு = ' + word + 'வோடு',
                word + ' + இன் = ' + word + 'ின்'
            ];
        } 
        // இ / ஈ / ஐ / ி / ீ / ை - இறுதி (ய் - உடம்படுமெய்)
        else if (['இ','ஈ','ஐ','ி','ீ','ை'].includes(lastChar)) {
            forms = [
                word + ' + ஐ = ' + word + 'யை',
                word + ' + ஆல் = ' + word + 'யால்',
                word + ' + கு = ' + word + 'க்கு',
                word + ' + அது = ' + word + 'யினது',
                word + ' + இலிருந்து = ' + word + 'யிலிருந்து',
                word + ' + ஓடு = ' + word + 'யோடு',
                word + ' + இன் = ' + word + 'யின்'
            ];
        } 
        // அ / ஆ / எ / ஏ / ஒ / ஓ / ஔ (வ் - உடம்படுமெய்)
        else {
            forms = [
                word + ' + ஐ = ' + word + 'வை',
                word + ' + ஆல் = ' + word + 'வால்',
                word + ' + கு = ' + word + 'க்கு',
                word + ' + அது = ' + word + 'வினது',
                word + ' + இலிருந்து = ' + word + 'விலிருந்து',
                word + ' + ஓடு = ' + word + 'வோடு',
                word + ' + இன் = ' + word + 'வின்'
            ];
        }
        return forms;
    }

    // 2. விக்சனரி பக்க உள்ளடக்கம் உருவாக்குதல்
    function buildWiktionaryPageContent(word, meaning, posType, categoryList) {
        const declensions = generateDeclensionForms(word);
        const declensionText = declensions.map(function(d) { return ': * ' + d; }).join('\n');

        // பகுப்புகளை அமைத்தல்
        let categoriesText = '';
        if (categoryList && categoryList.trim() !== '') {
            categoriesText = categoryList.split(',')
                .map(function(c) { return '[[பகுப்பு:' + c.trim() + ']]'; })
                .join('\n');
        } else {
            categoriesText = '[[பகுப்பு:தமிழ்ச் சொற்கள்]]';
        }

        return '== {{மொழி|ta}} ==\n' +
            '{{விக்கிப்பீடியா-மொழி|ta}}\n' +
            '{{clear}}\n' +
            '__TOC__\n' +
            '=== பொருள் ===\n' +
            '{{' + (posType || 'பெயர்ச்சொல்') + '-பகுப்பு|ta}}\n\n' +
            '# ' + (meaning || '[[' + word + ']] பற்றிய பொருள்.') + '\n\n' +
            '==பிற வடிவங்கள்==\n' +
            '{{விக்கிப்பீடியா|வேற்றுமையுருபு}}\n' +
            '* வேற்றுமையுருபுகளால் மாறக்கூடியன.\n' +
            declensionText + '\n\n' +
            '{{ஆதாரங்கள்-மொழி|ta}}\n\n' +
            categoriesText;
    }

    let extractedWordsList = [];
    let uncreatedWordsList = [];
    let currentIndex = 0;
    let currentUser = '';
    let skippedCount = 0;
    let wiktionaryApi = null;
    let csrfToken = '';

    function initializeApi() {
        wiktionaryApi = new mw.ForeignApi('https://' + TARGET_WIKTIONARY_LANG + '.wiktionary.org/w/api.php');
    }

    function normalizeWord(text) {
        if (!text) return '';
        return String(text).normalize('NFC').replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
    }

    function containsScript(text) {
        return SCRIPT_RE.test(text || '');
    }

    function extractHeadwords() {
        const contentArea = $('#mw-content-text').clone();
        contentArea.find('.printfooter, .mw-editsection, style, script, .prp-page-header, .prp-page-footer').remove();
        
        const words = [];
        const lines = contentArea.text().split(/\r?\n/).map(function(x) { return x.trim(); }).filter(Boolean);

        lines.forEach(function(line) {
            if (!containsScript(line)) return;
            
            let wordStr = '';
            let meaningStr = '';

            if (line.includes('=')) {
                let parts = line.split('=');
                wordStr = parts[0].trim();
                meaningStr = parts.slice(1).join('=').trim();
            } else if (line.includes(' - ')) {
                let parts = line.split(' - ');
                wordStr = parts[0].trim();
                meaningStr = parts.slice(1).join(' - ').trim();
            } else {
                wordStr = line.trim();
            }

            const m = wordStr.match(new RegExp('^(' + SCRIPT_RE.source + '+)'));
            if (m) {
                const normWord = normalizeWord(m[1]);
                if (normWord) {
                    words.push({
                        word: normWord,
                        meaning: meaningStr || '[[' + normWord + ']] பற்றிய பொருள்.'
                    });
                }
            }
        });

        const uniqueMap = new Map();
        words.forEach(function(item) {
            if (!uniqueMap.has(item.word)) {
                uniqueMap.set(item.word, item);
            }
        });

        return Array.from(uniqueMap.values());
    }

    function getWiktionaryToken() {
        return wiktionaryApi.get({
            action: 'query',
            meta: 'tokens',
            type: 'csrf',
            formatversion: 2
        }).then(function(data) {
            if (data && data.query && data.query.tokens && data.query.tokens.csrftoken) {
                csrfToken = data.query.tokens.csrftoken;
                return true;
            }
            throw new Error('விக்சனரி CSRF Token பெற முடியவில்லை.');
        });
    }

    async function filterExistingWiktionaryPagesFast() {
        const batchSize = 50;
        const results = [];
        
        for (let i = 0; i < extractedWordsList.length; i += batchSize) {
            const batch = extractedWordsList.slice(i, i + batchSize);
            const titles = batch.map(function(b) { return b.word; }).join('|');

            try {
                const data = await wiktionaryApi.get({
                    action: 'query',
                    titles: titles,
                    formatversion: 2
                });

                if (data && data.query && data.query.pages) {
                    const missingTitles = new Set();
                    data.query.pages.forEach(function(p) {
                        if (p.missing) {
                            missingTitles.add(p.title);
                        }
                    });

                    batch.forEach(function(item) {
                        if (missingTitles.has(item.word)) {
                            results.push(item);
                        }
                    });
                }
            } catch (e) {
                batch.forEach(function(item) { results.push(item); });
            }
        }
        uncreatedWordsList = results;
    }

    function addImportButton() {
        if ($('#import-wiktionary-btn').length > 0) return;
        
        const btn = $('<button>', {
            id: 'import-wiktionary-btn',
            text: 'விக்சனரியில் இணை'
        }).css({
            'margin': '5px 10px',
            'padding': '6px 12px',
            'background-color': '#00a38f',
            'color': '#fff',
            'border': 'none',
            'border-radius': '4px',
            'cursor': 'pointer',
            'font-weight': 'bold',
            'font-size': '13px'
        });

        btn.click(processImportToWiktionary);
        
        if ($('#firstHeading').length) {
            $('#firstHeading').append(btn);
        } else if ($('#bodyContent').length) {
            $('#bodyContent').prepend(btn);
        }
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
            .then(function() { return filterExistingWiktionaryPagesFast(); })
            .then(function() {
                $('#import-wiktionary-btn').text('விக்சனரியில் இணை').prop('disabled', false);
                if (!uncreatedWordsList.length) {
                    alert('இப்பக்கத்தில் உள்ள அனைத்துச் சொற்களும் ஏற்கனவே விக்சனரியில் உள்ளன!');
                    return;
                }
                showInteractiveModal();
            })
            .catch(function(err) {
                $('#import-wiktionary-btn').text('விக்சனரியில் இணை').prop('disabled', false);
                alert('பிழை: ' + (err.message || err));
            });
    }

    // 3. மேம்படுத்தப்பட்ட முகப்புப் பெட்டி (UI with Grammar & Categories)
    function showInteractiveModal() {
        $('#wiktionary-modal-overlay').remove();

        const overlay = $('<div>', { id: 'wiktionary-modal-overlay' }).css({
            'position': 'fixed', 'top': '0', 'left': '0', 'width': '100%', 'height': '100%',
            'background': 'rgba(0,0,0,0.5)', 'z-index': '10000', 'display': 'flex',
            'align-items': 'center', 'justify-content': 'center', 'font-family': 'sans-serif'
        });

        overlay.click(function(e) {
            if (e.target.id === 'wiktionary-modal-overlay') {
                overlay.remove();
            }
        });

        const dialog = $('<div>').css({
            'background': '#fff', 'width': '540px', 'max-width': '92%', 'max-height': '88vh',
            'overflow-y': 'auto', 'padding': '20px', 'border-radius': '8px',
            'box-shadow': '0 4px 12px rgba(0,0,0,0.3)', 'position': 'relative'
        });

        const closeBtn = $('<button>', { text: '✖' }).css({
            'position': 'absolute', 'top': '10px', 'right': '10px', 'border': 'none',
            'background': 'none', 'font-size': '18px', 'cursor': 'pointer', 'color': '#666'
        }).click(function() { overlay.remove(); });

        const title = $('<h2>').css({
            'margin-top': '0', 'font-size': '16px', 'border-bottom': '1px solid #ccc', 'padding-bottom': '6px'
        }).html('விக்சனரியில் புதிய பக்கம் உருவாக்குதல் (<span id="current-step-num">1</span>/' + uncreatedWordsList.length + ')');

        const wordGroup = $('<div>').css('margin-bottom', '10px').append(
            $('<label>').css({'font-weight': 'bold', 'display': 'block', 'margin-bottom': '4px', 'font-size': '13px'}).text('தலைப்புச் சொல்:'),
            $('<input>', { type: 'text', id: 'input-word' }).css({
                'width': '100%', 'padding': '6px 8px', 'border': '1px solid #ccc', 'border-radius': '4px', 'box-sizing': 'border-box'
            })
        );

        const posGroup = $('<div>').css('margin-bottom', '10px').append(
            $('<label>').css({'font-weight': 'bold', 'display': 'block', 'margin-bottom': '4px', 'font-size': '13px'}).text('இலக்கண வகை:'),
            $('<select>', { id: 'select-pos' }).css({
                'width': '100%', 'padding': '6px 8px', 'border': '1px solid #ccc', 'border-radius': '4px'
            }).append(
                $('<option>', { value: 'பெயர்ச்சொல்', text: 'பெயர்ச்சொல்' }),
                $('<option>', { value: 'வினைச்சொல்', text: 'வினைச்சொல்' }),
                $('<option>', { value: 'பெயரடை', text: 'பெயரடை' }),
                $('<option>', { value: 'வினையடை', text: 'வினையடை' }),
                $('<option>', { value: 'இடைச்சொல்', text: 'இடைச்சொல்' }),
                $('<option>', { value: 'உரிச்சொல்', text: 'உரிச்சொல்' })
            )
        );

        const meaningGroup = $('<div>').css('margin-bottom', '10px').append(
            $('<label>').css({'font-weight': 'bold', 'display': 'block', 'margin-bottom': '4px', 'font-size': '13px'}).text('பொருள்/விளக்கம்:'),
            $('<textarea>', { id: 'input-meaning', rows: 3 }).css({
                'width': '100%', 'padding': '6px 8px', 'border': '1px solid #ccc', 'border-radius': '4px', 'box-sizing': 'border-box'
            })
        );

        const catGroup = $('<div>').css('margin-bottom', '10px').append(
            $('<label>').css({'font-weight': 'bold', 'display': 'block', 'margin-bottom': '4px', 'font-size': '13px'}).text('பகுப்புகள் (ற்பற்பி மூலம் பிரிக்கவும்):'),
            $('<input>', { type: 'text', id: 'input-categories', value: 'தமிழ்ச் சொற்கள்' }).css({
                'width': '100%', 'padding': '6px 8px', 'border': '1px solid #ccc', 'border-radius': '4px', 'box-sizing': 'border-box'
            })
        );

        const previewDetails = $('<details>', { open: false }).css({
            'font-size': '12px', 'background': '#f8f9fa', 'padding': '6px', 'border-radius': '4px', 'margin-bottom': '10px'
        }).append(
            $('<summary>').css({'cursor': 'pointer', 'font-weight': 'bold'}).text('விக்கிநடை முன்னோட்டம் (Wikitext Preview)'),
            $('<pre>', { id: 'wikitext-preview' }).css({
                'margin-top': '6px', 'white-space': 'pre-wrap', 'font-size': '11px',
                'max-height': '140px', 'overflow-y': 'auto', 'background': '#fff', 'padding': '6px', 'border': '1px solid #eee'
            })
        );

        const btnGroup = $('<div>').css({'display': 'flex', 'justify-content': 'space-between', 'align-items': 'center'}).append(
            $('<button>', { id: 'skip-word-btn', text: 'தவிர் (Skip)' }).css({
                'padding': '6px 14px', 'background': '#72777d', 'color': '#fff', 'border': 'none', 'border-radius': '4px', 'cursor': 'pointer'
            }).click(function() { skippedCount++; nextWord(); }),
            $('<button>', { id: 'submit-word-btn', text: 'பக்கத்தை உருவாக்கு' }).css({
                'padding': '6px 14px', 'background': '#36c', 'color': '#fff', 'border': 'none', 'border-radius': '4px', 'cursor': 'pointer', 'font-weight': 'bold'
            }).click(submitCurrentWord)
        );

        const statusMsg = $('<div>', { id: 'status-msg' }).css({
            'margin-top': '8px', 'font-weight': 'bold', 'font-size': '12px', 'text-align': 'center'
        });

        dialog.append(closeBtn, title, wordGroup, posGroup, meaningGroup, catGroup, previewDetails, btnGroup, statusMsg);
        overlay.append(dialog);
        $('body').append(overlay);

        loadCurrentWordToForm();

        $('#input-word, #input-meaning, #select-pos, #input-categories').on('input change', updatePreviewText);
    }

    function updatePreviewText() {
        const word = $('#input-word').val().trim();
        const meaning = $('#input-meaning').val().trim();
        const pos = $('#select-pos').val();
        const cats = $('#input-categories').val().trim();

        const text = buildWiktionaryPageContent(word, meaning, pos, cats);
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

    async function submitCurrentWord() {
        const word = $('#input-word').val().trim();
        const meaning = $('#input-meaning').val().trim();
        const pos = $('#select-pos').val();
        const cats = $('#input-categories').val().trim();

        if (!word) {
            alert('சொல்லை உள்ளிடவும்.');
            return;
        }

        $('#submit-word-btn').prop('disabled', true).text('உருவாக்கப்படுகிறது...');
        $('#skip-word-btn').prop('disabled', true);
        $('#status-msg').text('விக்சனரியில் பக்கம் சேர்க்கப்படுகிறது...').css('color', '#00af89');

        try {
            const getRes = await wiktionaryApi.get({
                action: 'query',
                titles: word,
                prop: 'revisions',
                rvprop: 'content',
                rvslots: 'main',
                formatversion: 2
            });

            const page = getRes?.query?.pages?.[0];
            let finalContent = '';

            if (page && !page.missing) {
                const existingContent = page.revisions[0].slots.main.content;
                if (existingContent.includes('=== பொருள் ===')) {
                    finalContent = existingContent.replace(
                        '=== பொருள் ===',
                        '=== பொருள் ===\n# ' + (meaning || '[[' + word + ']] பற்றிய பொருள்.')
                    );
                } else {
                    finalContent = existingContent + '\n\n# ' + (meaning || '[[' + word + ']] பற்றிய பொருள்.');
                }
            } else {
                finalContent = buildWiktionaryPageContent(word, meaning, pos, cats);
            }

            const editRes = await wiktionaryApi.post({
                action: 'edit',
                title: word,
                text: finalContent,
                summary: 'விக்கிமூலத்திலிருந்து இறக்குமதி செய்யப்பட்டது | User: ' + currentUser,
                token: csrfToken,
                format: 'json'
            });

            if (editRes && editRes.edit && editRes.edit.result === 'Success') {
                const url = 'https://' + TARGET_WIKTIONARY_LANG + '.wiktionary.org/wiki/' + encodeURIComponent(word);
                $('#status-msg').html('வெற்றி: <a href="' + url + '" target="_blank" style="color:green;">' + word + '</a> உருவாக்கப்பட்டது!').css('color', 'green');
                setTimeout(nextWord, 1200);
            } else {
                throw new Error((editRes && editRes.error && editRes.error.info) || 'பக்கத்தை உருவாக்க முடியவில்லை.');
            }
        } catch (err) {
            $('#status-msg').text('பிழை: ' + (err.message || err)).css('color', 'red');
            $('#submit-word-btn').prop('disabled', false).text('பக்கத்தை உருவாக்கு');
            $('#skip-word-btn').prop('disabled', false);
        }
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

    mw.loader.using('mediawiki.ForeignApi').then(function() {
        $(document).ready(addImportButton);
    });

})();
