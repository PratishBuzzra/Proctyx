
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/authContext.jsx'
import { BrowserRouter } from 'react-router-dom'
import { ExamProvider } from './context/ExamContext.jsx'

createRoot(document.getElementById('root')).render(
    <BrowserRouter>
    <ExamProvider>
<AuthProvider>
    <App />

</AuthProvider>
</ExamProvider>
</BrowserRouter>

)
