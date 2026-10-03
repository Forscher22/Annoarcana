// Lets readers bookmark a comic page. The bookmark is saved in their browser,
// so it works without an account and stays put between visits.
(() => {
  const KEY = "comic-bookmark";
  const box = document.querySelector("[data-bookmark]");
  if (!box) return;

  const here = { url: box.dataset.url, title: box.dataset.title };
  const saveButton = box.querySelector(".bookmark-save");
  const goLink = box.querySelector(".bookmark-go");
  const clearButton = box.querySelector(".bookmark-clear");

  function load() {
    try {
      return JSON.parse(localStorage.getItem(KEY));
    } catch {
      return null;
    }
  }

  function show() {
    const saved = load();
    const onSaved = saved && saved.url === here.url;
    saveButton.textContent = onSaved ? "★ Bookmarked" : "☆ Bookmark this page";
    saveButton.setAttribute("aria-pressed", String(onSaved));
    goLink.hidden = !saved || onSaved;
    if (saved) {
      goLink.href = saved.url;
      goLink.textContent = `Go to bookmark: ${saved.title}`;
    }
    clearButton.hidden = !saved;
  }

  saveButton.addEventListener("click", () => {
    const saved = load();
    if (saved && saved.url === here.url) {
      localStorage.removeItem(KEY);
    } else {
      localStorage.setItem(KEY, JSON.stringify(here));
    }
    show();
  });

  clearButton.addEventListener("click", () => {
    localStorage.removeItem(KEY);
    show();
  });

  show();
})();
