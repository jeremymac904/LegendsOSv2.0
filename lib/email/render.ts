// Shared email preview renderer.
//
// One function — renderEmailPreview() — emits a self-contained HTML string
// using table-based, inline-styled layout that survives Gmail / Outlook
// inboxes. Both the Email Studio composer preview pane and any future
// outbound payload to n8n should call this so what Jeremy sees is what he
// sends.
//
// We deliberately do NOT pull in a heavy library here. Markdown → HTML is
// a tiny subset matching the legacy renderMarkdownPreview() in EmailComposer
// (headings, bold/italic, lists, links, code blocks, paragraphs). The
// surrounding shell adds brand header, body wrapper, and NMLS footer.

import { PUBLIC_ENV } from "@/lib/env";

export interface RenderEmailInput {
  subject: string;
  previewText?: string;
  /**
   * Either Markdown source (preferred) or pre-rendered HTML body. If both
   * are provided, html wins.
   */
  bodyMarkdown?: string;
  bodyHtml?: string;
  brandName?: string;
  complianceLine?: string;
  /** Full URL or pathless slug. Defaults to APP_URL. */
  appUrl?: string;
}

export interface RenderEmailOutput {
  /** Full <html>...</html> document, safe to drop into an iframe srcdoc. */
  html: string;
  /** Just the inner email body (the table wrapper + brand/footer), no doctype. */
  fragment: string;
  /** Plain-text fallback derived from the markdown (or stripped HTML). */
  text: string;
}

const PALETTE = {
  bg: "#0a0a0d",
  cardBg: "#15151a",
  border: "#23232b",
  accent: "#c8a45c",
  accentSoft: "#3a2f1c",
  ink: "#f3f1ec",
  inkMuted: "#9a958a",
  inkDim: "#6b6760",
  link: "#e3c07a",
};

export function renderEmailPreview(input: RenderEmailInput): RenderEmailOutput {
  const brandName = input.brandName || PUBLIC_ENV.TEAM_NAME;
  const compliance = input.complianceLine || PUBLIC_ENV.BRAND_LINE;
  const appUrl = input.appUrl || PUBLIC_ENV.APP_URL || "";
  const subject = (input.subject || "").trim() || "(No subject)";
  const previewText = (input.previewText || "").trim();

  const bodyHtml = input.bodyHtml
    ? input.bodyHtml
    : markdownToHtml(input.bodyMarkdown || "");

  const text = input.bodyMarkdown
    ? input.bodyMarkdown
    : stripHtmlToText(bodyHtml);

  const fragment = renderFragment({
    brandName,
    compliance,
    appUrl,
    subject,
    bodyHtml,
  });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeAttr(subject)}</title>
${previewText ? `<meta name="description" content="${escapeAttr(previewText)}" />` : ""}
<style>
  body { margin: 0; padding: 0; background: ${PALETTE.bg}; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; color: ${PALETTE.ink}; }
  a { color: ${PALETTE.link}; }
  .preview-only { display:none !important; max-height:0; overflow:hidden; mso-hide:all; }
