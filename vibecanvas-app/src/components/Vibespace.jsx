import { useState, useRef, useCallback, useEffect } from 'react'
import './Vibespace.css'

function Vibespace({ vibespace, isSelected, onUpdate, viewScale, currentTool }) {
  const [isResizing, setIsResizing] = useState(false)
  const [resizeHandle, setResizeHandle] = useState(null)
  const resizeStart = useRef(null)
  const originalSize = useRef(null)

  const handleResizeStart = useCallback((e, handle) => {
    e.stopPropagation()
    setIsResizing(true)
    setResizeHandle(handle)
    resizeStart.current = { x: e.clientX, y: e.clientY }
    originalSize.current = { ...vibespace }
    
    // Add pointer capture for reliable tracking
    e.currentTarget.setPointerCapture(e.pointerId)
  }, [vibespace])

  const handleResizeMove = useCallback((e) => {
    if (!isResizing || !resizeStart.current || !originalSize.current) return

    const deltaX = (e.clientX - resizeStart.current.x) / viewScale
    const deltaY = (e.clientY - resizeStart.current.y) / viewScale
    
    const updates = { ...originalSize.current }

    switch (resizeHandle) {
      case 'top':
        updates.y = originalSize.current.y + deltaY
        updates.height = originalSize.current.height - deltaY
        break
      case 'right':
        updates.width = originalSize.current.width + deltaX
        break
      case 'bottom':
        updates.height = originalSize.current.height + deltaY
        break
      case 'left':
        updates.x = originalSize.current.x + deltaX
        updates.width = originalSize.current.width - deltaX
        break
      case 'top-left':
        updates.x = originalSize.current.x + deltaX
        updates.y = originalSize.current.y + deltaY
        updates.width = originalSize.current.width - deltaX
        updates.height = originalSize.current.height - deltaY
        break
      case 'top-right':
        updates.y = originalSize.current.y + deltaY
        updates.width = originalSize.current.width + deltaX
        updates.height = originalSize.current.height - deltaY
        break
      case 'bottom-left':
        updates.x = originalSize.current.x + deltaX
        updates.width = originalSize.current.width - deltaX
        updates.height = originalSize.current.height + deltaY
        break
      case 'bottom-right':
        updates.width = originalSize.current.width + deltaX
        updates.height = originalSize.current.height + deltaY
        break
    }

    if (updates.width > 50 && updates.height > 50) {
      onUpdate(updates)
    }
  }, [isResizing, resizeHandle, viewScale, onUpdate])

  const handleResizeEnd = useCallback((e) => {
    if (isResizing) {
      setIsResizing(false)
      setResizeHandle(null)
      resizeStart.current = null
      originalSize.current = null
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }, [isResizing])

  // Global event listeners for resize
  useEffect(() => {
    if (!isResizing) return

    const handleGlobalMove = (e) => {
      handleResizeMove(e)
    }

    const handleGlobalUp = (e) => {
      setIsResizing(false)
      setResizeHandle(null)
      resizeStart.current = null
      originalSize.current = null
    }

    window.addEventListener('pointermove', handleGlobalMove)
    window.addEventListener('pointerup', handleGlobalUp)

    return () => {
      window.removeEventListener('pointermove', handleGlobalMove)
      window.removeEventListener('pointerup', handleGlobalUp)
    }
  }, [isResizing, handleResizeMove])

  return (
    <div 
      className={`vibespace ${isSelected ? 'selected' : ''} tool-${currentTool}`}
      style={{
        left: vibespace.x,
        top: vibespace.y,
        width: vibespace.width,
        height: vibespace.height
      }}
    >
      {vibespace.url && (
        <iframe
          src={vibespace.url}
          className="vibespace-iframe"
          title={`Vibespace ${vibespace.id}`}
          style={{ 
            pointerEvents: currentTool === 'vibespace' ? 'auto' : 'none' 
          }}
        />
      )}
      {isSelected && currentTool === 'selector' && (
        <>
          <div 
            className="resize-handle top" 
            onPointerDown={(e) => handleResizeStart(e, 'top')}
            onPointerUp={handleResizeEnd}
          />
          <div 
            className="resize-handle right" 
            onPointerDown={(e) => handleResizeStart(e, 'right')}
            onPointerUp={handleResizeEnd}
          />
          <div 
            className="resize-handle bottom" 
            onPointerDown={(e) => handleResizeStart(e, 'bottom')}
            onPointerUp={handleResizeEnd}
          />
          <div 
            className="resize-handle left" 
            onPointerDown={(e) => handleResizeStart(e, 'left')}
            onPointerUp={handleResizeEnd}
          />
          <div 
            className="resize-handle top-left" 
            onPointerDown={(e) => handleResizeStart(e, 'top-left')}
            onPointerUp={handleResizeEnd}
          />
          <div 
            className="resize-handle top-right" 
            onPointerDown={(e) => handleResizeStart(e, 'top-right')}
            onPointerUp={handleResizeEnd}
          />
          <div 
            className="resize-handle bottom-left" 
            onPointerDown={(e) => handleResizeStart(e, 'bottom-left')}
            onPointerUp={handleResizeEnd}
          />
          <div 
            className="resize-handle bottom-right" 
            onPointerDown={(e) => handleResizeStart(e, 'bottom-right')}
            onPointerUp={handleResizeEnd}
          />
        </>
      )}
    </div>
  )
}

export default Vibespace