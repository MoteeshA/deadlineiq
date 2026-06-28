import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";

export default function ProtectedRoute({ children, requireAuth = true }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 border-4 border-white/10 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
        <p className="mt-4 text-sm text-slate-400 font-medium animate-pulse">Syncing session...</p>
      </div>
    );
  }

  if (requireAuth && !user) {
    // Redirect to login if user is not authenticated
    return <Navigate to="/" replace />;
  }

  if (!requireAuth && user) {
    // Redirect to dashboard if user is already authenticated (e.g., trying to access login page)
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
