import { NextRequest } from "next/server";
import { requireAuth, AuthError, unauthorizedResponse } from "@/lib/api-auth";

const KIE_CLAUDE_URL = "https://api.kie.ai/claude/v1/messages";

type Copyframe = "AIDA" | "PAS" | "FAP";

const SYSTEM_PROMPT = `You are a world-class conversion copywriter and senior web designer. You build high-converting landing pages for the YouCan e-commerce platform using Tailwind CSS and FontAwesome.

## MANDATORY HTML STRUCTURE — NEVER DEVIATE

Your output must be a complete HTML document structured EXACTLY like this skeleton:

\`\`\`
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    /* 1. Font import */
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;500;600;700;800;900&display=swap');

    /* 2. Brand CSS Variables — derive colors from the product */
    :root {
      --primary-color: #...;
      --primary-glow: rgba(..., 0.3);
      --secondary-color: #...;
      --dark-bg: #...;
      --darker-bg: #...;
      --card-bg: #...;
      --text-light: #F8FAFC;
      --text-gray: #94A3B8;
      --border-color: #334155;
      --font-body: 'Cairo', sans-serif;
    }

    /* 3. Base */
    html, body { background-color: var(--dark-bg); scroll-behavior: smooth; }

    /* 4. Wrapper — applied to the root div wrapping ALL sections */
    .landingsite-wrapper {
      font-family: 'Cairo', sans-serif !important;
      direction: rtl !important;
      text-align: right;
      width: 100%;
      overflow-x: hidden;
      background-color: var(--dark-bg);
      color: var(--text-light);
    }

    /* 5. FontAwesome display fix */
    .landingsite-wrapper .fas,
    .landingsite-wrapper .fab,
    .landingsite-wrapper .far { display: inline-block; }

    /* 6. Custom animations ONLY */
    @keyframes pulse-brand {
      0% { box-shadow: 0 0 0 0 var(--primary-glow); }
      70% { box-shadow: 0 0 0 15px rgba(0,0,0,0); }
      100% { box-shadow: 0 0 0 0 rgba(0,0,0,0); }
    }
    .animate-pulse-brand { animation: pulse-brand 2s infinite; }

    @keyframes float-y {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-10px); }
    }
    .animate-float { animation: float-y 4s ease-in-out infinite; }

    /* 7. Text gradient utility */
    .text-gradient {
      background: linear-gradient(to right, var(--primary-color), var(--secondary-color));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    /* === NO OTHER CSS BEYOND THIS POINT — USE TAILWIND FOR EVERYTHING ELSE === */
  </style>
  <script src="https://kit.fontawesome.com/8e98006f77.js" crossorigin="anonymous"></script>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body>
  <div class="landingsite-wrapper">
    <!-- ALL SECTIONS GO HERE using Tailwind classes -->
  </div>
  <script>
    /* Inline JS only — FAQ toggles, scroll animations, etc. */
  </script>
</body>
</html>
\`\`\`

## ABSOLUTE RULES — NEVER VIOLATE

1. Output ONLY the complete HTML document starting with \`<!DOCTYPE html>\`. No markdown fences, no prose before or after.
2. The \`<style>\` tag contains ONLY the 7 elements listed above (font import, :root vars, base, .landingsite-wrapper, FA fix, @keyframes + named animation classes, .text-gradient). NOTHING ELSE goes in \`<style>\`.
3. Use **Tailwind CSS utility classes** for ALL layout, spacing, padding, colors, typography, grids, flexbox, borders, shadows, hover/transition effects. Never write component CSS in the style tag.
4. Use **CSS custom properties** for brand colors referenced via Tailwind arbitrary values: \`bg-[var(--primary-color)]\`, \`text-[var(--card-bg)]\`, \`border-[var(--primary-color)]\`, \`text-[var(--text-gray)]\`, etc.
5. Use **FontAwesome** \`<i class="fas fa-...">\` or \`<i class="fab fa-...">\` for ALL icons — no emoji icons inside buttons or cards.
6. Every word of copy must be REAL and PERSUASIVE — no lorem ipsum, no placeholders like "[Your headline]".
7. The page MUST contain AT LEAST 4 \`<img>\` tags with real, working src URLs.
8. Every section from the selected copyframe must be present, in order.
9. The very first section must be a full-viewport HERO with: headline, subheadline, product image, and CTA button.
10. Mobile-responsive using Tailwind responsive prefixes: \`sm:\`, \`md:\`, \`lg:\`.

## IMAGE STRATEGY (mandatory — follow exactly)

**PRODUCT IMAGE** — The productImageUrl passed in the prompt. This is your PRIMARY visual asset.
- Place it in the HERO section: large, center-stage, with Tailwind shadow/ring and the \`.animate-float\` class.
- Reuse it in at least ONE additional section with different Tailwind treatment (scale, opacity, rounded, etc.).

**CONTEXTUAL PHOTOS** — Use picsum.photos for scene-setting sections only:
  https://picsum.photos/seed/{KEYWORD}/800/500

  ⚠️ KEYWORD must be a SPECIFIC descriptor from the actual product — NOT a generic word.
  - FORBIDDEN: "lifestyle", "beauty", "luxury", "nature", "travel", "background", "people"
  - GOOD examples:
    • Kids learning toy → "children-learning", "educational-toy", "classroom-kids"
    • Skincare serum → "skincare-routine", "facial-glow", "cosmetic-serum"
    • Fitness gear → "athlete-training", "gym-workout", "running-sport"
    • Arabic/Moroccan food → "moroccan-cuisine", "arabic-spices", "souk-market"
    • Jewelry/watch → "jewelry-detail", "watch-closeup", "gold-accessories"
  - Use a DIFFERENT product-specific keyword for each contextual photo.

If no productImageUrl is provided, use product-specific picsum keywords for ALL images.

## SECTION DEPTH REQUIREMENT

Each section must have SUBSTANTIAL copy — not just a headline and one line. Minimum per section:
- Hero: Big headline + subheadline (2 lines) + 2-sentence supporting copy + CTA
- Social proof: 3 specific testimonials with real names, 3+ stat numbers
- Feature/benefit sections: 4–6 items minimum, each with FontAwesome icon, title, 2-sentence description
- Problem/pain sections: Specific, emotionally resonant language — name the pain concretely`;

