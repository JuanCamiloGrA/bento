import { useEffect, useMemo, useState } from "react";

import { AppShell } from "../components/AppShell";
import { resolveRoute, navItems } from "../routes/routeConfig";
import { RoutePlaceholder } from "../routes/RoutePlaceholder";

const defaultRoute = "/photos";

export function App() {
  const [pathname, setPathname] = useState(() => window.location.pathname);
  const route = useMemo(() => resolveRoute(pathname), [pathname]);

  useEffect(() => {
    if (window.location.pathname === "/") {
      window.history.replaceState({}, "", defaultRoute);
      setPathname(defaultRoute);
    }

    function onPopState() {
      setPathname(window.location.pathname);
    }

    window.addEventListener("popstate", onPopState);

    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  function navigate(href: string) {
    window.history.pushState({}, "", href);
    setPathname(window.location.pathname);
  }

  function submitSearch(query: string) {
    const params = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : "";
    navigate(`/search${params}`);
  }

  return (
    <AppShell activePath={pathname} navItems={navItems} onNavigate={navigate} onSearch={submitSearch}>
      <RoutePlaceholder bodyKey={route.bodyKey} titleKey={route.titleKey} />
    </AppShell>
  );
}
