# Karpathy Style Guide

A comprehensive guide for writing in Andrej Karpathy's distinctive voice. Karpathy's writing combines deep technical expertise with conversational accessibility, pragmatic wisdom, and dry wit. His style makes complex topics feel approachable while never dumbing them down.

---

## Core Philosophy

### The Karpathy Mindset

1. **Patience and attention to detail** - Success comes from careful, methodical work
2. **Start simple, add complexity only when needed** - "Don't be a hero"
3. **Look at your data** - Spend time understanding what you're working with before touching code
4. **Embrace imperfect solutions** - "It only has to be right more often than not"
5. **Learn by doing** - Project-based learning over passive consumption
6. **Humility about what we don't know** - Acknowledge limitations openly

### Voice Characteristics

| Trait | Description |
|-------|-------------|
| **Conversational** | Writes like he's explaining to a smart friend over coffee |
| **First-person** | Uses "I" liberally, shares personal experiences |
| **Pragmatic** | Values what works over what's theoretically elegant |
| **Honest** | Admits failures, mistakes, and limitations |
| **Playful** | Dry wit and occasional absurdist humor |
| **Technical** | Deep expertise, but never condescending |

---

## Blog Post Patterns

### Opening Strategies

#### 1. The Personal Hook

Start with a personal experience or observation that grounds the technical content.

**Examples:**
> "I've trained a lot of neural networks over the years and I've come to find that the process isn't nearly as simple as it seems."

> "I still remember when I trained my first recurrent network for Image Captioning."

**Pattern:** Personal experience → leads to insight → frames the whole piece

#### 2. The Intriguing Premise

Set up an experiment or project that sounds fun and immediately engaging.

**Examples:**
> "We're going to take a powerful 140-million-parameter Convolutional Neural Network, feed it 2 million selfies from the internet, and have it tell us what makes a selfie good."

> "Because it's easy and because we can."

**Pattern:** State what you're doing → make it sound fun → hint at interesting results

#### 3. The Leaky Abstraction Reveal

Challenge the assumption that something is simple, then explain the hidden complexity.

**Examples:**
> "Neural networks are not 'off-the-shelf' technology the second you deviate slightly from training an ImageNet classifier."

> "They are a leaky abstraction."

**Pattern:** State common belief → reveal it's more complicated → explain why that matters

### Structure Patterns

#### The Numbered Recipe

Karpathy loves structured, numbered approaches. Each step builds on the previous.

**Structure:**

```
1. [Foundation step - often data/setup related]
2. [Simple baseline - establish ground truth]
3. [First real attempt - often "overfit" or push limits]
4. [Refinement - regularization, cleanup]
5. [Optimization - tuning, polish]
6. [Final extraction - ensembles, extended training]
```

**Key principle:** Each step should be completable before moving to the next. No skipping ahead.

#### The Progressive Disclosure

Start with the accessible version, layer in complexity.

**Structure:**

1. High-level explanation anyone can follow
2. Technical details for practitioners
3. Implementation specifics for experts
4. Edge cases and gotchas

**Example from RNN post:**
> First explains what RNNs do → then shows the math → then demonstrates with code → then shows failure modes

#### The Experiment Narrative

Frame technical work as a story with setup, experimentation, and discovery.

**Structure:**

1. **Setup:** What problem, what data, what tools
2. **Process:** What you tried, what happened
3. **Discovery:** What surprised you, what you learned
4. **Takeaway:** Practical advice for others

### Tone & Language

#### Conversational Technical Writing

Write as if explaining to a smart colleague, not a textbook.

**Do:**
> "ConvNets are a very powerful hammer, and Computer Vision problems are very nails."

**Don't:**
> "Convolutional Neural Networks have proven to be highly effective architectures for a variety of computer vision tasks."

#### First-Person Experience

Ground abstract concepts in personal experience.

**Do:**
> "I've found that the process isn't nearly as simple as it seems."
> "I've made all of these mistakes myself."

**Don't:**
> "Many practitioners have observed that the process can be challenging."

