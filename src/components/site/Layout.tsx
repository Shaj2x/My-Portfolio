import { ReactNode, useEffect } from "react";
import { useLocation } from "react-router-dom";
import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";

interface LayoutProps {
  children: ReactNode;
  title: string;
  /** True when the page opens on a dark or iridescent full-bleed hero. */
  darkHeader?: boolean;
}

const Layout = ({ children, title, darkHeader = false }: LayoutProps) => {
  const { pathname } = useLocation();

  useEffect(() => {
    document.title = title;
  }, [title]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <a
        href="#start"
        className="sr-only focus:not-sr-only focus:absolute focus:left-10 focus:top-3 focus:z-[60] focus:bg-obsidian focus:px-7 focus:py-3 focus:text-label focus:uppercase focus:text-paper"
      >
        Skip to content
      </a>
      <SiteHeader inverse={darkHeader} />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
};

export default Layout;
