import { ReactNode } from 'react';
import { Route, Redirect } from 'wouter';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
  path: string;
  children: ReactNode;
  allowedRoles: string[];
}

const ProtectedRoute = ({ path, children, allowedRoles }: ProtectedRouteProps) => {
  const { user, isValidating } = useAuth();

  // Show loading state while validating session
  if (isValidating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Validating session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    // If not logged in, redirect to login page
    return <Redirect to="/login" />;
  }

  if (!allowedRoles.includes(user.role)) {
    // If logged in but not authorized, redirect to dashboard or an unauthorized page
    return <Redirect to="/login" />;
  }

  return <Route path={path}>{children}</Route>;
};

export default ProtectedRoute;