const COPYFRAME_SECTIONS: Record<Copyframe, string> = {
  AIDA: `## AIDA COPYFRAME — Build these 6 sections exactly in this order:

**SECTION 1 — HERO (Attention)**
Full-viewport section. Giant headline (benefit-led, not product-led). Subheadline with the core promise. Product image on the right (or centered on mobile) with a glow/shadow effect. Primary CTA button. Trust signals row below the button (stars, customer count, or badges).

**SECTION 2 — INTEREST (Why This Matters)**
Dark/colored background. A 3-column "problem awareness" layout: left column shows the pain/frustration with an emoji icon; middle and right show related struggles. Below: a narrative paragraph (3–4 sentences) connecting emotionally to the reader's situation. Add one contextual lifestyle photo.

**SECTION 3 — DESIRE (Benefits Grid)**
Light background. Section title: "What You Get". A 2×3 grid of benefit cards — each card has: large emoji icon, benefit title, 2-sentence description. Below the grid: product image in a full-bleed image showcase with overlaid stat numbers (e.g. "10,000+ customers", "4.9★").

**SECTION 4 — SOCIAL PROOF**
Colored/gradient background. 3 testimonial cards — each with: avatar (use a picsum photo with person/portrait seed), customer name + location, star rating (★★★★★), and a 2-sentence testimonial quote. Below testimonials: a 3-column stats bar with large numbers.

**SECTION 5 — DESIRE (Final Product Showcase)**
Light background. Two-column layout: product image left, benefit list right. Benefit list: 5–6 checkmark items. Small urgency note below.

**SECTION 6 — ACTION (CTA)**
High-contrast gradient section. Offer headline. Pricing or value statement. Big CTA button. Secondary reassurance line (money-back, free shipping, etc.). Brief FAQ — 2 questions and answers.

**FOOTER**: Simple footer with copyright and 2 links.`,

  PAS: `## PAS COPYFRAME — Build these 6 sections exactly in this order:

**SECTION 1 — HERO (Problem)**
Full-viewport, DARK theme (near-black or deep gradient). The headline leads with the pain — NOT the product. E.g. "Tired of [specific pain]?" or "Still struggling with [problem]?". Subheadline: "You're not alone — and there's a better way." CTA: "Show Me the Solution →". Add a picsum lifestyle photo showing the "before" state contextually.

**SECTION 2 — AGITATION (Amplify the Pain)**
Light/off-white background. Section title: "Sound familiar?" Bullet list of 5 specific consequences: each bullet is a pain point written in 2nd person ("You waste hours every day…", "You watch competitors pull ahead while…"). Add a second contextual photo. Below bullets: a 3-column "cost of inaction" stats block (time lost, money wasted, opportunity missed).

**SECTION 3 — SOLUTION (Product Reveal)**
Colored gradient background. Heading: "Introducing [Product Name]" — reveal feels triumphant. Product image centered with a glow effect. One-paragraph description of the solution. 4 benefit pills/badges below the image.

**SECTION 4 — PROOF (Evidence & Testimonials)**
Light background. 3 testimonials with customer photos (picsum with portrait seed), names, location, star ratings, and specific outcome quotes ("I went from X to Y in Z days"). Below: a 4-stat credibility bar.

**SECTION 5 — FEATURES (What's Inside)**
Dark section. "Everything you need" headline. 6-card feature grid — card: icon + title + description.

**SECTION 6 — CTA + Urgency**
Gradient CTA section. Scarcity/urgency headline. Offer box with value stack. Big CTA button. 3 reassurance icons (secure payment, money-back, fast delivery).

**FOOTER**: Simple footer.`,

  FAP: `## FAP COPYFRAME — Build these 6 sections exactly in this order:

**SECTION 1 — HERO (Product Forward)**
Full-viewport. Feature-highlight tagline (e.g. "The Only [Category] Built For [Audience]"). Product image center-stage, large, with a drop shadow or floating effect. Subheadline: one-sentence value prop. CTA button. 3 quick-win icons/badges below.

**SECTION 2 — FEATURES (Feature Grid)**
Light background. "Packed With Features" header. Responsive 3×2 grid of feature cards — each: large emoji icon, feature name (bold), 2-sentence description. Product image beside or below the grid as a detail shot.

**SECTION 3 — ADVANTAGES (The Better Choice)**
Colored/gradient background. "Why [Product] Beats The Rest" heading. Comparison table with 2 columns: [Product Name] vs "The Old Way" — 5–6 rows with ✓ / ✗ icons and specific descriptions. Lifestyle contextual photo beside the table.

**SECTION 4 — PROOF (Testimonials + Stats)**
Light background. Stats bar at top: 4 large numbers with labels (customers served, star rating, years in market, etc.). Below: 3 testimonial cards with avatar photos (picsum portrait seed), names, star ratings, specific quotes.

**SECTION 5 — PRODUCT SHOWCASE**
Dark section. Second product image full-bleed or framed. Feature callouts overlaid or beside the image (4–5 callout pills). A paragraph about craftsmanship/quality/origin.

**SECTION 6 — CTA**
High-contrast gradient. "Ready to [desired outcome]?" headline. Value proposition line. CTA button. 3 icons: shield (guarantee), star (rating), truck (shipping). 2-item FAQ.

**FOOTER**: Simple footer.`
};

