from pathlib import Path
import re

src_path = Path("/mnt/data/Wiktionar tool level 11.js")
src = src_path.read_text(encoding="utf-8")

# Replace the previous broad search function with a source-aware literature citation search.
start = src.index("    // ---------------- மேம்படுத்தப்பட்ட இணையத் தேடல் நுட்பம் ----------------")
end = src.index("    // ---------------- இயக்க நிலை (State) ----------------", start)

new_fetch = r'''    // ---------------- இலக்கிய மேற்கோள் தேடல் ----------------
    // Search Tamil Wikisource, then fetch page extracts so users can select
    // actual text rather than copying search-result snippets.
    async function fetchLiteraryReferences(word) {
        const api = new mw.ForeignApi('https://ta.wikisource.org/w/api.php');
        const searchRes = await api.get({
            action: 'query',
            list: 'search',
            srsearch: '"' + word + '"',
            srnamespace: 0,
            srlimit: 10,
            srprop: 'snippet|titlesnippet',
            formatversion: 2
        });

        const hits = (searchRes && searchRes.query && searchRes.query.search) || [];
        const results = [];

        for (const hit of hits) {
            try {
                const pageRes = await api.get({
                    action: 'query',
                    prop: 'extracts',
                    exintro: false,
                    explaintext: true,
                    exsectionformat: 'plain',
                    titles: hit.title,
                    formatversion: 2
                });
                const page = pageRes && pageRes.query && pageRes.query.pages &&
                    pageRes.query.pages[0];
                const extract = page && page.extract ? page.extract : '';
                if (!extract) continue;

                const normalizedWord = normalizeWord(word);
                const cleanExtract = extract.replace(/\r/g, '').trim();
                const lines = cleanExtract.split(/\n+/).map(s => s.trim()).filter(Boolean);
                let matchedLine = lines.find(line => line.includes(normalizedWord));
                if (!matchedLine) {
                    const idx = cleanExtract.indexOf(normalizedWord);
                    if (idx >= 0) {
                        matchedLine = cleanExtract.slice(Math.max(0, idx - 180),
                            Math.min(cleanExtract.length, idx + normalizedWord.length + 220)).trim();
                    }
                }
                if (!matchedLine) continue;

                results.push({
                    title: hit.title,
                    text: matchedLine,
                    url: 'https://ta.wikisource.org/wiki/' + encodeURIComponent(hit.title.replace(/ /g, '_')),
                    snippet: (hit.snippet || '').replace(/<[^>]+>/g, '').trim()
                });
            } catch (e) {
                console.warn('Literary page extraction failed:', hit.title, e);
            }
        }

        return results;
    }

    async function fetchReferencesEnhanced(word, meaning) {
        const refs = { litQuote: '', synonyms: '', loanwords: '', collocations: '' };

        try {
            const citations = await fetchLiteraryReferences(word);
            refs.citations = citations;
            refs.litQuote = citations.length
                ? citations.map(c => '* "' + c.text + '" — [[' + SOURCE_LANG + ':s:' +
                    c.title + '|' + c.title + ']] ([மூலம்](' + c.url + '))').join('\n')
                : '';
        } catch (e) {
            console.warn('Wikisource literary search failed', e);
        }

        // Wikidata: collect possible related-language Wiktionary links.
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
                const e = ent.entities && ent.entities[entityId];
                const langsMap = {
                    en: 'ஆங்கிலம்', sa: 'சமஸ்கிருதம்', te: 'தெலுங்கு',
                    kn: 'கன்னடம்', ml: 'மலையாளம்', hi: 'இந்தி'
                };
                const found = [];
                for (const l in langsMap) {
                    if (e && e.sitelinks && e.sitelinks[l + 'wiktionary']) {
                        const title = e.sitelinks[l + 'wiktionary'].title;
                        found.push('* ' + langsMap[l] + ': [https://' + l +
                            '.wiktionary.org/wiki/' + encodeURIComponent(title) + ' ' + title + ']');
                    }
                }
                if (found.length) refs.loanwords = found.join('\n');
            }
        } catch (e) {
            console.warn('Wikidata search failed', e);
        }

        // Search the Tamil Wiktionary for related pages; do not label these as verified synonyms.
        try {
            const wtApi = new mw.ForeignApi('https://ta.wiktionary.org/w/api.php');
            const wtRes = await wtApi.get({
                action: 'query', list: 'search', srsearch: word,
                srlimit: 5, formatversion: 2
            });
            const hits = (wtRes && wtRes.query && wtRes.query.search) || [];
            const related = hits.map(h => h.title).filter(t => t !== word).slice(0, 4);
            if (related.length) {
                refs.synonyms = related.map(t => '* [[' + t + ']]').join('\n');
                refs.collocations = related.slice(0, 3)
                    .map(t => '* தொடர்புடைய பதிவு: [[' + t + ']]').join('\n');
            }
        } catch (e) {
            console.warn('Wiktionary related-page search failed', e);
        }

        if (!refs.litQuote) refs.litQuote = '* {{மேற்கோள் தேவை}}';
        if (!refs.synonyms) refs.synonyms = '* {{விரிவாக்கம் தேவை}}';
        if (!refs.loanwords) refs.loanwords = '* {{விரிவாக்கம் தேவை}}';
        if (!refs.collocations) refs.collocations = '* {{விரிவாக்கம் தேவை}}';
        return refs;
    }

'''
src = src[:start] + new_fetch + src[end:]

