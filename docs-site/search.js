const form = document.querySelector('#site-search');
const queryInput = document.querySelector('#search-query');
const resultList = document.querySelector('#search-results');

if (form && queryInput && resultList) {
  let entriesPromise;
  const loadEntries = () => {
    entriesPromise ??= fetch('./search-index.json', { credentials: 'same-origin' })
      .then(response => {
        if (!response.ok) throw new Error('Search index unavailable.');
        return response.json();
      });
    return entriesPromise;
  };

  form.addEventListener('submit', async event => {
    event.preventDefault();
    resultList.replaceChildren();
    const query = queryInput.value.trim().toLocaleLowerCase();
    if (!query) {
      resultList.hidden = true;
      return;
    }
    try {
      const entries = await loadEntries();
      const matches = entries.filter(entry =>
        `${entry.title} ${entry.description} ${entry.content}`.toLocaleLowerCase().includes(query)
      ).slice(0, 8);
      for (const entry of matches) {
        const item = document.createElement('li');
        const link = document.createElement('a');
        link.href = entry.url;
        link.textContent = entry.title;
        const description = document.createElement('span');
        description.textContent = entry.description;
        item.append(link, description);
        resultList.append(item);
      }
      if (!matches.length) {
        const item = document.createElement('li');
        item.textContent = 'No matching pages.';
        resultList.append(item);
      }
      resultList.hidden = false;
    } catch {
      resultList.hidden = false;
      const item = document.createElement('li');
      item.textContent = 'Search is unavailable. Browse the documentation links instead.';
      resultList.append(item);
    }
  });
}
