import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { socket } from '../services/socket'
import Toolbar from '../components/Toolbar'
import Canvas from '../components/Canvas'
import TextBox from '../components/TextBox'
import ChatSidebar from '../components/ChatSidebar'
import { useBoard } from '../hooks/useBoard' 
import { useChat } from '../hooks/useChat'
import { useHandPointer } from '../hooks/useHandPointer'
import { useVoiceCommands } from '../hooks/useVoiceCommands'; // NUEVO: Importar el hook de voz
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

  // NUEVO: Lógica de comandos de voz
  const handleVoiceCommand = useCallback((command) => {
    console.log("[BoardView] Comando de voz reconocido:", command);
    switch (command.type) {
      case 'tool':
        setTool(command.value);
        break;
      case 'color':
        setColor(command.value);
        break;
      case 'fontSize':
        setFontSize(command.value);
        break;
      default:
        console.warn("[BoardView] Tipo de comando de voz no manejado:", command.type);
    }
  }, [setTool, setColor, setFontSize]); // Dependencias para useCallback

  const { isListening, startListening, stopListening } = useVoiceCommands(handleVoiceCommand);

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

  // Efecto para borrar elementos con la tecla 'Delete' o 'Backspace'
  useEffect(() => {
    const handleDeleteKey = e => {
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
        setSelectedElementId(null);
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
        currentFontSize={fontSize}
        onFontSizeChange={setFontSize}
        isVoiceListening={isListening} // Pasa el estado de escucha de voz
        onToggleVoice={isListening ? stopListening : startListening} // Pasa la función para activar/desactivar voz
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
          onMove={updatedProps => {
            updateElement(updatedProps);
            const movedTextBox = textBoxes.find(tb => tb.id === updatedProps.id);
            if (movedTextBox) {
                updateTextBox(movedTextBox.id, { 
                    x: updatedProps.x ?? movedTextBox.x,
                    y: updatedProps.y ?? movedTextBox.y,
                    width: updatedProps.width ?? movedTextBox.width,
                    height: updatedProps.height ?? movedTextBox.height,
                    fontSize: updatedProps.fontSize ?? movedTextBox.fontSize
                });
            }
          }}
          onRemove={removeElement}
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
              fontSize: fontSize
            });
            setTool('select');
          }}
          tool={tool}
          drawColor={color}
          selectedElementId={selectedElementId}
          onSelectElement={setSelectedElementId}
        />

        {textBoxes.map(box => (
          <TextBox
            key={box.id}
            data={box}
            onChange={props => {
              updateTextBox(box.id, props);

              const newFontSizeForElement = fontSize;

              if (props.text.trim() === '') {
                  removeElement(box.id);
                  updateTextBox(box.id, { deleted: true });
              } else {
                  const existingEl = elements.find(el => el.id === box.id);
                  if (!existingEl) {
                      addElement({
                          id: box.id,
                          type: 'text',
                          x: props.x ?? box.x,
                          y: props.y ?? box.y,
                          width: props.width ?? box.width,
                          height: props.height ?? box.height,
                          text: props.text,
                          color: props.color ?? box.color,
                          fontSize: newFontSizeForElement
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
                          fontSize: newFontSizeForElement
                      });
                  }
              }
            }}
            tool={tool}
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