// Script for the /admin/ dashboard. It's bundled by esbuild during the
// Eleventy build (see eleventy.config.js), which is why it can import from npm.
import {
  acceptInvite,
  getUser,
  handleAuthCallback,
  login,
  logout,
  requestPasswordRecovery,
  signup,
  updateUser,
} from "@netlify/identity";

// Requests to the function have to fit under Netlify's 6 MB limit, so bigger
// images are re-saved as high-quality JPEGs before uploading.
const MAX_UPLOAD_BYTES = 4.5 * 1024 * 1024;

const $ = (selector, root = document) => root.querySelector(selector);

function show(view) {
  document.querySelectorAll("[data-view]").forEach((el) => {
    el.hidden = el.dataset.view !== view;
  });
}

function setError(form, message) {
  $(".form-error", form).textContent = message || "";
}

function setBusy(form, busy, label) {
  const button = $("button[type=submit]", form);
  button.disabled = busy;
  if (label) button.textContent = label;
}

function notice(message) {
  const el = $("[data-slot=notice]");
  el.textContent = message;
  el.hidden = !message;
}

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function api(path, options = {}) {
  const res = await fetch(path, { credentials: "same-origin", ...options });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Something went wrong (${res.status}).`);
  return body;
}

// ---------- Auth ----------

let pendingInviteToken = null;

async function start() {
  try {
    const result = await handleAuthCallback();
    if (result?.type === "invite") {
      pendingInviteToken = result.token;
      $("[data-slot=password-heading]").textContent = "Welcome! Choose a password";
      history.replaceState(null, "", location.pathname);
      return show("set-password");
    }
    if (result?.type === "recovery") {
      $("[data-slot=password-heading]").textContent = "Choose a new password";
      history.replaceState(null, "", location.pathname);
      return show("set-password");
    }
  } catch (error) {
    console.error(error);
  }
  await enter();
}

async function enter() {
  const user = await getUser();
  const session = $(".studio-session");
  if (!user) {
    session.hidden = true;
    return show("login");
  }
  session.hidden = false;
  $(".studio-user").textContent = user.email;
  if (!user.roles?.includes("admin")) return show("no-role");
  show("dashboard");
  await Promise.all([loadPages(), loadComments()]);
}

$("[data-form=login]").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  setError(form);
  setBusy(form, true, "Logging in…");
  try {
    await login(form.email.value, form.password.value);
    form.reset();
    await enter();
  } catch (error) {
    setError(form, error.status === 401 ? "That email and password don't match." : error.message);
  } finally {
    setBusy(form, false, "Log in");
  }
});

$("[data-action=show-signup]").addEventListener("click", () => show("signup"));
$("[data-action=show-login]").addEventListener("click", () => show("login"));

$("[data-form=signup]").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  setError(form);
  setBusy(form, true, "Creating…");
  try {
    const user = await signup(form.email.value, form.password.value);
    if (user.confirmedAt) {
      form.reset();
      return await enter();
    }
    $("[data-slot=signup-email]").textContent = form.email.value;
    form.reset();
    show("check-email");
  } catch (error) {
    // The identity function turns away emails that aren't on the admin list
    setError(
      form,
      error.status === 401 || error.status === 403
        ? "That email isn't set up as an admin for this comic."
        : error.status === 422
          ? "That email already has an account. Try logging in instead."
          : error.message,
    );
  } finally {
    setBusy(form, false, "Create account");
  }
});

$("[data-action=forgot]").addEventListener("click", async () => {
  const form = $("[data-form=login]");
  const email = form.email.value;
  if (!email) return setError(form, "Type your email above first, then click here again.");
  try {
    await requestPasswordRecovery(email);
    setError(form, "Check your email for a link to reset your password.");
  } catch (error) {
    setError(form, error.message);
  }
});

$("[data-form=set-password]").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  setError(form);
  setBusy(form, true, "Saving…");
  try {
    if (pendingInviteToken) {
      await acceptInvite(pendingInviteToken, form.password.value);
      pendingInviteToken = null;
    } else {
      await updateUser({ password: form.password.value });
    }
    form.reset();
    await enter();
  } catch (error) {
    setError(form, error.message);
  } finally {
    setBusy(form, false, "Save password");
  }
});

$("[data-action=logout]").addEventListener("click", async () => {
  await logout().catch(() => {});
  await enter();
});

// ---------- Pages ----------

async function loadPages() {
  const list = $("[data-slot=pages]");
  list.innerHTML = '<li class="page-skeleton"></li>'.repeat(4);

  try {
    const [dashboard, published] = await Promise.all([
      api("/api/comic-pages"),
      fetch("/comic-index.json").then((r) => (r.ok ? r.json() : [])).catch(() => []),
    ]);
    renderPages(dashboard, published);
  } catch (error) {
    list.innerHTML = "";
    notice(error.message);
  }
}

function renderPages({ pages, buildHookConfigured }, published) {
  const publishedNumbers = new Set(published.map((p) => p.number));
  const pending = pages
    .filter((p) => !publishedNumbers.has(p.pageNumber))
    .map((p) => ({
      number: p.pageNumber,
      title: p.title,
      chapter: p.chapter,
      date: p.postedOn,
      image: `/comic-uploads/${p.imageKey}`,
      source: "dashboard",
      id: p.id,
      pending: true,
    }));
  const all = [...published, ...pending].sort((a, b) => a.number - b.number);

  // Suggest the next page number and the latest chapter for the upload form
  const form = $("[data-form=upload]");
  const last = all[all.length - 1];
  form.pageNumber.value = last ? last.number + 1 : 1;
  form.chapter.value = last ? last.chapter : 1;
  if (!form.postedOn.value) form.postedOn.value = today();

  const publishButton = $("[data-action=publish]");
  publishButton.hidden = !buildHookConfigured;
  if (!buildHookConfigured) {
    notice(
      "Automatic publishing isn't set up yet, so new pages appear after the site's next deploy. " +
        "To publish right away, add a build hook (see the setup notes).",
    );
  } else if (pending.length) {
    notice(`${pending.length} page${pending.length > 1 ? "s are" : " is"} on the way to the site. Publishing takes a minute or two.`);
  } else {
    notice("");
  }

  const list = $("[data-slot=pages]");
  list.innerHTML = "";
  if (!all.length) {
    list.innerHTML = '<li class="page-empty">No pages yet. Post your first one!</li>';
    return;
  }

  // Newest first, so the page you just posted is at the top
  for (const page of all.reverse()) {
    const item = document.createElement("li");
    item.className = "page-item" + (page.pending ? " is-pending" : "");
    item.innerHTML = `
      <img src="${page.image}" alt="" loading="lazy" width="60">
      <div class="page-meta">
        <strong></strong>
        <span class="page-sub"></span>
      </div>
      <div class="page-actions"></div>`;
    $("strong", item).textContent = page.title || `Page ${String(page.number).padStart(2, "0")}`;
    $(".page-sub", item).textContent =
      `Page ${page.number} · Chapter ${page.chapter} · ${page.date}` +
      (page.pending ? " · publishing…" : "");

    const actions = $(".page-actions", item);
    if (!page.pending) {
      const notes = document.createElement("button");
      notes.type = "button";
      notes.className = "link-button";
      notes.textContent = "Notes";
      notes.addEventListener("click", () => openNotes(page));
      actions.append(notes);
    }
    if (page.url) {
      const view = document.createElement("a");
      view.href = page.url;
      view.textContent = "View";
      actions.append(view);
    }
    if (page.source === "dashboard") {
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "link-button danger";
      remove.textContent = "Delete";
      remove.addEventListener("click", () => deletePage(page));
      actions.append(remove);
    } else {
      const tag = document.createElement("span");
      tag.className = "page-tag";
      tag.title = "This page is a file in the site's code, so it can't be deleted here.";
      tag.textContent = "file";
      actions.append(tag);
    }
    list.append(item);
  }
}

// ---------- Author notes ----------

const notesDialog = $("[data-slot=notes-dialog]");
const notesForm = $("[data-form=notes]");
let notesPage = null;

async function openNotes(page) {
  notesPage = page;
  setError(notesForm);
  $("[data-slot=notes-heading]").textContent = `Author notes for ${page.title || `Page ${page.number}`}`;
  notesForm.notes.value = "";
  notesForm.notes.disabled = true;
  notesDialog.showModal();
  try {
    const { notes } = await api(`/api/page-notes/${page.number}`);
    // Pages that are files may already have notes written in the file
    notesForm.notes.value = notes ?? "";
    if (notes === null && page.source === "file") {
      notesForm.notes.placeholder = "Any notes already in this page's file show until you save new ones here.";
    }
  } catch (error) {
    setError(notesForm, error.message);
  } finally {
    notesForm.notes.disabled = false;
    notesForm.notes.focus();
  }
}

$("[data-action=close-notes]").addEventListener("click", () => notesDialog.close());

notesForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setError(notesForm);
  setBusy(notesForm, true, "Saving…");
  try {
    const { rebuilding } = await api(`/api/page-notes/${notesPage.number}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: notesForm.notes.value }),
    });
    notesDialog.close();
    notice(
      rebuilding
        ? `Notes saved for page ${notesPage.number}. The site updates in a minute or two.`
        : `Notes saved for page ${notesPage.number}. They appear on the site after the next deploy.`,
    );
  } catch (error) {
    setError(notesForm, error.message);
  } finally {
    setBusy(notesForm, false, "Save notes");
  }
});

