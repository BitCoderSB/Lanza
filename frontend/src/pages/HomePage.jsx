import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';

import '../styles/HomePage.css';

export default function HomePage() {
  const [boardIdInput, setBoardIdInput] = useState('');
  const navigate = useNavigate();

  const handleCreateBoard = () => {
    const newBoardId = uuidv4();
    navigate(`/boards/${newBoardId}`);
  };

  const handleJoinBoard = () => {
    const trimmedId = boardIdInput.trim();
    if (trimmedId) {
      navigate(`/boards/${trimmedId}`);
    } else {
      alert('Por favor, ingresa un ID de pizarra válido para unirte.');
    }
  };

  return (
    <div className="home-page-body">
      <div className="container">
        <h1>¡Bienvenido a DrawMotion!</h1>
        <p>Una forma sencilla de colaborar en tiempo real.</p>

        <div className="section">
          <h2>Crear una nueva pizarra</h2>
          <p>Empieza un nuevo proyecto desde cero.</p>
          <button onClick={handleCreateBoard}>Crear Pizarra</button>
        </div>

        <div className="divider">O</div>

        <div className="section">
          <h2>Unirse a una pizarra existente</h2>
          <p>Ingresa el ID de la pizarra a la que deseas unirte.</p>
          <input
            type="text"
            id="boardIdInput"
            placeholder="Ej. mi-pizarra-unica-123"
            value={boardIdInput}
            onChange={(e) => setBoardIdInput(e.target.value)}
          />
          <button onClick={handleJoinBoard}>Unirse a la Pizarra</button>
        </div>

      </div>
    </div>
  );
}