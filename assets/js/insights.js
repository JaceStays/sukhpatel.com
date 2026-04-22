const formatDate = (value) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Latest";
  }
  return parsed.toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const createFeedCard = (source, sourceUrl, items, ok) => {
  const wrapper = document.createElement("article");
  wrapper.className = "feed-source";

  const heading = document.createElement("h3");
  heading.textContent = source;
  wrapper.appendChild(heading);

  const meta = document.createElement("p");
  meta.className = "feed-meta";
  meta.textContent = ok
    ? `Live feed from ${new URL(sourceUrl).hostname}`
    : "Source currently unavailable.";
  wrapper.appendChild(meta);

  if (!ok) {
    const fallback = document.createElement("a");
    fallback.href = sourceUrl;
    fallback.target = "_blank";
    fallback.rel = "noopener noreferrer";
    fallback.textContent = "Open source website";
    wrapper.appendChild(fallback);
    return wrapper;
  }

  const list = document.createElement("div");
  list.className = "feed-preview-list";

  items.slice(0, 5).forEach((item) => {
    const row = document.createElement("article");
    row.className = "feed-preview-item";

    if (item.image) {
      const img = document.createElement("img");
      img.className = "feed-preview-image";
      img.src = item.image;
      img.alt = item.title;
      img.loading = "lazy";
      row.appendChild(img);
    }

    const content = document.createElement("div");
    content.className = "feed-preview-content";

    const link = document.createElement("a");
    link.href = item.link;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = item.title;
    content.appendChild(link);

    const date = document.createElement("p");
    date.className = "feed-date";
    date.textContent = formatDate(item.pubDate);
    content.appendChild(date);

    row.appendChild(content);
    list.appendChild(row);
  });

  wrapper.appendChild(list);
  return wrapper;
};

const loadFeedGroup = async (group) => {
  const response = await fetch(`/.netlify/functions/feeds?group=${group}`);
  if (!response.ok) {
    throw new Error("Unable to fetch feed group");
  }
  const data = await response.json();
  if (!Array.isArray(data.sources)) {
    throw new Error("Invalid feed payload");
  }
  return data.sources;
};

const hydrateFeedGroup = async (targetId, group) => {
  const mount = document.getElementById(targetId);
  if (!mount) {
    return;
  }

  try {
    const sources = await loadFeedGroup(group);
    sources.forEach((source) => {
      mount.appendChild(
        createFeedCard(source.source, source.url, source.items || [], source.ok)
      );
    });
  } catch (_error) {
    const failed = document.createElement("p");
    failed.className = "feed-meta";
    failed.textContent = "Feed service is temporarily unavailable.";
    mount.appendChild(failed);
  }
};

hydrateFeedGroup("news-feeds", "news");
