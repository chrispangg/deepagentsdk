# Brand Design Guidelines

> **Version:** 1.0.0
> **Last Updated:** 2025-01-09
> **Status:** Active

---

## Table of Contents

1. [Overview](#overview)
2. [Core Design Principles](#core-design-principles)
3. [Color System](#color-system)
4. [Typography](#typography)
5. [Spacing & Layout](#spacing--layout)
6. [Components & UI Patterns](#components--ui-patterns)
7. [Visual Effects & Animations](#visual-effects--animations)
8. [Iconography](#iconography)
9. [Voice & Tone](#voice--tone)
10. [Asset Specifications](#asset-specifications)
11. [Implementation Examples](#implementation-examples)

---

## Overview

DeepAgent SDK brand design is built on a **terminal-inspired aesthetic** that balances technical precision with modern simplicity. Our design language draws from developer tools and command-line interfaces while maintaining accessibility and clarity for all audiences.

### Design Philosophy

- **Terminal-inspired, not terminal-limited:** We use CLI aesthetics as a foundation, not a constraint
- **Monochromatic base with strategic accent:** Black and white foundation with single accent color
- **Clarity through hierarchy:** Strong visual hierarchy guides users through content
- **Developer-first, not developer-only:** Technical credibility without alienating non-technical audiences
- **Minimal ornamentation:** Every design element serves a functional purpose

★ Insight ─────────────────────────────────────
The design system uses **CSS custom properties** extensively, making it trivial to swap themes and maintain consistency. The variable naming convention (`--home-*`, `--fd-*`) creates clear separation between home page and documentation contexts while keeping the same underlying design tokens.
─────────────────────────────────────────────────

---

## Core Design Principles

### 1. Functional Minimalism

Every design element must serve a purpose. Decorative elements should enhance understanding or guide attention, not distract from content.

### 2. Terminal Aesthetic Modernization

We reinterpret classic terminal elements (monospace fonts, blinking cursors, command prefixes) through a modern lens. The result feels familiar but not constrained by historical limitations.

### 3. Strong Visual Hierarchy

Information architecture is clear through:

- Scale differences (large headings, small labels)
- Color contrast (primary vs. muted text)
- Spacing (grouping related elements)
- Borders and dividers (separating sections)

### 4. Motion with Purpose

Animations serve three purposes:

- **Entrance animations:** Draw attention to new content
- **Hover states:** Confirm interactivity
- **Transitions:** Smooth state changes (not jarring)

### 5. Dark Mode First

Dark mode is the default experience. Light mode is a carefully considered alternative, not an afterthought.

---

## Color System

Our color palette is deliberately minimal: grayscale foundation with single accent color. This creates visual consistency and reduces cognitive load.

### Light Mode Colors

```css
/* Backgrounds */
--home-bg-primary: #FAFAFA;      /* Main page background */
--home-bg-elevated: #FFFFFF;     /* Cards, headers */
--home-bg-card: #FFFFFF;         /* Feature cards */

/* Text */
--home-text-primary: #0A0A0A;    /* Headings, important text */
--home-text-secondary: #6B7280;  /* Body text */
--home-text-muted: #9CA3AF;      /* Labels, metadata */

/* Borders */
--home-border-primary: #D1D5DB;  /* Primary borders */
--home-border-secondary: #E5E7EB; /* Subtle borders */
--home-border-accent: #9CA3AF;   /* Interactive elements */

/* Accent */
--home-accent: #0A0A0A;          /* Links, buttons, highlights */
```

### Dark Mode Colors

```css
/* Backgrounds */
--home-bg-primary: #0A0A0A;      /* Main page background */
--home-bg-elevated: #141414;     /* Cards, headers */
--home-bg-card: #0D0D0D;         /* Feature cards */

/* Text */
--home-text-primary: #F5F5F5;    /* Headings, important text */
--home-text-secondary: #9CA3AF;  /* Body text */
--home-text-muted: #6B7280;      /* Labels, metadata */

/* Borders */
--home-border-primary: #262626;  /* Primary borders */
--home-border-secondary: #1A1A1A; /* Subtle borders */
--home-border-accent: #404040;   /* Interactive elements */

/* Accent */
--home-accent: #FFFFFF;          /* Links, buttons, highlights */
```

### Semantic Colors (for Callouts)

```css
/* Info/Note */
--callout-info: #3B82F6;

/* Tip/Success */
--callout-tip: #10B981;

/* Warning/Caution */
--callout-warning: #F59E0B;

/* Danger/Error */
--callout-danger: #EF4444;
```

### Color Usage Guidelines

| Purpose | Light Mode | Dark Mode |
|---------|-----------|-----------|
| Primary backgrounds | #FAFAFA | #0A0A0A |
| Elevated surfaces | #FFFFFF | #141414 |
| Body text | #6B7280 | #9CA3AF |
| Headings | #0A0A0A | #F5F5F5 |
| Links/Interactive | #0A0A0A | #FFFFFF |
| Borders | #E5E7EB | #1A1A1A |

★ Insight ─────────────────────────────────────
The color palette uses **near-black (#0A0A0A)** instead of pure black (#000000) and **off-white (#FAFAFA)** instead of pure white (#FFFFFF). This reduces eye strain in dark mode and creates a more premium, polished feel. The accent color inverts between modes (black in light, white in dark) maintaining the same visual weight.
─────────────────────────────────────────────────

---

## Typography

Typography is the cornerstone of our brand. We use two complementary typefaces from the **IBM Plex** family: a geometric sans for body text and a humanist mono for code and technical elements.

### Font Families

```css
/* Sans-serif - Body text, headings */
--font-ibm-plex-sans: 'IBM Plex Sans', system-ui, -apple-system, sans-serif;

/* Monospace - Code, technical content, labels */
--font-ibm-plex-mono: 'IBM Plex Mono', 'Courier New', monospace;
```

### Font Weights

| Weight | Usage Example | Font Stack |
|--------|--------------|------------|
| 300 (Light) | Body paragraphs, descriptions | IBM Plex Sans/Mono |
| 400 (Regular) | Default text | IBM Plex Sans/Mono |
| 500 (Medium) | Emphasized content | IBM Plex Sans/Mono |
| 600 (Semibold) | Section headings, buttons | IBM Plex Sans/Mono |
| 700 (Bold) | Rare - only for strong emphasis | IBM Plex Sans/Mono |

### Type Scale

#### Headings (Sans-serif)

```css
/* H1 - Page titles */
font-size: clamp(2.5rem, 7vw, 5rem);
font-weight: 300;
line-height: 1;
letter-spacing: -0.05em;

/* H2 - Section headings */
font-size: clamp(1.875rem, 4vw, 2.5rem);
font-weight: 600;
line-height: 1.2;
letter-spacing: -0.025em;

/* H3 - Subsection headings */
font-size: 1.5rem;
font-weight: 600;
line-height: 1.4;
letter-spacing: -0.0125em;

/* H4 - Card titles */
font-size: 1.25rem;
font-weight: 600;
line-height: 1.3;

/* Small headings - Labels */
font-size: 0.75rem;
font-weight: 600;
text-transform: uppercase;
letter-spacing: 0.1em;
```

#### Body Text

```css
/* Primary body */
font-size: 1rem;
line-height: 1.75;
font-weight: 300;

/* Secondary body (descriptions) */
font-size: 0.875rem;
line-height: 1.6;
font-weight: 300;

/* Captions, metadata */
font-size: 0.75rem;
line-height: 1.4;
font-weight: 400;
```

#### Code (Monospace)

```css
/* Inline code */
font-size: 0.875rem;
line-height: 1.6;
font-weight: 400;

/* Code blocks */
font-size: 0.8125rem;
line-height: 1.6;
font-weight: 400;
```

### Typography Hierarchy

**Terminal-Style Headings (Monospace)**

- Usage: Page titles, hero sections
- Font: IBM Plex Mono
- Weight: 300 (Light)
- Style: Uppercase labels with `>` prefix (e.g., `> cat README.md`)

**Content Headings (Sans-serif)**

- Usage: Section titles, card headings
- Font: IBM Plex Sans
- Weight: 600 (Semibold)
- Style: Title case, no prefix

**Body Copy (Sans-serif)**

- Usage: Paragraphs, descriptions
- Font: IBM Plex Sans
- Weight: 300 (Light)
- Style: Sentence case

**Technical Elements (Monospace)**

- Usage: Inline code, button labels, metadata
- Font: IBM Plex Mono
- Weight: 400-500 (Regular/Medium)
- Style: As-is (preserve original formatting)

### Letter-spacing & Tracking

```css
/* Default (body text) */
letter-spacing: normal;

/* Small uppercase text */
letter-spacing: 0.1em;  /* Navigation, labels */

/* Large headings */
letter-spacing: -0.05em; /* H1 titles */

/* Medium headings */
letter-spacing: -0.025em; /* H2, H3 */
```

---

## Spacing & Layout

### Spacing Scale

We use a consistent spacing scale based on `4px` units:

| Token | Value | Usage |
|-------|-------|-------|
| `xs` | 4px | Tight spacing between related items |
| `sm` | 8px | Small gaps, compact layouts |
| `md` | 16px | Default spacing between elements |
| `lg` | 24px | Section spacing |
| `xl` | 32px | Large gaps between major sections |
| `2xl` | 48px | Page-level spacing |
| `3xl` | 64px | Hero sections, top-level spacing |

### Container Widths

```css
/* Narrow - Metadata, captions */
max-width: 300px;

/* Regular - Documentation, blog content */
max-width: 65ch;  /* ~65 characters per line for readability */

/* Wide - Main content area */
max-width: 1200px;

/* Full-width - Hero sections */
max-width: 100%;
```

### Grid System

**Home Page:**

- Max width: `1280px` (5xl in Tailwind)
- Padding: `1.5rem` (24px) on mobile, `2.5rem` (40px) on desktop
- Centered container: `max-w-5xl mx-auto px-6`

**Content Sections:**

- Gap between cards: `0.75rem` (12px)
- Card padding: `1.75rem` (28px)
- Section margin-bottom: `4rem` (64px)

### Section Spacing

```css
/* Top-level sections */
margin-bottom: 4rem;  /* 64px */

/* Subsection within a section */
margin-bottom: 3rem;  /* 48px */

/* Related items (e.g., feature cards) */
gap: 0.75rem;  /* 12px */

/* Elements within a card */
gap: 1.5rem;  /* 24px */
```

---

## Components & UI Patterns

### Buttons

**Primary Button (Accent)**

```css
background: transparent;
border: 1px solid var(--home-accent);
color: var(--home-accent);
font-family: var(--font-ibm-plex-mono);
font-size: 0.875rem;
font-weight: 500;
padding: 0.875rem 1.75rem;
text-transform: uppercase;
letter-spacing: 0.05em;
transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);

/* Hover state */
background: var(--home-accent);
color: var(--home-bg-primary);
box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
transform: translateY(-2px);
```

**Secondary Button**

```css
background: var(--home-bg-card);
border: 1px solid var(--home-border-primary);
color: var(--home-text-secondary);
font-family: var(--font-ibm-plex-mono);
font-size: 0.875rem;
font-weight: 500;
padding: 0.875rem 1.75rem;
text-transform: uppercase;
letter-spacing: 0.05em;

/* Hover state */
border-color: var(--home-text-primary);
color: var(--home-text-primary);
background: var(--home-bg-elevated);
box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
```

**Icon Button (Small)**

```css
padding: 0.375rem;
border: 1px solid transparent;
background: transparent;
color: var(--home-text-muted);

/* Hover state */
background: var(--home-accent);
color: var(--home-bg-primary);
```

### Cards

**Feature Card**

```css
background: var(--home-bg-card);
border: 1px solid var(--home-border-secondary);
padding: 1.75rem;
box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
position: relative;
overflow: hidden;
transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);

/* Top accent line (reveals on hover) */
&::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(
    90deg,
    transparent,
    var(--home-accent),
    transparent
  );
  opacity: 0;
  transition: opacity 0.3s ease;
}

/* Hover state */
&:hover::before {
  opacity: 1;
}

&:hover {
  border-color: var(--home-border-accent);
  background: var(--home-bg-elevated);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
  transform: translateY(-4px);
}
```

**Blog Post Card**
Same as feature card, with arrow icon transition:

```css
.arrow-icon {
  transition: transform 0.3s ease;
}

.card:hover .arrow-icon {
  transform: translateX(4px);
}
```

### Code Blocks

**Inline Code**

```css
background: var(--home-bg-elevated);
border: 1px solid var(--home-border-secondary);
color: var(--home-accent);
font-family: var(--font-ibm-plex-mono);
font-size: 0.875rem;
padding: 0.25rem 0.5rem;
border-radius: 0;
```

**Code Block (with accent line)**

```css
background: var(--home-bg-card);
border: 1px solid var(--home-border-primary);
border-left: 4px solid var(--home-accent);
padding: 1.5rem;
position: relative;
box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
font-family: var(--font-ibm-plex-mono);
font-size: 0.875rem;
line-height: 1.6;
overflow-x: auto;
```

### Navigation

**Header**

```css
background: linear-gradient(
  to bottom,
  rgba(250, 250, 250, 0.95),  /* Light mode */
  rgba(250, 250, 250, 0.8)
);
/* Dark mode: rgba(10, 10, 10, 0.95) → rgba(10, 10, 10, 0.8) */
backdrop-filter: blur(10px);
border-bottom: 1px solid var(--home-border-secondary);
padding: 1.5rem 0;
position: sticky;
top: 0;
z-index: 100;
```

**Nav Links**

```css
color: var(--home-text-muted);
font-family: var(--font-ibm-plex-mono);
font-size: 0.75rem;
text-transform: uppercase;
letter-spacing: 0.1em;
transition: color 0.2s ease;

&:hover {
  color: var(--home-text-primary);
}
```

### Dividers

**Section Divider with Label**

```html
<div class="flex items-center gap-4 mb-8">
  <h2 class="text-xs uppercase tracking-widest text-[var(--home-text-muted)] font-[family-name:var(--font-ibm-plex-mono)]">
    Section Label
  </h2>
  <div class="flex-1 h-px bg-[var(--home-border-secondary)]" />
</div>
```

**Gradient Horizontal Rule**

```css
height: 1px;
background: linear-gradient(
  90deg,
  transparent,
  var(--home-border-secondary),
  transparent
);
margin: 3rem 0;
```

★ Insight ─────────────────────────────────────
The **section divider pattern** (label + expanding line) is used extensively throughout the site. This creates visual rhythm and helps users scan content. The label uses **tiny uppercase monospace text** which contrasts beautifully with the sans-serif body content, reinforcing the technical aesthetic.
─────────────────────────────────────────────────

---

## Visual Effects & Animations

### Entrance Animations

**Fade In Up (for cards)**

```css
@keyframes fade-in-up {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fade-in-up {
  animation: fade-in-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  opacity: 0;
}
```

**Scale In (for smaller elements)**

```css
@keyframes scale-in {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.animate-scale-in {
  animation: scale-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  opacity: 0;
}
```

### Staggered Delays

```css
/* Stagger children by 0.1s */
.card:nth-child(1) { animation-delay: 0.1s; }
.card:nth-child(2) { animation-delay: 0.2s; }
.card:nth-child(3) { animation-delay: 0.3s; }
.card:nth-child(4) { animation-delay: 0.4s; }
```

### Blinking Cursor

```css
@keyframes blink {
  0%, 49% { opacity: 1; }
  50%, 100% { opacity: 0; }
}

.terminal-cursor {
  animation: blink 1s step-end infinite;
}
```

### Hover Transitions

```css
/* Default easing curve */
transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);

/* Faster for simple color changes */
transition: color 0.2s ease;

/* Slower for complex transforms */
transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
```

### Geometric Grid Background

```css
.geometric-grid {
  position: fixed;
  inset: 0;
  background-image:
    linear-gradient(rgba(0, 0, 0, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0, 0, 0, 0.03) 1px, transparent 1px);
  background-size: 80px 80px;
  pointer-events: none;
  z-index: 1;
}

/* Dark mode override */
.dark .geometric-grid {
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
}
```

---

## Iconography

### Icon System

We use **Lucide React** as our icon library. Icons are stroke-based, geometric, and minimal.

### Icon Guidelines

- **Size:** 16-24px for inline icons, 20px for navigation arrows
- **Stroke width:** 1.5px (default Lucide stroke)
- **Color:** Inherit from text color (usually `--home-text-muted` or `--home-accent`)
- **Spacing:** Minimum 8px padding around clickable icons

### Common Icons

| Icon | Usage | Size |
|------|-------|------|
| Arrow right (→) | External links, CTA buttons | 20px |
| Copy | Copy code buttons | 16px |
| Check | Success states | 16px |
| X (close) | Dismiss banners | 16px |
| GitHub | Social link | 20px |
| Moon/Sun | Theme toggle | 20px |

### Custom SVG Arrow

```html
<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
  <path
    d="M7.5 15L12.5 10L7.5 5"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linecap="square"
  />
</svg>
```

**Characteristics:**

- 7.5, 5 (starting point)
- 12.5, 10 (middle point)
- 7.5, 15 (end point)
- `stroke-linecap="square"` for technical feel

---

## Voice & Tone

### Writing Style

**Terminal Prefix Style**
Section headers often use terminal-style prefixes:

- `> cat README.md` (for overview sections)
- `> ls -la /blog` (for listing pages)
- `> npm install deepagentsdk` (for installation)

**Sentence Structure**

- Clear, direct sentences
- Active voice over passive
- Technical precision without verbosity
- Assume developer literacy but explain concepts

**Tone Guidelines**

| Context | Tone |
|---------|------|
| Documentation | Clear, concise, educational |
| Blog posts | Conversational but technical |
| Error messages | Direct, actionable, not blaming |
| Marketing copy | Confident, understated, feature-focused |

### Content Patterns

**Feature Descriptions**

```
[Number] [Title]
[Concise description explaining the feature]
[code snippet showing usage]
```

Example:

```
01 Planning & Task Decomposition
Built-in write_todos tool enables agents to break down complex tasks...
write_todos()
```

**Code Comments**

- Use `//` for single-line comments
- Place comments above the code they describe
- Explain "why" not "what"

---

## Asset Specifications

### Logos

**Primary Logo (Text)**

- Font: IBM Plex Mono
- Weight: 600 (Semibold)
- Style: Lowercase, no spacing
- Color: `--home-text-primary`

**Logo with Version**

```
deepagentsdk // v0.14.0
```

- Main logo: `--home-text-primary`
- Version: `--home-text-muted`
- Separator: `//` in lighter color

### Images

**Screenshots**

- Format: PNG (for UI) or JPG (for photos)
- Border: 1px solid `--home-border-secondary`
- Shadows: `0 2px 8px rgba(0, 0, 0, 0.4)`
- Max width: 100% of container
- Border radius: 0 (sharp corners)

### Code Screenshots

When showing code in images:

- Use the same syntax highlighting as the site
- Include 4px accent border on the left
- Background: `--home-bg-card`
- Font: IBM Plex Mono, 0.875rem

### Open Graph Images

**Recommended:**

- Dimensions: 1200×630px (1.91:1 aspect ratio)
- Format: PNG
- Background: `--home-bg-primary` (dark mode preferred)
- Text: IBM Plex Mono, 300 (Light), `--home-text-primary`
- Accent: 4px solid `--home-accent` on left edge

---

## Implementation Examples

### Creating a New Section

```html
<section className="mb-16">
  {/* Section Header */}
  <div className="flex items-center gap-4 mb-8">
    <h2 className="text-xs uppercase tracking-widest text-[var(--home-text-muted)] font-[family-name:var(--font-ibm-plex-mono)]">
      > section-command
    </h2>
    <div className="flex-1 h-px bg-[var(--home-border-secondary)]" />
  </div>

  {/* Content */}
  <div className="grid grid-cols-1 gap-3">
    {items.map((item, idx) => (
      <div
        key={idx}
        className="feature-card animate-scale-in relative border border-[var(--home-border-secondary)] p-7 bg-[var(--home-bg-card)] shadow-[0_2px_8px_rgba(0,0,0,0.4)]"
        style={{ animationDelay: `${0.1 + idx * 0.1}s` }}
      >
        {/* Card content */}
      </div>
    ))}
  </div>
</section>
```

### Creating a Callout

```html
<div data-callout="info" className="my-8 p-5 bg-[var(--home-bg-card)] border border-[var(--home-border-primary)] border-l-[3px] border-l-[#3B82F6]">
  <p className="text-[var(--home-text-secondary)] font-light">
    <strong className="text-[var(--home-text-primary)] font-semibold">Note:</strong>
    This is important information that users should read carefully.
  </p>
</div>
```

### Creating Inline Code

```html
<code className="inline-block px-3 py-1.5 text-xs bg-[var(--home-bg-primary)] border border-[var(--home-border-secondary)] text-[var(--home-accent)] font-[family-name:var(--font-ibm-plex-mono)] tracking-wide">
  function_name()
</code>
```

### Creating a Primary Button

```html
<a
  href="/destination"
  className="relative inline-flex items-center justify-center gap-2 px-7 py-3.5 border border-[var(--home-accent)] text-[var(--home-accent)] bg-transparent font-medium text-sm font-[family-name:var(--font-ibm-plex-mono)] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-[var(--home-accent)] hover:text-[var(--home-bg-primary)] hover:shadow-[0_8px_32px_rgba(0,0,0,0.6)] hover:-translate-y-0.5"
>
  Button Text
</a>
```

---

## Accessibility Guidelines

### Color Contrast

All text must meet WCAG AA standards:

- **Normal text:** Minimum 4.5:1 contrast ratio
- **Large text (18px+):** Minimum 3:1 contrast ratio
- **UI components:** Minimum 3:1 contrast ratio

Our color palette meets these requirements:

- Light mode body text: `#6B7280` on `#FAFAFA` = 4.6:1 ✓
- Dark mode body text: `#9CA3AF` on `#0A0A0A` = 7.2:1 ✓

### Keyboard Navigation

- All interactive elements must be keyboard accessible
- Visible focus indicators: `2px solid var(--home-accent)`
- Logical tab order through content
- Skip links for main content

### Screen Reader Support

- Semantic HTML (headings, landmarks, lists)
- ARIA labels for icon-only buttons
- Alt text for all images
- Descriptive link text (not "click here")

### Motion Preferences

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Cross-Channel Applications

### Presentations (Slides)

**Design adaptations:**

- Use larger type scale (increase by 1.5-2x)
- Simplify layouts (one idea per slide)
- Maintain terminal aesthetic for code slides
- Use accent color for emphasis only

### PDF Documents

**Design adaptations:**

- Export from web for consistency
- Maintain page margins (1" on all sides)
- Use grayscale-safe colors
- Include version numbers in footers

### Social Media Graphics

**Design adaptations:**

- Square (1:1) or vertical (4:5) aspect ratios
- Larger typography for readability
- Solid backgrounds (no transparency)
- Include logo in corner for brand recognition

### Video Thumbnails

**Design adaptations:**

- 16:9 aspect ratio
- High contrast for small sizes
- Terminal/code aesthetic maintained
- Large, readable title text

---

## Brand Do's and Don'ts

### Do ✓

- Use IBM Plex fonts for all text
- Include terminal-style prefixes for section headers
- Add 4px accent lines to code blocks
- Use staggered entrance animations for lists
- Maintain 8px base spacing unit
- Use geometric grid background for pages
- Include blinking cursor in hero titles
- Use sharp corners (no border-radius)
- Create strong contrast between text and backgrounds
- Test in both light and dark modes

### Don't ✗

- Add shadows to text
- Use rounded corners (except for icon buttons)
- Mix multiple accent colors
- Over-animate (keep it subtle)
- Use pure black (#000000) or pure white (#FFFFFF)
- Add gradients to text
- Use emojis in UI elements
- Stretch or distort the logo
- Change font weights inconsistently
- Add decorative elements without purpose

---

## Resources & Files

### Source Files

**CSS Variables:** `/www/src/app/global.css`

- All color definitions
- Typography scale
- Animation keyframes
- Component styles

**Components:** `/www/src/components/`

- `button.tsx` - Button variants
- `codeblock.tsx` - Code display
- `banner.tsx` - Announcement banners

**Layout:** `/www/src/app/layout.tsx`

- Font configuration
- Theme provider setup

### External Resources

- **Fonts:** Google Fonts (IBM Plex Sans, IBM Plex Mono)
- **Icons:** Lucide React
- **Framework:** Next.js 16, Fumadocs UI
- **Styling:** Tailwind CSS 4

### Design Tools

Recommended tools for creating brand assets:

- **Figma:** Component libraries, layouts
- **VS Code:** Code snippets with theme
- **ImageOptim:** Image compression
- **Squoosh:** Image optimization

---

## Changelog

### Version 1.0.0 (2025-01-09)

- Initial brand guidelines documentation
- Extracted from deepagentsdk website (www/)
- Comprehensive color, typography, and component documentation

---

## Questions?

For brand-related questions or to request additions to this document:

1. Check the website source code for implementation examples
2. Review Fumadocs UI defaults for base component styles
3. Consult AGENTS.md for project context and philosophy

---

**This document is a living resource. As the brand evolves, update this file to maintain consistency across all touchpoints.**
