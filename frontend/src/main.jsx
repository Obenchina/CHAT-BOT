/**
 * Main Entry Point
 * React application bootstrap
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

// Render application
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
