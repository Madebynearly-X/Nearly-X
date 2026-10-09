(() => {
  "use strict";

  const form = document.querySelector("[data-form]");
  if (!form) return;

  const submit = form.querySelector('button[type="submit"]');
  const summary = form.querySelector("[data-error-summary]");
  const list = form.querySelector("[data-error-list]");
  const live = form.querySelector("[data-live]");
  const success = form.querySelector("[data-form-success]");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!form.reportValidity()) return;

    if (summary && list) {
      list.replaceChildren();
      summary.hidden = true;
    }
    if (success) success.hidden = true;

    const previousLabel = submit.textContent;
    submit.disabled = true;
    submit.textContent = "Sending…";

    try {
      const response = await fetch(form.action, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(new FormData(form))),
      });
      let result;
      try {
        result = await response.json();
      } catch {
        throw new Error("We couldn't confirm delivery. Please try again or email us directly.");
      }

      if (!response.ok || result.success !== true) {
        throw new Error(result.message || "We couldn't send your enquiry. Please try again.");
      }

      form.reset();
      if (success) {
        success.hidden = false;
        success.focus();
      }
      if (live) live.textContent = "Your enquiry was accepted for delivery.";
    } catch (error) {
      const message = error instanceof Error && error.name === "Error"
        ? error.message
        : "We couldn't confirm your enquiry was sent. Please try again or email us directly.";

      if (summary && list) {
        const item = document.createElement("li");
        item.textContent = message;
        list.append(item);
        summary.hidden = false;
        summary.focus();
      }
      if (live) live.textContent = message;
    } finally {
      submit.disabled = false;
      submit.textContent = previousLabel;
    }
  });
})();
