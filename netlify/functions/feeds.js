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
      url: "https://www.theglobeandmail.com/arc/outboundfeeds/rss/category/real-estate/",
    },
    {
      name: "CTV News Vancouver",
      url: "https://news.google.com/rss/search?q=site:bc.ctvnews.ca+vancouver+real+estate&hl=en-CA&gl=CA&ceid=CA:en",
    },
    {
      name: "CBC British Columbia",
      url: "https://www.cbc.ca/webfeed/rss/rss-canada-britishcolumbia",
    },
    {
      name: "The Province - Local News",
      url: "https://theprovince.com/category/news/local-news/feed",
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

exports.handler = async (event) => {
  const group = event.queryStringParameters?.group || "news";
  const selectedFeeds = FEEDS[group] || FEEDS.news;

  const results = await Promise.all(
    selectedFeeds.map(async (source) => {
      try {
        const feed = await parser.parseURL(source.url);
        return {
          source: source.name,
          url: source.url,
          ok: true,
          items: (feed.items || []).slice(0, 6).map(sanitizeItem),
        };
      } catch (_error) {
        return {
          source: source.name,
          url: source.url,
          ok: false,
          items: [],
        };
      }
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
