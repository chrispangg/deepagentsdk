import Link from 'next/link';
import { getLatestVersion } from '@/lib/version';
import { ThemeToggle } from '@/components/theme-toggle';

const features = [
  {
    number: '01',
    title: 'Planning & Task Decomposition',
    description:
      'Built-in write_todos tool enables agents to break down complex tasks into discrete steps, track progress, and adapt plans as new information emerges during execution.',
    code: 'write_todos()',
  },
  {
    number: '02',
    title: 'Context Management',
    description:
      "File system tools (ls, read_file, write_file, edit_file, glob, grep) allow agents to offload large context to memory, preventing context window overflow and enabling work with variable-length tool results.",
    code: 'read_file() | write_file()',
  },
  {
    number: '03',
    title: 'Subagent Spawning',
    description:
      "Built-in task tool enables agents to spawn specialized subagents for context isolation. This keeps the main agent's context clean while still going deep on specific subtasks.",
    code: 'task(agent: "researcher")',
  },
  {
    number: '04',
    title: 'Session Persistence',
    description:
      'Checkpointers enable persistent memory across conversations. Agents can save and restore state (todos, files, messages) and resume long-running tasks later.',
    code: 'checkpointer: new FileSaver()',
  },
];

const stats = [
  { label: 'Core Tools', value: '12' },
  { label: 'Storage Backends', value: '4' },
  { label: 'Filesystem Ops', value: '7 tools' },
  { label: 'Checkpointers', value: '3 types' },
];

const specs = [
  { label: 'Framework', value: 'Vercel AI SDK v6' },
  { label: 'Runtime', value: 'Bun' },
  { label: 'Language', value: 'TypeScript 5.9+' },
  { label: 'Model Providers', value: 'Anthropic, OpenAI, Azure, etc.' },
  {
    label: 'Built-in Tools',
    value: 'write_todos, task, ls, read_file, write_file, edit_file, glob, grep',
  },
  {
    label: 'Storage Backends',
    value: 'In-memory, Filesystem, Persistent, Composite',
  },
];

const codeExample = `import { createDeepAgent } from 'deepagentsdk';
import { anthropic } from '@ai-sdk/anthropic';

const agent = createDeepAgent({
  model: anthropic('claude-sonnet-4-20250514'),
  systemPrompt: "Break down complex tasks into todos, write research findings to files, and delegate specialized work to subagents.",
});

const result = await agent.generate({
  prompt: 'Research and compare AI agent frameworks',
  maxSteps: 20,
});

console.log(result.text);
console.log(result.state.todos);
console.log(Object.keys(result.state.files));`;

