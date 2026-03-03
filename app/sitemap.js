export default function sitemap() {
  const base = "https://commonersdao.com";
  const now = new Date();

  return [
    { url: base,                     lastModified: now, changeFrequency: "daily",   priority: 1.0 },
    { url: `${base}/bounty`,         lastModified: now, changeFrequency: "daily",   priority: 0.9 },
    { url: `${base}/governance`,     lastModified: now, changeFrequency: "daily",   priority: 0.9 },
    { url: `${base}/discussion`,     lastModified: now, changeFrequency: "hourly",  priority: 0.8 },
    { url: `${base}/gallery`,        lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/treasury`,       lastModified: now, changeFrequency: "hourly",  priority: 0.7 },
    { url: `${base}/holders`,        lastModified: now, changeFrequency: "daily",   priority: 0.6 },
  ];
}
