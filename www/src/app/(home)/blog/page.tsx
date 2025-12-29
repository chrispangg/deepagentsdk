import Link from 'next/link';
import { blog } from '@/lib/source';
import { ThemeToggle } from '@/components/theme-toggle';

export default function BlogPage() {
  const posts = blog.getPages();

  return (
    <div className="min-h-screen bg-[var(--home-bg-primary)] text-[var(--home-text-primary)] font-[family-name:var(--font-ibm-plex-sans)] relative">
      {/* Geometric Grid Background */}
      <div className="geometric-grid" />

      <div className="relative z-10">
        {/* Header */}
        <header className="home-header border-b border-[var(--home-border-secondary)] py-6 backdrop-blur-[10px] sticky top-0 z-[100]">
          <div className="max-w-5xl mx-auto px-6">
            <div className="flex items-center justify-between">
              <Link
                href="/"
                className="text-sm font-semibold tracking-tight font-[family-name:var(--font-ibm-plex-mono)] text-[var(--home-text-primary)] hover:text-[var(--home-accent)] transition-colors"
              >
                ai-sdk-deepagent
              </Link>
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
          <main>
            {/* Hero Section */}
            <section className="mb-12">
              <div className="animate-fade-in-up [animation-delay:0.1s] mb-4">
                <span className="text-xs uppercase tracking-widest text-[var(--home-text-muted)] font-[family-name:var(--font-ibm-plex-mono)]">
                  &gt; ls -la /blog
                </span>
              </div>

              <h1 className="animate-fade-in-up [animation-delay:0.2s] mb-6 text-[clamp(2.5rem,7vw,4rem)] leading-none tracking-tighter font-light font-[family-name:var(--font-ibm-plex-mono)] text-[var(--home-text-primary)]">
                Blog Posts
                <span className="terminal-cursor text-[var(--home-accent)]">█</span>
              </h1>

              <div className="animate-fade-in-up [animation-delay:0.3s] h-px bg-gradient-to-r from-[var(--home-accent)] to-transparent max-w-[100px] mb-6" />

              <p className="animate-fade-in-up [animation-delay:0.4s] text-[clamp(1rem,2vw,1.125rem)] max-w-2xl leading-relaxed text-[var(--home-text-secondary)] font-light tracking-tight">
                Insights, technical deep dives, and updates about building Deep Agent with Vercel AI SDK
              </p>
            </section>

            {/* Posts Grid */}
            {posts.length > 0 ? (
              <section className="mb-12">
                <div className="flex items-center gap-4 mb-8">
                  <h2 className="text-xs uppercase tracking-widest text-[var(--home-text-muted)] font-[family-name:var(--font-ibm-plex-mono)]">
                    {posts.length} {posts.length === 1 ? 'Post' : 'Posts'}
                  </h2>
                  <div className="flex-1 h-px bg-[var(--home-border-secondary)]" />
                </div>

                <div className="flex flex-col gap-3">
                  {posts.map((post, idx) => (
                    <Link
                      key={post.url}
                      href={post.url}
                      className="blog-post-card animate-scale-in relative border border-[var(--home-border-secondary)] p-7 bg-[var(--home-bg-card)] shadow-[0_2px_8px_rgba(0,0,0,0.4)] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] overflow-hidden hover:border-[var(--home-border-accent)] hover:bg-[var(--home-bg-elevated)] hover:shadow-[0_8px_32px_rgba(0,0,0,0.6)] hover:-translate-y-1 focus-within:border-[var(--home-border-accent)] focus-within:bg-[var(--home-bg-elevated)] group"
                      style={{ animationDelay: `${0.1 + idx * 0.1}s` }}
                    >
                      <article>
                        <div className="flex items-start justify-between gap-6 mb-4">
                          <div className="flex-1">
                            <h2 className="text-xl font-semibold mb-2 font-[family-name:var(--font-ibm-plex-sans)] text-[var(--home-text-primary)] tracking-tight group-hover:text-[var(--home-accent)] transition-colors">
                              {post.data.title}
                            </h2>
                            {post.data.description && (
                              <p className="text-sm leading-relaxed text-[var(--home-text-secondary)] font-light">
                                {post.data.description}
                              </p>
                            )}
                          </div>
                          <div className="shrink-0 text-[var(--home-text-muted)] transition-transform duration-300 group-hover:translate-x-1">
                            <svg
                              width="20"
                              height="20"
                              viewBox="0 0 20 20"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <path
                                d="M7.5 15L12.5 10L7.5 5"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="square"
                              />
                            </svg>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-xs text-[var(--home-text-muted)] font-[family-name:var(--font-ibm-plex-mono)]">
                          {post.data.author && (
                            <span className="uppercase tracking-wide">{post.data.author}</span>
                          )}
                          {post.data.date && (
                            <>
                              <span className="opacity-30">·</span>
                              <time dateTime={post.data.date.toString()}>
                                {new Date(post.data.date).toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </time>
                            </>
                          )}
                        </div>
                      </article>
                    </Link>
                  ))}
                </div>
              </section>
            ) : (
              <section className="mb-12">
                <div className="border border-[var(--home-border-secondary)] p-12 bg-[var(--home-bg-card)] text-center">
                  <div className="text-xs uppercase tracking-widest text-[var(--home-text-muted)] font-[family-name:var(--font-ibm-plex-mono)] mb-3">
                    Empty Directory
                  </div>
                  <p className="text-sm text-[var(--home-text-secondary)]">
                    No blog posts found. Check back soon for updates.
                  </p>
                </div>
              </section>
            )}

            {/* Footer */}
            <footer className="border-t border-[var(--home-border-secondary)] pt-8 pb-6">
              <div className="flex items-center justify-between text-xs text-[var(--home-text-muted)] font-[family-name:var(--font-ibm-plex-mono)]">
                <div>© 2025 ai-sdk-deepagent</div>
                <Link
                  href="/"
                  className="hover:text-[var(--home-text-primary)] transition-colors"
                >
                  ← Back to Home
                </Link>
              </div>
            </footer>
          </main>
        </div>
      </div>
    </div>
  );
}

export function generateMetadata() {
  return {
    title: 'Blog | ai-sdk-deepagent',
    description: 'Insights, technical deep dives, and updates about building Deep Agent with Vercel AI SDK',
  };
}