export default async function HomePage() {
  const version = await getLatestVersion();

  return (
    <div className="min-h-screen bg-[var(--home-bg-primary)] text-[var(--home-text-primary)] font-[family-name:var(--font-ibm-plex-sans)] relative">
      {/* Geometric Grid Background */}
      <div className="geometric-grid" />

      {/* Skip to content link for accessibility */}
      <a
        href="#main-content"
        className="absolute left-[-9999px] z-[999] focus:left-1/2 focus:-translate-x-1/2 focus:top-4 focus:bg-[var(--home-accent)] focus:text-[var(--home-bg-primary)] focus:px-6 focus:py-3 focus:no-underline focus:font-semibold"
      >
        Skip to main content
      </a>

      <div className="relative z-10">
        {/* Header */}
        <header className="home-header border-b border-[var(--home-border-secondary)] py-6 backdrop-blur-[10px] sticky top-0 z-[100]">
          <div className="max-w-5xl mx-auto px-6">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold tracking-tight font-[family-name:var(--font-ibm-plex-mono)]">
                <span className="text-[var(--home-text-primary)]">deepagentsdk</span>
                <span className="text-[var(--home-text-muted)] ml-2">// v{version}</span>
              </div>
              <div className="flex items-center gap-6">
                <Link
                  href="/docs"
                  className="text-xs uppercase tracking-widest text-[var(--home-text-muted)] hover:text-[var(--home-text-primary)] transition-colors font-[family-name:var(--font-ibm-plex-mono)]"
                >
                  Docs
                </Link>
                <Link
                  href="/blog"
                  className="text-xs uppercase tracking-widest text-[var(--home-text-muted)] hover:text-[var(--home-text-primary)] transition-colors font-[family-name:var(--font-ibm-plex-mono)]"
                >
                  Blog
                </Link>
                <ThemeToggle />
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="max-w-5xl mx-auto px-6 py-10 pb-12">
          <main id="main-content">
            {/* Hero Section */}
            <section className="mb-12">
              <div className="animate-fade-in-up [animation-delay:0.1s] mb-4">
                <span className="text-xs uppercase tracking-widest text-[var(--home-text-muted)] font-[family-name:var(--font-ibm-plex-mono)]">
                  &gt; cat README.md
                </span>
              </div>

              <h1 className="animate-fade-in-up [animation-delay:0.2s] mb-6 text-[clamp(2.5rem,7vw,5rem)] leading-none tracking-tighter font-light font-[family-name:var(--font-ibm-plex-mono)] text-[var(--home-text-primary)]">
                Deep Agent SDK
                <span className="terminal-cursor text-[var(--home-accent)]">█</span>
              </h1>

              <div className="animate-fade-in-up [animation-delay:0.3s] h-px bg-gradient-to-r from-[var(--home-accent)] to-transparent max-w-[100px] mb-6" />

              <p className="animate-fade-in-up [animation-delay:0.4s] text-[clamp(1.125rem,2vw,1.25rem)] max-w-3xl leading-relaxed text-[var(--home-text-secondary)] font-light tracking-tight">
                Build agents that can plan, delegate to subagents, and leverage file systems for
                complex, multi-step tasks using Vercel AI SDK v6
              </p>
            </section>

            {/* CTA Buttons */}
            <div className="animate-fade-in-up [animation-delay:0.5s] flex flex-wrap gap-3 mb-16">
              <Link
                href="/docs"
                className="relative inline-flex items-center justify-center gap-2 px-7 py-3.5 border border-[var(--home-accent)] text-[var(--home-accent)] bg-transparent font-medium text-sm font-[family-name:var(--font-ibm-plex-mono)] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-[var(--home-accent)] hover:text-[var(--home-bg-primary)] hover:shadow-[0_8px_32px_rgba(0,0,0,0.6)] hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--home-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--home-bg-primary)]"
              >
                Read Documentation
              </Link>
              <Link
                href="/blog"
                className="relative inline-flex items-center justify-center gap-2 px-7 py-3.5 border border-[var(--home-border-primary)] text-[var(--home-text-secondary)] bg-[var(--home-bg-card)] font-medium text-sm font-[family-name:var(--font-ibm-plex-mono)] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-[var(--home-text-primary)] hover:text-[var(--home-text-primary)] hover:bg-[var(--home-bg-elevated)] hover:shadow-[0_2px_8px_rgba(0,0,0,0.4)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--home-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--home-bg-primary)]"
              >
                Read Blog
              </Link>
              <a
                href="https://github.com/chrispangg/deepagentsdk"
                target="_blank"
                rel="noopener noreferrer"
                className="relative inline-flex items-center justify-center gap-2 px-7 py-3.5 border border-[var(--home-border-primary)] text-[var(--home-text-secondary)] bg-[var(--home-bg-card)] font-medium text-sm font-[family-name:var(--font-ibm-plex-mono)] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-[var(--home-text-primary)] hover:text-[var(--home-text-primary)] hover:bg-[var(--home-bg-elevated)] hover:shadow-[0_2px_8px_rgba(0,0,0,0.4)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--home-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--home-bg-primary)]"
              >
                View on GitHub
              </a>
            </div>

            {/* Core Features Section */}
            <section className="mb-16">
              <div className="flex items-center gap-4 mb-8">
                <h2 className="text-xs uppercase tracking-widest text-[var(--home-text-muted)] font-[family-name:var(--font-ibm-plex-mono)]">
                  Core Features
                </h2>
                <div className="flex-1 h-px bg-[var(--home-border-secondary)]" />
              </div>

              <div className="flex flex-col gap-3">
                {features.map((feature, idx) => (
                  <article
                    key={feature.number}
                    className="feature-card animate-scale-in relative border border-[var(--home-border-secondary)] p-7 bg-[var(--home-bg-card)] shadow-[0_2px_8px_rgba(0,0,0,0.4)] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] overflow-hidden hover:border-[var(--home-border-accent)] hover:bg-[var(--home-bg-elevated)] hover:shadow-[0_8px_32px_rgba(0,0,0,0.6)] hover:-translate-y-1 focus-within:border-[var(--home-border-accent)] focus-within:bg-[var(--home-bg-elevated)]"
                    style={{ animationDelay: `${0.1 + idx * 0.1}s` }}
                  >
                    <div className="flex items-start gap-6">
                      <div className="text-4xl font-light shrink-0 font-[family-name:var(--font-ibm-plex-mono)] text-[var(--home-text-muted)] opacity-30">
                        {feature.number}
                      </div>
                      <div className="flex-1">
                        <h3 className="text-base font-semibold mb-2 font-[family-name:var(--font-ibm-plex-sans)] text-[var(--home-text-primary)] tracking-tight">
                          {feature.title}
                        </h3>
                        <p className="text-sm mb-3 leading-relaxed text-[var(--home-text-secondary)] font-light">
                          {feature.description}
                        </p>
                        <code className="inline-block px-3 py-1.5 text-xs bg-[var(--home-bg-primary)] border border-[var(--home-border-secondary)] text-[var(--home-accent)] font-[family-name:var(--font-ibm-plex-mono)] tracking-wide">
                          {feature.code}
                        </code>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            {/* Quick Start Section */}
            <section className="mb-16">
              <div className="flex items-center gap-4 mb-6">
                <h2 className="text-xs uppercase tracking-widest text-[var(--home-text-muted)] font-[family-name:var(--font-ibm-plex-mono)]">
                  Quick Start
                </h2>
                <div className="flex-1 h-px bg-[var(--home-border-secondary)]" />
              </div>

              <div className="code-block relative border border-[var(--home-border-primary)] bg-[var(--home-bg-card)] shadow-[0_2px_8px_rgba(0,0,0,0.4)] p-6">
                <pre className="m-0 leading-relaxed text-[var(--home-text-primary)] font-[family-name:var(--font-ibm-plex-mono)] font-normal text-sm whitespace-pre overflow-x-auto">
                  {codeExample}
                </pre>
              </div>
            </section>

            {/* Capabilities Section */}
            <section className="mb-16">
              <div className="flex items-center gap-4 mb-6">
                <h2 className="text-xs uppercase tracking-widest text-[var(--home-text-muted)] font-[family-name:var(--font-ibm-plex-mono)]">
                  Capabilities
                </h2>
                <div className="flex-1 h-px bg-[var(--home-border-secondary)]" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {stats.map((stat, i) => (
                  <div
                    key={i}
                    className="relative border border-[var(--home-border-secondary)] p-5 bg-gradient-to-br from-[var(--home-bg-card)] to-[var(--home-bg-elevated)] shadow-[0_2px_8px_rgba(0,0,0,0.4)] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-[var(--home-border-primary)] hover:shadow-[0_8px_32px_rgba(0,0,0,0.6)] hover:-translate-y-0.5"
                    style={{ animationDelay: `${0.1 + i * 0.05}s` }}
                  >
                    <div className="text-xs uppercase tracking-wide mb-2 text-[var(--home-text-muted)] font-[family-name:var(--font-ibm-plex-sans)] font-medium">
                      {stat.label}
                    </div>
                    <div className="text-2xl font-light font-[family-name:var(--font-ibm-plex-mono)] text-[var(--home-text-primary)] tracking-tight">
                      {stat.value}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Technical Specifications Section */}
            <section className="mb-12">
              <div className="border border-[var(--home-border-secondary)] p-8 bg-[var(--home-bg-card)] shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
                <div className="flex items-center gap-4 mb-8">
                  <h2 className="text-xs uppercase tracking-widest text-[var(--home-text-muted)] font-[family-name:var(--font-ibm-plex-mono)]">
                    Technical Specifications
                  </h2>
                  <div className="flex-1 h-px bg-[var(--home-border-secondary)]" />
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {specs.map((spec, i) => (
                    <div
                      key={i}
                      className="flex justify-between items-baseline py-2 border-b border-[var(--home-border-secondary)]"
                    >
                      <span className="text-sm text-[var(--home-text-secondary)] font-normal">
                        {spec.label}
                      </span>
                      <span className="text-sm font-medium font-[family-name:var(--font-ibm-plex-mono)] text-[var(--home-text-primary)]">
                        {spec.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Footer */}
            <footer className="border-t border-[var(--home-border-secondary)] pt-8 pb-6">
              <div className="flex flex-col gap-4">
                <div className="text-xs text-[var(--home-text-muted)] font-light">
                  Built with Vercel AI SDK v6, Next.js, and Fumadocs
                </div>
                <div className="text-xs text-[var(--home-text-muted)] font-[family-name:var(--font-ibm-plex-mono)]">
                  © 2025 deepagentsdk
                </div>
              </div>
            </footer>
          </main>
        </div>
      </div>
    </div>
  );
}
