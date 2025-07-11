import React, { useRef, useEffect } from 'react';

// Define los tipos de handles de redimensionamiento y sus cursores
const RESIZE_HANDLES = {
  TL: 'nw-resize', // Top-Left
  TR: 'ne-resize', // Top-Right
  BL: 'sw-resize', // Bottom-Left
  BR: 'se-resize', // Bottom-Right
  T: 'n-resize',   // Top
  B: 's-resize',   // Bottom
  L: 'w-resize',   // Left
  R: 'e-resize',   // Right
};

export default function TextBox({ data, onChange, tool }) {
  // data ahora incluye 'fontSize'
  const { id, x, y, width, height, text, placeholder, color, focus, fontSize } = data; 
  const textBoxRef = useRef(null);

  // Refs para el estado de arrastre/redimensionamiento
  const isDraggingRef = useRef(false);
  const isResizingRef = useRef(null); // Almacena el tipo de handle de resize ('TL', 'TR', etc.)
  const dragStartXRef = useRef(0); // Posición X del puntero al inicio del arrastre/resize
  const dragStartYRef = useRef(0); // Posición Y del puntero al inicio del arrastre/resize
  const initialBoxXRef = useRef(0); // Posición X inicial del TextBox
  const initialBoxYRef = useRef(0); // Posición Y inicial del TextBox
  const initialBoxWidthRef = useRef(0); // Ancho inicial del TextBox
  const initialBoxHeightRef = useRef(0); // Alto inicial del TextBox
  const initialAspectRatioRef = useRef(1); // Relación de aspecto inicial (ancho/alto)


  // Efecto 1: Para enfocar el div y mover el cursor al final
  useEffect(() => {
    const el = textBoxRef.current;
    if (!el) return;

    if (focus) {
      el.focus();
      try {
        const range = document.createRange();
        const selection = window.getSelection();
        range.selectNodeContents(el);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
      } catch (e) {
        console.warn("[TextBox.jsx] Error al mover el cursor al final:", e);
      }
    }
    adjustSize(); 
  }, [focus]);

  // Efecto 2: Para actualizar el contenido del div SOLO cuando la prop 'text' cambia externamente
  useEffect(() => {
    const el = textBoxRef.current;
    if (el && el.textContent !== text) { 
      el.textContent = text;
      adjustSize();
    }
  }, [text]);


  // Función para ajustar el tamaño del div en base a su contenido y notificar al padre
  const adjustSize = () => {
    const el = textBoxRef.current;
    if (!el) return;

    const originalOverflow = el.style.overflow;
    const originalWidthStyle = el.style.width;
    const originalHeightStyle = el.style.height;

    el.style.overflow = 'visible'; 
    el.style.width = 'auto'; 
    el.style.height = 'auto';

    const newWidth = el.offsetWidth;
    const newHeight = el.offsetHeight;

    el.style.overflow = originalOverflow;
    el.style.width = originalWidthStyle;
    el.style.height = originalHeightStyle;

    if (newWidth !== data.width || newHeight !== data.height || el.textContent.trim() !== data.text.trim()) {
        onChange({ 
            x: data.x, 
            y: data.y, 
            width: newWidth, 
            height: newHeight, 
            text: el.textContent,
            fontSize: data.fontSize 
        });
    }
  };

  // --- Lógica de arrastre y redimensionamiento de handles ---
  const handlePointerDown = (e) => {
    // Solo si la herramienta es 'select' y el clic es del botón izquierdo
    if (tool === 'select' && (e.button === 0 || e.pointerType === 'touch')) { 
        e.stopPropagation();
        e.target.setPointerCapture(e.pointerId);

        dragStartXRef.current = e.clientX;
        dragStartYRef.current = e.clientY;
        initialBoxXRef.current = x;
        initialBoxYRef.current = y;
        initialBoxWidthRef.current = width;
        initialBoxHeightRef.current = height;
        initialAspectRatioRef.current = width / height;

        const handleType = e.target.dataset.handle;
        if (handleType) {
            isResizingRef.current = handleType;
        } else {
            isDraggingRef.current = true;
            textBoxRef.current.style.cursor = 'grabbing';
        }
    }
  };

  const handlePointerMove = (e) => {
    if (!isDraggingRef.current && !isResizingRef.current) return;

    const dx = e.clientX - dragStartXRef.current;
    const dy = e.clientY - dragStartYRef.current;

    let newX = initialBoxXRef.current;
    let newY = initialBoxYRef.current;
    let newWidth = initialBoxWidthRef.current;
    let newHeight = initialBoxHeightRef.current;

    if (isDraggingRef.current) {
        newX = initialBoxXRef.current + dx;
        newY = initialBoxYRef.current + dy;
    } else if (isResizingRef.current) {
        const handleType = isResizingRef.current;
        
        const isCornerHandle = ['TL', 'TR', 'BL', 'BR'].includes(handleType);
        if (isCornerHandle) {
            const currentWidthChange = initialBoxWidthRef.current + dx;
            const currentHeightChange = initialBoxHeightRef.current + dy;

            let scale = 1;
            if (initialBoxWidthRef.current !== 0 && initialBoxHeightRef.current !== 0) {
                const scaleX = currentWidthChange / initialBoxWidthRef.current;
                const scaleY = currentHeightChange / initialBoxHeightRef.current;
                scale = Math.max(scaleX, scaleY);
            } else { 
                scale = Math.max(Math.abs(dx) / 50, Math.abs(dy) / 30); 
            }

            newWidth = initialBoxWidthRef.current * scale;
            newHeight = initialBoxHeightRef.current * scale;

            if (handleType === 'TL') {
                newX = initialBoxXRef.current + (initialBoxWidthRef.current - newWidth);
                newY = initialBoxYRef.current + (initialBoxHeightRef.current - newHeight);
            } else if (handleType === 'BL') {
                newX = initialBoxXRef.current + (initialBoxWidthRef.current - newWidth);
            } else if (handleType === 'TR') {
                newY = initialBoxYRef.current + (initialBoxHeightRef.current - newHeight);
            }
        } else { // Redimensionamiento NO PROPORCIONAL en los lados
            switch (handleType) {
                case 'T':
                    newHeight = initialBoxHeightRef.current - dy;
                    newY = initialBoxYRef.current + dy;
                    break;
                case 'B':
                    newHeight = initialBoxHeightRef.current + dy;
                    break;
                case 'L':
                    newWidth = initialBoxWidthRef.current - dx;
                    newX = initialBoxXRef.current + dx;
                    break;
                case 'R':
                    newWidth = initialBoxWidthRef.current + dx;
                    break;
                default:
                    break;
            }
        }

        newWidth = Math.max(50, newWidth); 
        newHeight = Math.max(30, newHeight); 
    }

    onChange({ 
        x: newX, 
        y: newY, 
        width: newWidth, 
        height: newHeight, 
        text: textBoxRef.current.textContent,
        fontSize: data.fontSize 
    });
  };

  const handlePointerUp = (e) => {
    if (isDraggingRef.current || isResizingRef.current) {
        isDraggingRef.current = false;
        isResizingRef.current = null;
        e.target.releasePointerCapture(e.pointerId);
        // El cursor se actualizará al final del render
        adjustSize(); 
    }
  };


  const handleInput = () => {
    adjustSize(); 
    onChange({ text: textBoxRef.current.textContent, width: data.width, height: data.height, fontSize: data.fontSize }); 
  };

  const handleBlur = () => {
    adjustSize(); 
    onChange({ text: textBoxRef.current.textContent, focus: false, width: data.width, height: data.height, fontSize: data.fontSize }); 
  };

  // Calcula el estilo de posición y tamaño del TextBox (base)
  const baseStyle = {
    position: 'absolute',
    left: `${x}px`,
    top: `${y}px`,
    width: `${width}px`, 
    height: `${height}px`,
    color: color || '#111827',
    fontSize: `${fontSize}px`, 
  };

  // NUEVO: Control de pointer-events basado en la herramienta
  // Si la herramienta es 'text', permite eventos. Si es 'select', permite eventos para arrastre/resize.
  // Si es 'eraser' o cualquier otra, los desactiva para que pasen al Canvas.
  const pointerEventsStyle = {
    pointerEvents: (tool === 'text' || tool === 'select') ? 'auto' : 'none',
  };

  // Combina todos los estilos
  const finalStyle = { ...baseStyle, ...pointerEventsStyle };

  // Control del cursor: solo si la herramienta es 'select', el cursor cambia a 'grab' o 'text'
  // Si no es 'select', el cursor será 'text' por defecto (para escribir)
  // Si es 'eraser', el cursor del TextBox será 'none' por pointer-events, y el Canvas mostrará el cursor de goma
  if (tool === 'select') {
    finalStyle.cursor = isDraggingRef.current ? 'grabbing' : 'grab';
  } else {
    finalStyle.cursor = 'text'; // Para escribir
  }


  return (
    <div
      ref={textBoxRef}
      className="text-box"
      style={finalStyle} 
      contentEditable
      suppressContentEditableWarning
      data-placeholder={placeholder || ''}
      onInput={handleInput}
      onBlur={handleBlur}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onResize={adjustSize} 
    >
      {/* Handles de redimensionamiento (solo mostrar si la herramienta es 'select') */}
      {tool === 'select' && ( 
        <>
          {Object.keys(RESIZE_HANDLES).map(handleType => (
            <div
              key={handleType}
              className={`resize-handle ${handleType}`}
              data-handle={handleType} 
              style={{ cursor: RESIZE_HANDLES[handleType] }} 
              onPointerDown={(e) => e.stopPropagation()} 
            />
          ))}
        </>
      )}
    </div>
  );
}