const RSS2JSON_ENDPOINT = "https://api.rss2json.com/v1/api.json?rss_url=";

const newsFeeds = [
  {
    name: "The Globe and Mail - Real Estate",
    url: "https://www.theglobeandmail.com/real-estate/?service=rss",
  },
  {
    name: "CTV News Vancouver",
    url: "https://bc.ctvnews.ca/rss/bc_ctvnews_ca-public-rss-1.822306",
  },
  {
    name: "CBC British Columbia",
    url: "https://www.cbc.ca/webfeed/rss/rss-canada-britishcolumbia",
  },
  {
    name: "The Province - Local News",
    url: "https://theprovince.com/category/news/local-news/feed",
  },
  {
    name: "BNN Bloomberg",
    url: "https://www.bnnbloomberg.ca/polopoly_fs/1.1!/feed/rss.xml",
  },
  {
    name: "CNN Business",
    url: "http://rss.cnn.com/rss/money_latest.rss",
  },
];

const redditFeeds = [
  {
    name: "r/RealEstateCanada",
    url: "https://www.reddit.com/r/RealEstateCanada/.rss",
  },
  {
    name: "r/Vancouver",
    url: "https://www.reddit.com/r/vancouver/.rss",
  },
];

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

const createFeedCard = (title, feedUrl, items, error) => {
  const wrapper = document.createElement("article");
  wrapper.className = "feed-source";

  const heading = document.createElement("h3");
  heading.textContent = title;
  wrapper.appendChild(heading);

  const meta = document.createElement("p");
  meta.className = "feed-meta";
  meta.textContent = error
    ? "Temporarily unavailable. Open source directly."
    : `Auto-updating feed from ${new URL(feedUrl).hostname}`;
  wrapper.appendChild(meta);

  if (error) {
    const fallback = document.createElement("a");
    fallback.href = feedUrl;
    fallback.target = "_blank";
    fallback.rel = "noopener noreferrer";
    fallback.textContent = "Open source website";
    wrapper.appendChild(fallback);
    return wrapper;
  }

  const list = document.createElement("ul");
  list.className = "feed-list";

  items.slice(0, 5).forEach((item) => {
    const li = document.createElement("li");
    const link = document.createElement("a");
    link.href = item.link;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = `${item.title} (${formatDate(item.pubDate)})`;
    li.appendChild(link);
    list.appendChild(li);
  });

  wrapper.appendChild(list);
  return wrapper;
};

const loadFeed = async ({ name, url }) => {
  const response = await fetch(`${RSS2JSON_ENDPOINT}${encodeURIComponent(url)}`);
  if (!response.ok) {
    throw new Error("Unable to fetch feed");
  }
  const data = await response.json();
  if (data.status !== "ok" || !Array.isArray(data.items)) {
    throw new Error("Invalid feed payload");
  }
  return createFeedCard(name, url, data.items, false);
};

const hydrateFeedGroup = async (targetId, feeds) => {
  const mount = document.getElementById(targetId);
  if (!mount) {
    return;
  }

  const cards = await Promise.all(
    feeds.map(async (feed) => {
      try {
        return await loadFeed(feed);
      } catch (_error) {
        return createFeedCard(feed.name, feed.url, [], true);
      }
    })
  );

  cards.forEach((card) => {
    mount.appendChild(card);
  });
};

hydrateFeedGroup("news-feeds", newsFeeds);
hydrateFeedGroup("reddit-feeds", redditFeeds);