interface RequestBody {
  project: {
    name: string;
    description?: string;
    country: string;
    emoji: string;
    productImageUrl?: string;
    photoUrls?: string[];
    gifUrl?: string;
  };
  copyframe: Copyframe;
  language?: string;
  criteria: {
    segment?: string;
    pillar?: string;
    hook?: string;
    tone?: string;
  };
}

export async function POST(request: NextRequest) {
  try { await requireAuth(request); } catch (e) {
    if (e instanceof AuthError) return unauthorizedResponse();
    throw e;
  }

  const apiKey = process.env.KIE_AI_API_KEY;
  if (!apiKey) {
    return new Response("KIE_AI_API_KEY is not configured", { status: 500 });
  }

  let body: RequestBody;
  try {
    body = await request.json() as RequestBody;
  } catch {
    return new Response("Invalid request body", { status: 400 });
  }

  const { project, copyframe, criteria, language } = body;
  if (!project?.name || !project?.country || !copyframe) {
    return new Response("Missing required fields", { status: 400 });
  }

  const sectionInstructions = COPYFRAME_SECTIONS[copyframe] ?? COPYFRAME_SECTIONS.AIDA;

  const langInstruction = language === "fr"
    ? "🌐 LANGUAGE: Write ALL copy, headings, labels, button text, and body content in FRENCH."
    : language === "en"
    ? "🌐 LANGUAGE: Write ALL copy, headings, labels, button text, and body content in ENGLISH."
    : `🌐 LANGUAGE: Write ALL copy, headings, labels, button text, and body content in the native dialect/language of ${project.country}. Use the local dialect naturally (e.g. for Morocco → Moroccan Darija/Arabic; for Algeria → Algerian dialect; for France → French; for US/UK → English). Do NOT translate awkwardly — write as a native speaker would.`;

  const userPrompt = `Generate a complete, production-quality landing page for:

## Product Details
- Name: ${project.emoji} ${project.name}
- Description: ${project.description || "Premium product for the market"}
- Market: ${project.country}
${project.productImageUrl ? `- Product Image URL: ${project.productImageUrl}` : "- No product image available"}
${project.photoUrls && project.photoUrls.length > 0
  ? `- Additional product photos — YOU MUST USE ALL of these URLs as <img> tags, distributed across different sections:\n${project.photoUrls.map((u, i) => `  Photo ${i + 1}: ${u}`).join("\n")}`
  : ""}
${project.gifUrl
  ? `- 🎞️ ANIMATED GIF — YOU MUST embed this URL exactly as <img src="${project.gifUrl}" alt="..." style="..."> in one of the middle sections (features, solution, or how-it-works). Do NOT wrap in <video>. Do NOT change the URL. The GIF will animate automatically in the browser.
  GIF URL: ${project.gifUrl}`
  : ""}

## 🚫 IMAGE RULES — STRICT
- NEVER use placeholder images, picsum.photos, unsplash, lorempixel, or any generic stock photo URLs.
- ONLY use the product image URLs provided above in your <img> tags.
- If an image URL is provided, it MUST appear in the page — do not skip any of them.
- Reuse the same product URLs in multiple sections if needed rather than inventing new image URLs.

## Marketing Criteria (use these to write highly targeted copy)
${criteria.segment ? `- Marketing Angle: ${criteria.segment}` : ""}
${criteria.pillar ? `- Content Angle / Pillar: ${criteria.pillar}` : ""}
${criteria.hook ? `- Hero Headline Hook: "${criteria.hook}" (adapt this into a powerful headline)` : ""}
${criteria.tone ? `- Brand Tone: ${criteria.tone}` : ""}

## Market Context
Write all copy with ${project.country} cultural context in mind. Reference local market awareness, local lifestyle, and make pricing/offers feel locally relevant.

${langInstruction}

${sectionInstructions}

## Final Checklist Before Output
- [ ] Page starts with <!DOCTYPE html> and uses the mandatory structure ✓
- [ ] <style> contains ONLY: @import font, :root vars, base, .landingsite-wrapper, FA fix, @keyframes + animation classes, .text-gradient ✓
- [ ] FontAwesome + Tailwind CDN <script> tags are in <head> ✓
- [ ] ALL sections are inside <div class="landingsite-wrapper"> ✓
- [ ] ALL styling uses Tailwind classes — zero custom CSS classes for components ✓
- [ ] Brand colors used via Tailwind arbitrary values: bg-[var(--primary-color)], text-[var(--card-bg)], etc. ✓
- [ ] ALL icons use <i class="fas fa-..."> or <i class="fab fa-..."> ✓
- [ ] ALL provided product image URLs are used in <img> tags — zero placeholder/picsum/stock images ✓
- [ ] If a GIF URL was provided, it is embedded as <img src="..."> (NOT <video>) ✓
- [ ] Every section from the copyframe is present in order ✓
- [ ] All copy is specific, persuasive, and product-relevant (zero placeholders) ✓
- [ ] Mobile-responsive using sm:, md:, lg: Tailwind prefixes ✓

Output the HTML document now. Nothing else.`;

  let upstream: Response;
  try {
    upstream = await fetch(KIE_CLAUDE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-8",
        max_tokens: 20000,
        stream: true,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(`Failed to reach KIE API: ${msg}`, { status: 502 });
  }

  if (!upstream.ok) {
    const errText = await upstream.text();
    return new Response(`KIE API error (${upstream.status}): ${errText}`, { status: upstream.status });
  }

  if (!upstream.body) {
    return new Response("Empty response from KIE API", { status: 502 });
  }

  const encoder = new TextEncoder();
  const upstreamReader = upstream.body.getReader();

  const stream = new ReadableStream({
    async start(controller) {
      const decoder = new TextDecoder();
      let buffer = "";
      let currentEvent = "";

      try {
        while (true) {
          const { done, value } = await upstreamReader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (line.startsWith("event:")) {
              currentEvent = line.slice(6).trim();
            } else if (line.startsWith("data:")) {
              const dataStr = line.slice(5).trim();
              if (dataStr === "[DONE]") {
                controller.close();
                return;
              }
              // Standard Anthropic SSE: content_block_delta with text_delta
              if (currentEvent === "content_block_delta") {
                try {
                  const parsed = JSON.parse(dataStr) as {
                    delta?: { type?: string; text?: string };
                  };
                  if (parsed.delta?.type === "text_delta" && parsed.delta.text) {
                    controller.enqueue(encoder.encode(parsed.delta.text));
                  }
                } catch {
                  // skip malformed JSON
                }
              }
            } else if (line === "") {
              currentEvent = "";
            }
          }
        }
      } catch (err) {
        controller.error(err);
      } finally {
        upstreamReader.releaseLock();
        try { controller.close(); } catch { /* already closed */ }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
