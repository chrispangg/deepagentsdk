import defaultMdxComponents from 'fumadocs-ui/mdx';
import type { MDXComponents } from 'mdx/types';

// Import all installed components
import { Accordion, Accordions } from '@/components/accordion';
import { Banner } from '@/components/banner';
import { CodeBlock, Pre } from '@/components/codeblock';
import { File, Files, Folder } from '@/components/files';
import { InlineTOC } from '@/components/inline-toc';
import { Step, Steps } from '@/components/steps';
import { Tab, Tabs } from '@/components/tabs';
import { TypeTable } from '@/components/type-table';

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    // Accordion
    Accordion,
    Accordions,
    // Banner
    Banner,
    // Code Block
    CodeBlock,
    Pre,
    // Files
    File,
    Files,
    Folder,
    // Inline TOC
    InlineTOC,
    // Steps
    Step,
    Steps,
    // Tabs
    Tab,
    Tabs,
    // Type Table
    TypeTable,
    ...components,
  };
}
