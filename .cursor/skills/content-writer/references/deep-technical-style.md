# Deep Technical Style Guide

A comprehensive guide for writing opinion-forward, technically authoritative blog posts. This style combines deep technical insight with conversational accessibility, emphasizing simplicity over complexity and taking clear positions backed by concrete evidence.

---

## Opening Strategies (Detailed)

### 1. The Contrarian Position

Challenge prevailing wisdom immediately. Often references famous quotes or cultural touchstones.

**Examples:**
> "AI engineering is a new discipline, but that doesn't mean we should throw out everything we know about engineering."

> "The death of prompt engineering has been greatly exaggerated." *(echoing Mark Twain)*

**Pattern:** State something most readers believe → immediately challenge it

### 2. The Practical Pain Point

Jump directly into a problem the reader recognizes. Use direct address.

**Examples:**
> "So you need a team to build an LLM multi-agent system... how do you interview candidates?"

> "We treat AI tools like they're special, and something to be scared of."

**Pattern:** Describe a real situation → imply you have the solution

### 3. Challenge Conventional Wisdom

Suggest readers likely have incorrect assumptions. Creates urgency.

**Examples:**
> "If you've been stuffing thousands of tokens into your LLM prompts thinking 'more context = better results,' I have some sobering news."

**Pattern:** "If you've been doing X thinking Y, here's what you need to know..."

### 4. The Reframe

Reveal what the "real" innovation actually is. Subverts expectations.

**Examples:**
> "The real innovation...isn't about chatbots. It's not about intelligence...It's about *assumptions*."

**Pattern:** "It's not about X. It's about Y."

### 5. The Philosophical Question

Open with a provocative question that invites reconsideration.

**Examples:**
> "Do you think there's really reasoning going on or is it a mirage of reasoning?"

**Pattern:** Ask a question that has no easy answer → use it to frame the discussion

### 6. The Surprising Simplicity

Reveal that something complex is actually simple.

**Examples:**
> "Claude Code isn't built on a complex multi-agent swarm. It's a single-threaded loop."

**Pattern:** Name impressive system → reveal it's surprisingly simple → explain why that matters

### 7. The Historical Hook

Trace how we got here to reframe the present.

**Examples:**
> "The term 'prompt engineering' emerged following ChatGPT's 2022 launch..."

**Pattern:** Historical origin → evolution → present state → reframe

---

## Argumentative Structures (Detailed)

### Problem → Evidence → Redefinition

**Structure:**

1. **Identify the problem**: The current term/approach is inadequate
2. **Provide evidence**: Quote recognized authorities, show concrete examples
3. **Redefine**: Offer a new, better framework

**Example (Context Engineering article):**
> **Problem**: "Prompt engineering" sounds insufficiently technical and fails to capture actual work
> **Evidence**: Karpathy notes "People associate prompts with short task descriptions, but apps build contexts — meticulously"
> **Redefinition**: This discipline is "context engineering," encompassing system instructions, conversation history, API data, tool descriptions, and output formatting

### The De-Scoping Narrative

Tell a story where complexity was reduced to simplicity, validating the philosophy.

**Example:**
> "A customer initially wanted five specialized agents to process documents and generate reports. Through de-scoping, this reduced to 'a text box and a button' with a single LLM call. It solved the actual problem effectively."

**Pattern:**

1. Customer/user wanted complex solution (multi-agent, elaborate orchestration)
2. Analysis revealed simpler approach would work
3. Simple solution succeeded
4. Lesson: Start simple

### Numbered Frameworks

Break complex topics into enumerated principles. Each item follows a consistent pattern.

**Example (AI Engineer Interview article):**
Six Dimensions for Evaluating AI Engineers:

1. **Passion for LLMs**: Tests continuous learning through opinion-based questioning
2. **Coding Competence**: Validates core engineering ability
3. **Advanced Concepts**: Probes technical depth
4. **Tinkerer Mentality**: Assesses experimental approach
5. **Communication Skills**: Evaluates prompt structure
6. **Take-Home Projects**: Tests real-world implementation

**Pattern for each item:**

- Title (memorable phrase)
- Explanation (what it means)
- Why it matters (practical impact)
- Red flags (warning signs of the opposite)

