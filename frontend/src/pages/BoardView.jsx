import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { socket } from '../services/socket'
import Toolbar from '../components/Toolbar'
import Canvas from '../components/Canvas'
import TextBox from '../components/TextBox'
import ChatSidebar from '../components/ChatSidebar'
import { useBoard } from '../hooks/useBoard' // <-- ¡CORREGIDO AQUÍ!
import { useChat } from '../hooks/useChat'
import { useHandPointer } from '../hooks/useHandPointer'
import { v4 as uuidv4 } from 'uuid';

export default function BoardView() {
  const { boardId } = useParams()
  const {
    elements, textBoxes,
    addElement, updateElement, removeElement,
    addTextBox, updateTextBox
  } = useBoard(boardId)

  const [userName, setUserName] = useState('')
  useEffect(() => {
    if (socket.connected) setUserName(socket.id)
    else socket.on('connect', () => setUserName(socket.id))
  }, [])

  const { messages, sendMessage } = useChat(boardId, userName)
  const [tool, setTool]         = useState('select')
  const [color, setColor]       = useState('#3b82f6')
  const [chatOpen, setChatOpen] = useState(false)
  const [fontSize, setFontSize] = useState(14); // Estado para el tamaño de fuente

  const [gesturesEnabled, setGesturesEnabled] = useState(false)
  const videoRef = useRef(null)
  const svgRef   = useRef(null)

  // Estado para el ID del elemento seleccionado
  const [selectedElementId, setSelectedElementId] = useState(null);

  const handleHandPointerReady = useCallback(ctrl => {
    if (ctrl && typeof ctrl.hidePreview === 'function') {
      ctrl.hidePreview();
    } else {
      if (videoRef.current) {
        videoRef.current.style.display = 'none';
      }
    }
  }, [videoRef]);

  useHandPointer({
    videoRef,
    svgRef,
    enabled: gesturesEnabled,
    onReady: handleHandPointerReady
  })

  // Efecto para el toggle de gestos con la tecla 'v'
  useEffect(() => {
    const onKey = e => {
      if (e.key.toLowerCase() === 'v' && gesturesEnabled) {
        if (videoRef.current) {
          videoRef.current.style.display =
            videoRef.current.style.display === 'none' ? 'block' : 'none'
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [gesturesEnabled])

  // NUEVO EFECTO: Para borrar elementos con la tecla 'Delete' o 'Backspace'
  useEffect(() => {
    const handleDeleteKey = e => {
      // Solo borrar si la tecla es 'Delete' o 'Backspace'
      // Y si hay un elemento seleccionado
      // Y si el foco NO está en un campo de texto editable O si el elemento seleccionado es el que tiene el foco
      const isInputFocused = document.activeElement.tagName === 'INPUT' ||
                             document.activeElement.tagName === 'TEXTAREA' ||
                             document.activeElement.contentEditable === 'true';
      
      const isSelectedTextBoxFocused = selectedElementId && 
                                       document.activeElement.id === selectedElementId &&
                                       document.activeElement.contentEditable === 'true';

      if (
        (e.key === 'Delete' || e.key === 'Backspace') &&
        selectedElementId &&
        (!isInputFocused || (document.activeElement.id !== selectedElementId && isInputFocused))
      ) {
        e.preventDefault();
        removeElement(selectedElementId);
        setSelectedElementId(null); // Deseleccionar el elemento
      }
    };

    window.addEventListener('keydown', handleDeleteKey);
    return () => window.removeEventListener('keydown', handleDeleteKey);
  }, [selectedElementId, removeElement]); 

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-gray-100">
      <Toolbar
        tool={tool}
        onToolSelect={setTool}
        currentColor={color}
        onColorChange={setColor}
        onToggleChat={() => setChatOpen(o => !o)}
        gesturesEnabled={gesturesEnabled}
        onToggleGestures={setGesturesEnabled}
        currentFontSize={fontSize} // Pasa el tamaño de fuente actual
        onFontSizeChange={setFontSize} // Pasa la función para cambiar el tamaño de fuente
      />

      <div className="relative flex-1">
        {gesturesEnabled && (
          <video
            ref={videoRef}
            muted playsInline
            className="fixed bottom-4 right-4 w-40 h-28 border-2 border-blue-600 rounded z-50"
          />
        )}

        <Canvas
          ref={svgRef}
          className="absolute inset-0 w-full h-full"
          elements={elements}
          onAdd={el => addElement({ ...el, color })}
          onMove={updatedProps => { // onMove ahora recibe las propiedades actualizadas para el elemento
            // Actualiza el elemento en el estado de 'elements' y lo persiste
            updateElement(updatedProps);

            // Si el elemento movido es texto y tiene un TextBox asociado, actualiza también el TextBox local
            const movedTextBox = textBoxes.find(tb => tb.id === updatedProps.id);
            if (movedTextBox) {
                // Solo actualiza las propiedades de posición si están definidas en updatedProps
                updateTextBox(movedTextBox.id, { 
                    x: updatedProps.x ?? movedTextBox.x,
                    y: updatedProps.y ?? movedTextBox.y,
                    width: updatedProps.width ?? movedTextBox.width, // Actualiza width
                    height: updatedProps.height ?? movedTextBox.height, // Actualiza height
                    fontSize: updatedProps.fontSize ?? movedTextBox.fontSize // Propaga fontSize
                });
            }
          }}
          onRemove={removeElement} // Pasa onRemove al Canvas
          onSelectText={pos => {
            const tempTextId = uuidv4(); 
            addTextBox({
              id: tempTextId,
              type: 'text',
              x: pos.x,
              y: pos.y,
              width: 150,
              height: 40,
              text: '',
              placeholder: 'Escribe algo…',
              color,
              fontSize: fontSize // Asigna el tamaño de fuente actual al nuevo texto
            });
            setTool('select'); // Siempre cambiar a herramienta de selección después de añadir un cuadro de texto
          }}
          tool={tool}
          drawColor={color}
          selectedElementId={selectedElementId} // Pasar el ID del elemento seleccionado al Canvas
          onSelectElement={setSelectedElementId} // Pasar la función para actualizar el ID seleccionado
        />

        {textBoxes.map(box => (
          <TextBox
            key={box.id}
            data={box}
            onChange={props => {
              updateTextBox(box.id, props);

              // Determinar el tamaño de fuente a usar: siempre el currentFontSize de BoardView
              const newFontSizeForElement = fontSize; // Usa el estado 'fontSize' de BoardView

              // Eliminar si el texto está vacío
              if (props.text.trim() === '') {
                  removeElement(box.id);
                  updateTextBox(box.id, { deleted: true });
              } else {
                  // Añadir o actualizar el elemento en el Canvas/DB
                  const existingEl = elements.find(el => el.id === box.id);
                  if (!existingEl) {
                      addElement({
                          id: box.id,
                          type: 'text',
                          x: props.x ?? box.x,
                          y: props.y ?? box.y,
                          width: props.width ?? box.width, // Propagar width
                          height: props.height ?? box.height, // Propagar height
                          text: props.text,
                          color: props.color ?? box.color,
                          fontSize: newFontSizeForElement // Usa el nuevo tamaño de fuente de la Toolbar
                      });
                  } else {
                      updateElement({
                          id: box.id,
                          type: 'text',
                          x: props.x ?? box.x,
                          y: props.y ?? box.y,
                          width: props.width ?? box.width,
                          height: props.height ?? box.height,
                          text: props.text,
                          color: props.color ?? box.color,
                          fontSize: newFontSizeForElement // Usa el nuevo tamaño de fuente de la Toolbar
                      });
                  }
              }
            }}
            tool={tool} /* Pasa la herramienta actual al TextBox */
          />
        ))}
      </div>

      {chatOpen && (
        <ChatSidebar
          messages={messages}
          onSend={sendMessage}
          onClose={() => setChatOpen(false)}
          currentUser={userName}
        />
      )}
    </div>
  )
}