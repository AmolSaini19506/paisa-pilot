import { extractText, getDocumentProxy } from "unpdf";

const J = (d: any) => new Response(JSON.stringify(d), { headers: { "content-type": "application/json" } });

export async function onRequestPost(context: any) {
  try {
    const form = await context.request.formData();
    const file = form.get("file") as File | null;
    if (!file) return J({ error: "no file", lines: [] });
    const buf = new Uint8Array(await file.arrayBuffer());
    const pdf = await getDocumentProxy(buf);
    const { text, totalPages } = await extractText(pdf, { mergePages: true });
    const lines = String(text)
      .split(/\n/)
      .map((l) => l.replace(/\s+/g, " ").trim())
      .filter((l) => /\d{1,2}[-/][\dA-Za-z]{2,3}[-/]\d{2,4}/.test(l) && /\d+\.\d{2}/.test(l));
    return J({ pages: totalPages, lines: lines.slice(0, 80) });
  } catch (e: any) {
    return J({ error: e.message, lines: [] });
  }
}
