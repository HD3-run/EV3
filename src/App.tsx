import { lazy, Suspense } from 'react';
import { Route, Switch, Redirect } from 'wouter';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { WebSocketProvider } from './context/WebSocketContext';
import Sidebar from './components/Sidebar';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const EmployeeDashboard = lazy(() => import('./pages/EmployeeDashboard'));
const EmployeeOrders = lazy(() => import('./pages/EmployeeOrders'));
const EmployeeInventory = lazy(() => import('./pages/EmployeeInventory'));
const Orders = lazy(() => import('./pages/Orders'));
const Inventory = lazy(() => import('./pages/Inventory'));
const Invoices = lazy(() => import('./pages/Invoices'));
const Reports = lazy(() => import('./pages/Reports'));
const Returns = lazy(() => import('./pages/Returns'));
const Suppliers = lazy(() => import('./pages/Suppliers'));
const Settings = lazy(() => import('./pages/Settings'));
const Login = lazy(() => import('./pages/Login'));
const Landing = lazy(() => import('./pages/Landing'));
const Signup = lazy(() => import('./pages/Signup'));
const CookiePolicy = lazy(() => import('./pages/CookiePolicy'));
const ProductCatalog = lazy(() => import('./pages/ProductCatalog'));
const PublicCatalog = lazy(() => import('./pages/PublicCatalog'));
function AppContent() {
  const { user, isValidating } = useAuth();

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="/signup" component={Signup} />
        <Route path="/" component={Landing} />
        <Route path="/cookies" component={CookiePolicy} />
        <Route path="/catalog/:merchantId" component={PublicCatalog} />
        {/* Protected routes with sidebar layout */}
        <Route path="/:rest*">
          {isValidating ? (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600 dark:text-gray-400">Validating session...</p>
              </div>
            </div>
          ) : user ? (
            <div className="flex h-screen overflow-hidden">
              <Sidebar />
              <div className="flex-grow overflow-auto bg-gray-100 dark:bg-gray-900">
                <Switch>
                  {user?.role === 'admin' ? (
                    // Admin routes
                    <>
                      <Route path="/dashboard" component={Dashboard} />
                      <Route path="/orders" component={Orders} />
                      <Route path="/inventory" component={Inventory} />
                      <Route path="/invoices" component={Invoices} />
                      <Route path="/reports" component={Reports} />
                      <Route path="/returns" component={Returns} />
                      <Route path="/suppliers" component={Suppliers} />
                      <Route path="/product-catalog" component={ProductCatalog} />
                      <Route path="/settings" component={Settings} />
                    </>
                  ) : (
                    // Employee routes
                    <>
                      <Route path="/employee-dashboard" component={EmployeeDashboard} />
                      <Route path="/employee-orders" component={EmployeeOrders} />
                      <Route path="/employee-inventory" component={EmployeeInventory} />
                      <Route path="/settings" component={Settings} />
                    </>
                  )}
                </Switch>
              </div>
            </div>
          ) : (
            <Redirect to="/login" />
          )}
        </Route>
      </Switch>
    </Suspense>
  );
}

function App() {
  // Determine WebSocket URL based on environment
  // Socket.IO uses HTTP/HTTPS URLs, not ws:// URLs
  const wsUrl = (import.meta as any).env?.PROD 
    ? 'http://13.201.116.161:5000' 
    : 'http://localhost:5000';

  return (
    <ThemeProvider>
      <AuthProvider>
        <WebSocketProvider url={wsUrl}>
          <AppContent />
        </WebSocketProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;