### The Thought Experiment

Use hypothetical scenarios to illuminate abstract points.

**Example (Death of Prompt Engineering article):**
> The "blank page problem": Even with infinite capability, an AI needs direction. Raw power doesn't solve the question of *what* to do.

### Historical Analogy

Draw parallels to established disciplines to legitimize arguments.

**Example:**
> Programming language evolution (assembly → high-level → visual) parallels prompt engineering's trajectory toward invisibility.

> Hardware engineers questioning software engineering's legitimacy mirrors today's dismissal of prompt engineering.

---

## Rhetorical Techniques (Detailed)

### Authority Leverage

Quote recognized experts to validate positions. Keep quotes punchy and memorable.

**Examples:**
> "As Andrej Karpathy observed..."
> "Shopify CEO Tobi Lütke criticized the term..."
> "Stephen Wolfram's 'computational irreducibility' concept..."

**Authorities commonly cited:**

- Andrej Karpathy (AI/ML)
- Simon Willison (AI engineering)
- Tobi Lütke (tech leadership)
- Stewart Alsop (philosophy/tech)

### Metaphors That Demystify

Translate jargon into familiar concepts. Make abstract accessible.

| Jargon | Demystified Version |
|--------|---------------------|
| Autonomous agents | "AI cron jobs" |
| Context window | "The agent's working memory" |
| Tool calling | "The agent has hands" |
| File reading | "The agent has eyes" |
| Embeddings | "Coordinates in probability space" |
| AI assistance | "Like managing an intern" |
| Multi-agent system | "A single-threaded loop" |

### The Probability-Space Metaphor

For abstract ML concepts, use geometric/spatial language.

**Example:**
> The embeddings explanation uses geometric language ("probability space," "coordinates"), making abstract ML concepts accessible by suggesting the AI locates answers within a vast landscape of possibilities.

### The Uncomfortable Analogy

Draw parallels that make readers reconsider their assumptions.

**Examples:**
> "Hardware engineers questioning software engineering's legitimacy mirrors today's dismissal of prompt engineering."

> "Calling all this 'prompt engineering' is like calling software development 'typing.'"

### Direct Reader Address

Engage readers as participants, not spectators.

**Examples:**
> "You are looking for candidates who 💡 light up 💡"
> "Here's my prediction..."
> "I have some sobering news."

### Emphatic Repetition

Drive home key points through deliberate repetition.

**Examples:**
> "You don't. You don't."
> "Start simple. Use functions. Think iteratively."

### Questions as Methodology

Use interrogatives to guide reader thinking.

**Examples:**
> "What would happen if we removed this agent?"
> "Is this complexity actually solving a problem?"
> "How do you actually interview for this role?"

### Cascading Benefits

Stack advantages rather than arguing single points.

**Example:**
> Coverage without complexity, zero learning curves, shifted workload, graceful failure modes.

### Counterargument Anticipation

Address objections head-on rather than avoiding them.

**Example:**
> The database-dropping concern is addressed directly: "There is no silver bullet...Just code review, unit tests, staging environments."

---

## Recurring Themes

### 1. Domain Expertise > Technical Understanding

**Key phrases:**
> "Stop trying to understand the neural network. Start understanding your domain."
> "Subject matter experts outperform ML engineers"
> "Teachers, doctors, lawyers. They're the ones building the most effective AI applications"

### 2. Embrace the Black Box

**Key phrases:**
> "Not knowing how it works is actually the point"
> "Focus on inputs and outputs, not internal mechanisms"
> "Accept that not knowing can be a feature"

### 3. Context as Scarce Resource

**Key phrases:**
> "Context rot is real"
> "More isn't always better. It's worse"
> "Treat token budgets like compute budgets"

### 4. Assumptions as Innovation

**Key phrases:**
> "Not that computers can think, but that they can assume. And get it right most of the time"
> "The revolution isn't intelligence. It's inference"

### 5. Engineering Fundamentals Remain Essential

**Key phrases:**
> "There is no silver bullet...Just code review, unit tests, staging environments"
> "Classical practices become more important with AI"
> Version control, testing and evals, observability

