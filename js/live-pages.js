// On the newest page in the site's build, adds "Next" and "Latest" links to
// pages posted in the Studio since then (see lib/live-pages.ts).
(async () => {
  const nav = document.querySelector(".comicNav");
  if (!nav) return;
  let pages;
  try {
    const res = await fetch("/api/live-pages");
    pages = res.ok ? await res.json() : [];
  } catch {
    return;
  }
  if (!pages.length) return;
  const next = pages[0].url;
  const last = pages[pages.length - 1].url;

  function link(url, name, label) {
    const a = document.createElement("a");
    a.href = url;
    a.innerHTML = `<img src="/img/comicnav/nav_${name}.png" alt="" loading="eager"><span>${label}</span>`;
    return a;
  }
  nav.append(link(next, "next", "Next"), link(last, "last", "Latest"));

  // Clicking the page goes on to the next one, as on every other page
  for (const img of document.querySelectorAll("#comicPage > img")) {
    const a = document.createElement("a");
    a.href = next;
    img.replaceWith(a);
    a.append(img);
  }
  document.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowRight" || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (e.target.closest && e.target.closest("input, textarea, select, [contenteditable]")) return;
    window.location.href = next;
  });
})();
