import { put } from "@vercel/blob";

export const runtime = "edge";

export async function POST(request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return Response.json({ error: "Image upload not configured." }, { status: 503 });
  }

  const form = await request.formData();
  const file = form.get("file");

  if (!file || typeof file === "string") {
    return Response.json({ error: "No file provided." }, { status: 400 });
  }

  const ext = file.name?.split(".").pop()?.toLowerCase() || "jpg";
  const allowed = ["jpg", "jpeg", "png", "gif", "webp", "avif"];
  if (!allowed.includes(ext)) {
    return Response.json({ error: "Unsupported file type." }, { status: 400 });
  }

  if (file.size > 10 * 1024 * 1024) {
    return Response.json({ error: "File must be under 10 MB." }, { status: 400 });
  }

  const blob = await put(`bounty/${Date.now()}.${ext}`, file, {
    access: "public",
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });

  return Response.json({ url: blob.url });
}