### 6. Simplicity Over Complexity

**Key phrases:**
> "Do the simple thing first"
> "Less scaffolding, more model"
> "De-scope ruthlessly"
> "Start with the simplest viable solution"
> "Regex over embeddings"

### 7. Human Responsibility

**Key phrases:**
> "AI doesn't kill prod. You do."
> "You're not shipping AI-generated code. You're shipping your code that you chose to create with AI assistance"

### 8. Terminology Evolution

Track the shift in vocabulary:
> prompt engineering → context engineering → cognitive engineering

---

## Structural Patterns

### Subheading Style

Write subheadings as mini-arguments or declarations, not topic labels.

**Good:**

- "Bash is all you need"
- "Less scaffolding, more model"
- "De-scope ruthlessly"
- "Human-centric agent design"
- "Here's my prediction..."

**Bad:**

- "Overview of Command Line Usage"
- "Agent Architecture Discussion"
- "Conclusion"
- "Summary of Findings"

### The Why Behind Decisions

Never describe what something does without explaining why.

**Examples:**
> "Regex was chosen over embeddings for developer familiarity and reduced overhead."

> "Sub-agents operate under depth limitations. This prevents recursive spawning while enabling parallel exploration, preserving single-thread simplicity."

### Contrast Tables

Show rejected approaches alongside chosen ones.

| Approach | Status | Reasoning |
|----------|--------|-----------|
| Simple while loops | Chosen | Predictable, debuggable |
| Multi-agent swarms | Rejected | Complexity without proportional benefit |
| Vector databases | Rejected | Regex is familiar and sufficient |

### Red Flags / Warning Signs

Include negative indicators for quick reader scanning.

> **Red flag**: Candidates who can't explain trade-offs between RAG approaches
> **Warning sign**: Over-reliance on academic perfectionism versus field pragmatism

### Progressive Disclosure

Explain *what* before *how*:

1. First establish what something does and why it matters
2. Then reveal technical implementation details
3. Finally discuss implications and applications

---

## Tone & Voice (Detailed)

### Authoritative Yet Accessible

- Assume technical competence
- Don't assume domain-specific knowledge
- Explain without condescending
- Draw from personal experience
- Write as expert sharing with peers

### Conversational Precision

- Use contractions naturally ("it's", "don't", "here's")
- Address the reader directly
- Maintain technical accuracy
- Avoid stiff academic language

### Opinion-Forward

**Do:**
> "Here's my prediction: every agent will need its own VM."
> "This approach is wrong, and here's why."
> "Stop trying to understand the neural network."

**Don't:**
> "It could potentially be argued that..."
> "Some might suggest that perhaps..."
> "Further research may be needed..."

### Self-Aware Humor

Acknowledge contradictions or personal stakes with lightness.

**Example:**
> The author concludes the terminology debate while admitting personal investment in "prompt engineering" branding (complete with a photo of branded hats).

### Provocation Without Arrogance

Be bold but support positions:

- ✅ "I have some sobering news" (then provide evidence)
- ❌ "Obviously anyone who disagrees is wrong"

---

## Sentence-Level Craft

### Vary Sentence Length

Alternate between punchy declarations and explanatory sentences.

**Examples:**
> "Bash is all you need. Rather than building hundreds of specialized functions, successful agents leverage the command line. The same tool developers have used for decades."

> "Context rot is real. And it affects every model."

### Active Voice, Present Tense

Describe systems as if they're acting now.

- ✅ "The model analyzes input, executes tools, feeds results back"
- ❌ "Input is analyzed by the model, tools are executed"

### Specific Numbers and Thresholds

Include concrete data points wherever possible.

**Examples:**
> "~92% context utilization"
> "30% accuracy loss"
> "6-8 human hours"
> "21-source architectural analysis"
> "15,000-word building code analysis"

### Italics for Emphasis

Use italics to highlight key terms and surprising claims.

**Example:**
> "The real innovation...isn't about chatbots. It's about *assumptions*."

---

## Closing Strategies (Detailed)

### 1. Actionable Simplicity

End with memorable, implementable guidance.

**Examples:**
> "Start simple. Use functions. Think iteratively."
> "Stop trying to understand the neural network. Start understanding your domain."

