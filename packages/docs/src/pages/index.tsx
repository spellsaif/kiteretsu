import type {ReactNode} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import HomepageFeatures from '@site/src/components/HomepageFeatures';
import Heading from '@theme/Heading';

import styles from './index.module.css';

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <Heading as="h1" className="hero__title" style={{ fontWeight: 800, fontSize: '4rem' }}>
          {siteConfig.title}
        </Heading>
        <p className="hero__subtitle" style={{ opacity: 0.8 }}>{siteConfig.tagline}</p>
        <div className={styles.buttons}>
          <Link
            className="button button--secondary button--lg"
            to="/docs/getting-started/quick-start"
            style={{ padding: '1rem 3rem', borderRadius: '50px' }}>
            Get Started 🚀
          </Link>
        </div>
      </div>
    </header>
  );
}

export default function Home(): ReactNode {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title={`${siteConfig.title} | Codebase Intelligence`}
      description={siteConfig.tagline}>
      <HomepageHeader />
      <main>
        {/* Simplified main section */}
        <section style={{ padding: '4rem 0', borderTop: '1px solid var(--site-border-color)' }}>
          <div className="container">
            <div className="row">
              <div className="col col--4">
                <h3>Built for Agents</h3>
                <p>Standardized protocols for Claude, Cursor, and Antigravity.</p>
              </div>
              <div className="col col--4">
                <h3>Token Optimized</h3>
                <p>Save up to 90% on context tokens with precision mapping.</p>
              </div>
              <div className="col col--4">
                <h3>Zero Hallucination</h3>
                <p>Ensures agents never guess about your project architecture.</p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}
