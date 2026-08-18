import type {ReactNode} from 'react';
import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

type FeatureItem = {
  title: string;
  Svg: React.ComponentType<React.ComponentProps<'svg'>>;
  description: ReactNode;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'Four-Signal Multi-Sensor Fusion',
    Svg: require('@site/static/img/undraw_docusaurus_mountain.svg').default,
    description: (
      <>
        Unifies BM25-inspired lexical matching, deterministic semantic embeddings,
        multi-hop symbol graph traversal, and episodic memory into compact Context Packs.
      </>
    ),
  },
  {
    title: 'Transitive Blast Radius',
    Svg: require('@site/static/img/undraw_docusaurus_tree.svg').default,
    description: (
      <>
        Predict downstream callers, affected test suites, and risk ratings before editing code.
        Synthesize AST source, ADRs, rules, and graph dependencies with <code>kiteretsu explain</code>.
      </>
    ),
  },
  {
    title: 'Zero-Friction Agent Bridge',
    Svg: require('@site/static/img/undraw_docusaurus_react.svg').default,
    description: (
      <>
        One-command onboarding with <code>npx kiteretsu init</code> for Claude Code,
        Cursor IDE, Gemini CLI, OpenCode, OpenAI Codex, GitHub Copilot, and standard MCP clients.
      </>
    ),
  },
];

function Feature({title, Svg, description}: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center">
        <Svg className={styles.featureSvg} role="img" />
      </div>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
