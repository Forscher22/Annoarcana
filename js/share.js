// "Copy link" under each comic page. On phones that have a share sheet, the
// button opens it instead (which also offers copying).
(() => {
  for (const button of document.querySelectorAll("[data-share-url]")) {
    const url = button.dataset.shareUrl;
    const title = button.dataset.shareTitle;
    const label = button.textContent;
    const canShare = typeof navigator.share === "function" && matchMedia("(pointer: coarse)").matches;
    if (canShare) button.textContent = "Share…";

    button.addEventListener("click", async () => {
      if (canShare) {
        try {
          await navigator.share({ title, url });
        } catch {
          // Closing the share sheet isn't an error worth showing
        }
        return;
      }
      try {
        await navigator.clipboard.writeText(url);
        button.textContent = "Copied!";
      } catch {
        // No clipboard access (e.g. an insecure context): show the link to copy by hand
        window.prompt("Copy this link:", url);
      }
      setTimeout(() => (button.textContent = label), 2000);
    });
  }
})();
