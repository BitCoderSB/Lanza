// frontend/src/index.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

// Importa tus componentes de página
import BoardView from './pages/BoardView'; // Ya lo tienes
import HomePage from './pages/HomePage'; // <--- Importa el nuevo componente

// Asegúrate de que tus estilos globales se importen aquí
import './styles/global.css'; // Si ya tienes un archivo CSS global

ReactDOM.createRoot(document.getElementById('root')).render(
  // Si estás en desarrollo y tienes React.StrictMode, puedes mantenerlo o quitarlo para pruebas
  // <React.StrictMode>
    <BrowserRouter>
      <Routes>
        {/* Ruta para la página de inicio */}
        <Route path="/" element={<HomePage />} /> {/* <--- NUEVA RUTA */}

        {/* Ruta existente para la pizarra */}
        <Route path="/boards/:boardId" element={<BoardView />} />
        
        {/* Aquí puedes añadir más rutas si las necesitas, por ejemplo, para login */}
      </Routes>
    </BrowserRouter>
  // </React.StrictMode>
);