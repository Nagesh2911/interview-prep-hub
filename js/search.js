/* Search: every word must appear somewhere in the question
   (subject, question, answer, key points or code). Matches are highlighted. */
(function (IPH) {
  "use strict";

  const haystacks = new WeakMap();

  function terms(query) {
    return String(query || "").toLowerCase().trim().split(/\s+/).filter(Boolean);
  }

  function haystack(q) {
    let text = haystacks.get(q);
    if (!text) {
      text = [q.subject, q.question, q.answer, q.points.join(" "), q.code].join(" ").toLowerCase();
      haystacks.set(q, text);
    }
    return text;
  }

  function matches(q, searchTerms) {
    if (!searchTerms.length) return true;
    const text = haystack(q);
    return searchTerms.every(term => text.includes(term));
  }

  // Escape the text and wrap every search term in <mark>.
  function highlight(text, searchTerms) {
    const value = String(text);
    if (!searchTerms || !searchTerms.length) return IPH.esc(value);

    const lower = value.toLowerCase();
    const ranges = [];
    searchTerms.forEach(term => {
      let from = 0;
      let at;
      while ((at = lower.indexOf(term, from)) !== -1) {
        ranges.push([at, at + term.length]);
        from = at + term.length;
      }
    });
    if (!ranges.length) return IPH.esc(value);

    ranges.sort((a, b) => a[0] - b[0]);
    const merged = [ranges[0]];
    ranges.slice(1).forEach(([start, end]) => {
      const last = merged[merged.length - 1];
      if (start <= last[1]) last[1] = Math.max(last[1], end);
      else merged.push([start, end]);
    });

    let html = "";
    let pos = 0;
    merged.forEach(([start, end]) => {
      html += IPH.esc(value.slice(pos, start)) + "<mark>" + IPH.esc(value.slice(start, end)) + "</mark>";
      pos = end;
    });
    return html + IPH.esc(value.slice(pos));
  }

  IPH.search = { terms, matches, highlight };
})(window.IPH = window.IPH || {});
