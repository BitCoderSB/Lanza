import React, { useState, forwardRef, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid'; // Para generar IDs únicos

export default forwardRef(({
  elements = [],
  onAdd,
  onMove, // Usada para notificar el movimiento del elemento
  onRemove, // Usaremos esta prop para eliminar elementos
  onSelectText,
  tool = 'select',
  drawColor = '#1e3a8a',
  className = ''
}, ref) => {
  const [dragging, setDragging] = useState(false); // Indica si se está arrastrando algo
  const [preview, setPreview] = useState(null); // Elemento en previsualización al dibujar formas
  const [pathPoints, setPathPoints] = useState([]); // Puntos para el trazo de lápiz/rotulador
  const [selectedElementId, setSelectedElementId] = useState(null); // ID del elemento actualmente seleccionado
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 }); // Offset del puntero al inicio del arrastre de un elemento
  const [pointerGuide, setPointerGuide] = useState(null); // Posición del puntero rojo de guía
  const lastAddedId = useRef(null); // Para posibles optimizaciones
  const SMOOTHING = 0.3; // Factor de suavizado para el trazo de lápiz

  // Refs para almacenar el estado del arrastre de forma consistente
  const draggingElementRef = useRef(null); // Almacena el objeto del elemento que se está arrastrando
  const initialPointerPosRef = useRef(null); // Almacena la posición normalizada del puntero cuando el arrastre comenzó
  const initialElementBBoxRef = useRef(null); // Bounding Box inicial del elemento


  // Resetea el estado de dibujo y selección al cambiar de herramienta
  useEffect(() => {
    setDragging(false);
    setPreview(null);
    setPathPoints([]);
    setSelectedElementId(null); // Deselecciona al cambiar de herramienta
    lastAddedId.current = null;
  }, [tool]);

  // Normaliza las coordenadas del puntero (de píxeles de pantalla a unidades 0-100 del SVG)
  const toNorm = e => {
    const r = ref.current.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) * 100) / r.width,
      y: ((e.clientY - r.top) * 100) / r.height,
    };
  };

  // Función auxiliar para calcular la caja delimitadora (Bounding Box) de un elemento SVG
  const getBoundingBox = (element) => {
    const selectionPadding = 0.5;
    let minX, minY, maxX, maxY;

    switch (element.type) {
      case 'square':
      case 'circle':
      case 'triangle':
      case 'diamond':
      case 'star':
      case 'pentagon':
      case 'arrowRight':
      case 'arrowLeft': {
        minX = Math.min(element.x0, element.x1);
        minY = Math.min(element.y0, element.y1);
        maxX = Math.max(element.x0, element.x1);
        maxY = Math.max(element.y0, element.y1);
        break;
      }
      case 'line': {
        minX = Math.min(element.x0, element.x1);
        minY = Math.min(element.y0, element.y1);
        maxX = Math.max(element.x0, element.x1);
        maxY = Math.max(element.y0, element.y1);
        const lineThicknessAdjust = 0.5;
        minY -= lineThicknessAdjust;
        maxY += lineThicknessAdjust;
        minX -= lineThicknessAdjust;
        maxX += lineThicknessAdjust;
        break;
      }
      case 'pencil':
      case 'marker': {
        if (!element.points || element.points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
        const xs = element.points.map(p => p.x);
        const ys = element.points.map(p => p.y);
        minX = Math.min(...xs);
        minY = Math.min(...ys);
        maxX = Math.max(...xs);
        maxY = Math.max(...ys);
        const strokeAdjust = getDrawingProperties(element.type, element.color).strokeWidth * 2;
        minX -= strokeAdjust;
        minY -= strokeAdjust;
        maxX += strokeAdjust;
        maxY += strokeAdjust;
        break;
      }
      case 'text': {
        minX = element.x;
        minY = element.y;
        maxX = element.x + element.width;
        maxY = element.y + element.height;
        break;
      }
      default:
        return { x: 0, y: 0, width: 0, height: 0 };
    }
    return {
      x: minX - selectionPadding,
      y: minY - selectionPadding,
      width: (maxX - minX) + (selectionPadding * 2),
      height: (maxY - minY) + (selectionPadding * 2)
    };
  };

  const isPointInsideBox = (point, box) => {
    return point.x >= box.x && point.x <= (box.x + box.width) &&
           point.y >= box.y && point.y <= (box.y + box.height);
  };

  const handlePointerDown = e => {
    e.target.setPointerCapture(e.pointerId);
    const pos = toNorm(e);
    setPointerGuide(pos);

    if (tool === 'eraser') {
      const clickedElement = elements.find(el => {
        const bbox = getBoundingBox(el);
        return isPointInsideBox(pos, bbox);
      });
      if (clickedElement) {
        onRemove(clickedElement.id);
      }
      return;
    }

    if (tool === 'select') {
      const clickedElement = elements.find(el => {
        const bbox = getBoundingBox(el);
        return isPointInsideBox(pos, bbox);
      });

      if (clickedElement) {
        setSelectedElementId(clickedElement.id);
        setDragging(true);
        
        // Guardamos el estado original del elemento y la posición del puntero
        draggingElementRef.current = clickedElement; 
        initialPointerPosRef.current = pos; 
        initialElementBBoxRef.current = getBoundingBox(clickedElement);

        setDragOffset({ x: pos.x - initialElementBBoxRef.current.x, y: pos.y - initialElementBBoxRef.current.y });
      } else {
        setSelectedElementId(null);
      }
      return;
    }

    if (tool === 'text') {
      const rect = ref.current.getBoundingClientRect();
      onSelectText({
        x: e.clientX - rect.left - 5,
        y: e.clientY - rect.top + 50,
        color: drawColor,
        width: 150,
        height: 40,
        focus: true
      });
      return;
    }

    if (['pencil', 'marker'].includes(tool)) {
      setDragging(true);
      setPathPoints([pos]);
      return;
    }

    if (['square','circle','triangle','diamond','star','pentagon','arrowRight','arrowLeft','line'].includes(tool)) {
      setDragging(true);
      if (!preview) {
        const newPreviewId = uuidv4(); 
        setPreview({
          id: newPreviewId,
          type: tool, 
          x0: pos.x, y0: pos.y,
          x1: pos.x, y1: pos.y,
          color: drawColor
        });
      }
    }
  };

  const handlePointerMove = e => {
    const pos = toNorm(e);
    setPointerGuide(pos);

    // Si no estamos arrastrando, no hacemos nada más
    if (!dragging) return;

    // --- LÓGICA DE DIBUJO EN TIEMPO REAL ---
    if (tool === 'pencil' || tool === 'marker') {
      setPathPoints(prev => [...prev, pos]);
      return; // Salimos para no ejecutar la lógica de arrastre
    }
    if (preview) {
      setPreview(prev => ({ ...prev, x1: pos.x, y1: pos.y }));
      return; // Salimos para no ejecutar la lógica de arrastre
    }
    
    // --- LÓGICA DE ARRASTRE (DRAG & DROP) OPTIMIZADA ---
    if (tool === 'select' && selectedElementId) {
      const elementToMove = draggingElementRef.current; // El estado ORIGINAL del elemento
      const initialPointer = initialPointerPosRef.current; // La posición ORIGINAL del puntero

      // Asegurarnos que tenemos los datos necesarios
      if (!elementToMove || !initialPointer) {
        console.error("Error: Faltan referencias para iniciar el arrastre.");
        return;
      }

      // 1. Calcular el desplazamiento TOTAL del puntero desde el inicio
      const deltaX = pos.x - initialPointer.x;
      const deltaY = pos.y - initialPointer.y;

      const newUpdate = { id: selectedElementId };

      // 2. Aplicar el desplazamiento a las coordenadas ORIGINALES del elemento
      if (['pencil', 'marker'].includes(elementToMove.type)) {
        newUpdate.points = elementToMove.points.map(p => ({
          x: p.x + deltaX,
          y: p.y + deltaY
        }));
      } else if (elementToMove.type === 'text') {
        newUpdate.x = elementToMove.x + deltaX;
        newUpdate.y = elementToMove.y + deltaY;
      } else { // Para formas (cuadrado, círculo, etc.)
        newUpdate.x0 = elementToMove.x0 + deltaX;
        newUpdate.y0 = elementToMove.y0 + deltaY;
        newUpdate.x1 = elementToMove.x1 + deltaX;
        newUpdate.y1 = elementToMove.y1 + deltaY;
      }
      
      // 3. Notificar al componente padre de la nueva posición
      onMove(newUpdate);
    }
  };

  const handlePointerUp = e => {
    e.target.releasePointerCapture(e.pointerId);

    if (dragging) {
      if (['pencil', 'marker'].includes(tool) && pathPoints.length > 1) {
        const newEl = {
          id: uuidv4(),
          type: tool,
          points: pathPoints,
          color: drawColor
        };
        onAdd(newEl);
        setPathPoints([]);
      }
      else if (preview) {
        onAdd(preview); 
        setPreview(null);
      }
    }
    // Limpiamos todas las referencias y estados de arrastre
    setDragging(false);
    draggingElementRef.current = null;
    initialPointerPosRef.current = null;
    initialElementBBoxRef.current = null; 
  };

  const getSmoothed = pts => {
    if (!pts.length) return [];
    const sm = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const prev = sm[i - 1], curr = pts[i];
      sm.push({
        x: prev.x + (curr.x - prev.x) * SMOOTHING,
        y: prev.y + (curr.y - prev.y) * SMOOTHING
      });
    }
    return sm;
  };

  const getDrawingProperties = (toolType, currentColor) => {
    switch (toolType) {
      case 'pencil':
        return { strokeWidth: 0.3, strokeOpacity: 1.0, strokeColor: currentColor };
      case 'marker':
        return { strokeWidth: 1.5, strokeOpacity: 0.5, strokeColor: currentColor };
      case 'line':
        return { strokeWidth: 0.5, strokeOpacity: 1.0, strokeColor: currentColor };
      default:
        return { strokeWidth: 0.3, strokeOpacity: 1.0, strokeColor: currentColor };
    }
  };

  const renderElement = el => {
    const { strokeWidth, strokeOpacity, strokeColor } = getDrawingProperties(el.type, el.color || drawColor);

    const stroke = strokeColor;
    const fill = "none";

    const bbox = getBoundingBox(el);
    const isSelected = el.id === selectedElementId;


    return (
      <g key={el.id}>
        {el.type === 'square' && <rect x={el.x0} y={el.y0} width={el.x1 - el.x0} height={el.y1 - el.y0} fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeOpacity={strokeOpacity} />}
        {el.type === 'circle' && <circle cx={(el.x0 + el.x1) / 2} cy={(el.y0 + el.y1) / 2} r={Math.hypot(el.x1 - el.x0, el.y1 - el.y0) / 2} fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeOpacity={strokeOpacity} />}
        {el.type === 'triangle' && <polygon points={`${el.x0},${el.y1} ${(el.x0 + el.x1) / 2},${el.y0} ${el.x1},${el.y1}`} fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeOpacity={strokeOpacity} />}
        {['pencil', 'marker'].includes(el.type) && <polyline key={`${el.id}-${el.points[0]?.x || '0'}-${el.points[0]?.y || '0'}`} points={getSmoothed(el.points).map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeOpacity={strokeOpacity} strokeLinejoin="round" strokeLinecap="round" />}
        {el.type === 'text' && (
            <text
              key={`${el.id}-text`}
              x={el.x}
              y={el.y + (el.height / 2)}
              fontSize={`${el.fontSize}px`} /* Usa directamente el fontSize de la prop */
              fill={el.color}
              dominantBaseline="middle"
              textAnchor="start"
              style={{ whiteSpace: 'pre', cursor: 'text' }}
            >
              {el.text}
            </text>
        )}
        {el.type === 'diamond' && <polygon points={`${(el.x0 + el.x1) / 2},${el.y0} ${el.x1},${(el.y0 + el.y1) / 2} ${(el.x0 + el.x1) / 2},${el.y1} ${el.x0},${(el.y0 + el.y1) / 2}`} fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeOpacity={strokeOpacity} />}
        {el.type === 'star' && (() => { 
          const cx = (el.x0 + el.x1) / 2;
          const cy = (el.y0 + el.y1) / 2;
          const radius = Math.hypot(el.x1 - cx, el.y1 - cy);
          const points = [];
          for (let i = 0; i < 10; i++) {
            const r = i % 2 === 0 ? radius : radius / 2.5;
            const angle = Math.PI / 2 + i * Math.PI / 5;
            points.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
          }
          return <polygon key={`${el.id}-star`} points={points.join(' ')} fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeOpacity={strokeOpacity} />; 
        })()}
        {el.type === 'pentagon' && (() => { 
          const cx = (el.x0 + el.x1) / 2;
          const cy = (el.y0 + el.y1) / 2;
          const radius = Math.hypot(el.x1 - cx, el.y1 - cy);
          const points = [];
          for (let i = 0; i < 5; i++) {
            const angle = Math.PI / 2 + i * 2 * Math.PI / 5;
            points.push(`${cx + radius * Math.cos(angle)},${cy + radius * Math.sin(angle)}`);
          }
          return <polygon key={`${el.id}-pentagon`} points={points.join(' ')} fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeOpacity={strokeOpacity} />; 
        })()}
        {el.type === 'arrowRight' && (() => { 
          const xStart = Math.min(el.x0, el.x1);
          const xEnd = Math.max(el.x0, el.x1);
          const yCenter = (el.y0 + el.y1) / 2;
          const headWidth = Math.abs(el.x1 - el.x0) * 0.3;
          const tailHeight = Math.abs(el.y1 - el.y0) * 0.3;

          const points = [];
          if (el.x1 > el.x0) { // Flecha hacia la derecha
            points.push(`${xStart},${yCenter - tailHeight / 2}`);
            points.push(`${xEnd - headWidth},${yCenter - tailHeight / 2}`);
            points.push(`${xEnd - headWidth},${yCenter - Math.abs(el.y1 - el.y0) / 2}`);
            points.push(`${xEnd},${yCenter}`);
            points.push(`${xEnd - headWidth},${yCenter + Math.abs(el.y1 - el.y0) / 2}`);
            points.push(`${xEnd - headWidth},${yCenter + tailHeight / 2}`);
            points.push(`${xStart},${yCenter + tailHeight / 2}`);
          } else { // Flecha hacia la izquierda (invertida)
            points.push(`${xEnd},${yCenter - tailHeight / 2}`);
            points.push(`${xStart + headWidth},${yCenter - tailHeight / 2}`);
            points.push(`${xStart + headWidth},${yCenter - Math.abs(el.y1 - el.y0) / 2}`);
            points.push(`${xStart},${yCenter}`);
            points.push(`${xStart + headWidth},${yCenter + Math.abs(el.y1 - el.y0) / 2}`);
            points.push(`${xStart + headWidth},${yCenter + tailHeight / 2}`);
            points.push(`${xEnd},${yCenter + tailHeight / 2}`);
          }

          return (
            <polygon key={`${el.id}-arrowRight`} points={points.join(' ')} fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeOpacity={strokeOpacity} />
          );
        })()}
        {el.type === 'arrowLeft' && (() => { 
          const xStart = Math.min(el.x0, el.x1);
          const xEnd = Math.max(el.x0, el.x1);
          const yCenter = (el.y0 + el.y1) / 2;
          const headWidth = Math.abs(el.x1 - el.x0) * 0.3;
          const tailHeight = Math.abs(el.y1 - el.y0) * 0.3;

          const points = [];
          if (el.x1 < el.x0) { // Flecha hacia la izquierda
            points.push(`${xEnd},${yCenter - tailHeight / 2}`);
            points.push(`${xStart + headWidth},${yCenter - tailHeight / 2}`);
            points.push(`${xStart + headWidth},${yCenter - Math.abs(el.y1 - el.y0) / 2}`);
            points.push(`${xStart},${yCenter}`);
            points.push(`${xStart + headWidth},${yCenter + Math.abs(el.y1 - el.y0) / 2}`);
            points.push(`${xStart + headWidth},${yCenter + tailHeight / 2}`);
            points.push(`${xEnd},${yCenter + tailHeight / 2}`);
          } else { // Flecha hacia la derecha (invertida)
            points.push(`${xStart},${yCenter - tailHeight / 2}`);
            points.push(`${xEnd - headWidth},${yCenter - tailHeight / 2}`);
            points.push(`${xEnd - headWidth},${yCenter - Math.abs(el.y1 - el.y0) / 2}`);
            points.push(`${xEnd},${yCenter}`);
            points.push(`${xEnd - headWidth},${yCenter + Math.abs(el.y1 - el.y0) / 2}`);
            points.push(`${xEnd - headWidth},${yCenter + tailHeight / 2}`);
            points.push(`${xStart},${yCenter + tailHeight / 2}`);
          }
          return (
            <polygon key={el.id}
                     points={points.join(' ')}
                     fill={fill}
                     stroke={stroke}
                     strokeWidth={strokeWidth}
                     strokeOpacity={strokeOpacity}
            />
          );
        })()}
        {el.type === 'line' && <line key={el.id} x1={el.x0} y1={el.y0} x2={el.x1} y2={el.y1} stroke={stroke} strokeWidth={strokeWidth} strokeOpacity={strokeOpacity} strokeLinecap="round" />}

        {/* Indicador de selección (borde azul) */}
        {isSelected && (
          <rect
            key={`${el.id}-selection-border`}
            x={bbox.x - 0.2}
            y={bbox.y - 0.2}
            width={bbox.width + 0.4}
            height={bbox.height + 0.4}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="0.1"
            strokeDasharray="0.2,0.2"
          />
        )}
      </g>
    );
  };

  const renderLive = () => {
    const { strokeWidth, strokeOpacity, strokeColor } = getDrawingProperties(tool, drawColor);

    if (!['pencil', 'marker'].includes(tool) || pathPoints.length < 2) return null;

    const smooth = getSmoothed(pathPoints);
    const ptsStr = smooth.map(p => `${p.x},${p.y}`).join(' ');
    return (
      <polyline points={ptsStr}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeOpacity={strokeOpacity}
        strokeLinejoin="round"
        strokeLinecap="round" />
    );
  };

  return (
    <svg ref={ref}
      className={className}
      width="100%" height="100%"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{ background: '#f3f4f6', cursor: tool === 'select' ? 'move' : 'crosshair' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}>

      <defs>
        <pattern id="smallGrid" width="1" height="1" patternUnits="userSpaceOnUse">
          <path d="M1 0 L0 0 0 1" fill="none" stroke="#e5e7eb" strokeWidth="0.1" />
        </pattern>
        <pattern id="grid" width="5" height="5" patternUnits="userSpaceOnUse">
          <rect width="5" height="5" fill="url(#smallGrid)" />
          <path d="M5 0 L0 0 0 5" fill="none" stroke="#d1d5db" strokeWidth="0.2" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" />

      {elements.map(renderElement)}

      {/* Renderiza el preview de las formas mientras se dibujan */}
      {['square','circle','triangle','diamond','star','pentagon','arrowRight','arrowLeft','line'].includes(tool) && preview && renderElement(preview)}

      {/* Renderiza el preview del lápiz/marcador mientras se dibuja */}
      {renderLive()}

      {/* Guía roja del puntero */}
      {pointerGuide && (
        <circle cx={pointerGuide.x}
          cy={pointerGuide.y}
          r={0.4}
          fill="red" />
      )}
    </svg>
  );
});