# Add a citation selection panel between the fetch button and preview.
needle = "        const previewDetails = $('<details>', { open: true }).css({"
panel = r'''        const citationResultsPanel = $('<div>', { id: 'citation-results-panel' }).css({
            'display': 'none', 'border': '1px solid #c8ccd1', 'border-radius': '6px',
            'padding': '10px', 'margin-bottom': '12px', 'background': '#f8f9fa'
        });
        const citationResultsTitle = $('<div>').text('கிடைத்த இலக்கியச் சான்றுகள் — தேவையானவற்றைத் தேர்ந்தெடுக்கவும்')
            .css({ 'font-weight': 'bold', 'margin-bottom': '8px', 'font-size': '13px' });
        const citationResultsList = $('<div>', { id: 'citation-results-list' });
        const insertCitationsBtn = $('<button>', { type: 'button', text: 'தேர்ந்தெடுத்த மேற்கோள்களைச் சேர்க்கவும்' })
            .css({
                'margin-top': '8px', 'padding': '7px 12px', 'background': '#14866d',
                'color': '#fff', 'border': '0', 'border-radius': '5px', 'cursor': 'pointer'
            });
        citationResultsPanel.append(citationResultsTitle, citationResultsList, insertCitationsBtn);

        function renderCitationResults(citations) {
            citationResultsList.empty();
            if (!citations || !citations.length) {
                citationResultsList.append($('<p>').text(
                    'பொருத்தமான உரை கிடைக்கவில்லை. வேறு சொல்லுருவை முயற்சிக்கவும் அல்லது மூல நூலை நேரடியாகச் சரிபார்க்கவும்.'
                ));
                citationResultsPanel.show();
                return;
            }
            citations.forEach(function (citation, index) {
                const checkbox = $('<input>', {
                    type: 'checkbox',
                    class: 'literary-citation-checkbox',
                    value: String(index)
                }).css({ 'margin-right': '7px', 'vertical-align': 'top' });
                const title = $('<strong>').text(citation.title);
                const text = $('<div>').text(citation.text).css({
                    'margin': '5px 0', 'white-space': 'pre-wrap', 'line-height': '1.6'
                });
                const link = $('<a>', {
                    href: citation.url, target: '_blank', rel: 'noopener noreferrer',
                    text: 'மூலப் பக்கத்தைத் திற'
                }).css({ 'font-size': '12px' });
                const item = $('<div>').css({
                    'padding': '8px 4px', 'border-bottom': '1px solid #eaecf0'
                }).append(checkbox, title, text, link);
                citationResultsList.append(item);
            });
            citationResultsPanel.show();
        }

        insertCitationsBtn.on('click', function () {
            const citations = window.__wiktLiteraryCitations || [];
            const selected = citationResultsList.find('.literary-citation-checkbox:checked')
                .map(function () { return citations[Number(this.value)]; }).get().filter(Boolean);
            if (!selected.length) {
                alert('முதலில் குறைந்தது ஒரு மேற்கோளைத் தேர்ந்தெடுக்கவும்.');
                return;
            }
            const lines = selected.map(function (c) {
                return '* "' + c.text + '" — [[' + SOURCE_LANG + ':s:' + c.title +
                    '|' + c.title + ']] ([மூலம்](' + c.url + '))';
            });
            const current = $('#input-lit-quote').val().trim();
            const placeholder = '* {{மேற்கோள் தேவை}}';
            $('#input-lit-quote').val(
                (!current || current === placeholder) ? lines.join('\n') : current + '\n' + lines.join('\n')
            );
            updatePreviewText();
            $('#status-msg').text('தேர்ந்தெடுத்த மேற்கோள்கள் சேர்க்கப்பட்டன. சேமிப்பதற்கு முன் மூலத்தைச் சரிபார்க்கவும்.')
                .css('color', '#14866d');
        });

'''
src = src.replace(needle, panel + needle)

# Include panel in modal before preview.
src = src.replace(
    "            litQuoteGroup, synonymsGroup, loanwordsGroup, collocationsGroup,\n            fetchBtn, previewDetails, btnGroup, statusMsg);",
    "            litQuoteGroup, synonymsGroup, loanwordsGroup, collocationsGroup,\n            fetchBtn, citationResultsPanel, previewDetails, btnGroup, statusMsg);"
)

# Replace fetch click handler to show selectable literary results and still fill auxiliary fields.
old = r'''                const refs = await fetchReferencesEnhanced(w, m);
                currentExtras = refs;
                $('#input-lit-quote').val(refs.litQuote);
                $('#input-synonyms').val(refs.synonyms);
                $('#input-loanwords').val(refs.loanwords);
                $('#input-collocations').val(refs.collocations);
                updatePreviewText();'''
new = r'''                const refs = await fetchReferencesEnhanced(w, m);
                currentExtras = refs;
                window.__wiktLiteraryCitations = refs.citations || [];
                renderCitationResults(window.__wiktLiteraryCitations);
                if (!refs.citations || !refs.citations.length) {
                    $('#input-lit-quote').val(refs.litQuote);
                }
                $('#input-synonyms').val(refs.synonyms);
                $('#input-loanwords').val(refs.loanwords);
                $('#input-collocations').val(refs.collocations);
                updatePreviewText();'''
if old not in src:
    raise RuntimeError("Could not find the expected fetch button handler to patch.")
src = src.replace(old, new)

# Add clearer note to the fetch button title/text.
src = src.replace(
    '<span>இணைய சான்றுகள் & பிற தகவல்களைத் தேடு</span>',
    '<span>இலக்கிய மேற்கோள்களைத் தேடு</span>'
)

out = Path("/mnt/data/Wiktionary_Literary_Citation_Search.js")
out.write_text(src, encoding="utf-8")
print(f"Created {out.name} ({len(src.splitlines())} lines, {out.stat().st_size} bytes).")
