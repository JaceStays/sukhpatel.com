const Parser = require("rss-parser");

const parser = new Parser({
  timeout: 12000,
  customFields: {
    item: [
      ["media:content", "mediaContent"],
      ["media:thumbnail", "mediaThumbnail"],
      ["content:encoded", "contentEncoded"],
      ["description", "description"],
    ],
  },
});

const FEEDS = {
  news: [
    {
      name: "The Globe and Mail - Real Estate",
      url: "https://www.theglobeandmail.com/real-estate/?service=rss",
      fallbackUrls: [
        "https://news.google.com/rss/search?q=site:theglobeandmail.com+real+estate+canada&hl=en-CA&gl=CA&ceid=CA:en",
      ],
    },
    {
      name: "CTV News Vancouver",
      url: "https://news.google.com/rss/search?q=site:bc.ctvnews.ca+vancouver+real+estate&hl=en-CA&gl=CA&ceid=CA:en",
      fallbackUrls: [
        "https://news.google.com/rss/search?q=CTV+Vancouver+housing+market&hl=en-CA&gl=CA&ceid=CA:en",
      ],
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
      url: "https://news.google.com/rss/search?q=BNN+Bloomberg+Canada+real+estate&hl=en-CA&gl=CA&ceid=CA:en",
    },
    {
      name: "Financial Post",
      url: "https://news.google.com/rss/search?q=Financial+Post+Canadian+housing+market&hl=en-CA&gl=CA&ceid=CA:en",
    },
  ],
  reddit: [
    {
      name: "r/RealEstateCanada",
      url: "https://www.reddit.com/r/RealEstateCanada/.rss",
      viaRss2Json: true,
    },
    {
      name: "r/Vancouver",
      url: "https://www.reddit.com/r/vancouver/.rss",
      viaRss2Json: true,
    },
  ],
};

const extractImageFromHtml = (html) => {
  if (!html || typeof html !== "string") {
    return "";
  }
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match ? match[1] : "";
};

const pickImage = (item) => {
  if (item.enclosure && item.enclosure.url) {
    return item.enclosure.url;
  }
  if (item.mediaContent && item.mediaContent.$ && item.mediaContent.$.url) {
    return item.mediaContent.$.url;
  }
  if (item.mediaThumbnail && item.mediaThumbnail.$ && item.mediaThumbnail.$.url) {
    return item.mediaThumbnail.$.url;
  }
  return (
    extractImageFromHtml(item.contentEncoded) ||
    extractImageFromHtml(item.content) ||
    extractImageFromHtml(item.description)
  );
};

const sanitizeItem = (item) => ({
  title: item.title || "Untitled",
  link: item.link || "",
  pubDate: item.pubDate || "",
  image: pickImage(item),
});

const cleanXml = (xmlText) =>
  xmlText.replace(/&(?!#?[a-zA-Z0-9]+;)/g, "&amp;");

const parseFromUrl = async (url) => parser.parseURL(url);

const parseFromSanitizedXml = async (url) => {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; SukhPatelFeed/1.0)",
    },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const xml = await response.text();
  const cleaned = cleanXml(xml);
  return parser.parseString(cleaned);
};

const parseViaRss2Json = async (url) => {
  const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}`;
  const response = await fetch(apiUrl);
  if (!response.ok) {
    throw new Error(`rss2json HTTP ${response.status}`);
  }
  const payload = await response.json();
  if (payload.status !== "ok") {
    throw new Error("rss2json unavailable");
  }
  return {
    items: (payload.items || []).map((item) => ({
      title: item.title,
      link: item.link,
      pubDate: item.pubDate,
      enclosure: item.thumbnail ? { url: item.thumbnail } : undefined,
      description: item.description,
      content: item.content,
    })),
  };
};

exports.handler = async (event) => {
  const group = event.queryStringParameters?.group || "news";
  const selectedFeeds = FEEDS[group] || FEEDS.news;

  const results = await Promise.all(
    selectedFeeds.map(async (source) => {
      const candidates = [source.url, ...(source.fallbackUrls || [])];
      for (const candidateUrl of candidates) {
        try {
          const feed = source.viaRss2Json
            ? await parseViaRss2Json(candidateUrl)
            : await parseFromUrl(candidateUrl);
          const items = (feed.items || []).slice(0, 6).map(sanitizeItem);
          if (items.length > 0) {
            return {
              source: source.name,
              url: candidateUrl,
              ok: true,
              items,
            };
          }
        } catch (_parseError) {
          if (!source.viaRss2Json) {
            try {
              const feed = await parseFromSanitizedXml(candidateUrl);
              const items = (feed.items || []).slice(0, 6).map(sanitizeItem);
              if (items.length > 0) {
                return {
                  source: source.name,
                  url: candidateUrl,
                  ok: true,
                  items,
                };
              }
            } catch (_fallbackError) {
              // Continue trying next candidate.
            }
          }
        }
      }

      return {
        source: source.name,
        url: source.url,
        ok: false,
        items: [],
      };
    })
  );

  return {
    statusCode: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
    body: JSON.stringify({ group, sources: results }),
  };
};
