import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { Layout } from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import PublicRoute from "./components/PublicRoute";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import Dashboard from "./pages/Dashboard";
import Items from "./pages/Items";
import Categories from "./pages/Categories";
import Users from "./pages/Users";
import Reports from "./pages/Reports";
import Suppliers from "./pages/Suppliers";
import Stores from "./pages/Stores";
import SelectStore from "./pages/SelectStore";
import PurchaseOrders from "./pages/PurchaseOrders";
import Orders from "./pages/Orders";
import Credits from "./pages/Credits";
import Subcategories from "./pages/Subcategories";
import Brands from "./pages/Brands";
import NotFound from "./pages/NotFound";
import Billing from "./pages/Billing";
import BillUpdateList from "./pages/BillUpdateList";
import UserRights from "./pages/UserRights";
import { SCREEN_KEY_TO_ID } from "./constants/screens";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <Routes>
            <Route
              path="/"
              element={
                <PublicRoute>
                  <Login />
                </PublicRoute>
              }
            />
            <Route
              path="/register"
              element={
                <PublicRoute>
                  <Register />
                </PublicRoute>
              }
            />
            <Route
              path="/forgot-password"
              element={
                <PublicRoute>
                  <ForgotPassword />
                </PublicRoute>
              }
            />
            <Route
              path="/privacy-policy"
              element={
                <PublicRoute>
                  <PrivacyPolicy />
                </PublicRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute screenId={SCREEN_KEY_TO_ID["dashboard"]}>
                  <Layout><Dashboard /></Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/items"
              element={
                <ProtectedRoute screenId={SCREEN_KEY_TO_ID["items"]}>
                  <Layout><Items /></Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/billing"
              element={
                <ProtectedRoute screenId={SCREEN_KEY_TO_ID["billing"]}>
                  <Layout><Billing /></Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/billing/update"
              element={
                <ProtectedRoute screenId={SCREEN_KEY_TO_ID["billing"]}>
                  <Layout><BillUpdateList /></Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/categories"
              element={
                <ProtectedRoute screenId={SCREEN_KEY_TO_ID["categories"]}>
                  <Layout><Categories /></Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/subcategories"
              element={
                <ProtectedRoute screenId={SCREEN_KEY_TO_ID["subcategories"]}>
                  <Layout><Subcategories /></Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/brands"
              element={
                <ProtectedRoute screenId={SCREEN_KEY_TO_ID["items"]}>
                  <Layout><Brands /></Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/users"
              element={
                <ProtectedRoute screenId={SCREEN_KEY_TO_ID["users"]}>
                  <Layout><Users /></Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/reports"
              element={
                <ProtectedRoute screenId={SCREEN_KEY_TO_ID["reports"]}>
                  <Layout><Reports /></Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/suppliers"
              element={
                <ProtectedRoute screenId={SCREEN_KEY_TO_ID["suppliers"]}>
                  <Layout><Suppliers /></Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/stores"
              element={
                <ProtectedRoute screenId={SCREEN_KEY_TO_ID["stores"]}>
                  <Layout><Stores /></Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/select-store"
              element={
                <ProtectedRoute skipStoreCheck={true}>
                  <Layout><SelectStore /></Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/purchase-orders"
              element={
                <ProtectedRoute screenId={SCREEN_KEY_TO_ID["purchase-orders"]}>
                  <Layout><PurchaseOrders /></Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/orders"
              element={
                <ProtectedRoute screenId={SCREEN_KEY_TO_ID["orders"]}>
                  <Layout><Orders /></Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/credits"
              element={
                <ProtectedRoute screenId={SCREEN_KEY_TO_ID["credits"]}>
                  <Layout><Credits /></Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/user-rights"
              element={
                <ProtectedRoute screenId={SCREEN_KEY_TO_ID["user-rights"]}>
                  <Layout><UserRights /></Layout>
                </ProtectedRoute>
              }
            />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
