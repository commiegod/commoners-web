import { handleUpload } from "@vercel/blob/client";
import { NextResponse } from "next/server";

// No edge runtime — client upload doesn't need the function body to carry the file

export async function POST(request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "Image upload not configured." }, { status: 503 });
  }

  const body = await request.json();

  const jsonResponse = await handleUpload({
    body,
    request,
    onBeforeGenerateToken: async (pathname) => {
      // Validate file type and size before issuing an upload token
      const ext = pathname.split(".").pop()?.toLowerCase() || "";
      const allowed = ["jpg", "jpeg", "png", "gif", "webp", "avif"];
      if (!allowed.includes(ext)) {
        throw new Error("Unsupported file type.");
      }
      return {
        allowedContentTypes: [
          "image/jpeg",
          "image/png",
          "image/gif",
          "image/webp",
          "image/avif",
        ],
        maximumSizeInBytes: 10 * 1024 * 1024, // 10 MB
        tokenPayload: pathname,
      };
    },
    onUploadCompleted: async () => {
      // Nothing to do after upload
    },
  });

  return NextResponse.json(jsonResponse);
}
