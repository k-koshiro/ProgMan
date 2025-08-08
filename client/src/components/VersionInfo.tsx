import { useEffect, useState } from 'react';

function VersionInfo() {
  const [version, setVersion] = useState<{ commit: string; timestamp: string } | null>(null);

  useEffect(() => {
    fetch('/progress-manager/api/version')
      .then(res => res.json())
      .then(data => setVersion(data))
      .catch(err => console.error('Failed to fetch version:', err));
  }, []);

  if (!version) return null;

  return (
    <div className="fixed bottom-2 right-2 text-xs text-gray-400 bg-white/80 px-2 py-1 rounded shadow-sm">
      <span>v{version.commit}</span>
      <span className="ml-2">{new Date(version.timestamp).toLocaleString('ja-JP')}</span>
    </div>
  );
}

export default VersionInfo;