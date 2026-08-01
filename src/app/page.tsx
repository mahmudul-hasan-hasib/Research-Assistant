'use client';

import { Sidebar } from '@/components/insight/Sidebar';
import { ChatPanel } from '@/components/insight/ChatPanel';
import { useInsightStore } from '@/lib/store';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';
import { branding, getPrimaryClasses } from '@/config/branding';
import { AppIcon } from '@/components/insight/AppIcon';

export default function Home() {
  const { sidebarOpen, setSidebarOpen } = useInsightStore();
  const [isMobile, setIsMobile] = useState(false);
  const primary = getPrimaryClasses();

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <div className="relative flex h-dvh overflow-hidden bg-background">
      {/* Animated background orbs */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
        <div
          className="absolute -top-32 -left-32 h-[500px] w-[500px] rounded-full bg-gradient-to-br from-emerald-200/40 via-teal-200/30 to-cyan-200/20 blur-3xl"
          style={{ animation: 'float-orb-1 18s ease-in-out infinite' }}
        />
        <div
          className="absolute top-1/3 -right-48 h-[600px] w-[600px] rounded-full bg-gradient-to-br from-violet-200/30 via-purple-200/20 to-fuchsia-200/15 blur-3xl"
          style={{ animation: 'float-orb-2 22s ease-in-out infinite' }}
        />
        <div
          className="absolute -bottom-40 left-1/3 h-[450px] w-[450px] rounded-full bg-gradient-to-br from-sky-200/30 via-blue-200/20 to-indigo-200/15 blur-3xl"
          style={{ animation: 'float-orb-3 20s ease-in-out infinite' }}
        />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'radial-gradient(circle, oklch(0.3 0.02 260) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />
      </div>

      {/* Mobile overlay */}
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`${isMobile && !sidebarOpen ? 'hidden' : ''} shrink-0`}>
        <Sidebar />
      </div>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 relative">
        {isMobile && (
          <header className="flex items-center gap-3 border-b border-border/50 px-4 py-3 shrink-0 bg-white/60 backdrop-blur-md">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSidebarOpen(!sidebarOpen)}>
              <Menu className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <div className={`flex h-6 w-6 items-center justify-center rounded-lg ${primary.bg}`}>
                <AppIcon size={12} className="text-white" />
              </div>
              <span className="text-sm font-bold">{branding.appName}</span>
              <span className="text-[10px] text-muted-foreground">{branding.appTagline}</span>
            </div>
          </header>
        )}
        <ChatPanel />
      </main>
    </div>
  );
}
