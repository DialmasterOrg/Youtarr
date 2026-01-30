import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './themeTokens.css';
import { Root } from './Root';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(<Root />);
