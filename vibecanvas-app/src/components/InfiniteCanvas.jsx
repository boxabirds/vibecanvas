import { useRef, useEffect, useState, useCallback } from 'react'
import Vibespace from './Vibespace'
import './InfiniteCanvas.css'

function InfiniteCanvas({ currentTool, vibespaces = [], setVibespaces }) {
  const canvasRef = useRef(null)
  const [viewTransform, setViewTransform] = useState({ x: 0, y: 0, scale: 1 })
  const [isPanning, setIsPanning] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [createStart, setCreateStart] = useState(null)
  const [createEnd, setCreateEnd] = useState(null)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [selectionBox, setSelectionBox] = useState(null)
  const [isDraggingSelection, setIsDraggingSelection] = useState(false)
  const [dragStart, setDragStart] = useState(null)
  const [isSpacePressed, setIsSpacePressed] = useState(false)
  
  const panStart = useRef(null)
  const lastPointerPos = useRef(null)

  const screenToCanvas = useCallback((screenX, screenY) => {
    return {
      x: (screenX - viewTransform.x) / viewTransform.scale,
      y: (screenY - viewTransform.y) / viewTransform.scale
    }
  }, [viewTransform])

  const handleWheel = useCallback((e) => {
    e.preventDefault()
    const scaleFactor = e.deltaY < 0 ? 1.1 : 0.9
    const newScale = Math.max(0.1, Math.min(5, viewTransform.scale * scaleFactor))
    
    const rect = canvasRef.current.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top
    
    const canvasPoint = screenToCanvas(mouseX, mouseY)
    
    const newX = mouseX - canvasPoint.x * newScale
    const newY = mouseY - canvasPoint.y * newScale
    
    setViewTransform({ x: newX, y: newY, scale: newScale })
  }, [viewTransform, screenToCanvas])

  const handlePointerDown = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const canvasPoint = screenToCanvas(x, y)
    
    lastPointerPos.current = { x: e.clientX, y: e.clientY }

    if (isSpacePressed || e.buttons === 4 || currentTool === 'grabber') {
      setIsPanning(true)
      panStart.current = { x: e.clientX, y: e.clientY }
      e.currentTarget.style.cursor = 'grabbing'
    } else if (currentTool === 'vibespace') {
      setIsCreating(true)
      setCreateStart(canvasPoint)
      setCreateEnd(canvasPoint)
    } else if (currentTool === 'selector') {
      const clickedVibespace = Array.isArray(vibespaces) && vibespaces.find(vs => 
        canvasPoint.x >= vs.x && 
        canvasPoint.x <= vs.x + vs.width &&
        canvasPoint.y >= vs.y && 
        canvasPoint.y <= vs.y + vs.height
      )
      
      if (clickedVibespace) {
        if (!e.shiftKey && !e.ctrlKey && !e.metaKey && !selectedIds.has(clickedVibespace.id)) {
          setSelectedIds(new Set([clickedVibespace.id]))
        } else if (e.shiftKey || e.ctrlKey || e.metaKey) {
          const newSelected = new Set(selectedIds)
          if (newSelected.has(clickedVibespace.id)) {
            newSelected.delete(clickedVibespace.id)
          } else {
            newSelected.add(clickedVibespace.id)
          }
          setSelectedIds(newSelected)
        }
        if (selectedIds.has(clickedVibespace.id) || e.shiftKey || e.ctrlKey || e.metaKey) {
          setIsDraggingSelection(true)
          setDragStart(canvasPoint)
        }
      } else {
        if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
          setSelectedIds(new Set())
        }
        setSelectionBox({ start: canvasPoint, end: canvasPoint })
      }
    }
  }, [currentTool, screenToCanvas, vibespaces, selectedIds, isSpacePressed])

  const handlePointerMove = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const canvasPoint = screenToCanvas(x, y)

    if (isPanning && panStart.current) {
      const deltaX = e.clientX - lastPointerPos.current.x
      const deltaY = e.clientY - lastPointerPos.current.y
      setViewTransform(prev => ({
        ...prev,
        x: prev.x + deltaX,
        y: prev.y + deltaY
      }))
      lastPointerPos.current = { x: e.clientX, y: e.clientY }
    } else if (isCreating && createStart) {
      setCreateEnd(canvasPoint)
    } else if (selectionBox) {
      setSelectionBox(prev => ({ ...prev, end: canvasPoint }))
    } else if (isDraggingSelection && dragStart) {
      const deltaX = canvasPoint.x - dragStart.x
      const deltaY = canvasPoint.y - dragStart.y
      
      setVibespaces(
        vibespaces.map(vs => 
          selectedIds.has(vs.id) 
            ? { ...vs, x: vs.x + deltaX, y: vs.y + deltaY }
            : vs
        )
      )
      setDragStart(canvasPoint)
    }
  }, [isPanning, isCreating, createStart, screenToCanvas, selectionBox, isDraggingSelection, dragStart, selectedIds, setVibespaces, vibespaces])

  const getCursor = useCallback(() => {
    if (isPanning) return 'grabbing'
    if (isSpacePressed) return 'grab'
    if (currentTool === 'grabber') return 'grab'
    if (currentTool === 'vibespace') return 'crosshair'
    return 'default'
  }, [isPanning, isSpacePressed, currentTool])

  const handlePointerUp = useCallback((e) => {
    if (isPanning) {
      setIsPanning(false)
      panStart.current = null
      e.currentTarget.style.cursor = getCursor()
    } else if (isCreating && createStart && createEnd) {
      const minX = Math.min(createStart.x, createEnd.x)
      const minY = Math.min(createStart.y, createEnd.y)
      const width = Math.abs(createEnd.x - createStart.x)
      const height = Math.abs(createEnd.y - createStart.y)
      
      if (width > 10 && height > 10) {
        const urls = [
          'https://codeleaves.replit.app',
          'https://fireworkvibes.replit.app'
        ]
        const randomUrl = urls[Math.floor(Math.random() * urls.length)]
        
        const newVibespace = {
          id: Date.now().toString(),
          x: minX,
          y: minY,
          width,
          height,
          url: randomUrl
        }
        setVibespaces([...vibespaces, newVibespace])
      }
      
      setIsCreating(false)
      setCreateStart(null)
      setCreateEnd(null)
    } else if (selectionBox) {
      const minX = Math.min(selectionBox.start.x, selectionBox.end.x)
      const minY = Math.min(selectionBox.start.y, selectionBox.end.y)
      const maxX = Math.max(selectionBox.start.x, selectionBox.end.x)
      const maxY = Math.max(selectionBox.start.y, selectionBox.end.y)
      
      const newSelected = new Set()
      if (Array.isArray(vibespaces)) {
        vibespaces.forEach(vs => {
          if (vs.x < maxX && vs.x + vs.width > minX &&
              vs.y < maxY && vs.y + vs.height > minY) {
            newSelected.add(vs.id)
          }
        })
      }
      
      if (e.shiftKey || e.ctrlKey || e.metaKey) {
        selectedIds.forEach(id => newSelected.add(id))
      }
      
      setSelectedIds(newSelected)
      setSelectionBox(null)
    } else if (isDraggingSelection) {
      setIsDraggingSelection(false)
      setDragStart(null)
    }
  }, [isPanning, isCreating, createStart, createEnd, setVibespaces, selectionBox, vibespaces, selectedIds, isDraggingSelection, getCursor])

  const handleKeyDown = useCallback((e) => {
    if (e.code === 'Space' && !isSpacePressed) {
      e.preventDefault()
      setIsSpacePressed(true)
      if (!isPanning) {
        canvasRef.current.style.cursor = 'grab'
      }
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      if (selectedIds.size > 0) {
        e.preventDefault()
        setVibespaces(vibespaces.filter(vs => !selectedIds.has(vs.id)))
        setSelectedIds(new Set())
      }
    }
  }, [isSpacePressed, isPanning, selectedIds, setVibespaces, vibespaces])

  const handleKeyUp = useCallback((e) => {
    if (e.code === 'Space') {
      e.preventDefault()
      setIsSpacePressed(false)
      if (!isPanning) {
        canvasRef.current.style.cursor = getCursor()
      }
    }
  }, [isPanning, getCursor])

  useEffect(() => {
    const canvas = canvasRef.current
    canvas.addEventListener('wheel', handleWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [handleKeyDown, handleKeyUp])

  return (
    <div 
      ref={canvasRef}
      className="infinite-canvas"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{ cursor: getCursor() }}
    >
      <div 
        className="canvas-content"
        style={{
          transform: `translate(${viewTransform.x}px, ${viewTransform.y}px) scale(${viewTransform.scale})`
        }}
      >
        {Array.isArray(vibespaces) && vibespaces.map(vibespace => (
          <Vibespace
            key={vibespace.id}
            vibespace={vibespace}
            isSelected={selectedIds.has(vibespace.id)}
            onUpdate={(updated) => {
              setVibespaces(
                vibespaces.map(vs => vs.id === updated.id ? updated : vs)
              )
            }}
            viewScale={viewTransform.scale}
            currentTool={currentTool}
          />
        ))}
        
        {isCreating && createStart && createEnd && (
          <div 
            className="creation-preview"
            style={{
              left: Math.min(createStart.x, createEnd.x),
              top: Math.min(createStart.y, createEnd.y),
              width: Math.abs(createEnd.x - createStart.x),
              height: Math.abs(createEnd.y - createStart.y)
            }}
          />
        )}
        
        {selectionBox && (
          <div 
            className="selection-box"
            style={{
              left: Math.min(selectionBox.start.x, selectionBox.end.x),
              top: Math.min(selectionBox.start.y, selectionBox.end.y),
              width: Math.abs(selectionBox.end.x - selectionBox.start.x),
              height: Math.abs(selectionBox.end.y - selectionBox.start.y)
            }}
          />
        )}
      </div>
    </div>
  )
}

export default InfiniteCanvas