import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

const ProtectedRoute = ({
  children,
  skipStoreCheck = false,
  screenKey,
  screenId,
}) => {
  const { isAuthenticated, isLoading, user, selectedStore, hasScreenAccess } = useAuth();
  const location = useLocation();

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

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  // Check if store is selected - redirect to select-store if not (except for select-store page itself)
  if (!skipStoreCheck && !selectedStore && location.pathname !== '/select-store') {
    return <Navigate to="/select-store" state={{ from: location }} replace />;
  }

  const screenRef = screenId ?? screenKey;

  if (screenRef && !hasScreenAccess(screenRef)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-destructive mb-2">Screen Disabled</h1>
          <p className="text-muted-foreground">
            Your administrator has not granted access to this view.
          </p>
        </div>
      </div>
    );
  }

  return children;
};

export default ProtectedRoute;
