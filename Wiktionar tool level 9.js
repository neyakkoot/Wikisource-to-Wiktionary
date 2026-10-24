// ============================================================
// Wikisource → Wiktionary Importer (Fixed: button visibility + refs)
// ============================================================

(function () {
    'use strict';

    const TARGET_WIKTIONARY_LANG = 'ta';
    const TARGET_WIKIPEDIA_LANG   = 'ta';
    const SCRIPT_RE = /[\u0B80-\u0BFF]/;

    const CUSTOM_SOURCES = [
        // { name: 'Tamil Virtual Academy', url: 'https://www.tamilvu.org/...' },
        // { name: 'Madurai Project',       url: 'https://www.projectmadurai.org/...' }
    ];

    // ---------------- Sandhi ----------------
    function generateDeclensionForms(word) {
        if (!word) return [];
        const lastTwo  = word.slice(-2);
        const lastChar = word.slice(-1);
        let forms = [];
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
        } else if (lastTwo === 'ன்' || lastTwo === 'ல்') {
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
        } else if (lastChar === 'உ' || lastChar === 'ு') {
            const stem = (lastChar === 'ு') ? word.slice(0, -1) : word;
            forms = [
                word + ' + ஐ = ' + word + 'வை',
                word + ' + ஆல் = ' + word + 'வால்',
                word + ' + கு = ' + word + 'க்கு',
                word + ' + அது = ' + stem + 'ின்',
                word + ' + இலிருந்து = ' + stem + 'ிலிருந்து',
                word + ' + ஓடு = ' + word + 'வோடு',
                word + ' + இன் = ' + stem + 'ின்'
            ];
        } else if (['இ','ஈ','ஐ','ி','ீ','ை'].includes(lastChar)) {
            forms = [
                word + ' + ஐ = ' + word + 'யை',
                word + ' + ஆல் = ' + word + 'யால்',
                word + ' + கு = ' + word + 'க்கு',
                word + ' + அது = ' + word + 'யின்',
                word + ' + இலிருந்து = ' + word + 'யிலிருந்து',
                word + ' + ஓடு = ' + word + 'யோடு',
                word + ' + இன் = ' + word + 'யின்'
            ];
        } else {
            forms = [
                word + ' + ஐ = ' + word + 'வை',
                word + ' + ஆல் = ' + word + 'வால்',
                word + ' + கு = ' + word + 'க்கு',
                word + ' + அது = ' + word + 'வின்',
                word + ' + இலிருந்து = ' + word + 'விலிருந்து',
                word + ' + ஓடு = ' + word + 'வோடு',
                word + ' + இன் = ' + word + 'வின்'
            ];
        }
        return forms;
    }

    // ---------------- Wikitext Builder ----------------
    function buildWiktionaryPageContent(word, meaning, posType, categoryList, extras) {
        extras = extras || {};
        const declensions = generateDeclensionForms(word);
        const declensionText = declensions.map(d => ': * ' + d).join('\n');

        let categoriesText;
        if (categoryList && categoryList.trim() !== '') {
            categoriesText = categoryList.split(',')
                .map(c => '[[பகுப்பு:' + c.trim() + ']]').join('\n');
        } else {
            categoriesText = '[[பகுப்பு:தமிழ்ச் சொற்கள்]]';
        }

        const litQuote     = (extras.litQuote     || '* {{மேற்கோள் தேவை}}').trim();
        const synonyms     = (extras.synonyms     || '* {{விரிவாக்கம் தேவை}}').trim();
        const loanwords    = (extras.loanwords    || '* {{விரிவாக்கம் தேவை}}').trim();
        const collocations = (extras.collocations || '* {{விரிவாக்கம் தேவை}}').trim();

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
            '== இலக்கிய மேற்கோள் ==\n' + litQuote + '\n\n' +
            '== ஒத்த சொற்கள் ==\n' + synonyms + '\n\n' +
            '== பிறமொழிச் சொற்கள் ==\n' + loanwords + '\n\n' +
            '== சொல்வளம் ==\n' + collocations + '\n\n' +
            '{{ஆதாரங்கள்-மொழி|ta}}\n\n' +
            categoriesText;
    }

    // ---------------- External References ----------------
    // ★ FIX: wbsearchentities → தனி Wikidata API (விக்சனரி API-ல் இல்லை)
    async function fetchReferences(word, meaning) {
        const refs = { litQuote: '', synonyms: '', loanwords: '', collocations: '' };

        try {
            const wdApi = new mw.ForeignApi('https://www.wikidata.org/w/api.php');
            const wd = await wdApi.get({
                action: 'wbsearchentities', search: word,
                language: 'ta', format: 'json', limit: 1
            });
            const entityId = wd && wd.search && wd.search[0] && wd.search[0].id;
            if (entityId) {
                const ent = await wdApi.get({
                    action: 'wbgetentities', ids: entityId,
                    props: 'sitelinks|descriptions', format: 'json'
                });
                const e = ent.entities[entityId];
                const langs = Object.keys(e.sitelinks || {})
                    .filter(k => k.endsWith('wiki'))
                    .map(k => k.replace('wiki', ''))
                    .filter(l => l !== 'ta');
                if (langs.length) {
                    refs.loanwords = langs.map(l => '* {{l|' + l + '|' + word + '}}').join('\n');
                }
                if (e.descriptions && e.descriptions.ta && e.descriptions.ta.value) {
                    refs.collocations = '* ' + e.descriptions.ta.value;
                }
            }
        } catch (e) { console.warn('Wikidata search failed', e); }

        try {
            const wp = new mw.ForeignApi('https://' + TARGET_WIKIPEDIA_LANG + '.wikipedia.org/w/api.php');
            const wpRes = await wp.get({
                action: 'query', list: 'search',
                srsearch: word, srlimit: 1, format: 'json'
            });
            const hit = wpRes && wpRes.query && wpRes.query.search && wpRes.query.search[0];
            if (hit) {
                refs.litQuote = '* [[' + TARGET_WIKIPEDIA_LANG + ':'
                    + hit.title + '|' + hit.title + ']] — விக்கிப்பீடியாக் கட்டுரை';
            }
        } catch (e) { console.warn('WP search failed', e); }

        if (CUSTOM_SOURCES.length) {
            const extra = CUSTOM_SOURCES.map(s => '* [' + s.url + ' ' + s.name + ']').join('\n');
            refs.litQuote = (refs.litQuote ? refs.litQuote + '\n' : '') + extra;
        }

        if (!refs.litQuote)     refs.litQuote     = '* {{மேற்கோள் தேவை}}';
        if (!refs.synonyms)     refs.synonyms     = '* {{விரிவாக்கம் தேவை}}';
        if (!refs.loanwords)    refs.loanwords    = '* {{விரிவாக்கம் தேவை}}';
        if (!refs.collocations) refs.collocations = '* {{விரிவாக்கம் தேவை}}';
        return refs;
    }

    // ---------------- State ----------------
    let extractedWordsList = [];
    let uncreatedWordsList = [];
    let currentIndex       = 0;
    let currentUser        = '';
    let skippedCount       = 0;
    let wiktionaryApi      = null;
    let csrfToken          = '';
    let currentExtras      = { litQuote: '', synonyms: '', loanwords: '', collocations: '' };

    function initializeApi() {
        wiktionaryApi = new mw.ForeignApi('https://' + TARGET_WIKTIONARY_LANG + '.wiktionary.org/w/api.php');
    }

    function normalizeWord(text) {
        if (!text) return '';
        return String(text).normalize('NFC')
            .replace(/[\u200B-\u200D\uFEFF]/g, '')
            .replace(/\u00A0/g, ' ')
            .replace(/\s+/g, ' ').trim();
    }
    function containsScript(text) { return SCRIPT_RE.test(text || ''); }

    function extractHeadwords() {
        const contentArea = $('#mw-content-text').clone();
        contentArea.find('.printfooter, .mw-editsection, style, script, .prp-page-header, .prp-page-footer').remove();
        const words = [];
        contentArea.text().split(/\r?\n/).map(x => x.trim()).filter(Boolean).forEach(function (line) {
            if (!containsScript(line)) return;
            let wordStr = '', meaningStr = '';
            if (line.includes('=')) {
                const p = line.split('=');
                wordStr = p[0].trim(); meaningStr = p.slice(1).join('=').trim();
            } else if (line.includes(' - ')) {
                const p = line.split(' - ');
                wordStr = p[0].trim(); meaningStr = p.slice(1).join(' - ').trim();
            } else { wordStr = line.trim(); }
            const m = wordStr.match(new RegExp('^(' + SCRIPT_RE.source + '+)'));
            if (m) {
                const n = normalizeWord(m[1]);
                if (n) words.push({ word: n, meaning: meaningStr || '[[' + n + ']] பற்றிய பொருள்.' });
            }
        });
        const map = new Map();
        words.forEach(i => { if (!map.has(i.word)) map.set(i.word, i); });
        return Array.from(map.values());
    }

    function getWiktionaryToken() {
        return wiktionaryApi.get({
            action: 'query', meta: 'tokens', type: 'csrf', formatversion: 2
        }).then(data => {
            if (data && data.query && data.query.tokens && data.query.tokens.csrftoken) {
                csrfToken = data.query.tokens.csrftoken; return true;
            }
            throw new Error('CSRF token பெற முடியவில்லை.');
        });
    }

    async function filterExistingWiktionaryPagesFast() {
        const batchSize = 50, results = [];
        for (let i = 0; i < extractedWordsList.length; i += batchSize) {
            const batch = extractedWordsList.slice(i, i + batchSize);
            const titles = batch.map(b => b.word).join('|');
            try {
                const data = await wiktionaryApi.get({ action: 'query', titles, formatversion: 2 });
                if (data && data.query && data.query.pages) {
                    const missing = new Set();
                    data.query.pages.forEach(p => { if (p.missing) missing.add(p.title); });
                    batch.forEach(it => { if (missing.has(it.word)) results.push(it); });
                }
            } catch (e) { batch.forEach(it => results.push(it)); }
        }
        uncreatedWordsList = results;
    }

    // ★ FIX: addPortletLink மிகவும் நம்பகமானது; fallback-ஆக firstHeading/bodyContent
    function addImportButton() {
        console.log('[WiktionaryImporter] addImportButton called');
        if ($('#import-wiktionary-btn').length > 0 || $('#ca-import-wiktionary').length > 0) {
            console.log('[WiktionaryImporter] button already exists');
            return;
        }

        try {
            const portlet = mw.util.addPortletLink(
                'p-cactions',
                '#',
                'விக்சனரியில் இணை',
                'ca-import-wiktionary',
                'இப்பக்கத்தின் சொற்களை விக்சனரியில் இறக்குமதி செய்',
                null,
                null
            );
            if (portlet) {
                $(portlet).on('click', function (e) {
                    e.preventDefault();
                    processImportToWiktionary();
                });
                console.log('[WiktionaryImporter] portlet link added');
            }
        } catch (e) {
            console.warn('[WiktionaryImporter] addPortletLink failed', e);
        }

        // ★ fallback: ஒரு தெளிவான பொத்தானையும் தலைப்பின் கீழ் சேர்
        if ($('#import-wiktionary-btn').length === 0) {
            const btn = $('<button>', {
                id: 'import-wiktionary-btn',
                text: 'விக்சனரியில் இணை'
            }).css({
                'margin': '5px 10px', 'padding': '6px 12px',
                'background-color': '#00a38f', 'color': '#fff',
                'border': 'none', 'border-radius': '4px',
                'cursor': 'pointer', 'font-weight': 'bold', 'font-size': '13px'
            }).on('click', processImportToWiktionary);

            const $target = $('#firstHeading').length ? $('#firstHeading') :
                            ($('#bodyContent').length ? $('#bodyContent') : $('body'));
            $target.first().append(btn);
            console.log('[WiktionaryImporter] fallback button appended to', $target.selector);
        }
    }

    function processImportToWiktionary() {
        console.log('[WiktionaryImporter] process started');
        currentUser = mw.config.get('wgUserName');
        if (!currentUser) {
            alert('இந்தப் பங்களிப்பைச் செய்ய நீங்கள் முதலில் உள்நுழைய வேண்டும்.');
            return;
        }
        extractedWordsList = extractHeadwords();
        console.log('[WiktionaryImporter] extracted', extractedWordsList.length, 'words');
        if (!extractedWordsList.length) {
            alert('அகராதித் தலைப்புச் சொற்கள் எதுவும் கண்டறியப்படவில்லை.');
            return;
        }
        $('#import-wiktionary-btn').text('விக்சனரி சரிபார்க்கப்படுகிறது...').prop('disabled', true);
        initializeApi();
        getWiktionaryToken()
            .then(() => filterExistingWiktionaryPagesFast())
            .then(function () {
                $('#import-wiktionary-btn').text('விக்சனரியில் இணை').prop('disabled', false);
                console.log('[WiktionaryImporter] uncreated', uncreatedWordsList.length);
                if (!uncreatedWordsList.length) {
                    alert('இப்பக்கத்தில் உள்ள அனைத்துச் சொற்களும் ஏற்கனவே விக்சனரியில் உள்ளன!');
                    return;
                }
                showInteractiveModal();
            })
            .catch(function (err) {
                $('#import-wiktionary-btn').text('விக்சனரியில் இணை').prop('disabled', false);
                alert('பிழை: ' + (err.message || err));
            });
    }

    // ---------------- Modal ----------------
    function showInteractiveModal() {
        $('#wiktionary-modal-overlay').remove();

        const overlay = $('<div>', { id: 'wiktionary-modal-overlay' }).css({
            'position': 'fixed', 'top': '0', 'left': '0', 'width': '100%', 'height': '100%',
            'background': 'rgba(0,0,0,0.5)', 'z-index': '10000', 'display': 'flex',
            'align-items': 'center', 'justify-content': 'center', 'font-family': 'sans-serif'
        });
        overlay.on('click', e => { if (e.target.id === 'wiktionary-modal-overlay') overlay.remove(); });

        const dialog = $('<div>').css({
            'background': '#fff', 'width': '620px', 'max-width': '94%', 'max-height': '90vh',
            'overflow-y': 'auto', 'padding': '20px', 'border-radius': '8px',
            'box-shadow': '0 4px 12px rgba(0,0,0,0.3)', 'position': 'relative'
        });

        const closeBtn = $('<button>', { text: '✖' }).css({
            'position': 'absolute', 'top': '10px', 'right': '10px', 'border': 'none',
            'background': 'none', 'font-size': '18px', 'cursor': 'pointer', 'color': '#666'
        }).on('click', () => overlay.remove());

        const title = $('<h2>').css({
            'margin-top': '0', 'font-size': '16px', 'border-bottom': '1px solid #ccc', 'padding-bottom': '6px'
        }).html('விக்சனரியில் புதிய பக்கம் (<span id="current-step-num">1</span>/' + uncreatedWordsList.length + ')');

        const wordGroup = $('<div>').css('margin-bottom', '8px').append(
            $('<label>').css({ 'font-weight': 'bold', 'display': 'block', 'margin-bottom': '4px', 'font-size': '13px' }).text('தலைப்புச் சொல்:'),
            $('<input>', { type: 'text', id: 'input-word' }).css({ 'width': '100%', 'padding': '6px 8px', 'border': '1px solid #ccc', 'border-radius': '4px', 'box-sizing': 'border-box' })
        );
        const posGroup = $('<div>').css('margin-bottom', '8px').append(
            $('<label>').css({ 'font-weight': 'bold', 'display': 'block', 'margin-bottom': '4px', 'font-size': '13px' }).text('இலக்கண வகை:'),
            $('<select>', { id: 'select-pos' }).css({ 'width': '100%', 'padding': '6px 8px', 'border': '1px solid #ccc', 'border-radius': '4px' }).append(
                $('<option>', { value: 'பெயர்ச்சொல்', text: 'பெயர்ச்சொல்' }),
                $('<option>', { value: 'வினைச்சொல்', text: 'வினைச்சொல்' }),
                $('<option>', { value: 'பெயரடை', text: 'பெயரடை' }),
                $('<option>', { value: 'வினையடை', text: 'வினையடை' }),
                $('<option>', { value: 'இடைச்சொல்', text: 'இடைச்சொல்' }),
                $('<option>', { value: 'உரிச்சொல்', text: 'உரிச்சொல்' })
            )
        );
        const meaningGroup = $('<div>').css('margin-bottom', '8px').append(
            $('<label>').css({ 'font-weight': 'bold', 'display': 'block', 'margin-bottom': '4px', 'font-size': '13px' }).text('பொருள்/விளக்கம்:'),
            $('<textarea>', { id: 'input-meaning', rows: 2 }).css({ 'width': '100%', 'padding': '6px 8px', 'border': '1px solid #ccc', 'border-radius': '4px', 'box-sizing': 'border-box' })
        );
        const catGroup = $('<div>').css('margin-bottom', '8px').append(
            $('<label>').css({ 'font-weight': 'bold', 'display': 'block', 'margin-bottom': '4px', 'font-size': '13px' }).text('பகுப்புகள் (காற்புள்ளியால் பிரிக்கவும்):'),
            $('<input>', { type: 'text', id: 'input-categories', value: 'தமிழ்ச் சொற்கள்' }).css({ 'width': '100%', 'padding': '6px 8px', 'border': '1px solid #ccc', 'border-radius': '4px', 'box-sizing': 'border-box' })
        );

        function makeSection(labelText, id) {
            return $('<div>').css('margin-bottom', '8px').append(
                $('<label>').css({ 'font-weight': 'bold', 'display': 'block', 'margin-bottom': '4px', 'font-size': '13px' }).text(labelText),
                $('<textarea>', { id, rows: 3 }).css({ 'width': '100%', 'padding': '6px 8px', 'border': '1px solid #ccc', 'border-radius': '4px', 'box-sizing': 'border-box', 'font-size': '12px' })
            );
        }

        const litQuoteGroup     = makeSection('இலக்கிய மேற்கோள்:', 'input-lit-quote');
        const synonymsGroup     = makeSection('ஒத்த சொற்கள்:',    'input-synonyms');
        const loanwordsGroup    = makeSection('பிறமொழிச் சொற்கள்:', 'input-loanwords');
        const collocationsGroup = makeSection('சொல்வளம்:',         'input-collocations');

        const fetchBtn = $('<button>', { id: 'fetch-refs-btn', text: '🔍 மேற்கோள்களைத் தேடு (விக்கிப்பீடியா / விகிடேட்டா / விக்சனரி)' }).css({
            'padding': '6px 12px', 'background': '#0078d7', 'color': '#fff',
            'border': 'none', 'border-radius': '4px', 'cursor': 'pointer',
            'font-size': '12px', 'margin-bottom': '8px'
        });

        const previewDetails = $('<details>', { open: true }).css({
            'font-size': '12px', 'background': '#f8f9fa', 'padding': '8px',
            'border-radius': '4px', 'margin-bottom': '8px'
        }).append(
            $('<summary>').css({ 'cursor': 'pointer', 'font-weight': 'bold', 'margin-bottom': '6px' }).text('விக்கிநடை உரை (Editable Wikitext):'),
            $('<textarea>', { id: 'wikitext-preview', rows: 11 }).css({
                'width': '100%', 'font-family': 'monospace', 'font-size': '11px',
                'background': '#fff', 'padding': '6px', 'border': '1px solid #ccc',
                'border-radius': '4px', 'box-sizing': 'border-box'
            })
        );

        const btnGroup = $('<div>').css({ 'display': 'flex', 'justify-content': 'space-between', 'align-items': 'center' }).append(
            $('<button>', { id: 'skip-word-btn', text: 'தவிர் (Skip)' }).css({
                'padding': '6px 14px', 'background': '#72777d', 'color': '#fff',
                'border': 'none', 'border-radius': '4px', 'cursor': 'pointer'
            }).on('click', () => { skippedCount++; nextWord(); }),
            $('<button>', { id: 'submit-word-btn', text: 'பக்கத்தை உருவாக்கு' }).css({
                'padding': '6px 14px', 'background': '#36c', 'color': '#fff',
                'border': 'none', 'border-radius': '4px', 'cursor': 'pointer', 'font-weight': 'bold'
            }).on('click', submitCurrentWord)
        );

        const statusMsg = $('<div>', { id: 'status-msg' }).css({
            'margin-top': '8px', 'font-weight': 'bold', 'font-size': '12px', 'text-align': 'center'
        });

        dialog.append(closeBtn, title, wordGroup, posGroup, meaningGroup, catGroup,
            litQuoteGroup, synonymsGroup, loanwordsGroup, collocationsGroup,
            fetchBtn, previewDetails, btnGroup, statusMsg);

        overlay.append(dialog);
        $('body').append(overlay);

        loadCurrentWordToForm();

        $('#input-word, #input-meaning, #select-pos, #input-categories, ' +
          '#input-lit-quote, #input-synonyms, #input-loanwords, #input-collocations')
            .on('input change', updatePreviewText);

        $('#fetch-refs-btn').on('click', async function () {
            const w = $('#input-word').val().trim();
            const m = $('#input-meaning').val().trim();
            if (!w) return alert('முதலில் ஒரு சொல்லை உள்ளிடவும்.');
            $(this).prop('disabled', true).text('தேடுகிறது...');
            try {
                const refs = await fetchReferences(w, m);
                currentExtras = refs;
                $('#input-lit-quote').val(refs.litQuote);
                $('#input-synonyms').val(refs.synonyms);
                $('#input-loanwords').val(refs.loanwords);
                $('#input-collocations').val(refs.collocations);
                updatePreviewText();
            } catch (e) {
                console.warn('fetchReferences failed', e);
            } finally {
                $(this).prop('disabled', false).text('🔍 மேற்கோள்களைத் தேடு (விக்கிப்பீடியா / விகிடேட்டா / விக்சனரி)');
            }
        });
    }

    function updatePreviewText() {
        const word    = $('#input-word').val().trim();
        const meaning = $('#input-meaning').val().trim();
        const pos     = $('#select-pos').val();
        const cats    = $('#input-categories').val().trim();
        const extras  = {
            litQuote:     $('#input-lit-quote').val(),
            synonyms:     $('#input-synonyms').val(),
            loanwords:    $('#input-loanwords').val(),
            collocations: $('#input-collocations').val()
        };
        currentExtras = extras;
        $('#wikitext-preview').val(buildWiktionaryPageContent(word, meaning, pos, cats, extras));
    }

    function loadCurrentWordToForm() {
        const item = uncreatedWordsList[currentIndex];
        if (!item) return;
        $('#current-step-num').text(currentIndex + 1);
        $('#input-word').val(item.word);
        $('#input-meaning').val(item.meaning);
        $('#input-lit-quote').val('* {{மேற்கோள் தேவை}}');
        $('#input-synonyms').val('* {{விரிவாக்கம் தேவை}}');
        $('#input-loanwords').val('* {{விரிவாக்கம் தேவை}}');
        $('#input-collocations').val('* {{விரிவாக்கம் தேவை}}');
        currentExtras = { litQuote: '', synonyms: '', loanwords: '', collocations: '' };
        $('#submit-word-btn').prop('disabled', false).text('பக்கத்தை உருவாக்கு');
        $('#skip-word-btn').prop('disabled', false);
        $('#status-msg').text('');
        updatePreviewText();
    }

    async function submitCurrentWord() {
        const word = $('#input-word').val().trim();
        const finalContent = $('#wikitext-preview').val().trim();
        if (!word || !finalContent) { alert('சொல் மற்றும் விக்கி உரையைச் சரிபார்க்கவும்.'); return; }
        $('#submit-word-btn').prop('disabled', true).text('உருவாக்கப்படுகிறது...');
        $('#skip-word-btn').prop('disabled', true);
        $('#status-msg').text('விக்சனரியில் பக்கம் சேர்க்கப்படுகிறது...').css('color', '#00af89');
        try {
            const editRes = await wiktionaryApi.post({
                action: 'edit', title: word, text: finalContent,
                summary: 'விக்கிமூலத்திலிருந்து இறக்குமதி | User: ' + currentUser,
                token: csrfToken, format: 'json'
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
        if (currentIndex < uncreatedWordsList.length) loadCurrentWordToForm();
        else { $('#wiktionary-modal-overlay').remove(); alert('அனைத்துப் புதிய சொற்களும் விக்சனரியில் உருவாக்கப்பட்டன!'); }
    }

    // ★ FIX: module load + ready hook + retry on LateInit / DOM ready
    function boot() {
        console.log('[WiktionaryImporter] boot()');
        if (!mw || !mw.loader) {
            console.error('[WiktionaryImporter] mw.loader இல்லை');
            return;
        }
        mw.loader.using(['mediawiki.api', 'mediawiki.ForeignApi', 'mediawiki.util', 'jquery'])
            .then(function () {
                console.log('[WiktionaryImporter] modules loaded');
                if (document.readyState === 'loading') {
                    $(document).one('ready', addImportButton);
                } else {
                    addImportButton();
                }
                // ★ சில தோற்றங்களில் தலைப்பு தாமதமாக load ஆகும் — மீண்டும் முயற்சி
                setTimeout(addImportButton, 1500);
                setTimeout(addImportButton, 4000);
            })
            .catch(function (err) {
                console.error('[WiktionaryImporter] module load failed', err);
                // module load தோல்வியடைந்தாலும் fallback button போடு
                if (document.readyState !== 'loading') addImportButton();
                else $(document).one('ready', addImportButton);
            });
    }

    boot();

})();
