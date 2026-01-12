import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.scss';
import './lumon-terminal.css'; // Lumon Industries Terminal UI
import App from './App';
import { BrowserRouter } from 'react-router-dom';

// https://caniuse.com/mdn-javascript_builtins_array_flatmap
require('array.prototype.flatmap').shim();

const root = createRoot(document.getElementById('root')!);

root.render(
  // <React.StrictMode>
  <BrowserRouter basename={process.env.PUBLIC_URL}>
    <App />
  </BrowserRouter>,
  // </React.StrictMode>
);
