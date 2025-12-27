import { blog } from '@/lib/source';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ThemeToggle } from '@/components/theme-toggle';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const page = blog.getPage([slug]);

  if (!page) {
    notFound();
  }

  const MDX = page.data.body;

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
          <article>
            {/* Back Link */}
            <div className="animate-fade-in-up [animation-delay:0.1s] mb-8">
              <Link
                href="/blog"
                className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-[var(--home-text-muted)] hover:text-[var(--home-text-primary)] transition-colors font-[family-name:var(--font-ibm-plex-mono)]"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path
                    d="M7.5 9L4.5 6L7.5 3"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="square"
                  />
                </svg>
                Back to Blog
              </Link>
            </div>

            {/* Post Header */}
            <header className="mb-12">
              <div className="animate-fade-in-up [animation-delay:0.2s] mb-4">
                <span className="text-xs uppercase tracking-widest text-[var(--home-text-muted)] font-[family-name:var(--font-ibm-plex-mono)]">
                  &gt; cat {slug}.mdx
                </span>
              </div>

              <h1 className="animate-fade-in-up [animation-delay:0.3s] mb-6 text-[clamp(2rem,5vw,3rem)] leading-tight tracking-tighter font-light font-[family-name:var(--font-ibm-plex-mono)] text-[var(--home-text-primary)]">
                {page.data.title}
              </h1>

              <div className="animate-fade-in-up [animation-delay:0.4s] h-px bg-gradient-to-r from-[var(--home-accent)] to-transparent max-w-[100px] mb-6" />

              {page.data.description && (
                <p className="animate-fade-in-up [animation-delay:0.5s] text-[clamp(1rem,2vw,1.125rem)] max-w-3xl leading-relaxed text-[var(--home-text-secondary)] font-light tracking-tight mb-6">
                  {page.data.description}
                </p>
              )}

              <div className="animate-fade-in-up [animation-delay:0.6s] flex items-center gap-4 text-xs text-[var(--home-text-muted)] font-[family-name:var(--font-ibm-plex-mono)]">
                {page.data.author && (
                  <span className="uppercase tracking-wide">{page.data.author}</span>
                )}
                {page.data.date && (
                  <>
                    <span className="opacity-30">·</span>
                    <time dateTime={page.data.date.toString()}>
                      {new Date(page.data.date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </time>
                  </>
                )}
              </div>
            </header>

            {/* Post Content */}
            <div className="blog-content animate-fade-in-up [animation-delay:0.7s] mb-12">
              <MDX />
            </div>

            {/* Footer Navigation */}
            <footer className="border-t border-[var(--home-border-secondary)] pt-8">
              <Link
                href="/blog"
                className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-[var(--home-text-muted)] hover:text-[var(--home-text-primary)] transition-colors font-[family-name:var(--font-ibm-plex-mono)]"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path
                    d="M7.5 9L4.5 6L7.5 3"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="square"
                  />
                </svg>
                All Posts
              </Link>
            </footer>
          </article>
        </div>
      </div>
    </div>
  );
}

export async function generateStaticParams() {
  return blog.getPages().map((page) => ({
    slug: page.slugs[0],
  }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = blog.getPage([slug]);

  if (!page) {
    notFound();
  }

  return {
    title: `${page.data.title} | ai-sdk-deepagent`,
    description: page.data.description,
  };
}
