import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { HexColorPicker } from "react-colorful";

export default function Toolbar({
  tool,
  onToolSelect,
  currentColor,
  onColorChange,
  onToggleChat,
  gesturesEnabled,
  onToggleGestures,
  currentFontSize,
  onFontSizeChange
}) {
  const [shapesOpen, setShapesOpen] = useState(false)
  const [colorOpen, setColorOpen]   = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pencilOpen, setPencilOpen] = useState(false);

  const shapesBtnRef     = useRef(null)
  const shapesPopoverRef = useRef(null)
  const colorBtnRef      = useRef(null)
  const colorPopoverRef  = useRef(null)
  const pencilBtnRef     = useRef(null)
  const pencilPopoverRef = useRef(null)


  useEffect(() => {
    const handleClickOutside = e => {
      if (
        shapesOpen &&
        shapesBtnRef.current &&
        shapesPopoverRef.current &&
        !shapesBtnRef.current.contains(e.target) &&
        !shapesPopoverRef.current.contains(e.target)
      ) setShapesOpen(false)

      if (
        colorOpen &&
        colorBtnRef.current &&
        colorPopoverRef.current &&
        !colorBtnRef.current.contains(e.target) &&
        !colorPopoverRef.current.contains(e.target)
      ) {
          setColorOpen(false);
          setPickerOpen(false);
      }
      
      if (
        pencilOpen &&
        pencilBtnRef.current &&
        pencilPopoverRef.current &&
        !pencilBtnRef.current.contains(e.target) &&
        !pencilPopoverRef.current.contains(e.target)
      ) setPencilOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [shapesOpen, colorOpen, pencilOpen]) 

  const renderPopover = (anchorRef, isOpen, popoverRef, children, customClass = "") => {
    if (!isOpen || !anchorRef.current) return null
    const rect = anchorRef.current.getBoundingClientRect()
    const style = {
      position: 'absolute',
      top: rect.bottom + window.scrollY + 8,
      left: rect.left + window.scrollX,
      zIndex: 1000
    }
    const basePopoverClasses = "bg-white p-3 shadow-lg rounded-xl"; 
    
    return createPortal(
      <div ref={popoverRef} style={style} className={`${basePopoverClasses} ${customClass}`}>
        {children}
      </div>,
      document.body
    )
  }

  const shapeTools = [
    { type: 'square', label: '◻️', title: 'Cuadrado' },
    { type: 'circle', label: '⚪', title: 'Círculo' },
    { type: 'triangle', label: '△', title: 'Triángulo' },
    { type: 'diamond', label: '◇', title: 'Rombo' },
    { type: 'star', label: '⭐', title: 'Estrella' },
    { type: 'pentagon', label: '⬟', title: 'Pentágono' },
    { type: 'arrowRight', label: '➡️', title: 'Flecha Derecha' },
    { type: 'arrowLeft', label: '⬅️', title: 'Flecha Izquierda' },
    { type: 'line', label: '──', title: 'Línea' },
  ];

  const predefinedColors = [
    '#000000', '#FFFFFF', '#FF0000',
    '#00FF00', '#0000FF', '#FFFF00',
    '#FF00FF', '#00FFFF', '#FFA500'
  ];

  const drawingTools = [
    { type: 'pencil', label: '🖊️', title: 'Lápiz' },
    { type: 'marker', label: '🖍️', title: 'Rotulador' },
  ];

  // NUEVO: Herramienta de goma
  const eraserTool = { type: 'eraser', label: '🧽', title: 'Goma de Borrar' }; // Usamos un emoji de esponja/goma

  const fontSizes = [12, 14, 16, 18, 24, 32, 48];


  return (
    <div className="toolbar flex items-center space-x-3 p-2 bg-gray-200">
      <label className="flex items-center space-x-1">
        <input
          type="checkbox"
          checked={gesturesEnabled}
          onChange={e => onToggleGestures(e.target.checked)}
          className="toggle-checkbox"
        />
        <span className="text-sm select-none">Gestos</span>
      </label>

      <button className={`toolbar-btn ${tool==='text'?'active':''}`} onClick={()=>onToolSelect('text')} title="Texto">T</button>
      
      {/* Selector de tamaño de fuente, AHORA SIEMPRE VISIBLE */}
      <select
        className="toolbar-select"
        value={currentFontSize}
        onChange={e => onFontSizeChange(Number(e.target.value))}
        title="Tamaño de Fuente"
      >
        {fontSizes.map(size => (
          <option key={size} value={size}>{size}px</option>
        ))}
      </select>

      <button className={`toolbar-btn ${tool==='select'?'active':''}`} onClick={()=>onToolSelect('select')} title="Seleccionar">🖐️</button>

      {/* Botón de despliegue de Figuras */}
      <div ref={shapesBtnRef} className="inline-block">
        <button className={`toolbar-btn ${shapeTools.some(s => s.type === tool)?'active':''}`}
                onClick={()=>setShapesOpen(o=>!o)} title="Figuras">
          {shapeTools.find(s => s.type === tool)?.label || '◼️'}
        </button>
        {renderPopover(shapesBtnRef, shapesOpen, shapesPopoverRef,
          <div className="shapes-grid">
            {shapeTools.map(s => (
              <button
                key={s.type}
                className={`toolbar-btn ${tool === s.type ? 'active' : ''}`}
                onClick={() => { onToolSelect(s.type); setShapesOpen(false); }}
                title={s.title}
              >
                {s.label}
              </button>
            ))}
          </div>,
          "shapes-popover"
        )}
      </div>

      {/* Botón de despliegue de Lápiz/Rotulador */}
      <div ref={pencilBtnRef} className="inline-block">
        <button className={`toolbar-btn ${drawingTools.some(d => d.type === tool)?'active':''}`}
                onClick={()=>setPencilOpen(o=>!o)} title="Herramientas de Dibujo">
          {drawingTools.find(d => d.type === tool)?.label || '🖊️'}
        </button>
        {renderPopover(pencilBtnRef, pencilOpen, pencilPopoverRef,
            <> 
            {drawingTools.map(d => (
              <button
                key={d.type}
                className={`toolbar-btn ${tool === d.type ? 'active' : ''}`}
                onClick={() => { onToolSelect(d.type); setPencilOpen(false); }}
                title={d.title}
              >
                {d.label}
              </button>
            ))}
            </>,
          "pencil-popover"
        )}
      </div>

      {/* NUEVO: Botón de Goma de Borrar */}
      <button className={`toolbar-btn ${tool===eraserTool.type?'active':''}`} onClick={()=>onToolSelect(eraserTool.type)} title={eraserTool.title}>{eraserTool.label}</button>


      {/* SELECTOR DE COLOR MEJORADO */}
      <div ref={colorBtnRef} className="inline-block">
        <button
          className="toolbar-btn color-preview-btn"
          onClick={() => setColorOpen(o => !o)}
          title="Color actual"
          style={{ backgroundColor: currentColor }}
        >
        </button>
        {renderPopover(colorBtnRef, colorOpen, colorPopoverRef,
          <>
            {!pickerOpen ? (
              <>
                <div className="color-grid">
                  {predefinedColors.map((color, index) => (
                    <div
                      key={index}
                      className="color-swatch"
                      style={{ backgroundColor: color, border: color === '#FFFFFF' ? '1px solid #ccc' : 'none' }}
                      onClick={() => { onColorChange(color); setColorOpen(false); }}
                      title={color}
                    />
                  ))}
                </div>
                <button 
                  className="toolbar-btn custom-color-btn"
                  onClick={() => setPickerOpen(true)}
                  title="Más colores">
                  Más Colores
                </button>
              </>
            ) : (
              <div className="color-picker-container">
                <HexColorPicker color={currentColor} onChange={onColorChange} className="react-colorful-picker" />
                <button className="toolbar-btn custom-color-btn" onClick={() => setPickerOpen(false)}>
                  Cerrar
                </button>
              </div>
            )}
          </>,
          "color-popover"
        )}
      </div>

      <div style={{ flexGrow: 1 }} />

      <button className="toolbar-btn" onClick={()=>onToolSelect('zoomIn')} title="Zoom In">🔍+</button>
      <button className="toolbar-btn" onClick={()=>onToolSelect('zoomOut')} title="Zoom Out">🔍–</button>
      <button className="toolbar-btn" onClick={onToggleChat} title="Abrir chat">💬</button>
    </div>
  )
}