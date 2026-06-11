import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App';
import ModelDetailPage from './pages/ModelDetailPage';
import AddModelPage from './pages/AddModelPage';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/add" element={<AddModelPage />} />
        <Route path="/models/:id" element={<ModelDetailPage />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
