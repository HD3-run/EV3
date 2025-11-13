import React, { useMemo, useState, useCallback, memo } from 'react';
import { Link, useLocation } from 'wouter';
import { Moon, Sun, LayoutDashboard, ShoppingCart, Package, BarChart, FileText, Settings, RefreshCw, LogOut, ImageIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const Sidebar: React.FC = memo(() => {
  const { user, logout } = useAuth();
  const { isDarkMode, toggleDarkMode } = useTheme();
  const [isOpen, setIsOpen] = useState(false); // State to manage sidebar open/close
  const [location] = useLocation(); // Get current location

  const isAdmin = useMemo(() => user?.role === 'admin', [user?.role]);

  // Memoize logout handler to prevent unnecessary re-renders
  const handleLogout = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      if (response.ok) {
        logout(); // Call the AuthContext logout to clear local state
      } else {
        // If backend logout fails, still clear local state
        logout();
      }
    } catch (error) {
      // If network error, still clear local state
      logout();
    }
  }, [logout]);

  // Optimize hover handlers with useCallback
  const handleMouseEnter = useCallback(() => {
    setIsOpen(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsOpen(false);
  }, []);

  if (!user) {
    return null; // Don't render sidebar if user is not logged in
  }

  // Memoize link class function to prevent unnecessary recalculations
  const getLinkClass = useCallback((path: string) => {
    const baseClasses = "flex items-center py-2.5 px-4 rounded transition duration-200 hover:bg-slate-800/70";
    return location === path ? `${baseClasses} bg-slate-800/70` : baseClasses;
  }, [location]);

  return (
    <div
      className={`h-screen flex-shrink-0 sidebar-transition transition-all duration-300 ease-in-out ${isOpen ? 'w-64' : 'w-20'}\
       bg-slate-900/95 backdrop-blur-sm text-white p-4 space-y-4 overflow-hidden border-r border-slate-700/50`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <h2 className={`text-2xl font-bold mb-6 ${!isOpen && 'hidden'}`}>{isAdmin ? 'Merchant Portal' : 'User Portal'}</h2>
      <nav>
        <ul>
          {isAdmin ? (
            // Admin Navigation
            <>
              <li>
                <Link href="/dashboard" className={getLinkClass("/dashboard")}>
                  <LayoutDashboard size={20} />
                  <span className={`ml-2 ${!isOpen && 'hidden'}`}>Dashboard</span>
                </Link>
              </li>
              <li>
                <Link href="/orders" className={getLinkClass("/orders")}>
                  <ShoppingCart size={20} />
                  <span className={`ml-2 ${!isOpen && 'hidden'}`}>Orders</span>
                </Link>
              </li>
              <li>
                <Link href="/inventory" className={getLinkClass("/inventory")}>
                  <Package size={20} />
                  <span className={`ml-2 ${!isOpen && 'hidden'}`}>Inventory</span>
                </Link>
              </li>
              <li>
                <Link href="/reports" className={getLinkClass("/reports")}>
                  <BarChart size={20} />
                  <span className={`ml-2 ${!isOpen && 'hidden'}`}>Reports</span>
                </Link>
              </li>
              <li>
                <Link href="/invoices" className={getLinkClass("/invoices")}>
                  <FileText size={20} />
                  <span className={`ml-2 ${!isOpen && 'hidden'}`}>Invoices</span>
                </Link>
              </li>
              <li>
                <Link href="/returns" className={getLinkClass("/returns")}>
                  <RefreshCw size={20} />
                  <span className={`ml-2 ${!isOpen && 'hidden'}`}>Returns</span>
                </Link>
              </li>
              <li>
                <Link href="/product-catalog" className={getLinkClass("/product-catalog")}>
                  <ImageIcon size={20} />
                  <span className={`ml-2 ${!isOpen && 'hidden'}`}>Product Catalog</span>
                </Link>
              </li>
              <li>
                <Link href="/settings" className={getLinkClass("/settings")}>
                  <Settings size={20} />
                  <span className={`ml-2 ${!isOpen && 'hidden'}`}>Settings</span>
                </Link>
              </li>
            </>
          ) : (
            // User Navigation (Limited Access)
            <>
              <li>
                <Link href="/employee-dashboard" className={getLinkClass("/employee-dashboard")}>
                  <LayoutDashboard size={20} />
                  <span className={`ml-2 ${!isOpen && 'hidden'}`}>Dashboard</span>
                </Link>
              </li>
              <li>
                <Link href="/employee-orders" className={getLinkClass("/employee-orders")}>
                  <ShoppingCart size={20} />
                  <span className={`ml-2 ${!isOpen && 'hidden'}`}>Orders</span>
                </Link>
              </li>
              <li>
                <Link href="/employee-inventory" className={getLinkClass("/employee-inventory")}>
                  <Package size={20} />
                  <span className={`ml-2 ${!isOpen && 'hidden'}`}>Inventory</span>
                </Link>
              </li>
              <li>
                <Link href="/settings" className={getLinkClass("/settings")}>
                  <Settings size={20} />
                  <span className={`ml-2 ${!isOpen && 'hidden'}`}>Settings</span>
                </Link>
              </li>
            </>
          )}
        </ul>
      </nav>
      
      {/* Dark Mode Toggle and Logout */}
      <div className="mt-auto pt-4 border-t border-slate-700/50 space-y-2">
        <button
          onClick={toggleDarkMode}
          className="w-full flex items-center justify-center py-2 px-4 rounded transition duration-200 hover:bg-slate-800/70"
        >
          {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          <span className={`ml-2 ${!isOpen && 'hidden'}`}>{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>
        </button>
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center py-2 px-4 bg-red-600 hover:bg-red-700 rounded transition duration-200"
        >
          <LogOut size={20} />
          <span className={`ml-2 ${!isOpen && 'hidden'}`}>Logout</span>
        </button>
      </div>
    </div>
  );
});

Sidebar.displayName = 'Sidebar';

export default Sidebar;