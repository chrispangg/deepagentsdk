import { createFileRoute, Link } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
  component: HomePage,
});

function HomePage() {
  return (
    <>
      <style dangerouslySetInnerHTML={{
        __html: `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600;700&family=IBM+Plex+Sans:wght@300;400;500;600;700&display=swap');

:root {
  --bg-primary: #0A0A0A;
  --bg-elevated: #141414;
  --bg-card: #0D0D0D;
  --text-primary: #F5F5F5;
  --text-secondary: #9CA3AF;
  --text-muted: #6B7280;
  --border-primary: #262626;
  --border-secondary: #1A1A1A;
  --border-accent: #404040;
  --accent: #FFFFFF;
  --shadow-subtle: 0 2px 8px rgba(0, 0, 0, 0.4);
  --shadow-elevated: 0 8px 32px rgba(0, 0, 0, 0.6);
}

@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

@keyframes blink {
  0%, 49% { opacity: 1; }
  50%, 100% { opacity: 0; }
}

.animate-fade-in-up { animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; opacity: 0; }
.animate-fade-in { animation: fadeIn 0.5s ease-out forwards; opacity: 0; }
.animate-scale-in { animation: scaleIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; opacity: 0; }
.delay-100 { animation-delay: 0.1s; }
.delay-200 { animation-delay: 0.2s; }
.delay-300 { animation-delay: 0.3s; }
.delay-400 { animation-delay: 0.4s; }
.delay-500 { animation-delay: 0.5s; }
.terminal-cursor { animation: blink 1s step-end infinite; }

.geometric-grid {
  position: fixed;
  inset: 0;
  background-image: linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
  background-size: 80px 80px;
  pointer-events: none;
  z-index: 1;
}

*:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }

.skip-to-content { position: absolute; left: -9999px; z-index: 999; }
.skip-to-content:focus {
  left: 50%;
  transform: translateX(-50%);
  top: 1rem;
  background: var(--accent);
  color: var(--bg-primary);
  padding: 0.75rem 1.5rem;
  text-decoration: none;
  font-weight: 600;
}

.btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.875rem 1.75rem;
  border: 1px solid;
  font-weight: 500;
  text-decoration: none;
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  cursor: pointer;
  overflow: hidden;
  font-size: 0.875rem;
}

.btn::before {
  content: '';
  position: absolute;
  inset: 0;
  background: currentColor;
  opacity: 0;
  transition: opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.btn-primary {
  border-color: var(--accent);
  color: var(--accent);
  background: transparent;
}

.btn-primary:hover, .btn-primary:focus {
  background: var(--accent);
  color: var(--bg-primary);
  box-shadow: var(--shadow-elevated);
  transform: translateY(-2px);
}

.btn-secondary {
  border-color: var(--border-primary);
  color: var(--text-secondary);
  background: var(--bg-card);
}

.btn-secondary:hover, .btn-secondary:focus {
  border-color: var(--text-primary);
  color: var(--text-primary);
  background: var(--bg-elevated);
  box-shadow: var(--shadow-subtle);
}

.feature-card {
  position: relative;
  border: 1px solid var(--border-secondary);
  padding: 1.75rem;
  background: var(--bg-card);
  box-shadow: var(--shadow-subtle);
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  overflow: hidden;
}

.feature-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, var(--accent), transparent);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.feature-card:hover, .feature-card:focus-within {
  border-color: var(--border-accent);
  background: var(--bg-elevated);
  box-shadow: var(--shadow-elevated);
  transform: translateY(-4px);
}

.feature-card:hover::before, .feature-card:focus-within::before { opacity: 1; }

.stat-card {
  position: relative;
  border: 1px solid var(--border-secondary);
  padding: 1.25rem;
  background: linear-gradient(135deg, var(--bg-card) 0%, var(--bg-elevated) 100%);
  box-shadow: var(--shadow-subtle);
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.stat-card:hover {
  border-color: var(--border-primary);
  box-shadow: var(--shadow-elevated);
  transform: translateY(-2px);
}

.code-block {
  position: relative;
  border: 1px solid var(--border-primary);
  background: var(--bg-card);
  box-shadow: var(--shadow-subtle);
}

.code-block::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 4px;
  height: 100%;
  background: var(--accent);
}
`
      }} />

      <div style={{
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        fontFamily: "'IBM Plex Sans', sans-serif",
        minHeight: '100vh',
        position: 'relative'
      }}>
        <div className="geometric-grid" />

        <a href="#main-content" className="skip-to-content">
          Skip to main content
        </a>

        <div style={{ position: 'relative', zIndex: 10 }}>
          <header style={{
            borderBottom: '1px solid var(--border-secondary)',
            padding: '1.5rem 0',
            background: 'linear-gradient(180deg, rgba(10,10,10,0.95) 0%, rgba(10,10,10,0.8) 100%)',
            backdropFilter: 'blur(10px)',
            position: 'sticky',
            top: 0,
            zIndex: 100
          }}>
            <div style={{ maxWidth: '80rem', margin: '0 auto', padding: '0 1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, letterSpacing: '-0.025em', fontFamily: "'IBM Plex Mono', monospace" }}>
                  <span style={{ color: 'var(--text-primary)' }}>ai-sdk-deep-agent</span>
                  <span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem' }}>// v0.9.2</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent)', opacity: 0.8 }} />
                  <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>
                    Deep Agents
                  </span>
                </div>
              </div>
            </div>
          </header>

          <div style={{ maxWidth: '80rem', margin: '0 auto', padding: '2.5rem 1.5rem 3rem' }}>
            <main id="main-content">
              <section style={{ marginBottom: '3rem' }}>
                <div className="animate-fade-in-up delay-100" style={{ marginBottom: '1rem' }}>
                  <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', fontFamily: "'IBM Plex Mono', monospace" }}>
                    &gt; cat README.md
                  </span>
                </div>

                <h1 className="animate-fade-in-up delay-200" style={{ marginBottom: '1.5rem', fontSize: 'clamp(2.5rem, 7vw, 5rem)', lineHeight: '1', letterSpacing: '-0.03em', fontWeight: 300, fontFamily: "'IBM Plex Mono', monospace", color: 'var(--text-primary)' }}>
                  Deep Agents
                  <span className="terminal-cursor" style={{ color: 'var(--accent)' }}>█</span>
                </h1>

                <div className="animate-fade-in-up delay-300" style={{ height: '1px', background: 'linear-gradient(90deg, var(--accent), transparent)', maxWidth: '100px', marginBottom: '1.5rem' }} />

                <p className="animate-fade-in-up delay-400" style={{ fontSize: 'clamp(1.125rem, 2vw, 1.25rem)', maxWidth: '48rem', lineHeight: '1.5', color: 'var(--text-secondary)', fontWeight: 300, letterSpacing: '-0.01em' }}>
                  Build agents that can plan, delegate to subagents, and leverage file systems for complex, multi-step tasks using Vercel AI SDK v6
                </p>
              </section>

              <div className="animate-fade-in-up delay-500" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '4rem' }}>
                <Link to="/docs/$" params={{ _splat: '' }} className="btn btn-primary" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                  Read Documentation
                </Link>
                <a href="https://github.com/chrispangg/ai-sdk-deepagent" target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                  View on GitHub
                </a>
              </div>

              <section style={{ marginBottom: '4rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                  <h2 style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', fontFamily: "'IBM Plex Mono', monospace" }}>
                    Core Features
                  </h2>
                  <div style={{ flex: 1, height: '1px', background: 'var(--border-secondary)' }} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {[
                    { number: '01', title: 'Planning & Task Decomposition', description: 'Built-in write_todos tool enables agents to break down complex tasks into discrete steps, track progress, and adapt plans as new information emerges during execution.', code: 'write_todos()' },
                    { number: '02', title: 'Context Management', description: 'File system tools (ls, read_file, write_file, edit_file, glob, grep) allow agents to offload large context to memory, preventing context window overflow and enabling work with variable-length tool results.', code: 'read_file() | write_file()' },
                    { number: '03', title: 'Subagent Spawning', description: 'Built-in task tool enables agents to spawn specialized subagents for context isolation. This keeps the main agent\'s context clean while still going deep on specific subtasks.', code: 'task(agent: "researcher")' },
                    { number: '04', title: 'Session Persistence', description: 'Checkpointers enable persistent memory across conversations. Agents can save and restore state (todos, files, messages) and resume long-running tasks later.', code: 'checkpointer: new FileSaver()' }
                  ].map((feature, idx) => (
                    <article key={feature.number} className="feature-card animate-scale-in" style={{ animationDelay: `${0.1 + idx * 0.1}s` }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1.5rem' }}>
                        <div style={{ fontSize: '2.25rem', fontWeight: 300, flexShrink: 0, fontFamily: "'IBM Plex Mono', monospace", color: 'var(--text-muted)', opacity: 0.3 }}>
                          {feature.number}
                        </div>
                        <div style={{ flex: 1 }}>
                          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem', fontFamily: "'IBM Plex Sans', sans-serif", color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                            {feature.title}
                          </h3>
                          <p style={{ fontSize: '0.875rem', marginBottom: '0.75rem', lineHeight: '1.6', color: 'var(--text-secondary)', fontWeight: 300 }}>
                            {feature.description}
                          </p>
                          <code style={{ display: 'inline-block', padding: '0.375rem 0.75rem', fontSize: '0.75rem', background: 'var(--bg-primary)', border: '1px solid var(--border-secondary)', color: 'var(--accent)', fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.02em' }}>
                            {feature.code}
                          </code>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <section style={{ marginBottom: '4rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                  <h2 style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', fontFamily: "'IBM Plex Mono', monospace" }}>
                    Quick Start
                  </h2>
                  <div style={{ flex: 1, height: '1px', background: 'var(--border-secondary)' }} />
                </div>

                <div className="code-block" style={{ padding: '1.5rem' }}>
                  <pre style={{ margin: 0, lineHeight: '1.7', color: 'var(--text-primary)', fontFamily: "'IBM Plex Mono', monospace", fontWeight: 400, fontSize: '0.875rem', whiteSpace: 'pre', overflowX: 'auto' }}>
                    {`import { createDeepAgent } from 'ai-sdk-deep-agent';
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
console.log(Object.keys(result.state.files));`}
                  </pre>
                </div>
              </section>

              <section style={{ marginBottom: '4rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                  <h2 style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', fontFamily: "'IBM Plex Mono', monospace" }}>
                    Capabilities
                  </h2>
                  <div style={{ flex: 1, height: '1px', background: 'var(--border-secondary)' }} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
                  {[
                    { label: 'Core Tools', value: '12' },
                    { label: 'Storage Backends', value: '4' },
                    { label: 'Filesystem Ops', value: '7 tools' },
                    { label: 'Checkpointers', value: '3 types' }
                  ].map((stat, i) => (
                    <div key={i} className="stat-card" style={{ animationDelay: `${0.1 + i * 0.05}s` }}>
                      <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem', color: 'var(--text-muted)', fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 500 }}>
                        {stat.label}
                      </div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 300, fontFamily: "'IBM Plex Mono', monospace", color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                        {stat.value}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section style={{ marginBottom: '3rem' }}>
                <div style={{ border: '1px solid var(--border-secondary)', padding: '2rem', background: 'var(--bg-card)', boxShadow: 'var(--shadow-subtle)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                    <h2 style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', fontFamily: "'IBM Plex Mono', monospace" }}>
                      Technical Specifications
                    </h2>
                    <div style={{ flex: 1, height: '1px', background: 'var(--border-secondary)' }} />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: '1rem 3rem' }}>
                    {[
                      { label: 'Framework', value: 'Vercel AI SDK v6' },
                      { label: 'Runtime', value: 'Bun' },
                      { label: 'Language', value: 'TypeScript 5.9+' },
                      { label: 'Model Providers', value: 'Anthropic, OpenAI, Azure, etc.' },
                      { label: 'Built-in Tools', value: 'write_todos, task, ls, read_file, write_file, edit_file, glob, grep' },
                      { label: 'Storage Backends', value: 'In-memory, Filesystem, Persistent, Composite' }
                    ].map((spec, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: '0.5rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-secondary)' }}>
                        <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: 400 }}>
                          {spec.label}
                        </span>
                        <span style={{ fontSize: '0.875rem', fontWeight: 500, fontFamily: "'IBM Plex Mono', monospace", color: 'var(--text-primary)' }}>
                          {spec.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <footer style={{ borderTop: '1px solid var(--border-secondary)', paddingTop: '2rem', paddingBottom: '1.5rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 300 }}>
                    Built with Vercel AI SDK v6, TanStack Start, and Fumadocs
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: "'IBM Plex Mono', monospace" }}>
                    © 2025 ai-sdk-deep-agent
                  </div>
                </div>
              </footer>
            </main>
          </div>
        </div>
      </div>
    </>
  );
}