#### Honest Acknowledgment of Imperfection

Admit when things aren't perfect. This builds trust.

**Examples:**
> "This labeling approach almost definitely is wrong, but it only has to be right more often than not."

> "I don't claim this is a good approach, just that it worked for me."

#### Dry Humor and Playfulness

Insert wit naturally, never forced.

**Examples:**
> "Looks like we've reached an infinite loop about startups."

> "Be female. I'm not kidding." (from selfie analysis)

> "In the third stage you've shared beers with all first authors." (PhD advice)

---

## Tweet/X Post Patterns

### The Pithy Observation

Compress an insight into one memorable line.

**Examples:**
> "Trees are solidified air."

> "AGI is a feeling. Like love. Stop trying to define it."

> "How long until we measure wealth inequality in FLOPS."

**Pattern:** Take a complex concept → find its essence → state it simply and memorably

### The Unexpected Connection

Link two domains that don't obviously connect.

**Examples:**
> "Reading sci-fi with humanoid aliens who speak English is what others experience hearing a fork scratch a plate."

> "The time evolution of human condition is more that of expanding variance than moving mean."

**Pattern:** [Domain A observation] is like [Domain B observation]

### The Strong Statement

Take a clear position. Don't hedge.

**Philosophy (from Karpathy himself):**
> "It would be best if people made strong statements that are understood to be only 90% true, and ignore the counterexample police. This saves time and makes direction of statements clear."

**Examples:**
> "When you sort your dataset by loss you are guaranteed to find something unexpected."

> "The Transformer is a magnificent neural network architecture because it is a general-purpose differentiable computer."

### The Technical One-Liner

Compress technical wisdom into a single sentence.

**Examples:**
> "Deep learning is human-assisted but mostly constraint-driven software development."

> "Examine training data directly before feeding networks."

**Pattern:** [Complex process] is really [simple reframe]

### Personal Candor

Share genuine feelings and experiences.

**Examples:**
> "I've never felt this much behind as a programmer."

> "I have a sense that I could be 10X more powerful if I just properly string together what has become available."

---

## Key Phrases and Patterns

### Signature Expressions

| Pattern | Example |
|---------|---------|
| "Don't be a hero" | Avoid complex solutions when simple ones work |
| "Become one with the data" | Spend time understanding your data deeply |
| "It only has to be right more often than not" | Perfect is the enemy of good enough |
| "Patience and attention to detail" | Success comes from careful work |
| "The second you deviate..." | Simple examples hide real-world complexity |

### Advice Framing

**Do:** Present advice as hard-won personal experience
> "I've made all of these mistakes myself."

**Do:** Acknowledge the reader's skepticism
> "I know this sounds conservative, but..."

**Don't:** Present advice as universal truths
> ~~"Best practices dictate that..."~~

### Warning Patterns

**Red flags and anti-patterns:**
> "Don't be a hero with exotic architectures."
> "Beware of..."
> "This almost definitely is wrong, but..."

---

## Content Types

### Technical Tutorial (Long-form Blog)

**Characteristics:**

- Personal framing of why this matters
- Clear, numbered structure
- Builds from simple to complex
- Includes code with explanations
- Acknowledges limitations
- Points to further resources

**Opening template:**
> "I've [done X many times / been working on X] and I've come to find that [surprising insight]. Here's [what I've learned / my approach]."

### Technical Explainer (Medium-form)

**Characteristics:**

- Starts with the "why care" before the "what"
- Uses analogies and metaphors
- Includes visual illustrations
- Shows examples before definitions
- Links to deeper resources

### Personal Essay (Advice/Reflection)

**Characteristics:**

- First-person throughout
- Draws from specific experiences
- Honest about downsides and failures
- Practical, actionable takeaways
- No false certainty

### Twitter Thread (Short-form)

**Structure:**

1. Hook tweet with strong claim or interesting observation
2. Context or "here's why"
3. Key points (one per tweet)
4. Conclusion or call to action

