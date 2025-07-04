import { useState, useCallback, useEffect } from 'react'

function useUndoRedo(initialState) {
  const [history, setHistory] = useState([initialState])
  const [currentIndex, setCurrentIndex] = useState(0)

  const setState = useCallback((newState) => {
    setHistory(prev => {
      const newHistory = prev.slice(0, currentIndex + 1)
      return [...newHistory, newState]
    })
    setCurrentIndex(prev => prev + 1)
  }, [currentIndex])

  const undo = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1)
    }
  }, [currentIndex])

  const redo = useCallback(() => {
    if (currentIndex < history.length - 1) {
      setCurrentIndex(prev => prev + 1)
    }
  }, [currentIndex, history.length])

  const canUndo = currentIndex > 0
  const canRedo = currentIndex < history.length - 1
  const currentState = history[currentIndex]

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
      const isUndo = (isMac && e.metaKey && e.key === 'z' && !e.shiftKey) || 
                     (!isMac && e.ctrlKey && e.key === 'z' && !e.shiftKey)
      const isRedo = (isMac && e.metaKey && e.shiftKey && e.key === 'z') || 
                     (!isMac && e.ctrlKey && e.shiftKey && e.key === 'z')
      
      if (isUndo) {
        e.preventDefault()
        undo()
      } else if (isRedo) {
        e.preventDefault()
        redo()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [undo, redo])

  return {
    state: currentState,
    setState,
    undo,
    redo,
    canUndo,
    canRedo
  }
}

export default useUndoRedo