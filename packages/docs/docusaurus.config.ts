import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
  title: 'Kiteretsu',
  tagline: 'Codebase Intelligence & Agent Memory Layer',
  favicon: 'img/favicon.ico',

  future: {
    v4: true,
  },

  url: 'https://kiteretsu.org',
  baseUrl: '/',

  organizationName: 'spellsaif',
  projectName: 'kiteretsu',

  onBrokenLinks: 'throw',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/spellsaif/kiteretsu/tree/main/packages/docs/',
        },
        blog: false, // Disabled blog
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    colorMode: {
      defaultMode: 'dark',
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'Kiteretsu',
      logo: {
        alt: 'Kiteretsu Logo',
        src: 'https://i.ibb.co/cKjWsd7p/kiteretsu.png',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'tutorialSidebar',
          position: 'left',
          label: 'Documentation',
        },
        {
          href: 'https://github.com/spellsaif/kiteretsu',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {
              label: 'Getting Started',
              to: '/docs/intro',
            },
            {
              label: 'Interactive UI',
              to: '/docs/commands/ui',
            },
          ],
        },
        {
          title: 'Agent Integrations',
          items: [
            {
              label: 'Overview',
              to: '/docs/agents/overview',
            },
            {
              label: 'Claude Code',
              to: '/docs/agents/claude',
            },
            {
              label: 'Cursor',
              to: '/docs/agents/cursor',
            },
          ],
        },
        {
          title: 'More',
          items: [
            {
              label: 'GitHub',
              href: 'https://github.com/spellsaif/kiteretsu',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Kiteretsu. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['rust', 'go', 'ruby', 'python', 'bash'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