### 2. The Terminology Reframe

Conclude by renaming the discipline.

**Examples:**
> "This isn't prompt engineering. It's context engineering."
> "The future belongs to cognitive engineers, not prompt optimizers."

### 3. Circle Back to Opening

Return to the opening thesis with added weight.

**Example:**
> "Not that computers can think, but that they can assume. And get it right most of the time."

### 4. Forward-Looking Predictions

End with implications for the future.

**Example:**
> "Here's my prediction: every agent will need its own VM, creating significant demand for cloud providers."

### 5. Reframe Agency and Responsibility

Shift perspective on who's in control.

**Example:**
> "You're not shipping AI-generated code. You're shipping your code that you chose to create with AI assistance."

### 6. Resource Links

Include paths for deeper engagement (related articles, research papers, tools).

---

## Example Transformations

### Before (Generic Tech Blog)

> In the rapidly evolving field of artificial intelligence, many organizations are exploring how to effectively evaluate candidates for AI engineering positions. This blog post will examine various approaches to interviewing AI engineers and provide a framework for assessment. As we will see, there are multiple factors to consider when building an AI engineering team.

### After (Deep Technical Style)

> So you need to hire someone to build your LLM multi-agent system. You've got a backlog of AI features, a model that mostly works, and a team that's stretched thin. How do you actually interview for this role?
>
> Forget the traditional software engineering playbook. AI engineering requires a different lens: one that values tinkering over textbook knowledge and iteration over perfection.

---

### Before (Overcautious Academic)

> It could potentially be argued that current approaches to context management in large language models may benefit from optimization. Further research is needed to understand the implications of context length on model performance, though preliminary evidence suggests some correlation between input size and accuracy degradation.

### After (Deep Technical Style)

> If you've been stuffing thousands of tokens into your LLM prompts thinking "more context = better results," I have some sobering news.
>
> Context rot is real. Chroma's research found a 30% accuracy drop when models processed full chat histories versus condensed 300-token versions. More isn't better. It's worse.

---

## Pre-Publication Checklist

### Opening

- [ ] Does it hook immediately (contrarian view, pain point, reframe, or surprising simplicity)?
- [ ] Is there zero generic scene-setting?
- [ ] Would a busy reader want to continue after the first paragraph?

### Argument

- [ ] Have you taken a clear position?
- [ ] Is the "why" behind decisions explained?
- [ ] Are there concrete examples grounding abstract concepts?
- [ ] Did you include specific numbers/thresholds where applicable?
- [ ] Have you anticipated and addressed counterarguments?

### Structure

- [ ] Do subheadings read as mini-arguments?
- [ ] Is there a numbered framework or clear progression?
- [ ] Have you shown what was rejected and why?
- [ ] Does the piece use progressive disclosure (what → how → implications)?

### Style

- [ ] Active voice throughout?
- [ ] Varying sentence length?
- [ ] Free of hedging language?
- [ ] Technical but not tedious?

### Themes

- [ ] Does the piece advocate for simplicity where appropriate?
- [ ] Is domain expertise valued over pure technical knowledge?
- [ ] Are engineering fundamentals referenced?

### Closing

- [ ] Does it end with actionable guidance, a prediction, or a reframe?
- [ ] Is there a memorable synthesized takeaway?
- [ ] Does it circle back to the opening thesis?

### Philosophy

- [ ] Would a senior engineer find genuine insight here?
- [ ] Is it skeptical of unnecessary complexity?
- [ ] Does it embrace rather than fear uncertainty?

---

## Summary

The Deep Technical voice combines:

1. **Technical authority** with conversational accessibility
2. **Clear positions** supported by evidence and examples
3. **Simplicity advocacy** in both prose and ideas
4. **Concrete specificity** (numbers, names, real scenarios)
5. **Forward-looking predictions** and terminology evolution

**The Underlying Belief:**

Domain experts who embrace uncertainty will outperform technical specialists who demand understanding. The future belongs not to those who master the neural network, but to those who master their domain and treat AI as a tool (powerful, useful, and ultimately under human control).

**Remember:** If you can't explain why something is built a certain way, you haven't understood it well enough to write about it.
