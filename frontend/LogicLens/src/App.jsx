import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom';
import { Menu, X } from 'lucide-react'; // 🛠️ NEW: Icons for hamburger menu
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import Session from './components/Session';

export default function App() {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  // 🛠️ NEW: State for mobile menu
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('user');
    setUser(null);
    setIsMobileMenuOpen(false); // Close menu on logout
  };

  const closeMenu = () => setIsMobileMenuOpen(false);

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-950 text-white font-sans flex flex-col relative">
        
        {/* Global Navigation Bar */}
        <header className="px-4 sm:px-6 py-4 flex items-center justify-between bg-gray-900 border-b border-gray-800 relative z-50">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-purple-400 tracking-wide">Aura AI</h1>
          </div>
          
          {user && (
            <>
              {/* Desktop Navigation (Hidden on Mobile) */}
              <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
                <NavLink to="/dashboard" className={({isActive}) => isActive ? "text-purple-400" : "text-gray-400 hover:text-white transition-colors"}>
                  Dashboard
                </NavLink>
                <NavLink to="/session" className={({isActive}) => isActive ? "text-purple-400" : "text-gray-400 hover:text-white transition-colors"}>
                  New Session
                </NavLink>
                <button onClick={handleLogout} className="px-4 py-2 bg-red-950/30 text-red-400 border border-red-900/50 rounded-lg hover:bg-red-900/50 transition-colors">
                  Logout
                </button>
              </nav>

              {/* 🛠️ NEW: Mobile Hamburger Button (Hidden on Desktop) */}
              <button 
                className="md:hidden text-gray-400 hover:text-white transition-colors p-2 -mr-2"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                aria-label="Toggle Menu"
              >
                {isMobileMenuOpen ? <X size={26} /> : <Menu size={26} />}
              </button>
            </>
          )}
        </header>

        {/* 🛠️ NEW: Mobile Menu Dropdown */}
        {user && isMobileMenuOpen && (
          <div className="md:hidden absolute top-[68px] left-0 w-full bg-gray-900 border-b border-gray-800 z-40 shadow-2xl animate-in slide-in-from-top-2 flex flex-col">
            <NavLink 
              to="/dashboard" 
              onClick={closeMenu}
              className={({isActive}) => `px-6 py-4 border-b border-gray-800 font-medium ${isActive ? "text-purple-400 bg-gray-800/50" : "text-gray-300 active:bg-gray-800"}`}
            >
              Dashboard
            </NavLink>
            <NavLink 
              to="/session" 
              onClick={closeMenu}
              className={({isActive}) => `px-6 py-4 border-b border-gray-800 font-medium ${isActive ? "text-purple-400 bg-gray-800/50" : "text-gray-300 active:bg-gray-800"}`}
            >
              New Session
            </NavLink>
            <button 
              onClick={handleLogout} 
              className="px-6 py-4 text-left text-red-400 font-medium active:bg-gray-800 transition-colors"
            >
              Logout
            </button>
          </div>
        )}

        {/* Routing */}
        <main className="flex-1 flex w-full relative z-0">
          <Routes>
            <Route path="/" element={!user ? <Auth setUser={setUser} /> : <Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={user ? <Dashboard /> : <Navigate to="/" replace />} />
            <Route path="/session" element={user ? <Session /> : <Navigate to="/" replace />} />
          </Routes>
        </main>

      </div>
    </BrowserRouter>
  );
}