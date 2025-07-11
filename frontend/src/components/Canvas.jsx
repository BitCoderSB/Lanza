import React, { useState, forwardRef, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';

export default forwardRef(({
  elements = [],
  onAdd,
  onMove,
  onRemove,
  onSelectText,
  tool = 'select',
  drawColor = '#1e3a8a',
  className = ''
}, ref) => {
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState(null);
  const [pathPoints, setPathPoints] = useState([]);
  const [selectedElementId, setSelectedElementId] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [pointerGuide, setPointerGuide] = useState(null);
  const SMOOTHING = 0.3;

  // Refs para el estado del arrastre
  const draggingElementRef = useRef(null);
  const initialPointerPosRef = useRef(null);
  const initialElementBBoxRef = useRef(null);
  // NUEVO: Ref para el elemento del DOM que se está arrastrando
  const domElementRef = useRef(null);

  useEffect(() => {
    setDragging(false);
    setPreview(null);
    setPathPoints([]);
    setSelectedElementId(null);
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

  // MODIFICADO: para guardar la referencia al DOM
  const handlePointerDown = e => {
    e.target.setPointerCapture(e.pointerId);
    const pos = toNorm(e);
    setPointerGuide(pos);

    if (tool === 'eraser') {
      const clickedElement = elements.find(el => isPointInsideBox(pos, getBoundingBox(el)));
      if (clickedElement) onRemove(clickedElement.id);
      return;
    }

    if (tool === 'select') {
      const clickedElement = elements.find(el => isPointInsideBox(pos, getBoundingBox(el)));
      if (clickedElement) {
        setSelectedElementId(clickedElement.id);
        setDragging(true);
        draggingElementRef.current = clickedElement;
        initialPointerPosRef.current = pos;
        // Guardamos el nodo del DOM
        domElementRef.current = ref.current.querySelector(`[data-id="${clickedElement.id}"]`);
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
    
    // Lógica para empezar a dibujar formas o trazos
    setDragging(true);
    if (['pencil', 'marker'].includes(tool)) {
      setPathPoints([pos]);
    } else {
      setPreview({
        id: uuidv4(),
        type: tool,
        x0: pos.x, y0: pos.y,
        x1: pos.x, y1: pos.y,
        color: drawColor
      });
    }
  };

  // MODIFICADO: para usar transform en lugar de actualizar el estado
  const handlePointerMove = e => {
    const pos = toNorm(e);
    setPointerGuide(pos);
    if (!dragging) return;

    // Si estamos dibujando, actualizamos el preview
    if (tool !== 'select') {
        if (['pencil', 'marker'].includes(tool)) {
            setPathPoints(prev => [...prev, pos]);
        } else if (preview) {
            setPreview(prev => ({ ...prev, x1: pos.x, y1: pos.y }));
        }
        return;
    }
    
    // Si estamos seleccionando, movemos el elemento con transform
    if (domElementRef.current) {
      const initialPointer = initialPointerPosRef.current;
      const deltaX = pos.x - initialPointer.x;
      const deltaY = pos.y - initialPointer.y;
      domElementRef.current.setAttribute('transform', `translate(${deltaX} ${deltaY})`);
    }
  };

  // MODIFICADO: para actualizar el estado de React al final y limpiar
  const handlePointerUp = e => {
    e.target.releasePointerCapture(e.pointerId);

    // Si estábamos arrastrando un elemento, calculamos su posición final y actualizamos el estado
    if (tool === 'select' && dragging && draggingElementRef.current) {
        const elementToMove = draggingElementRef.current;
        const initialPointer = initialPointerPosRef.current;
        const finalPos = toNorm(e);
        const deltaX = finalPos.x - initialPointer.x;
        const deltaY = finalPos.y - initialPointer.y;
        
        if (deltaX !== 0 || deltaY !== 0) {
            const newUpdate = { id: elementToMove.id };
            if (['pencil', 'marker'].includes(elementToMove.type)) {
                newUpdate.points = elementToMove.points.map(p => ({ x: p.x + deltaX, y: p.y + deltaY }));
            } else if (elementToMove.type === 'text') {
                newUpdate.x = elementToMove.x + deltaX;
                newUpdate.y = elementToMove.y + deltaY;
            } else {
                newUpdate.x0 = elementToMove.x0 + deltaX;
                newUpdate.y0 = elementToMove.y0 + deltaY;
                newUpdate.x1 = elementToMove.x1 + deltaX;
                newUpdate.y1 = elementToMove.y1 + deltaY;
            }
            onMove(newUpdate);
        }
    }
    
    // Limpiamos la transformación del DOM para que React tome el control
    if (domElementRef.current) {
        domElementRef.current.removeAttribute('transform');
    }

    // Si estábamos dibujando un nuevo elemento, lo añadimos
    if (dragging && tool !== 'select') {
      if (['pencil', 'marker'].includes(tool) && pathPoints.length > 1) {
        onAdd({ id: uuidv4(), type: tool, points: pathPoints, color: drawColor });
      } else if (preview) {
        onAdd(preview);
      }
    }

    // Reseteo final de estados y refs
    setDragging(false);
    draggingElementRef.current = null;
    initialPointerPosRef.current = null;
    initialElementBBoxRef.current = null;
    domElementRef.current = null;
    setPathPoints([]);
    setPreview(null);
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
      case 'pencil': return { strokeWidth: 0.3, strokeOpacity: 1.0, strokeColor: currentColor };
      case 'marker': return { strokeWidth: 1.5, strokeOpacity: 0.5, strokeColor: currentColor };
      case 'line': return { strokeWidth: 0.5, strokeOpacity: 1.0, strokeColor: currentColor };
      default: return { strokeWidth: 0.3, strokeOpacity: 1.0, strokeColor: currentColor };
    }
  };

  // MODIFICADO: para añadir data-id a cada elemento
  const renderElement = el => {
    const { strokeWidth, strokeOpacity, strokeColor } = getDrawingProperties(el.type, el.color || drawColor);
    const stroke = strokeColor;
    const fill = "none";
    const bbox = getBoundingBox(el);
    const isSelected = el.id === selectedElementId;

    return (
      <g key={el.id} data-id={el.id}>
        {el.type === 'square' && <rect x={el.x0} y={el.y0} width={el.x1 - el.x0} height={el.y1 - el.y0} fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeOpacity={strokeOpacity} />}
        {el.type === 'circle' && <circle cx={(el.x0 + el.x1) / 2} cy={(el.y0 + el.y1) / 2} r={Math.hypot(el.x1 - el.x0, el.y1 - el.y0) / 2} fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeOpacity={strokeOpacity} />}
        {el.type === 'triangle' && <polygon points={`${el.x0},${el.y1} ${(el.x0 + el.x1) / 2},${el.y0} ${el.x1},${el.y1}`} fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeOpacity={strokeOpacity} />}
        {['pencil', 'marker'].includes(el.type) && <polyline key={`${el.id}-${el.points[0]?.x || '0'}-${el.points[0]?.y || '0'}`} points={getSmoothed(el.points).map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeOpacity={strokeOpacity} strokeLinejoin="round" strokeLinecap="round" />}
        {el.type === 'text' && (
          <text key={`${el.id}-text`} x={el.x} y={el.y + (el.height / 2)} fontSize={`${el.fontSize}px`} fill={el.color} dominantBaseline="middle" textAnchor="start" style={{ whiteSpace: 'pre', cursor: 'text' }}>
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
          const xStart = Math.min(el.x0, el.x1), xEnd = Math.max(el.x0, el.x1);
          const yCenter = (el.y0 + el.y1) / 2;
          const headWidth = Math.abs(el.x1 - el.x0) * 0.3, tailHeight = Math.abs(el.y1 - el.y0) * 0.3;
          const points = el.x1 > el.x0
            ? [`${xStart},${yCenter - tailHeight / 2}`, `${xEnd - headWidth},${yCenter - tailHeight / 2}`, `${xEnd - headWidth},${yCenter - Math.abs(el.y1 - el.y0) / 2}`, `${xEnd},${yCenter}`, `${xEnd - headWidth},${yCenter + Math.abs(el.y1 - el.y0) / 2}`, `${xEnd - headWidth},${yCenter + tailHeight / 2}`, `${xStart},${yCenter + tailHeight / 2}`]
            : [`${xEnd},${yCenter - tailHeight / 2}`, `${xStart + headWidth},${yCenter - tailHeight / 2}`, `${xStart + headWidth},${yCenter - Math.abs(el.y1 - el.y0) / 2}`, `${xStart},${yCenter}`, `${xStart + headWidth},${yCenter + Math.abs(el.y1 - el.y0) / 2}`, `${xStart + headWidth},${yCenter + tailHeight / 2}`, `${xEnd},${yCenter + tailHeight / 2}`];
          return <polygon key={`${el.id}-arrowRight`} points={points.join(' ')} fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeOpacity={strokeOpacity} />;
        })()}
        {el.type === 'arrowLeft' && (() => {
          const xStart = Math.min(el.x0, el.x1), xEnd = Math.max(el.x0, el.x1);
          const yCenter = (el.y0 + el.y1) / 2;
          const headWidth = Math.abs(el.x1 - el.x0) * 0.3, tailHeight = Math.abs(el.y1 - el.y0) * 0.3;
          const points = el.x1 < el.x0
            ? [`${xEnd},${yCenter - tailHeight / 2}`, `${xStart + headWidth},${yCenter - tailHeight / 2}`, `${xStart + headWidth},${yCenter - Math.abs(el.y1 - el.y0) / 2}`, `${xStart},${yCenter}`, `${xStart + headWidth},${yCenter + Math.abs(el.y1 - el.y0) / 2}`, `${xStart + headWidth},${yCenter + tailHeight / 2}`, `${xEnd},${yCenter + tailHeight / 2}`]
            : [`${xStart},${yCenter - tailHeight / 2}`, `${xEnd - headWidth},${yCenter - tailHeight / 2}`, `${xEnd - headWidth},${yCenter - Math.abs(el.y1 - el.y0) / 2}`, `${xEnd},${yCenter}`, `${xEnd - headWidth},${yCenter + Math.abs(el.y1 - el.y0) / 2}`, `${xEnd - headWidth},${yCenter + tailHeight / 2}`, `${xStart},${yCenter + tailHeight / 2}`];
          return <polygon key={el.id} points={points.join(' ')} fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeOpacity={strokeOpacity} />;
        })()}
        {el.type === 'line' && <line key={el.id} x1={el.x0} y1={el.y0} x2={el.x1} y2={el.y1} stroke={stroke} strokeWidth={strokeWidth} strokeOpacity={strokeOpacity} strokeLinecap="round" />}
        {isSelected && <rect key={`${el.id}-selection-border`} x={bbox.x - 0.2} y={bbox.y - 0.2} width={bbox.width + 0.4} height={bbox.height + 0.4} fill="none" stroke="#3b82f6" strokeWidth="0.1" strokeDasharray="0.2,0.2" />}
      </g>
    );
  };

  const renderLive = () => {
    if (!['pencil', 'marker'].includes(tool) || pathPoints.length < 2) return null;
    const { strokeWidth, strokeOpacity, strokeColor } = getDrawingProperties(tool, drawColor);
    const ptsStr = getSmoothed(pathPoints).map(p => `${p.x},${p.y}`).join(' ');
    return <polyline points={ptsStr} fill="none" stroke={strokeColor} strokeWidth={strokeWidth} strokeOpacity={strokeOpacity} strokeLinejoin="round" strokeLinecap="round" />;
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
      {preview && renderElement(preview)}
      {renderLive()}
      {pointerGuide && <circle cx={pointerGuide.x} cy={pointerGuide.y} r={0.4} fill="red" />}
    </svg>
  );
});