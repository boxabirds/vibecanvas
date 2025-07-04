import { useState, useRef, useEffect } from 'react'
import InfiniteCanvas from './components/InfiniteCanvas'
import ToolPalette from './components/ToolPalette'
import useUndoRedo from './hooks/useUndoRedo'
import './App.css'

function App() {
  const [currentTool, setCurrentTool] = useState('selector')
  
  // Safely parse saved vibespaces with validation
  const getInitialVibespaces = () => {
    try {
      const saved = localStorage.getItem('vibespaces')
      if (saved) {
        const parsed = JSON.parse(saved)
        // Validate that it's an array and all items have required properties
        if (Array.isArray(parsed) && parsed.every(vs => 
          vs.id && 
          typeof vs.x === 'number' && 
          typeof vs.y === 'number' && 
          typeof vs.width === 'number' && 
          typeof vs.height === 'number' &&
          typeof vs.url === 'string'
        )) {
          return parsed
        }
        // Invalid format - clear it
        localStorage.removeItem('vibespaces')
      }
    } catch (e) {
      // Invalid JSON - clear it
      localStorage.removeItem('vibespaces')
    }
    return []
  }
  
  const { state: vibespaces, setState: setVibespaces } = useUndoRedo(getInitialVibespaces())

  useEffect(() => {
    if (Array.isArray(vibespaces)) {
      localStorage.setItem('vibespaces', JSON.stringify(vibespaces))
    }
  }, [vibespaces])

  return (
    <div className="app">
      <InfiniteCanvas 
        currentTool={currentTool}
        vibespaces={vibespaces}
        setVibespaces={setVibespaces}
      />
      <ToolPalette 
        currentTool={currentTool}
        setCurrentTool={setCurrentTool}
      />
    </div>
  )
}

export default App
