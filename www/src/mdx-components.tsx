import defaultMdxComponents from 'fumadocs-ui/mdx';
import type { MDXComponents } from 'mdx/types';
import * as Twoslash from 'fumadocs-twoslash/ui';

// Import all installed components
import { Accordion, Accordions } from '@/components/accordion';
import { Banner } from '@/components/banner';
import { CodeBlock, Pre } from '@/components/codeblock';
import { File, Files, Folder } from '@/components/files';
import { InlineTOC } from '@/components/inline-toc';
import { Mermaid } from '@/components/mermaid';
import { Step, Steps } from '@/components/steps';
import { Tab, Tabs } from '@/components/tabs';
import { TypeTable } from '@/components/type-table';

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    // Twoslash components for TypeScript code annotations
    ...Twoslash,
    // Accordion
    Accordion,
    Accordions,
    // Banner
    Banner,
    // Code Block - Wrap pre element with CodeBlock
    pre: ({ ref: _ref, ...props }) => (
      <CodeBlock {...props}>
        <Pre>{props.children}</Pre>
      </CodeBlock>
    ),
    // Files
    File,
    Files,
    Folder,
    // Inline TOC
    InlineTOC,
    // Mermaid diagrams
    Mermaid,
    // Steps
    Step,
    Steps,
    // Tabs
    Tab,
    Tabs,
    // Type Table
    TypeTable,
    ...components,
  } as MDXComponents;
}
