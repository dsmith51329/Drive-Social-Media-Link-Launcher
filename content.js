(() => {
  const version = "1.0.1";
  console.log(`[DEBUG v${version}] extractLinks function triggered`);

  console.log("Extracting links from the expanded row only...");

  const expandedRow = document.querySelector(".MuiCollapse-entered.connect-panel");
  if (!expandedRow) {
    console.error("❌ No expanded row found! Adjust the selector.");
    return;
  } else {
    console.log("✅ Found expanded row:", expandedRow);
  }

  const prospectDetailsTab = expandedRow.querySelector("[data-testid='prospect-details-tab']");
  if (!prospectDetailsTab) {
    console.error("❌ No details section found within expanded row.");
    return;
  }

  const linkLabels = ["Website", "Facebook URL", "Ad Library Link", "Stat Show Link"];
  let filteredLinks = [];

  let companyName = "";
  const companyLabel = [...prospectDetailsTab.querySelectorAll("p")].find(p => p.innerText.trim() === "Company / Account");
  if (companyLabel) {
    const companyTextElement = companyLabel.parentElement?.querySelector("textarea, input");
    if (companyTextElement) {
      companyName = companyTextElement.value.trim();
    }
  }

  linkLabels.forEach(label => {
    const labelElement = [...prospectDetailsTab.querySelectorAll("p")].find(p => p.innerText.trim() === label);
    if (labelElement) {
      const linkElement = labelElement.parentElement?.querySelector("a");
      if (linkElement && linkElement.href.startsWith("http")) {
        filteredLinks.push({ text: label, href: linkElement.href });
      }
    }
  });

  // Fallback: If Facebook URL is missing but Company Name exists, create search link
  if (!filteredLinks.some(link => link.text === "Facebook URL") && companyName) {
    filteredLinks.push({
      text: "Facebook Search",
      href: `https://www.facebook.com/search/top?q=${encodeURIComponent(companyName)}`
    });
  }

  // Fallback: If Stat Show Link is missing but Website exists, create SpyFu link
  const websiteLink = filteredLinks.find(link => link.text === "Website");
  if (!filteredLinks.some(link => link.text === "Stat Show Link") && websiteLink) {
    const domain = new URL(websiteLink.href).hostname.replace("www.", "");
    filteredLinks.push({
      text: "SpyFu Link",
      href: `https://www.spyfu.com/overview/domain?query=${domain}`
    });
  }

  // Fallback: Add Google Ads Transparency link if a website exists
  if (websiteLink) {
    const domain = new URL(websiteLink.href).hostname.replace("www.", "");
    filteredLinks.push({
      text: "Google Ads Transparency",
      href: `https://adstransparency.google.com/?region=US&domain=${domain}`
    });
  }

  console.log("Filtered Links Inside Expanded Row:", filteredLinks);

  if (filteredLinks.length > 0) {
    chrome.runtime.sendMessage({ action: "openTabs", urls: filteredLinks.map(link => link.href) });
  } else {
    console.log("[DEBUG] No links to open. Exiting script.");
  }
})();
