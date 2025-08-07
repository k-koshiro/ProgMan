import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import ProjectList from './pages/ProjectList';
import Schedule from './pages/Schedule';

function App() {
  return (
    <Router basename="/progress-manager">
      <div className="min-h-screen bg-gray-50">
        <Routes>
          <Route path="/" element={<Navigate to="/projects" replace />} />
          <Route path="/projects" element={<ProjectList />} />
          <Route path="/schedule/:projectId" element={<Schedule />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;