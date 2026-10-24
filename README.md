# Wikisource-to-Wiktionary

**A Tamil Literary Reference Search and Wiktionary Page Creation Tool**

Wikisource-to-Wiktionary is a JavaScript-based tool designed to streamline the process of creating Tamil Wiktionary entries using word data extracted from Tamil Wikisource. It helps contributors identify words that do not yet have Wiktionary pages, search for relevant information, review the generated wikitext, and create dictionary entries through an interactive interface.

## 🎯 Project Objectives

- Identify Tamil headwords from Wikisource pages.
- Check whether corresponding entries already exist on Tamil Wiktionary.
- Assist contributors in preparing structured dictionary entries.
- Search for literary references associated with a Tamil word.
- Provide an editable wikitext preview before publishing.
- Reduce repetitive work involved in creating Tamil dictionary entries.

## ✨ Key Features

### 1. Headword Extraction
Extracts Tamil words from the current Wikisource page and prepares them for further processing.

### 2. Existing Page Detection
Checks Tamil Wiktionary to identify words that may need new dictionary entries.

### 3. Literary Reference Search
Provides a framework for searching Tamil Wikisource for text containing a target word. The aim is to help contributors find relevant literary passages and incorporate verified quotations into dictionary entries.

Potential source collections include:

- **திருக்குறள்** and other ethical literature
- **எட்டுத்தொகை** (Eight Anthologies)
- **பத்துப்பாட்டு** (Ten Idylls)
- Tamil epics and devotional literature
- Modern Tamil poetry, short stories, novels, and other literary works

The availability and completeness of searchable texts depend on the source collections and their digital content.

### 4. Selectable Quotations
The literary-reference workflow is intended to let contributors inspect search results, select relevant passages, and add them to the literary quotation section of a Wiktionary entry.

Contributors should verify the quotation against the original text, including the work's title, passage, and source link, before publishing.

### 5. Structured Wiktionary Entry
Generates editable wikitext containing sections such as:

- Meaning
- Grammatical category
- Other forms
- Literary quotations
- Related words
- Other-language information
- Word usage and related expressions
- References and categories

### 6. Preview and Publishing
Allows contributors to review and edit the generated wikitext before creating a page on Tamil Wiktionary.

## 🔄 Workflow

1. Open a suitable Tamil Wikisource page.
2. Start the Wikisource-to-Wiktionary tool.
3. Extract headwords from the page.
4. Check which words do not yet have Wiktionary entries.
5. Review a word's meaning and grammatical category.
6. Search for literary references and related information.
7. Select and verify appropriate quotations.
8. Review the generated wikitext.
9. Create the Wiktionary entry after final verification.

## 🛠️ Technologies

- JavaScript
- MediaWiki JavaScript environment
- MediaWiki API
- jQuery
- Wikisource and Wiktionary APIs
- Wikidata API for supplementary language-related information

## 📚 Wikimedia Projects

- [Tamil Wikisource](https://ta.wikisource.org/)
- [Tamil Wiktionary](https://ta.wiktionary.org/)
- [Wikidata](https://www.wikidata.org/)

## 🚀 Installation

The tool is intended to run within a compatible MediaWiki user-script environment.

1. Open your Tamil Wikisource user JavaScript page:  
   https://ta.wikisource.org/wiki/Special:MyPage/common.js
2. Add the required tool script to your user JavaScript configuration.
3. Save the page and reload Wikisource.
4. Sign in to your Wikimedia account and try the tool on a suitable page.
5. Review all generated content before publishing it to Wiktionary.

Installation instructions may need adjustment if the script's dependencies or interface change.

## ✅ Editorial Principles

Literary quotations are valuable evidence for a dictionary entry, but search results alone do not establish that a passage is an accurate or appropriate citation.

Contributors should:

- Confirm that the searched word actually occurs in the selected passage.
- Preserve the original wording of the literary text.
- Record the work title and the most specific available location, such as the verse or chapter number.
- Include a source link whenever available.
- Avoid treating search snippets, unrelated pages, or automatically generated text as verified quotations.
- Check copyright and Wikimedia policies when using modern literary works.

## 🤝 Contributing

Contributions, testing, feedback, and improvements are welcome. Developers and Tamil-language contributors can help improve search accuracy, source coverage, quotation selection, and the quality of