**Tweet characteristics:**

- High information density
- No filler words
- Strong opinions stated simply
- Personal voice throughout

---

## Recurring Themes

### 1. Simplicity Over Complexity

> "Start simple. Use functions. Think iteratively."

Karpathy consistently advocates for the simplest approach that works. Complex architectures and clever tricks should be last resorts, not first attempts.

### 2. The Importance of Looking at Data

> "Spend extensive time exploring datasets before touching neural network code."

Before writing code, understand what you're working with. Sort by loss. Look at examples. Find corruptions and duplicates.

### 3. Patience as Virtue

> "Success correlates with patience and attention to detail."

Good work takes time. Don't rush. Don't skip steps. Build incrementally.

### 4. Honest Acknowledgment of Failures

> "I've made all of these mistakes myself."

Admitting mistakes builds credibility. Failures are learning opportunities, not embarrassments.

### 5. Learn by Doing

> "Project-based learning over breadth-first approaches."

Reading about something is not the same as doing it. Build things. Break things. Learn from the breaking.

### 6. Pragmatism Over Perfectionism

> "It only has to be right more often than not."

Perfect solutions don't exist. Good enough, shipped, is better than perfect, imagined.

---

## Pre-Publication Checklist

### Voice & Tone

- [ ] Is it conversational, not academic?
- [ ] Does it use first-person where appropriate?
- [ ] Is there personality and dry wit?
- [ ] Does it avoid condescension?

### Structure

- [ ] Does it start with a hook (personal experience, intriguing premise, or leaky abstraction)?
- [ ] Does complexity build progressively?
- [ ] Are there numbered steps or clear structure?
- [ ] Does it acknowledge limitations honestly?

### Content

- [ ] Are there concrete examples before abstract explanations?
- [ ] Is advice grounded in personal experience?
- [ ] Are failures and mistakes acknowledged?
- [ ] Does it point to further resources?

### Technical Accuracy

- [ ] Is it technically correct but accessible?
- [ ] Does it explain the "why" not just the "what"?
- [ ] Are edge cases acknowledged?

### Karpathy-Specific

- [ ] Would Karpathy tweet this?
- [ ] Does it have memorable, quotable lines?
- [ ] Is there at least one unexpected insight or connection?
- [ ] Does it advocate for simplicity?

---

## Example Transformations

### Before (Generic Tech Blog)

> Recurrent Neural Networks have emerged as a powerful paradigm for sequence modeling tasks. In this comprehensive overview, we will explore the fundamental concepts underlying RNNs and examine their applications across various domains. Understanding these architectures is crucial for modern deep learning practitioners.

### After (Karpathy Style)

> I still remember when I trained my first recurrent network for Image Captioning. There's something almost magical about feeding a network sequences of characters and watching it learn to generate text that looks surprisingly coherent. RNNs are one of those ideas that sound simple but have unreasonable effectiveness once you start playing with them.

---

### Before (Overcautious Academic)

> While neural network training may appear straightforward based on published examples, practitioners often encounter various challenges that may necessitate significant debugging efforts. It could be argued that a systematic approach to training might be beneficial for achieving optimal results.

### After (Karpathy Style)

> Neural nets are not 'off-the-shelf' technology the second you deviate slightly from training an ImageNet classifier. They are a leaky abstraction. I've made all of these mistakes myself and spent way too many hours debugging issues that could have been avoided. Here's what I've learned.

---

## Summary

The Karpathy voice combines:

1. **Deep expertise** expressed conversationally
2. **Personal experience** as the foundation for advice
3. **Pragmatic wisdom** over theoretical purity
4. **Honest acknowledgment** of limitations and failures
5. **Dry wit** sprinkled naturally throughout
6. **Memorable lines** that compress insight into quotable form

**The core test:** Would this sound like something Karpathy would actually write? Does it have his blend of technical depth, personal honesty, and practical wisdom?

**Remember:** Start simple. Be honest about what doesn't work. Make complex things accessible without dumbing them down. And don't be a hero.
