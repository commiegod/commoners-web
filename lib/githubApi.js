const REPO = process.env.GITHUB_REPO || "commiegod/commoners-web";
const BASE = "https://api.github.com";

function headers() {
  return {
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

/**
 * Read a JSON file from the repo.
 * Returns { content: parsedJson, sha: string } or { content: null, sha: null } if 404.
 */
export async function getFile(filePath) {
  const res = await fetch(`${BASE}/repos/${REPO}/contents/${filePath}`, {
    headers: headers(),
    cache: "no-store",
  });
  if (res.status === 404) return { content: null, sha: null };
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub GET ${filePath}: ${res.status} — ${text}`);
  }
  const data = await res.json();
  const raw = Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf8");
  return { content: JSON.parse(raw), sha: data.sha };
}

/**
 * Write a JSON file to the repo (creates or updates).
 * sha is required when updating an existing file.
 */
export async function putFile(filePath, content, sha, message) {
  const body = {
    message,
    content: Buffer.from(JSON.stringify(content, null, 2) + "\n").toString("base64"),
  };
  if (sha) body.sha = sha;

  const res = await fetch(`${BASE}/repos/${REPO}/contents/${filePath}`, {
    method: "PUT",
    headers: { ...headers(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub PUT ${filePath}: ${res.status} — ${text}`);
  }
  return res.json();
}
