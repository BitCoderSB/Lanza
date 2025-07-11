import React, { useState, forwardRef, useEffect, useRef, useMemo } from 'react'; // Importar useMemo
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
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState(null);
  const [pathPoints, setPathPoints] = useState([]);
  const [selectedElementId, setSelectedElementId] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 }); // Offset del puntero al inicio del arrastre de un elemento
  const [pointerGuide, setPointerGuide] = useState(null);
  const lastAddedId = useRef(null);
  const SMOOTHING = 0.3;

  const draggingElementRef = useRef(null);
  const initialPointerPosRef = useRef(null); // Posición del puntero al inicio del drag
  const initialElementPropsRef = useRef(null); // Propiedades originales del elemento al inicio del drag
  const initialElementBBoxRef = useRef(null); // BBox inicial del elemento al inicio del drag


  useEffect(() => {
    setDragging(false);
    setPreview(null);
    setPathPoints([]);
    setSelectedElementId(null); // Deselecciona al cambiar de herramienta
    lastAddedId.current = null;
  }, [tool]);

  const toNorm = e => {
    const r = ref.current.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) * 100) / r.width,
      y: ((e.clientY - r.top) * 100) / r.height,
    };
  };

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

    // NUEVO: Lógica para la goma de borrar
    if (tool === 'eraser') {
      const clickedElement = elements.find(el => {
        const bbox = getBoundingBox(el);
        return isPointInsideBox(pos, bbox);
      });
      if (clickedElement) {
        onRemove(clickedElement.id); // Llama a onRemove para borrar el elemento
      }
      return; // La goma no arrastra ni selecciona
    }

    if (tool === 'select') {
      const clickedElement = elements.find(el => {
        const bbox = getBoundingBox(el);
        return isPointInsideBox(pos, bbox);
      });

      if (clickedElement) {
        setSelectedElementId(clickedElement.id);
        setDragging(true);
        
        draggingElementRef.current = clickedElement; 
        initialPointerPosRef.current = pos; 
        initialElementBBoxRef.current = getBoundingBox(clickedElement); // GUARDAR EL BBOX INICIAL

        // Guardar las propiedades originales del elemento al inicio del arrastre para la traslación final
        initialElementPropsRef.current = { 
            x0: clickedElement.x0, y0: clickedElement.y0, x1: clickedElement.x1, y1: clickedElement.y1,
            x: clickedElement.x, y: clickedElement.y,
            points: clickedElement.points ? [...clickedElement.points] : [],
            translateX: clickedElement.translateX || 0, // Captura la traslación actual
            translateY: clickedElement.translateY || 0  // Captura la traslación actual
        };

        // Calcula el offset desde la posición del puntero hasta el origen (x,y) del BBox del elemento
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

    if (!dragging) return;

    if (tool === 'select' && selectedElementId) {
      const elementToMoveInitialProps = initialElementPropsRef.current; // Propiedades originales
      const initialPointer = initialPointerPosRef.current; // Posición inicial del puntero

      if (!elementToMoveInitialProps || !initialPointer) {
          console.error("ERROR: Refs de arrastre no inicializados correctamente en handlePointerMove. Saliendo.");
          return;
      }

      const newUpdate = { id: selectedElementId };

      // Calcular el desplazamiento total del puntero desde su posición inicial
      const deltaX = pos.x - initialPointer.x;
      const deltaY = pos.y - initialPointer.y;
      
      if (['pencil', 'marker'].includes(elementToMoveInitialProps.type)) {
          // PARA LÁPIZ/ROTULADOR: ENVIAR TRANSLACIÓN TEMPORAL (translateX, translateY)
          newUpdate.translateX = deltaX;
          newUpdate.translateY = deltaY;
      } else if (elementToMoveInitialProps.type === 'text') {
          newUpdate.x = elementToMoveInitialProps.x + deltaX;
          newUpdate.y = elementToMoveInitialProps.y + deltaY;
      } else { // Para formas (square, circle, triangle, diamond, star, pentagon, arrowRight, arrowLeft, line)
          newUpdate.x0 = elementToMoveInitialProps.x0 + deltaX;
          newUpdate.y0 = elementToMoveInitialProps.y0 + deltaY;
          newUpdate.x1 = elementToMoveInitialProps.x1 + deltaX;
          newUpdate.y1 = elementToMoveInitialProps.y1 + dy;
      }
      onMove(newUpdate); // Notifica a BoardView sobre el movimiento
      return;
    }

    if (['pencil', 'marker'].includes(tool)) {
      setPathPoints(prev => [...prev, pos]);
    }
    else if (preview) {
      setPreview(prev => ({ ...prev, x1: pos.x, y1: pos.y }));
    }
  };

  const handlePointerUp = e => {
    e.target.releasePointerCapture(e.pointerId);

    if (dragging) {
      // Finalizar trazo de lápiz/rotulador (Aplicar la traslación final a los puntos)
      if (tool === 'select' && selectedElementId && draggingElementRef.current && ['pencil', 'marker'].includes(draggingElementRef.current.type)) {
        const elementToMoveInitialProps = initialElementPropsRef.current; // Propiedades originales
        const initialPointer = initialPointerPosRef.current; // Posición inicial del puntero
        
        const finalDeltaX = e.clientX - initialPointer.x;
        const finalDeltaY = e.clientY - initialPointer.y;

        // Calcular los puntos finales aplicando el delta a los puntos originales
        const updatedPoints = (elementToMoveInitialProps.points || []).map(p => ({
          x: p.x + finalDeltaX,
          y: p.y + finalDeltaY
        }));
        // Enviar la actualización final y resetear la traslación temporal a 0
        onMove({ id: selectedElementId, points: updatedPoints, translateX: 0, translateY: 0 }); 
      }
      // Finalizar dibujo de nuevo trazo (lápiz/rotulador)
      else if (['pencil', 'marker'].includes(tool) && pathPoints.length > 1) {
        const newEl = {
          id: uuidv4(),
          type: tool,
          points: pathPoints,
          color: drawColor
        };
        onAdd(newEl);
        setPathPoints([]);
      }
      // Finalizar dibujo de forma
      else if (preview) {
        onAdd(preview); 
        setPreview(null);
      }
    }
    setDragging(false);
    // Limpiar los refs al finalizar el arrastre
    draggingElementRef.current = null;
    initialPointerPosRef.current = null;
    initialElementPropsRef.current = null; 
    initialElementBBoxRef.current = null; 
  };

  // Función para suavizar los puntos (ahora memoizada para optimización)
  const getSmoothed = useMemo(() => {
    return (pts) => {
      if (!pts || pts.length === 0) return [];
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
  }, [SMOOTHING]);

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

    // Calcular la transformación de traslación para el arrastre del lápiz/rotulador
    // Aplicamos la traslación temporalmente si el elemento es el que se está arrastrando
    let transform = '';
    if (isSelected && dragging && draggingElementRef.current?.id === el.id && (el.type === 'pencil' || el.type === 'marker')) {
        const currentPointer = initialPointerPosRef.current;
        const initialProps = initialElementPropsRef.current; // Capturamos initialElementPropsRef
        if (currentPointer && initialProps) { // Asegurarse de que los refs no sean null
            const dx = toNorm(window.event).x - currentPointer.x; // Delta del puntero desde el inicio
            const dy = toNorm(window.event).y - currentPointer.y;
            transform = `translate(${dx} ${dy})`;
        }
    } else if (el.translateX || el.translateY) { // Si el elemento tiene una traslación final (del DB)
        transform = `translate(${el.translateX || 0} ${el.translateY || 0})`;
    }


    return (
      <g key={el.id} transform={transform}> {/* Aplicar la transformación aquí */}
        {el.type === 'square' && <rect x={el.x0} y={el.y0} width={el.x1 - el.x0} height={el.y1 - el.y0} fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeOpacity={strokeOpacity} />}
        {el.type === 'circle' && <circle cx={(el.x0 + el.x1) / 2} cy={(el.y0 + el.y1) / 2} r={Math.hypot(el.x1 - el.x0, el.y1 - el.y0) / 2} fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeOpacity={strokeOpacity} />}
        {el.type === 'triangle' && <polygon points={`${el.x0},${el.y1} ${(el.x0 + el.x1) / 2},${el.y0} ${el.x1},${el.y1}`} fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeOpacity={strokeOpacity} />}
        {/* Usamos un key simple para polyline. React puede optimizar el diff si el obj el.points cambia referencialmente. */}
        {['pencil', 'marker'].includes(el.type) && <polyline key={el.id} points={getSmoothed(el.points).map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeOpacity={strokeOpacity} strokeLinejoin="round" strokeLinecap="round" />}
        {el.type === 'text' && (
            <text
              key={`${el.id}-text`}
              x={el.x}
              y={el.y + (el.height / 2)}
              fontSize={`${el.fontSize}px`} 
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

      {/* Actualiza esta condición para incluir todas las nuevas herramientas de forma */}
      {['square','circle','triangle','diamond','star','pentagon','arrowRight','arrowLeft','line'].includes(tool) && preview && renderElement(preview)}

      {renderLive()}

      {pointerGuide && (
        <circle cx={pointerGuide.x}
          cy={pointerGuide.y}
          r={0.4}
          fill="red" />
      )}
    </svg>
  );
});