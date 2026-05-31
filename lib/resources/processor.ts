import { youtubeEmbedUrl } from "@/lib/teamResources";
import { runChat } from "@/lib/ai/providers";

export interface ProcessedResource {
  title: string;
  summary: string;
  tags: string[];
  category: string;
  format: string;
  recommendedLocation: string;
  legendsosVersion: string;
  url?: string;
  videoUrl?: string;
  embedUrl?: string;
}

export async function processYoutubeUrl(url: string): Promise<ProcessedResource> {
  const embedUrl = youtubeEmbedUrl(url);
  const videoIdMatch = url.match(/(?:v=|\/embed\/|\/shorts\/|\/live\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  const videoId = videoIdMatch ? videoIdMatch[1] : null;

  let title = "YouTube Video";
  let description = "";

  try {
    // Basic metadata retrieval via noembed
    const res = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(url)}`);
    const data = await res.json();
    if (data.title) title = data.title;
  } catch (e) {
    console.error("Failed to fetch YouTube metadata:", e);
  }

  // AI Review
  const aiResult = await runChat({
    messages: [
      {
        role: "system",
        content: "You are a resource librarian for LegendsOS. Analyze the following YouTube metadata and generate a structured review.",
      },
      {
        role: "user",
        content: `YouTube URL: ${url}\nTitle: ${title}\n\nPlease generate:\n1. Title (refined for LegendsOS)\n2. Summary (2-3 sentences)\n3. Tags (comma separated)\n4. Category (choose from: LegendsOS Basics, Atlas Training, n8n Setup, Google Workspace, Social Media, Image Studio, Email Newsletters, Mortgage Coaching, Sales Coaching, Loan Factory Systems, AI Tools)\n5. Format (YouTube Video)\n6. Recommended Location (Training, Marketing, or LF Resources)\n7. LegendsOS Version (The 'AI-first' way to describe this resource)\n\nRespond in JSON format.`,
      },
    ],
  });

  let aiData: any = {};
  if ("ok" in aiResult && aiResult.ok) {
    try {
      // Find JSON block in response
      const jsonMatch = aiResult.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        aiData = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error("Failed to parse AI response:", e);
    }
  }

  return {
    title: aiData.title || title,
    summary: aiData.summary || "",
    tags: Array.isArray(aiData.tags) ? aiData.tags : (aiData.tags || "").split(",").map((t: string) => t.trim()),
    category: aiData.category || "AI Tools",
    format: "YouTube Video",
    recommendedLocation: aiData.recommendedLocation || "Training",
    legendsosVersion: aiData.legendsosVersion || "1.0",
    url: url,
    videoUrl: url,
    embedUrl: embedUrl || undefined,
  };
}

export async function processFileContent(
  fileName: string,
  contentType: string,
  content: string
): Promise<ProcessedResource> {
  const aiResult = await runChat({
    messages: [
      {
        role: "system",
        content: "You are a resource librarian for LegendsOS. Analyze the following file content and generate a structured review.",
      },
      {
        role: "user",
        content: `File Name: ${fileName}\nContent Type: ${contentType}\nContent:\n${content.slice(0, 4000)}\n\nPlease generate:\n1. Title (refined for LegendsOS)\n2. Summary (2-3 sentences)\n3. Tags (comma separated)\n4. Category (choose from: LegendsOS Basics, Atlas Training, n8n Setup, Google Workspace, Social Media, Image Studio, Email Newsletters, Mortgage Coaching, Sales Coaching, Loan Factory Systems, AI Tools)\n5. Format (e.g. PDF, DOCX, CSV, etc.)\n6. Recommended Location (Training, Marketing, or LF Resources)\n7. LegendsOS Version (The 'AI-first' way to describe this resource)\n\nRespond in JSON format.`,
      },
    ],
  });

  let aiData: any = {};
  if ("ok" in aiResult && aiResult.ok) {
    try {
      const jsonMatch = aiResult.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        aiData = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error("Failed to parse AI response:", e);
    }
  }

  return {
    title: aiData.title || fileName,
    summary: aiData.summary || "",
    tags: Array.isArray(aiData.tags) ? aiData.tags : (aiData.tags || "").split(",").map((t: string) => t.trim()),
    category: aiData.category || "LegendsOS Basics",
    format: aiData.format || contentType,
    recommendedLocation: aiData.recommendedLocation || "LF Resources",
    legendsosVersion: aiData.legendsosVersion || "1.0",
  };
}
