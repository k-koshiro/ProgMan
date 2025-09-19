import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import ProjectList from './pages/ProjectList';
import Schedule from './pages/Schedule';
import CommentsPage from './pages/Comments';
import VersionInfo from './components/VersionInfo';

function App() {
  return (
    <Router basename="/progress-manager">
      <div className="min-h-screen bg-gray-50">
        <Routes>
          <Route path="/" element={<Navigate to="/projects" replace />} />
          <Route path="/projects" element={<ProjectList />} />
          <Route path="/schedule/:projectId" element={<Schedule />} />
          <Route path="/comments/:projectId/:date?" element={<CommentsPage />} />
        </Routes>
        <VersionInfo />
      </div>
    </Router>
  );
}

export default App;
