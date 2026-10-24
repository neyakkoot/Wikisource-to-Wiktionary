// ============================================================
// Wikisource → Wiktionary Importer
// Advanced External Search + Full Verse Extraction Edition
// ============================================================

(function () {
    'use strict';

    const SOURCE_LANG            = 'ta';
    const TARGET_WIKTIONARY_LANG = 'ta';
    const TARGET_WIKIPEDIA_LANG  = 'ta';
    const SCRIPT_RE              = /[\u0B80-\u0BFF]/;

    // ---------- கருவியின் லோகோ (SVG — 28×28) ----------
    const LOGO_SIZE = 28;
    const TOOL_LOGO_SVG = ''
      + '<svg xmlns="http://www.w3.org/2000/svg" width="' + LOGO_SIZE + '" height="' + LOGO_SIZE + '" '
      +     'viewBox="0 0 32 32" aria-hidden="true" focusable="false" '
      +     'style="vertical-align:middle;flex-shrink:0;display:inline-block;">'
      +   '<rect x="3" y="4" width="18" height="24" rx="2.5" fill="#00a38f"/>'
      +   '<rect x="5.5" y="7" width="13" height="2.2" rx="0.6" fill="#ffffff"/>'
      +   '<rect x="5.5" y="11" width="13" height="2.2" rx="0.6" fill="#ffffff"/>'
      +   '<rect x="5.5" y="15" width="9.5" height="2.2" rx="0.6" fill="#ffffff"/>'
      +   '<path d="M17 24 L29 17 L24.5 16 L27 10.5 L20.5 12 L19.5 8 Z" '
      +       'fill="#f5a623" stroke="#8a5a00" stroke-width="0.6" stroke-linejoin="round"/>'
      +   '<circle cx="17.5" cy="24" r="1.8" fill="#1a1a1a" stroke="#ffffff" stroke-width="0.5"/>'
      + '</svg>';

    function buildLabelHtml(labelText, logoSize) {
        const size = logoSize || LOGO_SIZE;
        const safe = (mw && mw.html && mw.html.escape)
            ? mw.html.escape(labelText)
            : String(labelText).replace(/[&<>"']/g, c => ({
                '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
              }[c]));
        let svg = TOOL_LOGO_SVG;
        if (size !== LOGO_SIZE) {
            svg = svg.replace(/width="\d+" height="\d+"/, 'width="' + size + '" height="' + size + '"');
        }
        return '<span class="wikt-import-label" '
             + 'style="display:inline-flex;align-items:center;gap:8px;line-height:1.2;">'
             + svg
             + '<span style="font-weight:600;">' + safe + '</span>'
             + '</span>';
    }

    const CUSTOM_SOURCES = [
        { name: 'தமிழ் இணையக் கல்விக்கழகம்', url: 'https://www.tamilvu.org/' },
        { name: 'மதுரைத் திட்டம்',            url: 'https://www.projectmadurai.org/' }
    ];

    // ---------------- தமிழ் புணர்ச்சி (Sandhi) விதிகள் ----------------
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

    // ---------------- விக்கிநடை உரை உருவாக்கம் ----------------
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
            '{{ஆதாரங்கள்-மொழி|ta}}\n' +
            '* தமிழ் இணையக் கல்விக்கழகம் / மதுரைத் திட்டம் சான்றுகள்.\n\n' +
            categoriesText;
    }

    // ---------------- ★ மேம்படுத்தப்பட்ட இணையத் தேடல் & முழுப் பாடல் பிரித்தெடுத்தல் ----------------
    
    // ஒரு விக்கி பக்கத்தின் HTML-லிருந்து பாடல்/மேற்கோள் பகுதிகளை மட்டும் பிரித்தெடுக்கும் உதவிச் சார்பு
    function extractVersesFromHtml(htmlContent, word) {
        const $html = $('<div>').html(htmlContent);
        let verses = [];

        // பொதுவான பாடல் கட்டமைப்புகள்: <poem>, <blockquote>
        $html.find('poem, blockquote').each(function () {
            let text = $(this).text().trim();
            // "கற்க" போன்ற சொல் இருந்தால் மட்டும் எடுத்துக்கொள்
            if (text.includes(word) && text.length > 10) {
                // பாடல் வடிவத்தை விக்கிநடையில் மாற்று
                let lines = text.split('\n').filter(l => l.trim() !== '');
                // ஒவ்வொரு வரியின் முன்னும் ':' சேர்த்து indent செய்
                let formatted = lines.map(l => ': ' + l.trim()).join('\n');
                verses.push(formatted);
            }
        });

        // பொதுவான <p> அல்லது <div> உள்ளே தனித்தனி வரிகளாக இருந்தால்
        if (verses.length === 0) {
            $html.find('p').each(function () {
                let text = $(this).text().trim();
                if (text.includes(word) && text.length > 10) {
                    let lines = text.split('\n').filter(l => l.trim() !== '');
                    // குறைந்தது 2 வரிகள் இருந்தால் மட்டும் பாடலாகக் கருது
                    if (lines.length >= 2) {
                        let formatted = lines.map(l => ': ' + l.trim()).join('\n');
                        verses.push(formatted);
                    }
                }
            });
        }

        return verses;
    }

    async function fetchReferencesEnhanced(word, meaning) {
        const refs = { litQuote: '', synonyms: '', loanwords: '', collocations: '' };

        // ---------------------------------------------------------
        // 1. ★ விக்கிமூலத்திலிருந்து இலக்கியப் பாடல்களைத் தேடி, முழுப் பாடல்களைப் பிரித்தெடுத்தல்
        // ---------------------------------------------------------
        try {
            const wsApi = new mw.ForeignApi('https://' + SOURCE_LANG + '.wikisource.org/w/api.php');
            const wsRes = await wsApi.get({
                action: 'query',
                list: 'search',
                srsearch: word,
                srnamespace: '0|104',
                srlimit: 3, // API சுமையைக் குறைக்க 3 மட்டும்
                format: 'json'
            });

            const hits = wsRes && wsRes.query && wsRes.query.search;
            if (hits && hits.length) {
                const extractedQuotes = [];
                
                // ஒவ்வொரு தேடல் முடிவின் பக்கத்தையும் parse செய்து முழுப் பாடலைப் பெறு
                for (const h of hits) {
                    try {
                        const parseRes = await wsApi.get({
                            action: 'parse',
                            page: h.title,
                            prop: 'text',
                            format: 'json',
                            formatversion: 2
                        });
                        if (parseRes && parseRes.parse && parseRes.parse.text) {
                            const html = parseRes.parse.text;
                            const verses = extractVersesFromHtml(html, word);
                            if (verses.length > 0) {
                                // தலைப்பு + பாடல்
                                extractedQuotes.push(
                                    '; [[' + SOURCE_LANG + ':s:' + h.title + '|' + h.title + ']]\n' +
                                    verses.join('\n\n')
                                );
                            }
                        }
                    } catch (e) {
                        console.warn('Parse failed for page: ' + h.title, e);
                    }
                }

                if (extractedQuotes.length > 0) {
                    refs.litQuote = extractedQuotes.join('\n\n');
                } else {
                    // பாடல் பிரித்தெடுக்க முடியாவிட்டால், குறைந்தது தேடல் முடிவுகளையாவது காட்டு
                    refs.litQuote = hits.map(h => 
                        '* [[' + SOURCE_LANG + ':s:' + h.title + '|' + h.title + ']] (பாடலை இப்பக்கத்தில் காண்க)'
                    ).join('\n');
                }
            }
        } catch (e) { console.warn('Wikisource search failed', e); }

        // ---------------------------------------------------------
        // 2. விக்கித்தரவிலிருந்து (Wikidata) பிறமொழிச் சொற்கள்
        // ---------------------------------------------------------
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
                const langsMap = { 'en': 'ஆங்கிலம்', 'sa': 'சமஸ்கிருதம்', 'te': 'தெலுங்கு', 'kn': 'கன்னடம்', 'ml': 'மலையாளம்', 'hi': 'இந்தி' };
                const foundCognates = [];
                for (let l in langsMap) {
                    if (e.sitelinks && e.sitelinks[l + 'wiktionary']) {
                        const title = e.sitelinks[l + 'wiktionary'].title;
                        foundCognates.push('* ' + langsMap[l] + ': [https://' + l + '.wiktionary.org/wiki/' + encodeURIComponent(title) + ' ' + title + ']');
                    }
                }
                if (foundCognates.length) refs.loanwords = foundCognates.join('\n');
            }
        } catch (e) { console.warn('Wikidata search failed', e); }

        // ---------------------------------------------------------
        // 3. தமிழ் விக்கிப்பீடியா (இலக்கியக் கட்டுரைகள்)
        // ---------------------------------------------------------
        try {
            const wp = new mw.ForeignApi('https://' + TARGET_WIKIPEDIA_LANG + '.wikipedia.org/w/api.php');
            const wpRes = await wp.get({
                action: 'query', list: 'search',
                srsearch: word, srlimit: 1, format: 'json'
            });
            const hit = wpRes && wpRes.query && wpRes.query.search && wpRes.query.search[0];
            if (hit) {
                const wpLink = '* [[' + TARGET_WIKIPEDIA_LANG + ':' + hit.title + '|' + hit.title + ']] — விக்கிப்பீடியா சான்று';
                if (!refs.litQuote) {
                    refs.litQuote = wpLink;
                } else {
                    refs.litQuote += '\n' + wpLink;
                }
            }
        } catch (e) { console.warn('WP search failed', e); }

        // ---------------------------------------------------------
        // 4. தமிழ் விக்சனரியிலிருந்து ஒத்த சொற்கள்
        // ---------------------------------------------------------
        try {
            const wtApi = new mw.ForeignApi('https://' + TARGET_WIKTIONARY_LANG + '.wiktionary.org/w/api.php');
            const wtRes = await wtApi.get({
                action: 'query', list: 'search',
                srsearch: word, srlimit: 5, format: 'json'
            });
            const hits = wtRes && wtRes.query && wtRes.query.search;
            if (hits && hits.length) {
                const synonymsList = hits.map(h => h.title).filter(t => t !== word).slice(0, 4);
                if (synonymsList.length) {
                    refs.synonyms = synonymsList.map(s => '* [[' + s + ']]').join('\n');
                }
            }
        } catch (e) { console.warn('Wiktionary search failed', e); }

        // பொது ஆதாரங்கள் (தமிழ் இணையக் கல்விக்கழகம் / மதுரைத் திட்டம்)
        if (CUSTOM_SOURCES.length) {
            const extra = CUSTOM_SOURCES.map(s => '* [' + s.url + ' ' + s.name + ']').join('\n');
            refs.litQuote = (refs.litQuote ? refs.litQuote + '\n' : '') + extra;
        }

        // இயல்பு மதிப்புகள்
        if (!refs.litQuote)     refs.litQuote     = '* {{மேற்கோள் தேவை}}';
        if (!refs.synonyms)     refs.synonyms     = '* {{விரிவாக்கம் தேவை}}';
        if (!refs.loanwords)    refs.loanwords    = '* {{விரிவாக்கம் தேவை}}';
        if (!refs.collocations) refs.collocations = '* {{விரிவாக்கம் தேவை}}';

        return refs;
    }

    // ---------------- இயக்க நிலை (State) ----------------
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

    function addImportButton() {
        if ($('#ca-import-wiktionary').length > 0 || $('#import-wiktionary-btn').length > 0) return;

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
                $(portlet).find('a').first()
                    .html(buildLabelHtml('விக்சனரியில் இணை'))
                    .css({ 'padding-top': '4px', 'padding-bottom': '4px' });
                $(portlet).on('click', function (e) {
                    e.preventDefault();
                    processImportToWiktionary();
                });
            }
        } catch (e) {
            console.warn('addPortletLink failed', e);
        }

        if ($('#import-wiktionary-btn').length === 0) {
            const btn = $('<button>', {
                id: 'import-wiktionary-btn',
                type: 'button',
                title: 'இப்பக்கத்தின் சொற்களை விக்சனரியில் இறக்குமதி செய்'
            })
            .html(buildLabelHtml('விக்சனரியில் இணை'))
            .css({
                'margin': '8px 10px', 'padding': '8px 16px',
                'background-color': '#00a38f', 'color': '#fff',
                'border': 'none', 'border-radius': '8px',
                'cursor': 'pointer', 'font-size': '14px',
                'display': 'inline-flex', 'align-items': 'center', 'gap': '8px',
                'box-shadow': '0 3px 6px rgba(0,0,0,0.18)',
                'transition': 'background-color .15s, box-shadow .15s, transform .1s'
            })
            .on('click', processImportToWiktionary);

            const $target = $('#firstHeading').length ? $('#firstHeading') :
                            ($('#bodyContent').length ? $('#bodyContent') : $('body'));
            $target.first().append(btn);
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
        const $btn = $('#import-wiktionary-btn').length
            ? $('#import-wiktionary-btn')
            : $('#ca-import-wiktionary a');
        $btn.html(buildLabelHtml('விக்சனரி சரிபார்க்கப்படுகிறது...')).prop('disabled', true).css('pointer-events', 'none');

        initializeApi();
        getWiktionaryToken()
            .then(() => filterExistingWiktionaryPagesFast())
            .then(function () {
                $btn.html(buildLabelHtml('விக்சனரியில் இணை')).prop('disabled', false).css('pointer-events', '');
                if (!uncreatedWordsList.length) {
                    alert('இப்பக்கத்தில் உள்ள அனைத்துச் சொற்களும் ஏற்கனவே விக்சனரியில் உள்ளன!');
                    return;
                }
                showInteractiveModal();
            })
            .catch(function (err) {
                $btn.html(buildLabelHtml('விக்சனரியில் இணை')).prop('disabled', false).css('pointer-events', '');
                alert('பிழை: ' + (err.message || err));
            });
    }

    // ---------------- முகப்புப் பெட்டி (Modal Window) ----------------
    function showInteractiveModal() {
        $('#wiktionary-modal-overlay').remove();

        const overlay = $('<div>', { id: 'wiktionary-modal-overlay' }).css({
            'position': 'fixed', 'top': '0', 'left': '0', 'width': '100%', 'height': '100%',
            'background': 'rgba(0,0,0,0.5)', 'z-index': '10000', 'display': 'flex',
            'align-items': 'center', 'justify-content': 'center', 'font-family': 'sans-serif'
        });
        overlay.on('click', e => { if (e.target.id === 'wiktionary-modal-overlay') overlay.remove(); });

        const dialog = $('<div>').css({
            'background': '#fff', 'width': '640px', 'max-width': '94%', 'max-height': '90vh',
            'overflow-y': 'auto', 'padding': '22px', 'border-radius': '10px',
            'box-shadow': '0 6px 20px rgba(0,0,0,0.35)', 'position': 'relative'
        });

        const closeBtn = $('<button>', { text: '✖' }).css({
            'position': 'absolute', 'top': '10px', 'right': '10px', 'border': 'none',
            'background': 'none', 'font-size': '18px', 'cursor': 'pointer', 'color': '#666'
        }).on('click', () => overlay.remove());

        const title = $('<h2>').css({
            'margin-top': '0', 'font-size': '17px', 'border-bottom': '1px solid #ccc',
            'padding-bottom': '8px', 'display': 'flex', 'align-items': 'center', 'gap': '10px'
        }).html(buildLabelHtml(
            'விக்சனரியில் புதிய பக்கம் (' + uncreatedWordsList.length + ')', 32
        ).replace('<span style="font-weight:600;">', '<span style="font-weight:600;" id="title-text">'));

        title.find('#title-text').append(' — <span id="current-step-num">1</span>/' + uncreatedWordsList.length);

        const wordGroup = $('<div>').css('margin-bottom', '10px').append(
            $('<label>').css({ 'font-weight': 'bold', 'display': 'block', 'margin-bottom': '4px', 'font-size': '13px' }).text('தலைப்புச் சொல்:'),
            $('<input>', { type: 'text', id: 'input-word' }).css({ 'width': '100%', 'padding': '7px 10px', 'border': '1px solid #ccc', 'border-radius': '5px', 'box-sizing': 'border-box', 'font-size': '14px' })
        );
        const posGroup = $('<div>').css('margin-bottom', '10px').append(
            $('<label>').css({ 'font-weight': 'bold', 'display': 'block', 'margin-bottom': '4px', 'font-size': '13px' }).text('இலக்கண வகை:'),
            $('<select>', { id: 'select-pos' }).css({ 'width': '100%', 'padding': '7px 10px', 'border': '1px solid #ccc', 'border-radius': '5px', 'font-size': '14px' }).append(
                $('<option>', { value: 'பெயர்ச்சொல்', text: 'பெயர்ச்சொல்' }),
                $('<option>', { value: 'வினைச்சொல்', text: 'வினைச்சொல்' }),
                $('<option>', { value: 'பெயரடை', text: 'பெயரடை' }),
                $('<option>', { value: 'வினையடை', text: 'வினையடை' }),
                $('<option>', { value: 'இடைச்சொல்', text: 'இடைச்சொல்' }),
                $('<option>', { value: 'உரிச்சொல்', text: 'உரிச்சொல்' })
            )
        );
        const meaningGroup = $('<div>').css('margin-bottom', '10px').append(
            $('<label>').css({ 'font-weight': 'bold', 'display': 'block', 'margin-bottom': '4px', 'font-size': '13px' }).text('பொருள்/விளக்கம்:'),
            $('<textarea>', { id: 'input-meaning', rows: 2 }).css({ 'width': '100%', 'padding': '7px 10px', 'border': '1px solid #ccc', 'border-radius': '5px', 'box-sizing': 'border-box', 'font-size': '13px' })
        );
        const catGroup = $('<div>').css('margin-bottom', '10px').append(
            $('<label>').css({ 'font-weight': 'bold', 'display': 'block', 'margin-bottom': '4px', 'font-size': '13px' }).text('பகுப்புகள் (காற்புள்ளியால் பிரிக்கவும்):'),
            $('<input>', { type: 'text', id: 'input-categories', value: 'தமிழ்ச் சொற்கள்' }).css({ 'width': '100%', 'padding': '7px 10px', 'border': '1px solid #ccc', 'border-radius': '5px', 'box-sizing': 'border-box', 'font-size': '13px' })
        );

        function makeSection(labelText, id) {
            return $('<div>').css('margin-bottom', '10px').append(
                $('<label>').css({ 'font-weight': 'bold', 'display': 'block', 'margin-bottom': '4px', 'font-size': '13px' }).text(labelText),
                $('<textarea>', { id, rows: 4 }).css({ 'width': '100%', 'padding': '7px 10px', 'border': '1px solid #ccc', 'border-radius': '5px', 'box-sizing': 'border-box', 'font-size': '12px' })
            );
        }
        const litQuoteGroup     = makeSection('இலக்கிய மேற்கோள் (தானாக நிரப்பப்படும்):', 'input-lit-quote');
        const synonymsGroup     = makeSection('ஒத்த சொற்கள் (விக்சனரி):',    'input-synonyms');
        const loanwordsGroup    = makeSection('பிறமொழிச் சொற்கள் (விக்கித்தரவு):', 'input-loanwords');
        const collocationsGroup = makeSection('சொல்வளம்:',         'input-collocations');

        const fetchBtn = $('<button>',
