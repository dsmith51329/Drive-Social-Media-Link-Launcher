(async () => {
  const version = "2.0.0";
  const logPrefix = `[DriveSocial v${version}]`;

  const log = {
    info: (message, ...args) => console.log(`${logPrefix} [INFO] ${message}`, ...args),
    debug: (message, ...args) => console.log(`${logPrefix} [DEBUG] ${message}`, ...args),
    warn: (message, ...args) => console.warn(`${logPrefix} [WARN] ${message}`, ...args),
    error: (message, ...args) => console.error(`${logPrefix} [ERROR] ${message}`, ...args)
  };

  const state = {
    CompanyName: null,
    CompanyWebsite: null,
    CompanyFB: null,
    MetaAdsLink: null,
    SpyfuLink: null
  };

  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const normalize = (value) => (value || "").trim().replace(/\s+/g, " ");

  const cleanUrl = (value) => {
    if (!value) {
      return null;
    }

    try {
      const url = new URL(value);
      return url.href;
    } catch (error) {
      return null;
    }
  };

  const getDomainFromUrl = (url) => {
    if (!url) {
      return null;
    }

    try {
      const parsed = new URL(url);
      return parsed.hostname.replace(/^www\./i, "");
    } catch (error) {
      return null;
    }
  };

  const findElementByText = (container, tagSelector, label) => {
    if (!container) {
      return null;
    }

    const normalizedLabel = normalize(label).toLowerCase();
    const elements = container.querySelectorAll(tagSelector);
    return Array.from(elements).find((element) => {
      const text = normalize(element.textContent).toLowerCase().replace(/:$/, "");
      return text === normalizedLabel;
    });
  };

  const resolveFieldContainer = (labels = [], fieldIds = []) => {
    const sections = Array.from(document.querySelectorAll(".slds-section__content"));

    for (const id of fieldIds) {
      const byId = document.querySelector(`[data-field-id='${id}']`);
      if (byId) {
        return byId;
      }
    }

    for (const section of sections) {
      for (const label of labels) {
        const labelElement = findElementByText(section, "label, span, p, div", label);
        if (labelElement) {
          return labelElement;
        }
      }
    }

    return null;
  };

  const deriveValueParent = (element) => {
    if (!element) {
      return null;
    }

    const parent = element.closest("div, li, td, tr, section, lightning-layout-item") || element.parentElement;
    if (!parent) {
      return null;
    }

    if (parent.matches("[data-field-id]")) {
      return parent;
    }

    const fieldWrapper = parent.querySelector("[data-field-id]");
    return fieldWrapper || parent;
  };

  const extractLinkFromContainer = (element) => {
    const parent = deriveValueParent(element);
    if (!parent) {
      return null;
    }

    const link = parent.querySelector("a[href]");
    if (link && link.href.startsWith("http")) {
      return cleanUrl(link.href);
    }

    const formattedUrl = parent.querySelector(
      "lightning-formatted-url, lightning-formatted-rich-text, lightning-formatted-text, span, p"
    );
    if (formattedUrl) {
      const text = normalize(formattedUrl.textContent);
      if (text && text.startsWith("http")) {
        return cleanUrl(text);
      }
    }

    return null;
  };

  const extractTextValueFromContainer = (element) => {
    const parent = deriveValueParent(element);
    if (!parent) {
      return null;
    }

    const input = parent.querySelector("input, textarea");
    if (input && input.value) {
      return normalize(input.value);
    }

    const textCandidate = parent.querySelector(
      "lightning-formatted-text, span, p, div, h4, h5, h6"
    );
    if (textCandidate && textCandidate.textContent) {
      return normalize(textCandidate.textContent);
    }

    return null;
  };

  const detectContext = () => {
    const hostname = window.location.hostname;
    if (hostname.includes("lightning.force.com")) {
      return "salesforce";
    }
    if (hostname.includes("orum.com")) {
      return "orum";
    }
    return "general";
  };

  const logFieldResult = (field, value) => {
    if (value) {
      log.debug(`Captured ${field}: ${value}`);
    } else {
      log.warn(`Missing ${field}.`);
    }
  };

  const extractSalesforceData = () => {
    const sections = document.querySelectorAll(".slds-section__content");
    if (!sections.length) {
      log.error("Salesforce section not found.");
      return;
    }

    const fields = {
      CompanyName: {
        labels: ["Company"],
        ids: ["Company", "CompanyName", "Name", "AccountName"]
      },
      CompanyWebsite: {
        labels: ["Website"],
        ids: ["Website", "Website__c", "CompanyWebsite"]
      },
      CompanyFB: {
        labels: ["Facebook URL"],
        ids: ["Facebook_URL__c", "Facebook_URL", "FacebookUrl", "Facebook"]
      },
      MetaAdsLink: {
        labels: ["Ads Library Link", "Meta Ads Link"],
        ids: ["Ads_Library_Link__c", "MetaAdsLink", "Ads_Library_Link"]
      },
      SpyfuLink: {
        labels: ["Stat Show Link", "SpyFu Link"],
        ids: ["Stat_Show_Link__c", "Spyfu_Link__c", "SpyFuLink"]
      }
    };

    for (const [key, config] of Object.entries(fields)) {
      const fieldElement = resolveFieldContainer(config.labels, config.ids);
      if (!fieldElement) {
        log.warn(`Unable to locate Salesforce field for ${key}.`);
        continue;
      }

      const value = key === "CompanyName"
        ? extractTextValueFromContainer(fieldElement)
        : extractLinkFromContainer(fieldElement);

      if (value) {
        state[key] = value;
      }

      logFieldResult(key, state[key]);
    }
  };

  const extractOrumData = () => {
    const expandedRow = document.querySelector(".MuiCollapse-entered.connect-panel");
    if (!expandedRow) {
      log.error("Prospect details panel not expanded.");
      return;
    }

    const prospectDetailsTab = expandedRow.querySelector("[data-testid='prospect-details-tab']");
    if (!prospectDetailsTab) {
      log.error("Prospect Details not found.");
      return;
    }

    const findParagraphByText = (label) =>
      Array.from(prospectDetailsTab.querySelectorAll("p")).find(
        (paragraph) => paragraph.innerText.trim() === label
      );

    const companyLabel = findParagraphByText("Company / Account");
    if (companyLabel) {
      const nameElement = companyLabel.parentElement?.querySelector("textarea, input");
      const extractedName = nameElement?.value?.trim();
      if (extractedName) {
        state.CompanyName = extractedName;
      }
    }
    logFieldResult("CompanyName", state.CompanyName);

    const extractLinkForLabel = (label, stateKey) => {
      const labelElement = findParagraphByText(label);
      if (!labelElement) {
        return;
      }

      const linkElement = labelElement.parentElement?.querySelector("a[href]");
      if (linkElement && linkElement.href.startsWith("http")) {
        state[stateKey] = cleanUrl(linkElement.href);
      }
    };

    extractLinkForLabel("Website", "CompanyWebsite");
    logFieldResult("CompanyWebsite", state.CompanyWebsite);

    extractLinkForLabel("Facebook URL", "CompanyFB");
    logFieldResult("CompanyFB", state.CompanyFB);

    extractLinkForLabel("Ad Library Link", "MetaAdsLink");
    logFieldResult("MetaAdsLink", state.MetaAdsLink);

    extractLinkForLabel("Stat Show Link", "SpyfuLink");
    extractLinkForLabel("Statshow Link", "SpyfuLink");
    logFieldResult("SpyfuLink", state.SpyfuLink);

    log.debug("Extracted Orum links:", {
      CompanyWebsite: state.CompanyWebsite,
      CompanyFB: state.CompanyFB,
      MetaAdsLink: state.MetaAdsLink,
      SpyfuLink: state.SpyfuLink
    });
  };

  const extractGeneralSiteData = () => {
    const currentUrl = window.location.href;
    state.CompanyWebsite = cleanUrl(currentUrl) || state.CompanyWebsite;
    logFieldResult("CompanyWebsite", state.CompanyWebsite);

    const candidates = [
      "meta[property='og:site_name']",
      "meta[property='og:title']",
      "meta[name='twitter:title']"
    ];

    for (const selector of candidates) {
      const meta = document.querySelector(selector);
      if (meta && meta.content) {
        state.CompanyName = normalize(meta.content);
        break;
      }
    }

    if (!state.CompanyName && document.title) {
      state.CompanyName = normalize(document.title);
    }

    if (!state.CompanyName) {
      const h1 = document.querySelector("h1");
      if (h1 && h1.textContent) {
        state.CompanyName = normalize(h1.textContent);
      }
    }

    if (!state.CompanyName) {
      log.error("Unable to determine company name from general site context.");
    } else {
      logFieldResult("CompanyName", state.CompanyName);
    }
  };

  const extractFacebookPageIdFromUrl = (url) => {
    if (!url) {
      return null;
    }

    const idParameterMatch = url.match(/[?&](?:id|page_id)=(\d+)/i);
    if (idParameterMatch) {
      return idParameterMatch[1];
    }

    const pathMatch = url.match(/\/pages\/[^/]+\/(\d+)(?:[/?]|$)/i);
    if (pathMatch) {
      return pathMatch[1];
    }

    const numericMatch = url.match(/\/(\d{5,})(?:[/?]|$)/);
    if (numericMatch) {
      return numericMatch[1];
    }

    return null;
  };

  const parseFacebookPageIdFromHtml = (html) => {
    if (!html) {
      return null;
    }

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      const metaSelectors = [
        "meta[property='al:android:url']",
        "meta[property='al:ios:url']",
        "meta[property='al:iphone:url']",
        "meta[property='al:ipad:url']"
      ];

      for (const selector of metaSelectors) {
        const meta = doc.querySelector(selector);
        const content = meta?.getAttribute("content");
        if (content) {
          const match = content.match(/fb:\/\/page\/(\d+)/i);
          if (match) {
            return match[1];
          }
        }
      }

      const bodyHtml = doc.body ? doc.body.innerHTML : html;
      const jsonMatch = bodyHtml.match(/"page_id":"(\d+)"/i) || bodyHtml.match(/"pageID":"(\d+)"/i);
      if (jsonMatch) {
        return jsonMatch[1];
      }

      const dataAttributeMatch = bodyHtml.match(/data-pagelet="ProfileAppSectionMain"[^>]*data-referrerid="(\d+)"/i);
      if (dataAttributeMatch) {
        return dataAttributeMatch[1];
      }
    } catch (error) {
      log.debug(`DOM parsing for Facebook Page ID failed: ${error.message}`);
    }

    const fallbackMatch = html.match(/page_id=(\d+)/i) || html.match(/\/pages\/[^/]+\/(\d+)(?:[/?]|$)/i);
    return fallbackMatch ? fallbackMatch[1] : null;
  };

  const fetchFacebookPageIdFromHtml = async (url) => {
    const attempts = 5;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        const response = await fetch(url, { credentials: "include" });
        if (!response.ok) {
          throw new Error(`Status ${response.status}`);
        }
        const body = await response.text();
        const parsedId = parseFacebookPageIdFromHtml(body);
        if (parsedId) {
          return parsedId;
        }
        log.debug(`Page ID attempt ${attempt + 1} did not find an ID.`);
      } catch (error) {
        log.warn(`Page ID fetch attempt ${attempt + 1} failed: ${error.message}`);
      }
      await delay(500);
    }
    log.error(`Failed to derive Facebook Page ID from ${url}`);
    return null;
  };

  const buildMetaAdsLink = async () => {
    if (state.MetaAdsLink) {
      return state.MetaAdsLink;
    }

    if (!state.CompanyFB) {
      return null;
    }

    const directId = extractFacebookPageIdFromUrl(state.CompanyFB);
    if (directId) {
      return `https://www.facebook.com/ads/library/?view_all_page_id=${directId}`;
    }

    try {
      const derivedId = await fetchFacebookPageIdFromHtml(state.CompanyFB);
      if (derivedId) {
        log.debug(`Extracted Facebook Page ID: ${derivedId}`);
        return `https://www.facebook.com/ads/library/?view_all_page_id=${derivedId}`;
      }
    } catch (error) {
      log.error(`Meta Ads fallback failed: ${error.message}`);
    }

    return null;
  };

  const buildSpyfuLink = () => {
    if (state.SpyfuLink) {
      return state.SpyfuLink;
    }

    const domain = getDomainFromUrl(state.CompanyWebsite);
    if (!domain) {
      return null;
    }

    return `https://www.spyfu.com/overview/domain?query=${encodeURIComponent(domain)}`;
  };

  const buildGoogleAdsTransparencyLink = () => {
    const domain = getDomainFromUrl(state.CompanyWebsite);
    if (!domain) {
      return null;
    }
    return `https://adstransparency.google.com/?region=US&domain=${encodeURIComponent(domain)}`;
  };

  const gatherLinksToOpen = async (context) => {
    const urls = [];
    const pushUrl = (url, label) => {
      const cleaned = cleanUrl(url);
      if (!cleaned) {
        return;
      }
      if (!urls.includes(cleaned)) {
        urls.push(cleaned);
        log.debug(`Added ${label}: ${cleaned}`);
      }
    };

    if (state.CompanyWebsite && (context === "salesforce" || context === "orum")) {
      pushUrl(state.CompanyWebsite, "Company Website");
    }

    if (state.CompanyFB) {
      pushUrl(state.CompanyFB, "Facebook URL");
    } else if (state.CompanyName) {
      pushUrl(`https://www.facebook.com/search/top?q=${encodeURIComponent(state.CompanyName)}`, "Facebook Search");
    }

    const metaAds = await buildMetaAdsLink();
    if (metaAds) {
      pushUrl(metaAds, "Meta Ads Library");
    }

    const spyfu = buildSpyfuLink();
    if (spyfu) {
      pushUrl(spyfu, "SpyFu");
    }

    const googleAds = buildGoogleAdsTransparencyLink();
    if (googleAds) {
      pushUrl(googleAds, "Google Ads Transparency");
    }

    return urls;
  };

  try {
    log.info("Extraction started.");
    const context = detectContext();

    switch (context) {
      case "salesforce":
        extractSalesforceData();
        break;
      case "orum":
        extractOrumData();
        break;
      default:
        extractGeneralSiteData();
        break;
    }

    log.debug("Extracted variables:", state);

    const urlsToOpen = await gatherLinksToOpen(context);
    if (urlsToOpen.length) {
      chrome.runtime.sendMessage({ action: "openTabs", urls: urlsToOpen });
      log.debug("URLs prepared for launch:", urlsToOpen);
      log.info(`Queued ${urlsToOpen.length} URL(s) for launch.`);
    } else {
      log.debug("No URLs to launch.");
      log.info("Extraction completed without launchable URLs.");
    }
  } catch (error) {
    log.error("Unexpected failure:", error);
  }
})();
