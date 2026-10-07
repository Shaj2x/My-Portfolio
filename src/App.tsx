import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import NotFound from "./pages/NotFound";

// three.js is heavy, so the 3D room loads only when visited
const Room = lazy(() => import("./pages/Room"));
const RoomPlain = lazy(() => import("./pages/RoomPlain"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* the 3D room is the home page */}
            <Route
              path="/"
              element={
                <Suspense fallback={<div className="fixed inset-0 bg-[#0d0e11]" />}>
                  <RoomPlain />
                </Suspense>
              }
            />
            <Route
              path="/room"
              element={
                <Suspense fallback={<div className="fixed inset-0 bg-[#030407]" />}>
                  <Room />
                </Suspense>
              }
            />
            {/* the room's old address, kept so shared links still land in it */}
            <Route path="/room/plain" element={<Navigate to="/" replace />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
