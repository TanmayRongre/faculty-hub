import React from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';

/**
 * FacultyLayout — wraps all faculty/admin pages with the sidebar
 */
const FacultyLayout = ({ children }) => {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-slate-950 text-white flex">
      <Sidebar activePath={location.pathname} />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
};

export default FacultyLayout;
