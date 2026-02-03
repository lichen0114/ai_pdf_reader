import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/index.css'

console.log('main.tsx loaded')

const root = document.getElementById('root')
console.log('root element:', root)

if (root) {
  try {
    console.log('Creating React root...')
    const reactRoot = ReactDOM.createRoot(root)
    console.log('Rendering App...')
    reactRoot.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    )
    console.log('Render called')
  } catch (error) {
    console.error('Failed to render:', error)
    root.innerHTML = `<div style="color: red; padding: 20px;">Error: ${error}</div>`
  }
} else {
  console.error('Root element not found!')
}
