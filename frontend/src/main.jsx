// src/main.jsx

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import Modal from 'react-modal';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './index.css';
import './app.css';

// 🔐 Google OAuth Client ID do arquivo .env
const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

// ✅ Necessário para acessibilidade do react-modal
Modal.setAppElement('#root');

// 🚀 Montagem da aplicação React
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={clientId}>
      {/* 🌐 Componente principal da aplicação */}
      <App />

      {/* 🔔 Toasts globais para feedback visual */}
      <ToastContainer
        position="top-right"
        autoClose={4000}
        hideProgressBar={false}
        newestOnTop={true}
        closeOnClick
        pauseOnHover
        draggable
        theme="colored"
      />
    </GoogleOAuthProvider>
  </React.StrictMode>
);