// ---------- Comments ----------

async function loadComments() {
  const list = $("[data-slot=comments]");
  list.innerHTML = '<li class="page-skeleton"></li>'.repeat(2);
  try {
    const { comments } = await api("/api/comments?recent");
    list.innerHTML = "";
    if (!comments.length) {
      list.innerHTML = '<li class="page-empty">No comments yet.</li>';
      return;
    }
    for (const comment of comments) {
      const item = document.createElement("li");
      item.className = "studio-comment";
      item.innerHTML = `
        <p class="studio-comment-meta"><strong></strong> on <a></a> · <time></time></p>
        <p class="studio-comment-body"></p>
        <button type="button" class="link-button danger">Delete</button>`;
      $("strong", item).textContent = comment.name + (comment.isAuthor ? " (you)" : "");
      const link = $("a", item);
      link.href = `/comic/${String(comment.pageNumber).padStart(2, "0")}/#comments-heading`;
      link.textContent = `Page ${comment.pageNumber}`;
      $("time", item).textContent = new Date(comment.createdAt).toLocaleString();
      $(".studio-comment-body", item).textContent = comment.body;
      $("button", item).addEventListener("click", async () => {
        if (!confirm(`Delete this comment from ${comment.name}?`)) return;
        try {
          await api(`/api/comments/${comment.id}`, { method: "DELETE" });
          item.remove();
        } catch (error) {
          notice(error.message);
        }
      });
      list.append(item);
    }
  } catch (error) {
    list.innerHTML = "";
    notice(error.message);
  }
}

