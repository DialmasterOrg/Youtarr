import React from 'react';
import Link from '@docusaurus/Link';
import useBaseUrl from '@docusaurus/useBaseUrl';

export default function NavbarLogo() {
  return <Link className="navbar__brand" to={useBaseUrl('/')} aria-label="Youtarr">
    <img className="navbar__logo" src={useBaseUrl('img/logo512.png')} width={32} height={32} alt="" />
    <img className="navbar__wordmark" src={useBaseUrl('img/Youtarr_text.png')} width={120} height={32} alt="Youtarr" />
  </Link>;
}
