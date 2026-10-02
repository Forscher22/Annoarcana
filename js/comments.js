/**
 * Loads and posts reader comments for the comic page shown on screen.
 * Comments are stored in Netlify Database through /api/comments.
 */
(function () {
  const section = document.querySelector("[data-comments]");
  if (!section) return;

  const page = section.dataset.page;
  const list = section.querySelector("[data-comments-list]");
  const count = section.querySelector("[data-comments-count]");
  const form = section.querySelector("[data-comments-form]");
  const error = section.querySelector("[data-comments-error]");
  const button = form.querySelector("button[type=submit]");

  // Remember the reader's name for next time
  const savedName = localStorage.getItem("comment-name");
  if (savedName) form.name.value = savedName;

  const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

  function renderComment(comment) {
    const item = document.createElement("li");
    item.className = "comment" + (comment.isAuthor ? " comment-author" : "");

    const header = document.createElement("p");
    header.className = "comment-meta";
    const name = document.createElement("strong");
    name.textContent = comment.name;
    header.append(name);
    if (comment.isAuthor) {
      const badge = document.createElement("span");
      badge.className = "comment-badge";
      badge.textContent = "Author";
      header.append(" ", badge);
    }
    const time = document.createElement("time");
    time.dateTime = comment.createdAt;
    time.textContent = dateFormat.format(new Date(comment.createdAt));
    header.append(" ", time);

    const body = document.createElement("p");
    body.className = "comment-body";
    body.textContent = comment.body;

    item.append(header, body);
    return item;
  }

  function setCount(n) {
    count.textContent = n ? `(${n})` : "";
  }

  function showStatus(message) {
    list.innerHTML = "";
    const item = document.createElement("li");
    item.className = "comments-status";
    item.textContent = message;
    list.append(item);
  }

  async function load() {
    try {
      const res = await fetch(`/api/comments?page=${encodeURIComponent(page)}`);
      if (!res.ok) throw new Error();
      const { comments } = await res.json();
      setCount(comments.length);
      if (!comments.length) return showStatus("No comments yet. Be the first!");
      list.innerHTML = "";
      comments.forEach((c) => list.append(renderComment(c)));
    } catch {
      showStatus("Comments couldn't be loaded right now.");
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    error.textContent = "";
    button.disabled = true;
    button.textContent = "Posting…";
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page,
          name: form.name.value,
          body: form.body.value,
          website: form.website.value,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Your comment couldn't be posted. Please try again.");

      localStorage.setItem("comment-name", form.name.value.trim());
      form.body.value = "";
      if (data.comment) {
        if (list.querySelector(".comments-status")) list.innerHTML = "";
        const item = renderComment(data.comment);
        item.classList.add("comment-new");
        list.append(item);
        setCount(list.querySelectorAll(".comment").length);
      }
    } catch (e) {
      error.textContent = e.message;
    } finally {
      button.disabled = false;
      button.textContent = "Post comment";
    }
  });

  load();
})();