</style>
</head>
<body>
${previewText ? `<div class="preview-only">${escapeHtml(previewText)}</div>` : ""}
${fragment}
</body>
</html>`;

  return { html, fragment, text };
}

function renderFragment(args: {
  brandName: string;
  compliance: string;
  appUrl: string;
  subject: string;
  bodyHtml: string;
}): string {
  const { brandName, compliance, appUrl, subject, bodyHtml } = args;
  const subjectSafe = escapeHtml(subject);
  const brandSafe = escapeHtml(brandName);
  const complianceSafe = escapeHtml(compliance);
  const appUrlSafe = escapeAttr(appUrl);

  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PALETTE.bg};padding:24px 12px;">
  <tr>
    <td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:${PALETTE.cardBg};border:1px solid ${PALETTE.border};border-radius:14px;overflow:hidden;">
        <tr>
          <td style="padding:24px 28px 20px 28px;border-bottom:1px solid ${PALETTE.border};background:linear-gradient(180deg, rgba(200,164,92,0.10), rgba(200,164,92,0));">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td valign="middle" style="white-space:nowrap;">
                  <span style="display:inline-block;width:30px;height:30px;border-radius:8px;background:linear-gradient(135deg,#c8a45c,#e07b2e);color:#0a0a0d;font-weight:800;text-align:center;line-height:30px;vertical-align:middle;font-size:14px;">L</span>
                  <span style="display:inline-block;vertical-align:middle;margin-left:10px;color:${PALETTE.ink};font-weight:600;font-size:14px;letter-spacing:0.02em;">${brandSafe}</span>
                </td>
                <td align="right" style="font-size:11px;color:${PALETTE.inkMuted};text-transform:uppercase;letter-spacing:0.18em;">Newsletter</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 28px 8px 28px;">
            <p style="margin:0 0 4px 0;color:${PALETTE.inkMuted};font-size:11px;text-transform:uppercase;letter-spacing:0.18em;">Subject</p>
            <h1 style="margin:0;font-size:20px;line-height:1.35;color:${PALETTE.ink};font-weight:700;">${subjectSafe}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 28px 24px 28px;color:${PALETTE.ink};font-size:14px;line-height:1.65;">
            <div style="color:${PALETTE.ink};">
              ${bodyHtml || `<p style="margin:0;color:${PALETTE.inkDim};font-style:italic;">Start typing in the editor on the left — the rendered email appears here.</p>`}
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:18px 28px 22px 28px;border-top:1px solid ${PALETTE.border};background:#101015;">
            <p style="margin:0 0 6px 0;font-size:11px;color:${PALETTE.inkMuted};line-height:1.55;">${complianceSafe}</p>
            ${
              appUrl
                ? `<p style="margin:0;font-size:11px;color:${PALETTE.inkDim};">Sent via <a href="${appUrlSafe}" style="color:${PALETTE.link};text-decoration:none;">LegendsOS</a></p>`
                : `<p style="margin:0;font-size:11px;color:${PALETTE.inkDim};">Sent via LegendsOS</p>`
            }
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}

// ---------------------------------------------------------------------------
// Tiny markdown → HTML. Mirrors the renderer that used to live inside
// EmailComposer so we can delete the duplicate.
// ---------------------------------------------------------------------------

export function markdownToHtml(src: string): string {
  if (!src) return "";
  let html = escapeHtml(src);
  // Code fences first so escaped content stays inside them.
  html = html.replace(
    /```([\s\S]*?)```/g,
    (_, code) =>
      `<pre style="background:${PALETTE.cardBg};border:1px solid ${PALETTE.border};border-radius:8px;padding:10px 12px;font-family:Menlo,Consolas,monospace;font-size:12px;color:${PALETTE.ink};overflow:auto;"><code>${code}</code></pre>`
  );
  html = html.replace(/^###### (.+)$/gm, '<h6 style="margin:14px 0 6px 0;font-size:13px;">$1</h6>');
  html = html.replace(/^##### (.+)$/gm, '<h5 style="margin:14px 0 6px 0;font-size:14px;">$1</h5>');
  html = html.replace(/^#### (.+)$/gm, '<h4 style="margin:14px 0 6px 0;font-size:15px;">$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3 style="margin:16px 0 6px 0;font-size:16px;font-weight:600;">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 style="margin:18px 0 8px 0;font-size:18px;font-weight:700;">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 style="margin:18px 0 10px 0;font-size:22px;font-weight:700;">$1</h1>');
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  html = html.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/g,
    `<a href="$2" style="color:${PALETTE.link};text-decoration:underline;" rel="noreferrer noopener" target="_blank">$1</a>`
  );
  html = html.replace(/^(?:- (.+)(?:\n|$))+/gm, (block) => {
    const items = block
      .trim()
      .split(/\n/)
      .map((l) => l.replace(/^- /, ""))
      .map((l) => `<li style="margin:4px 0;">${l}</li>`)
      .join("");
    return `<ul style="margin:10px 0 10px 22px;padding:0;">${items}</ul>`;
  });
  html = html.replace(/^(?:\d+\. (.+)(?:\n|$))+/gm, (block) => {
    const items = block
      .trim()
      .split(/\n/)
      .map((l) => l.replace(/^\d+\. /, ""))
      .map((l) => `<li style="margin:4px 0;">${l}</li>`)
      .join("");
    return `<ol style="margin:10px 0 10px 22px;padding:0;">${items}</ol>`;
  });
  html = html
    .split(/\n{2,}/)
    .map((chunk) =>
      /^<(h\d|ul|ol|pre|blockquote|table|div)/i.test(chunk.trim())
        ? chunk
        : `<p style="margin:8px 0;">${chunk.replace(/\n/g, "<br/>")}</p>`
    )
    .join("\n");
  return html;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/"/g, "&quot;");
}

function stripHtmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>(\s*)?/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
