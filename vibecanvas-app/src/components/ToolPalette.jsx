import { Hand, MousePointer2, Sparkles } from 'lucide-react'
import './ToolPalette.css'

function ToolPalette({ currentTool, setCurrentTool }) {
  const tools = [
    { 
      id: 'grabber', 
      name: 'Grabber',
      icon: <Hand size={20} />
    },
    { 
      id: 'selector', 
      name: 'Selector',
      icon: <MousePointer2 size={20} />
    },
    { 
      id: 'vibespace', 
      name: 'Create Vibespace',
      icon: <Sparkles size={20} />
    }
  ]

  return (
    <div className="tool-palette">
      {tools.map(tool => (
        <button
          key={tool.id}
          className={`tool-button ${currentTool === tool.id ? 'active' : ''}`}
          onClick={() => setCurrentTool(tool.id)}
          title={tool.name}
        >
          {tool.icon}
        </button>
      ))}
    </div>
  )
}

export default ToolPalette