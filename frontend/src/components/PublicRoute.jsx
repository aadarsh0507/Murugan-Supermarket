import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

const PublicRoute = ({ children }) => {
  const { isAuthenticated, isLoading, selectedStore } = useAuth();

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect based on whether store is selected
  if (isAuthenticated) {
    if (!selectedStore) {
      return <Navigate to="/select-store" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default PublicRoute;
