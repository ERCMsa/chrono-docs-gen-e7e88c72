import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import PrivateRoute from "@/components/PrivateRoute";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Workers from "./pages/Workers";
import WorkerDetail from "./pages/WorkerDetail";
import Documents from "./pages/Documents";
import Contracts from "./pages/Contracts";
import DocumentView from "./pages/DocumentView";
import GenerateDocument from "./pages/GenerateDocument";
import Statistics from "./pages/Statistics";
import NotFound from "./pages/NotFound";
import Acomptes from "./pages/Acomptes";
import AcompteView from "./pages/AcompteView";
import Absences from "./pages/Absences";
import Conges from "./pages/Conges";
import AdminPermissions from "./pages/AdminPermissions";
import OAuthConsent from "./pages/OAuthConsent";


const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
            <Route
              element={
                <PrivateRoute>
                  <Layout />
                </PrivateRoute>
              }
            >
              <Route path="/" element={<Dashboard />} />
              <Route path="/workers" element={<PrivateRoute module="employees"><Workers /></PrivateRoute>} />
              <Route path="/workers/:id" element={<PrivateRoute module="employees"><WorkerDetail /></PrivateRoute>} />
              <Route path="/documents" element={<PrivateRoute module="documents"><Documents /></PrivateRoute>} />
              <Route path="/contracts" element={<PrivateRoute module="documents"><Contracts /></PrivateRoute>} />
              
              <Route path="/documents/:id" element={<PrivateRoute module="documents"><DocumentView /></PrivateRoute>} />
              <Route path="/generate/:type" element={<PrivateRoute module="documents"><GenerateDocument /></PrivateRoute>} />
              <Route path="/generate/:type/:id" element={<PrivateRoute module="documents"><GenerateDocument /></PrivateRoute>} />
              <Route path="/statistics" element={<PrivateRoute module="reports"><Statistics /></PrivateRoute>} />
              <Route path="/acomptes" element={<PrivateRoute module="payroll"><Acomptes /></PrivateRoute>} />
              <Route path="/acomptes/:id" element={<PrivateRoute module="payroll"><AcompteView /></PrivateRoute>} />
              <Route path="/absences" element={<PrivateRoute module="leave"><Absences /></PrivateRoute>} />
              <Route path="/conges" element={<PrivateRoute module="leave"><Conges /></PrivateRoute>} />
              <Route path="/admin/permissions" element={<PrivateRoute requireAdmin><AdminPermissions /></PrivateRoute>} />
              
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
