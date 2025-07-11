import { useState, useEffect, useCallback, useRef } from 'react'; // Importar useRef
import { socket } from '../services/socket';


export function useBoard(boardId) {
  const [elements, setElements]   = useState([]);
  const [textBoxes, setTextBoxes] = useState([]);

  const API   = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
  const token = localStorage.getItem('token') || '';
  const authHeaders = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` })
  };

  // Ref para el temporizador de debounce
  const debounceTimeoutRef = useRef(null);

  // Función original que envía la petición PUT (no debounced)
  const sendPersistRequest = useCallback((elementsToPersist) => {
    fetch(`${API}/boards/${boardId}/elements`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ elements: elementsToPersist })
    }).catch(err => console.error('useBoard PUT (Error en persistencia):', err));
  }, [API, boardId, authHeaders]); // Dependencias para useCallback

  // 3) Función que persiste todo el estado al backend (ahora con debounce)
  const persist = useCallback(newElements => {
    // Limpiar el temporizador anterior si existe
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    // Establecer un nuevo temporizador
    debounceTimeoutRef.current = setTimeout(() => {
      sendPersistRequest(newElements);
    }, 500); // Guardar 500ms después de la última actualización
  }, [sendPersistRequest]); // Dependencia para useCallback

  // 1) GET inicial de la pizarra (crea si no existe)
  useEffect(() => {
    fetch(`${API}/boards/${boardId}`, {
      method: 'GET',
      headers: authHeaders
    })
      .then(async res => {
        if (!res.ok) {
          const errorText = await res.text(); 
          throw new Error(`Error cargando pizarra (${res.status}): ${errorText}`);
        }
        return res.json();
      })
      .then(board => {
        setElements(board.elements || []);
      })
      .catch(err => {
        console.error('useBoard GET (Error en fetch):', err);
      });
  }, [API, boardId, token]);

  // 2) WebSocket: unirse a sala y escuchar eventos
  useEffect(() => {
    socket.auth = { token };
    socket.connect();
    socket.emit('joinBoard', boardId);

    socket.on('board:init', initial => {
      setElements(initial);
    });

    socket.on('board:add', el => {
      setElements(prev => {
        if (prev.some(existingEl => existingEl.id === el.id)) {
            return prev.map(e => (e.id === el.id ? el : e)); 
        }
        return [...prev, el];
      });
    });

    socket.on('board:update', upd => {
      setElements(prev => {
        if (!prev.some(existingEl => existingEl.id === upd.elementId)) {
            // Elemento no encontrado para actualizar.
            // Podría ocurrir si un evento de actualización llega antes que el evento de adición inicial.
            // En este caso, simplemente se ignora la actualización o se podría añadir el elemento si es deseable.
        }
        return prev.map(e => (e.id === upd.elementId ? { ...e, ...upd } : e));
      });
    });

    socket.on('board:remove', id => {
      setElements(prev => prev.filter(e => e.id !== id));
    });

    return () => {
      socket.off('board:init');
      socket.off('board:add');
      socket.off('board:update');
      socket.off('board:remove');
      socket.disconnect();
    };
  }, [boardId, token]);

  // 4a) Añadir elemento: local + WS + DB
  const addElement = useCallback(el => {
    setElements(prev => {
      if (prev.some(existingEl => existingEl.id === el.id)) {
        return prev.map(e => (e.id === el.id ? el : e)); 
      }
      const next = [...prev, el];
      persist(next); // Llama a la versión debounced
      return next;
    });
    socket.emit('board:add', { boardId, element: el });
  }, [boardId, persist]);

  // 4b) Actualizar elemento
  const updateElement = useCallback(update => {
    setElements(prev => {
      const next = prev.map(e =>
        e.id === update.id ? { ...e, ...update } : e
      );
      persist(next); // Llama a la versión debounced
      return next;
    });
    socket.emit('board:update', {
      boardId,
      elementId: update.id,
      ...update
    });
  }, [boardId, persist]);

  // 4c) Eliminar elemento
  const removeElement = useCallback(id => {
    setElements(prev => {
      const next = prev.filter(e => e.id !== id);
      persist(next); // Llama a la versión debounced
      return next;
    });
    socket.emit('board:remove', { boardId, elementId: id });
  }, [boardId, persist]);

  // 5) TextBoxes (solo en cliente)
  const addTextBox = useCallback(box => {
    setTextBoxes(prev => [...prev, box]);
  }, []);

  const updateTextBox = useCallback((id, props) => {
    setTextBoxes(prev =>
      prev.map(tb => (tb.id === id ? { ...tb, ...props } : tb))
    );
  }, []);

  return {
    elements,
    textBoxes,
    addElement,
    updateElement,
    removeElement,
    addTextBox,
    updateTextBox
  };
}
