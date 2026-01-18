# AI Slop Avoidance Guide

A comprehensive guide to avoiding patterns that signal AI-generated content. Based on research from [Wikipedia](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing), [Plagiarism Today](https://www.plagiarismtoday.com/2025/06/26/em-dashes-hyphens-and-spotting-ai-writing/), [Rost Glukhov](https://www.glukhov.org/post/2025/12/ai-slop-detection/), and analysis of AI detection patterns.

---

## The Core Problem

In 2025, "AI slop" became Merriam-Webster's Word of the Year. AI-generated content now makes up over half of English-language web content. Readers and algorithms have become adept at spotting AI patterns. Content that reads as AI-generated loses credibility instantly.

**The test:** If you can swap out the subject, names, and locations and the content remains equally valid, it's slop.

---

## Banned Words (Complete List)

These words appear disproportionately in AI-generated text. Never use them.

### Verbs

| Word | Why It's Banned |
|------|-----------------|
| delve | ChatGPT's signature word (2023-2024) |
| embark | Signals "beginning a journey" cliché |
| unleash | Hyperbolic action word |
| harness | Tech buzzword overuse |
| unlock | "Unlock the secrets" pattern |
| navigate | "Navigate the landscape" cliché |
| revolutionize | Hyperbolic claim |
| foster | Corporate-speak |
| elevate | Vague improvement claim |
| leverage | Business jargon |
| underscore | Overly formal emphasis |
| showcase | Exhibition language |
| streamline | Process optimization cliché |
| spearhead | Leadership cliché |
| bolster | Strengthening cliché |

### Adjectives

| Word | Why It's Banned |
|------|-----------------|
| vibrant | Empty descriptor |
| bustling | Scene-setting cliché |
| intricate | Complexity without specifics |
| pivotal | Overused importance marker |
| crucial | Overused importance marker |
| cutting-edge | Tech buzzword |
| robust | Engineering buzzword |
| seamless | UX buzzword |
| meticulous | Precision cliché |
| unparalleled | Superlative abuse |
| groundbreaking | Hyperbolic |
| comprehensive | Scope claim |
| innovative | Empty marketing word |
| dynamic | Vague energy claim |
| holistic | Buzzword |
| nuanced | Ironic lack of nuance |
| multifaceted | Complexity claim |

### Nouns

| Word | Why It's Banned |
|------|-----------------|
| tapestry | Metaphor overuse ("rich tapestry") |
| realm | Fantasy-speak in tech contexts |
| landscape | "Navigate the landscape" |
| paradigm | Academic buzzword |
| synergy | Corporate buzzword |
| beacon | Guidance metaphor overuse |
| testament | Evidence cliché |
| game-changer | Hyperbolic impact claim |
| cornerstone | Foundation cliché |
| catalyst | Change metaphor |
| ecosystem | Tech buzzword |
| stakeholder | Corporate-speak |
| bandwidth | Capacity metaphor overuse |
| deep dive | Exploration cliché |
| framework | Structure buzzword |

### Phrases (Absolute Bans)

Never write these phrases:

**Opening clichés:**

- "In today's fast-paced world..."
- "In today's digital age..."
- "In the ever-evolving landscape of..."
- "In the realm of..."
- "Have you ever wondered..."
- "It goes without saying..."

**Emphasis patterns:**

- "It's important to note that..."
- "It's worth noting that..."
- "It's essential to remember..."
- "It's crucial to understand..."
- "Arguably..."
- "To some extent..."

**Transition overuse:**

- "Furthermore..."
- "Moreover..."
- "Additionally..."
- "That being said..."
- "With that in mind..."
- "Having said that..."

**Closing clichés:**

- "In conclusion..."
- "To summarize..."
- "To sum up..."
- "All in all..."
- "At the end of the day..."
- "Without further ado..."

**Filler phrases:**

- "A myriad of..."
- "A plethora of..."
- "At its core..."
- "When it comes to..."
- "In terms of..."
- "As a matter of fact..."
- "The fact of the matter is..."

**Commong phases:**

- "It's not this, it's about that..."

---

## Banned Punctuation and Formatting

### Em-Dashes (—)

**Status: BANNED ENTIRELY**

Em-dashes (the long dash: —) have become the signature of AI writing. GPT-4 uses approximately 10x more em-dashes than GPT-3.5. Human readers now associate em-dashes with AI-generated content.

**Note:** Regular hyphens (-) and en-dashes (–) are fine. Only the em-dash (—) is banned.

| Character | Name | Example | Status |
|-----------|------|---------|--------|
| - | Hyphen | well-known | ✅ OK |
| – | En-dash | 2020–2024 | ✅ OK |
| — | Em-dash | word—word | ❌ BANNED |

**Instead of em-dashes, use:**

- Commas for mild pauses
- Parentheses for asides
- Periods to break into separate sentences
- Colons to introduce explanations
- Semicolons to connect related clauses

**Before (AI pattern):**
> The system processes requests in real-time—analyzing patterns, executing tools, and returning results—all within milliseconds.

**After (human pattern):**
> The system processes requests in real-time. It analyzes patterns, executes tools, and returns results, all within milliseconds.

### Curly Quotes

ChatGPT and DeepSeek typically use curly quotation marks ("like this") instead of straight quotes ("like this"), and may do this inconsistently. Be consistent with your quote style.

### Colon-Heavy Titles

Titles with colons signal AI patterns:

- ❌ "How to Build Agents: The Complete Guide"
- ❌ "AI Engineering: A Comprehensive Overview"
- ✅ "Building Agents That Actually Work"
- ✅ "What I Learned Shipping 50 AI Features"

---

## Structural Patterns to Avoid

### Uniform Sentence Length

**Problem:** AI generates sentences averaging 25-30 words with minimal variation.

**Detection:** If all sentences are roughly the same length, it reads as mechanical.

**Fix:** Deliberately vary sentence length.

**Before (AI pattern):**
> The model processes input through multiple layers of transformation. Each layer applies attention mechanisms to understand context. The final layer produces output tokens sequentially. This approach enables sophisticated language understanding.

All sentences: 8-10 words. Mechanical rhythm.

**After (human pattern):**
> The model processes input through multiple layers. Each layer? Attention mechanisms that build context understanding. The final layer produces tokens one by one, which is why responses stream rather than appear all at once. Simple concept, but the implications are massive.

Sentence lengths: 7, 7, 19, 8 words. Natural rhythm.

### Immediate Jump to Lists

**Problem:** AI immediately structures content into bullet points or numbered lists without narrative buildup.

**Fix:** Build tension with prose before introducing lists. Use lists sparingly.

**Before (AI pattern):**
> Here are the key benefits of this approach:
>
> - Improved performance
> - Better scalability
> - Reduced costs

**After (human pattern):**
> Most teams overcomplicate this. They build elaborate pipelines when a simple approach would work better. Three things matter: performance (obviously), scalability (less obvious), and cost (often ignored until the bill arrives).

### Excessive Parallelism

**Problem:** AI loves the pattern "It's not about X, it's about Y" and repeats it.

**Before (AI pattern):**
> It's not about the tools, it's about the outcomes. It's not about complexity, it's about simplicity. It's not about features, it's about user value.

**After (human pattern):**
> Tools don't matter. Outcomes do. Stop adding complexity. Ship something simple that users actually want.

### Perfect Grammar

**Problem:** Zero typos creates an "over-sanitized" feeling that betrays AI generation.

**Reality:** Human writers make occasional errors. A typo has become a badge of authenticity.

**Guidance:** Don't artificially insert errors, but don't obsessively polish either. Natural imperfection is acceptable.

---

## Tone Patterns to Avoid

### Excessive Hedging

**Problem:** AI overuses qualifiers to avoid commitment.

**Red flags:** might, may, could, arguably, perhaps, typically, generally, often, sometimes, in some cases, to some extent

**Before (AI pattern):**
> This approach might be beneficial for some teams, particularly those who may be experiencing scalability challenges. It could potentially reduce costs, though results may vary depending on various factors.

**After (human pattern):**
> This approach works for teams hitting scale problems. It cuts costs. Not for everyone, but if you're processing more than 10K requests daily, pay attention.

### Artificial Balance

**Problem:** AI presents artificially balanced "both sides" perspectives even when one side is clearly correct.

**Before (AI pattern):**
> There are valid arguments on both sides of this debate. Some experts argue for approach A, while others prefer approach B. Each has its merits and drawbacks.

**After (human pattern):**
> Approach A is better. Here's why. The people advocating for B are usually dealing with legacy constraints that don't apply to new projects.

### Generic Tone

**Problem:** AI writing lacks personality. Every piece sounds like every other piece.

**Test:** Could you swap out the author's name and the piece would read identically? That's AI-generic.

**Fix:** Develop a recognizable voice. Include opinions, preferences, and personality.

---

## Content Deficiencies to Address

### Lack of Specificity

**Problem:** AI avoids concrete details, statistics, names, and dates.

**Before (AI pattern):**
> Many companies have adopted this approach with significant results. Industry experts recommend this methodology for improved outcomes.

**After (human pattern):**
> Stripe adopted this in 2022. Their API latency dropped 40%. When Guillermo Rauch talked about it at Vercel Conf, he said it changed how they think about edge computing.

### Missing Personal Experience

**Problem:** AI cannot include genuine anecdotes or personal stories.

**Fix:** Include specific experiences, lessons learned, and personal context.

**Before (AI pattern):**
> Teams often struggle with deployment complexity. This can lead to delays and frustration.

**After (human pattern):**
> Last month I spent three days debugging a deployment issue that turned out to be a missing environment variable. Three days. One variable. That's when I started automating our config checks.

### Surface-Level Analysis

**Problem:** AI provides accurate but shallow information without novel insight.

**Test:** Is this something anyone could find on the first page of Google results? That's surface-level.

**Fix:** Add perspective, connect dots others haven't, share what you learned that isn't obvious.

---

## Detection Signals (What Detectors Look For)

Understanding detection helps you avoid triggering false positives.

### Perplexity

Measures how predictable the text is. Low perplexity (very predictable) signals AI.

**Fix:** Use idioms, metaphors, and unexpected word choices. "The project hit a wall because we put the cart before the horse" is less predictable than "The project failed due to planning issues."

### Burstiness

Measures variation in sentence structure and length. Low burstiness (uniform structure) signals AI.

**Fix:** Deliberately vary:

- Sentence length (5 words to 40 words)
- Sentence structure (questions, declarations, fragments)
- Paragraph length

### Stylistic Fingerprints

Detectors maintain databases of patterns unique to each AI model.

**Fix:** The single most effective technique is using a different AI model to rewrite drafts, then manually editing. Cross-model rewrites "wash away" stylistic fingerprints.

---

## The Human Touch Checklist

Before publishing, verify:

### Voice & Personality

- [ ] Does it sound like a specific person wrote it?
- [ ] Are there opinions, not just facts?
- [ ] Is there personality in word choices?

### Specificity

- [ ] Are there specific names, numbers, and dates?
- [ ] Are examples concrete, not hypothetical?
- [ ] Are there real anecdotes or experiences?

### Structure

- [ ] Does sentence length vary dramatically?
- [ ] Are there short punchy sentences mixed with longer ones?
- [ ] Does it avoid immediate bullet-point lists?

### Word Choice

- [ ] Zero words from the banned list?
- [ ] Zero em-dashes?
- [ ] No "In conclusion" or "It's important to note"?

### Stance

- [ ] Does the piece take clear positions?
- [ ] Minimal hedging language?
- [ ] No artificial "both sides" balance?

---

## Summary

The goal isn't to "trick" AI detectors. The goal is to write content that genuinely reflects human thought patterns, personality, and insight.

**Core principles:**

1. **Be specific.** Names, numbers, dates, concrete examples.
2. **Be opinionated.** Take stances. Avoid hedge words.
3. **Be personal.** Include anecdotes, lessons learned, your perspective.
4. **Be varied.** Mix sentence lengths and structures.
5. **Be imperfect.** Don't over-polish. Natural writing has rough edges.

**The test that matters:** Would a reader finish this and feel they gained genuine insight that only a thoughtful human could provide? If yes, you've succeeded.