async function deletePage(page) {
  const name = page.title || `Page ${page.number}`;
  if (!confirm(`Delete "${name}"? This can't be undone.`)) return;
  try {
    await api(`/api/comic-pages/${page.id}`, { method: "DELETE" });
    await loadPages();
  } catch (error) {
    notice(error.message);
  }
}

$("[data-action=publish]").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  button.disabled = true;
  try {
    await api("/api/publish", { method: "POST" });
    notice("Publishing! The site updates in a minute or two.");
  } catch (error) {
    notice(error.message);
  } finally {
    button.disabled = false;
  }
});

// ---------- Upload ----------

const uploadForm = $("[data-form=upload]");
const preview = $(".drop-preview");

uploadForm.image.addEventListener("change", () => {
  const file = uploadForm.image.files[0];
  if (preview.src) URL.revokeObjectURL(preview.src);
  preview.hidden = !file;
  uploadForm.classList.toggle("has-image", Boolean(file));
  if (file) preview.src = URL.createObjectURL(file);
});

async function shrinkIfNeeded(file) {
  if (file.size <= MAX_UPLOAD_BYTES) return file;
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0);
  for (const quality of [0.92, 0.85, 0.75]) {
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (blob.size <= MAX_UPLOAD_BYTES) {
      return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" });
    }
  }
  throw new Error("That image is too large to upload. Try exporting it at a smaller size.");
}

uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setError(uploadForm);
  setBusy(uploadForm, true, "Posting…");
  try {
    const data = new FormData(uploadForm);
    data.set("image", await shrinkIfNeeded(uploadForm.image.files[0]));
    const { page, rebuilding } = await api("/api/comic-pages", { method: "POST", body: data });

    uploadForm.reset();
    preview.hidden = true;
    uploadForm.classList.remove("has-image");
    uploadForm.postedOn.value = today();
    await loadPages();
    notice(
      rebuilding
        ? `Page ${page.pageNumber} posted! The site updates in a minute or two.`
        : `Page ${page.pageNumber} saved. It appears on the site after the next deploy.`,
    );
  } catch (error) {
    setError(uploadForm, error.message);
  } finally {
    setBusy(uploadForm, false, "Post page");
  }
});

start();
