(() => {
  "use strict";
  const $ = (selector, context = document) => context.querySelector(selector);
  const $$ = (selector, context = document) => [...context.querySelectorAll(selector)];
  const notice = $("#notice");
  let currentSettings;
  let adobeExpressConfig;
  let adobeSdkPromise;
  let adobeInstancePromise;
  const platformIcons = {
    instagram: { icon: "instagram", className: "instagram" },
    facebook: { icon: "facebook", className: "facebook" },
    linkedin: { icon: "linkedin", className: "linkedin" },
    tiktok: { icon: "tiktok", className: "tiktok" },
    canva: { icon: "canva", className: "canva" },
    "adobe express": { icon: "adobe", className: "adobe" },
  };

  function platformIcon(platform) {
    const details = platformIcons[String(platform).toLowerCase()];
    if (!details) return '<svg class="icon" aria-hidden="true"><use href="#icon-integrations"></use></svg>';
    return `<svg class="platform-icon ${details.className}" aria-hidden="true"><use href="#icon-${details.icon}"></use></svg>`;
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
    })[character]);
  }

  async function api(path, options = {}) {
    const response = await fetch(path, {
      ...options,
      headers: { "Content-Type": "application/json", ...options.headers },
      cache: "no-store",
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || `Request failed with HTTP ${response.status}.`);
    return body;
  }

  function showNotice(message, isError = false) {
    notice.textContent = message;
    notice.hidden = false;
    notice.classList.toggle("error", isError);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function showEmpty(container, message) {
    container.innerHTML = `<p class="empty">${escapeHtml(message)}</p>`;
  }

  function setPage(page) {
    $$(".page").forEach((element) => element.classList.toggle("visible", element.id === `page-${page}`));
    $$(".nav-item").forEach((element) => element.classList.toggle("active", element.dataset.page === page));
    $("#page-title").textContent = ({ studio: "Content Studio", calendar: "Calendar", integrations: "Integrations", settings: "Settings", activity: "Activity Log" })[page] || "Overview";
    if (page === "studio" || page === "calendar") loadContent();
    if (page === "integrations") loadIntegrations();
    if (page === "activity") loadActivity();
  }

  async function loadContent() {
    const container = $("#content-list");
    const calendar = $("#calendar-list");
    try {
      const { items } = await api("/api/content");
      $("#overview-content-count").textContent = items.length ? `${items.length} saved item${items.length === 1 ? "" : "s"}` : "No content yet";
      const cards = items.map((item) => {
        const flags = JSON.parse(item.quality_flags_json || "[]");
        const controls = [];
        if (item.status === "draft" || item.status === "rejected") controls.push(`<button data-edit="${escapeHtml(item.id)}">Edit draft</button>`);
        if (item.status === "draft" && flags.length === 0) controls.push(`<button data-transition="pending_approval" data-id="${escapeHtml(item.id)}">Submit for review</button>`);
        if (item.status === "pending_approval") controls.push(`<button data-transition="approved" data-id="${escapeHtml(item.id)}">Approve</button><button data-transition="rejected" data-id="${escapeHtml(item.id)}">Reject</button>`);
        if (item.status === "approved" && item.platform === "linkedin" && !["submitting", "unknown"].includes(item.linkedin_publication_status)) controls.push(`<button class="primary" data-linkedin-publish="${escapeHtml(item.id)}">Publish approved post to LinkedIn</button>`);
        if (item.linkedin_publication_status === "unknown") controls.push(`<p class="flags">LinkedIn's result is uncertain. Check your feed before resolving this attempt.</p><button data-linkedin-resolve="published" data-id="${escapeHtml(item.id)}">Confirm it was published</button><button data-linkedin-resolve="not_published" data-id="${escapeHtml(item.id)}">Confirm no post was created</button>`);
        if (item.status === "approved" || item.status === "scheduled" || item.status === "exported") controls.push(`<button data-export="${escapeHtml(item.id)}">Copy export package</button>`);
        if (item.status === "exported") controls.push(`<button data-published="${escapeHtml(item.id)}">Confirm live post</button>`);
        return `<article class="card content-card">
          <span class="status ${escapeHtml(item.status)}">${escapeHtml(item.status.replaceAll("_", " "))}</span>
          <p class="eyebrow content-platform">${platformIcon(item.platform)}${escapeHtml(item.platform)} / ${escapeHtml(item.format)}</p>
          <h3>${escapeHtml(item.hook)}</h3>
          <p>${escapeHtml(item.message)}</p>
          <p class="caption">${escapeHtml(item.caption_or_script)}</p>
          ${item.linkedin_post_id ? `<p class="muted">LinkedIn post ID: ${escapeHtml(item.linkedin_post_id)}</p>` : ""}
          ${item.linkedin_publication_status === "submitting" ? `<p class="muted">Waiting for LinkedIn's publish result. Reload before trying again.</p>` : ""}
          ${flags.length ? `<p class="flags"><strong>Needs revision:</strong> ${flags.map(escapeHtml).join(" ")}</p>` : ""}
          ${item.planned_at ? `<p class="muted">Planned: ${escapeHtml(item.planned_at)}</p>` : ""}
          <div class="actions">${controls.join("")}</div>
        </article>`;
      }).join("");
      container.innerHTML = cards || "";
      if (!items.length) showEmpty(container, "No drafts yet. Start with a useful brief; the agent will create platform-specific drafts.");
      const scheduled = items.filter((item) => item.planned_at);
      calendar.innerHTML = scheduled.map((item) => `<article class="card"><p class="eyebrow">${escapeHtml(item.planned_at)} / ${escapeHtml(item.platform)}</p><h3>${escapeHtml(item.hook)}</h3><p>${escapeHtml(item.status)}</p></article>`).join("");
      if (!scheduled.length) showEmpty(calendar, "Nothing has a planned publication time yet. Scheduling is not connected.");
    } catch (error) {
      showNotice(error.message, true);
    }
  }

  async function loadIntegrations() {
    try {
      const { capabilities, canva, linkedin, adobeExpress } = await api("/api/integrations");
      adobeExpressConfig = adobeExpress;
      $("#integration-list").innerHTML = capabilities.map((item) => {
        const isVideoTool = item.category === "Video creation";
        const category = isVideoTool ? "Video creation" : "Social publishing";
        const detail = item.platform === "LinkedIn"
          ? `Text-only member posts via the official API. Publishing is ${item.connection.toLowerCase()}; company-page and media posting are not enabled.`
          : isVideoTool
          ? "Video tool listed; account connection and automated creation are not configured."
          : `Capability facts: ${escapeHtml(item.verification)}.`;
        const sourceLink = item.sourceUrl
          ? `<a href="${escapeHtml(item.sourceUrl)}" target="_blank" rel="noopener noreferrer">Official API documentation</a>`
          : "";
        return `<article class="card integration"><div class="integration-details"><span class="app-icon ${platformIcons[String(item.platform).toLowerCase()]?.className || "generic"}">${platformIcon(item.platform)}</span><div><p class="eyebrow">${category}</p><h3>${escapeHtml(item.platform)}</h3><p class="muted">${detail}</p>${sourceLink ? `<p class="muted">${sourceLink}</p>` : ""}<span class="status">${escapeHtml(item.connection)}</span></div></div></article>`;
      }).join("");
      $("#linkedin-connect").hidden = linkedin.connected;
      $("#linkedin-connect").disabled = !linkedin.configured;
      $("#linkedin-connect").textContent = !linkedin.configured
        ? "LinkedIn setup required"
        : linkedin.expiresAt
          ? "Reconnect LinkedIn"
          : "Connect LinkedIn";
      $("#linkedin-disconnect").hidden = !linkedin.connected;
      $("#linkedin-connection-detail").textContent = linkedin.connected
        ? `LinkedIn is connected${linkedin.connectedAt ? ` since ${linkedin.connectedAt}` : ""}. Authorization expires ${linkedin.expiresAt ?? "on an unreported date"}; reconnect after expiry.`
        : linkedin.error || "Connect an owner-authorized LinkedIn member account to publish reviewed text posts.";
      $("#canva-connect").hidden = canva.connected;
      $("#canva-connect").textContent = canva.configured ? "Connect Canva" : "Canva setup required";
      $("#canva-disconnect").hidden = !canva.connected;
      $("#canva-video-form").hidden = !canva.connected;
      $("#canva-connection-detail").textContent = canva.connected
        ? `Canva is connected${canva.connectedAt ? ` since ${canva.connectedAt}` : ""}. Create a design from an existing video-capable template, then export it as MP4.`
        : canva.configured
          ? "Connect your Canva account to fill an existing video-capable brand template and export an MP4."
          : `${canva.error} Add the Canva app credentials and encryption key to Worker secrets to enable connection.`;
      $("#canva-connect").disabled = !canva.configured;
      $(".adobe-actions").querySelectorAll("[data-adobe-action]").forEach((button) => {
        button.disabled = !adobeExpress.available;
      });
      $("#adobe-connection-detail").textContent = adobeExpress.available
        ? "Adobe Express is approved and ready. Choose a video quick action to open its interactive editor."
        : "The interactive editor needs Adobe business approval, an HTTPS app domain, and an approved Embed SDK client ID.";
      await loadCanvaVideoJobs();
    } catch (error) { showNotice(error.message, true); }
  }

  async function loadCanvaVideoJobs() {
    const container = $("#canva-video-jobs");
    const { jobs } = await api("/api/integrations/canva/video-jobs");
    container.innerHTML = jobs.map((job) => {
      const controls = job.status === "ready"
        ? `<button data-export-video="${escapeHtml(job.id)}">Export MP4</button><button data-check-video="${escapeHtml(job.id)}">Refresh status</button>`
        : ["exporting", "complete"].includes(job.status)
          ? `<button data-check-export="${escapeHtml(job.id)}">Check MP4 export</button>`
          : job.status === "processing"
            ? `<button data-check-video="${escapeHtml(job.id)}">Check design status</button>`
            : "";
      return `<article class="card video-job"><p class="eyebrow">CANVA VIDEO DESIGN</p><h3>${escapeHtml(job.status)}</h3><p class="muted">Started ${escapeHtml(job.created_at)}</p><div class="actions">${controls}</div><div data-video-downloads="${escapeHtml(job.id)}"></div></article>`;
    }).join("");
    if (!jobs.length) container.replaceChildren();
  }

  async function checkCanvaVideoJob(id) {
    const result = await api(`/api/integrations/canva/video-jobs/${encodeURIComponent(id)}`);
    await loadCanvaVideoJobs();
    showNotice(result.status === "ready" ? "Canva finished the video design. You can now export it as MP4." : `Canva design status: ${result.status}.`);
  }

  async function checkCanvaExport(id) {
    const result = await api(`/api/integrations/canva/video-jobs/${encodeURIComponent(id)}/export`);
    await loadCanvaVideoJobs();
    const container = $(`[data-video-downloads="${CSS.escape(id)}"]`);
    if (result.status === "complete" && Array.isArray(result.downloadUrls)) {
      container.innerHTML = result.downloadUrls.map((url, index) => {
        const parsed = new URL(url);
        if (parsed.protocol !== "https:") throw new Error("Canva returned a non-HTTPS download link.");
        return `<p><a href="${escapeHtml(parsed.toString())}" target="_blank" rel="noopener noreferrer">Download MP4${result.downloadUrls.length > 1 ? ` ${index + 1}` : ""}</a> <span class="muted">Canva download links expire after 24 hours.</span></p>`;
      }).join("");
      showNotice("Canva finished your MP4 export.");
    } else {
      showNotice(`Canva export status: ${result.status}.`);
    }
  }

  function loadAdobeExpressSdk() {
    if (window.CCEverywhere) return Promise.resolve(window.CCEverywhere);
    if (adobeSdkPromise) return adobeSdkPromise;
    adobeSdkPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cc-embed.adobe.com/sdk/v4/CCEverywhere.js";
      script.async = true;
      script.onload = () => window.CCEverywhere
        ? resolve(window.CCEverywhere)
        : reject(new Error("Adobe Express SDK loaded without its editor interface."));
      script.onerror = () => reject(new Error("Adobe Express SDK could not be loaded."));
      document.head.append(script);
    }).catch((error) => {
      adobeSdkPromise = undefined;
      throw error;
    });
    return adobeSdkPromise;
  }

  async function launchAdobeQuickAction(action) {
    if (!adobeExpressConfig?.available || !adobeExpressConfig.clientId) {
      throw new Error("Adobe Express is unavailable until its approved Embed SDK key and HTTPS domain are configured.");
    }
    if (!adobeInstancePromise) {
      adobeInstancePromise = loadAdobeExpressSdk().then((sdk) => sdk.initialize({
        clientId: adobeExpressConfig.clientId,
        appName: adobeExpressConfig.appName,
        appVersion: { major: 1, minor: 0 },
        platformCategory: "web",
      }, { loginMode: "delayed" })).catch((error) => {
        adobeInstancePromise = undefined;
        throw error;
      });
    }
    const express = await adobeInstancePromise;
    const quickAction = express.quickAction[action];
    if (typeof quickAction !== "function") throw new Error("This Adobe Express video action is not available in the loaded SDK.");
    express.quickAction[action]();
  }

  async function loadActivity() {
    const container = $("#activity-list");
    try {
      const { items } = await api("/api/activity");
      container.innerHTML = items.map((item) => `<article class="card"><p class="eyebrow">${escapeHtml(item.created_at)} / ${escapeHtml(item.actor)}</p><h3>${escapeHtml(item.event_type)}</h3><p class="muted">${escapeHtml(item.entity_type || "System")} ${escapeHtml(item.entity_id || "")}</p></article>`).join("");
      if (!items.length) showEmpty(container, "No activity has been recorded yet.");
    } catch (error) { showNotice(error.message, true); }
  }

  async function loadSettings() {
    try {
      currentSettings = await api("/api/settings");
      const form = $("#settings-form");
      form.elements.operatingMode.value = currentSettings.operatingMode;
      form.elements.dailySpendCapUsd.value = currentSettings.dailySpendCapUsd;
      form.elements.monthlySpendCapUsd.value = currentSettings.monthlySpendCapUsd;
      form.elements.authorizedPromotionalClaims.value = currentSettings.authorizedPromotionalClaims.join("\n");
      form.elements.platformApprovalOverrides.value = JSON.stringify(currentSettings.platformApprovalOverrides, null, 2);
      form.elements.categoryApprovalOverrides.value = JSON.stringify(currentSettings.categoryApprovalOverrides, null, 2);
      $("#pause-control").textContent = currentSettings.paused ? "Resume publishing" : "Emergency pause";
      $("#pause-control").classList.toggle("paused", currentSettings.paused);
    } catch (error) { showNotice(error.message, true); }
  }

  async function loadBrand() {
    try {
      const result = await api("/api/brand");
      $("#brand-form").elements.profile.value = JSON.stringify(result.profile, null, 2);
      $("#brand-form").elements.needsOwnerInput.value = result.needsOwnerInput.join("\n");
      $("#brand-form").previousElementSibling.textContent = `Version ${result.version}. Unknown fields remain owner input.`;
    } catch (error) { showNotice(error.message, true); }
  }

  $$(".nav-item").forEach((button) => button.addEventListener("click", () => setPage(button.dataset.page)));
  $$("[data-open-page]").forEach((button) => button.addEventListener("click", () => setPage(button.dataset.openPage)));

  $("#generate-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const platforms = data.getAll("platform");
    if (!platforms.length) return showNotice("Select at least one platform.", true);
    try {
      const result = await api("/api/content/generate", {
        method: "POST",
        body: JSON.stringify({
          brief: data.get("brief"), pillar: data.get("pillar"), objective: data.get("objective"),
          destinationUrl: data.get("destinationUrl"), platforms,
        }),
      });
      showNotice(`${result.drafts.length} platform-specific draft(s) created with ${result.provider}.`);
      await loadContent();
    } catch (error) { showNotice(error.message, true); }
  });

  $("#settings-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    let platformApprovalOverrides;
    let categoryApprovalOverrides;
    try {
      platformApprovalOverrides = JSON.parse(data.get("platformApprovalOverrides") || "{}");
      categoryApprovalOverrides = JSON.parse(data.get("categoryApprovalOverrides") || "{}");
    } catch {
      return showNotice("Approval overrides must be valid JSON objects.", true);
    }
    try {
      currentSettings = await api("/api/settings", { method: "PUT", body: JSON.stringify({
        operatingMode: data.get("operatingMode"),
        dailySpendCapUsd: Number(data.get("dailySpendCapUsd")),
        monthlySpendCapUsd: Number(data.get("monthlySpendCapUsd")),
        authorizedPromotionalClaims: String(data.get("authorizedPromotionalClaims")).split("\n").map((claim) => claim.trim()).filter(Boolean),
        platformApprovalOverrides,
        categoryApprovalOverrides,
      }) });
      showNotice("Operating controls saved.");
      await loadSettings();
    } catch (error) { showNotice(error.message, true); }
  });

  $("#pause-control").addEventListener("click", async () => {
    try {
      const result = await api("/api/settings/pause", { method: "POST", body: JSON.stringify({ paused: !currentSettings?.paused }) });
      showNotice(result.paused ? "Emergency pause is on." : "Publishing is resumed.");
      await loadSettings();
    } catch (error) { showNotice(error.message, true); }
  });

  $("#canva-connect").addEventListener("click", async () => {
    try {
      const { authorizationUrl } = await api("/api/integrations/canva/connect", { method: "POST", body: "{}" });
      window.location.assign(authorizationUrl);
    } catch (error) { showNotice(error.message, true); }
  });

  $("#linkedin-connect").addEventListener("click", async () => {
    try {
      const { authorizationUrl } = await api("/api/integrations/linkedin/connect", { method: "POST", body: "{}" });
      window.location.assign(authorizationUrl);
    } catch (error) { showNotice(error.message, true); }
  });

  $("#linkedin-disconnect").addEventListener("click", async () => {
    if (!window.confirm("Disconnect LinkedIn? Saved drafts and publication records will remain.")) return;
    try {
      await api("/api/integrations/linkedin", { method: "DELETE" });
      showNotice("LinkedIn has been disconnected.");
      await loadIntegrations();
    } catch (error) { showNotice(error.message, true); }
  });

  $("#canva-disconnect").addEventListener("click", async () => {
    try {
      await api("/api/integrations/canva", { method: "DELETE" });
      showNotice("Canva has been disconnected.");
      await loadIntegrations();
    } catch (error) { showNotice(error.message, true); }
  });

  $("#canva-video-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    let fields;
    try { fields = JSON.parse(data.get("data")); }
    catch { return showNotice("Canva template data must be valid JSON.", true); }
    try {
      const job = await api("/api/integrations/canva/video-jobs", {
        method: "POST",
        body: JSON.stringify({ brandTemplateId: data.get("brandTemplateId"), data: fields }),
      });
      showNotice("Canva started filling your video template. Check the job status in a moment.");
      await loadCanvaVideoJobs();
    } catch (error) { showNotice(error.message, true); }
  });

  $("#canva-video-jobs").addEventListener("click", async (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    try {
      if (button.dataset.checkVideo) await checkCanvaVideoJob(button.dataset.checkVideo);
      if (button.dataset.exportVideo) {
        await api(`/api/integrations/canva/video-jobs/${encodeURIComponent(button.dataset.exportVideo)}/export`, {
          method: "POST", body: "{}",
        });
        await loadCanvaVideoJobs();
        showNotice("Canva MP4 export started.");
      }
      if (button.dataset.checkExport) await checkCanvaExport(button.dataset.checkExport);
    } catch (error) { showNotice(error.message, true); }
  });

  $(".adobe-actions").addEventListener("click", async (event) => {
    const button = event.target.closest("[data-adobe-action]");
    if (!button || button.disabled) return;
    try {
      await launchAdobeQuickAction(button.dataset.adobeAction);
      showNotice("Adobe Express opened. Choose your video asset and save or export from the editor.");
    } catch (error) { showNotice(error.message, true); }
  });

  $("#brand-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    let profile;
    try { profile = JSON.parse(data.get("profile")); }
    catch { return showNotice("Brand profile must be valid JSON.", true); }
    try {
      const result = await api("/api/brand", { method: "PUT", body: JSON.stringify({
        profile,
        needsOwnerInput: String(data.get("needsOwnerInput")).split("\n").map((value) => value.trim()).filter(Boolean),
      }) });
      showNotice(`Saved brand profile version ${result.version}.`);
      await loadBrand();
    } catch (error) { showNotice(error.message, true); }
  });

  $("#content-list").addEventListener("click", async (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    const id = button.dataset.id || button.dataset.export || button.dataset.published || button.dataset.linkedinPublish;
    try {
      if (button.dataset.transition) {
        await api(`/api/content/${encodeURIComponent(id)}/transition`, { method: "POST", body: JSON.stringify({ to: button.dataset.transition }) });
      } else if (button.dataset.linkedinPublish) {
        if (!window.confirm("Publish this approved text post publicly to your LinkedIn member feed now?")) return;
        const result = await api(`/api/content/${encodeURIComponent(id)}/publish/linkedin`, { method: "POST", body: "{}" });
        showNotice(`Published to LinkedIn. Post ID: ${result.postId}`);
      } else if (button.dataset.linkedinResolve) {
        const isPublished = button.dataset.linkedinResolve === "published";
        if (!isPublished && !window.confirm("Confirm that you checked LinkedIn and no post was created? This will allow a retry.")) return;
        const postId = isPublished ? window.prompt("Paste the LinkedIn post ID if available; leave blank if you cannot retrieve it.") : null;
        if (isPublished && postId === null) return;
        await api(`/api/content/${encodeURIComponent(id)}/linkedin/resolve`, {
          method: "POST",
          body: JSON.stringify({ outcome: isPublished ? "published" : "not_published", ...(postId?.trim() ? { postId: postId.trim() } : {}) }),
        });
        showNotice(isPublished ? "LinkedIn publication recorded." : "No publication recorded; the approved post can be retried.");
      } else if (button.dataset.export) {
        const result = await api(`/api/content/${encodeURIComponent(id)}/export`, { method: "POST", body: "{}" });
        const packageText = `Caption:\n${result.package.caption}\n\nAlt text:\n${result.package.altText}\n\nTagged link:\n${result.package.utmLink}\n\nAsset brief:\n${result.package.assetBrief}`;
        await navigator.clipboard.writeText(packageText);
        showNotice("Approved post package copied. Check alt text against the final asset before posting.");
      } else if (button.dataset.published) {
        const livePostUrl = window.prompt("Paste the HTTPS URL of the post that is live. Leave blank to cancel.");
        if (!livePostUrl) return;
        await api(`/api/content/${encodeURIComponent(id)}/transition`, { method: "POST", body: JSON.stringify({ to: "published", livePostUrl }) });
        showNotice("Publication confirmed with the live post URL.");
      } else if (button.dataset.edit) {
        const { items } = await api("/api/content");
        const item = items.find((candidate) => candidate.id === button.dataset.edit);
        if (!item) throw new Error("This content item is no longer available.");
        const dialog = $("#edit-dialog");
        const form = $("#edit-form");
        form.elements.id.value = item.id;
        form.elements.hook.value = item.hook;
        form.elements.message.value = item.message;
        form.elements.caption.value = item.caption_or_script;
        form.elements.callToAction.value = item.call_to_action;
        form.elements.visualDirection.value = item.visual_direction || "";
        form.elements.altText.value = item.alt_text || "";
        dialog.showModal();
        return;
      }
      await loadContent();
    } catch (error) { showNotice(error.message, true); }
  });

  $("#save-edit").addEventListener("click", async () => {
    const form = $("#edit-form");
    const data = new FormData(form);
    try {
      await api(`/api/content/${encodeURIComponent(data.get("id"))}`, {
        method: "PATCH",
        body: JSON.stringify({
          hook: data.get("hook"), message: data.get("message"), caption: data.get("caption"),
          callToAction: data.get("callToAction"), visualDirection: data.get("visualDirection"), altText: data.get("altText"),
        }),
      });
      $("#edit-dialog").close();
      showNotice("Draft saved and quality checks rerun.");
      await loadContent();
    } catch (error) { showNotice(error.message, true); }
  });

  const callbackResult = new URLSearchParams(window.location.search).get("integration");
  if (callbackResult) {
    setPage("integrations");
    if (callbackResult === "canva-connected") showNotice("Canva account connected.");
    else if (callbackResult === "canva-denied") showNotice("Canva authorization was cancelled.", true);
    else if (callbackResult === "linkedin-connected") showNotice("LinkedIn account connected.");
    else if (callbackResult === "linkedin-denied") showNotice("LinkedIn authorization was cancelled.", true);
    else showNotice("Integration connection failed or expired. Check setup and start the connection again.", true);
    window.history.replaceState({}, "", window.location.pathname);
  }
  loadSettings();
  loadBrand();
})();
