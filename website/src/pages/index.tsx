import React from 'react';
import Link from '@docusaurus/Link';
import useBaseUrl from '@docusaurus/useBaseUrl';
import Layout from '@theme/Layout';
import styles from './styles.module.css';

const cards = [['Getting Started', 'Install, configure, and make your first download.', '/docs/quick-start'], ['Using Youtarr', 'Subscriptions, playlists, playback, and media servers.', '/docs/usage-guide'], ['Operations', 'Backups, maintenance, troubleshooting, and security.', '/docs/config'], ['Developers', 'REST API, integrations, and contribution workflow.', '/docs/api']];
export default function Home() { return <Layout><main className={styles.hero}>
  <div className={styles.brand}><img src={useBaseUrl('img/logo512.png')} className={styles.logo} width={96} height={96} alt="Youtarr app icon" /><img src={useBaseUrl('img/Youtarr_text.png')} className={styles.wordmark} width={360} height={96} alt="Youtarr" /></div>
  <p>Archive YouTube automatically, keep it offline, and organize it for Plex, Jellyfin, Emby, Kodi, or standalone playback.</p>
  <div className={styles.ctas}><Link className="button button--primary button--lg" to="/docs/quick-start">Deploy with Compose</Link><Link className="button button--secondary button--lg" to="/docs/installation">Browse documentation</Link></div>
  <div className={styles.cards}>{cards.map(([title, description, url]) => <Link key={title} to={url}><h2>{title}</h2><p>{description}</p></Link>)}</div>
</main></Layout>; }
