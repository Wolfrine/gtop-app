import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Dashboard from "./components/Dashboard";
import QuizEngine from "./components/QuizEngine";
import LiveQuizLobby from "./components/LiveQuizLobby";
import ReportsPage from "./components/ReportsPage";
import SyllabusPage from "./components/SyllabusPage";
import SyllabusPreviewPage from "./components/SyllabusPreviewPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/quiz" element={<QuizEngine />} />
          <Route path="/live-quiz" element={<LiveQuizLobby />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/syllabus" element={<SyllabusPage />} />
          <Route path="/syllabus-preview" element={<SyllabusPreviewPage />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
