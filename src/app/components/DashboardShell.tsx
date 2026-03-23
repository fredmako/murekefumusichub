import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import type { ComponentType, MouseEvent, ReactNode } from "react";

type LocationLike = {
  pathname: string;
  search: string;
  hash: string;
};

type DashboardNavItem = {
  id: string;
  label: string;
  path?: string;
  icon?: ComponentType<{ className?: string }>;
  onSelect?: () => void;
  isActive?: (location: LocationLike) => boolean;
};

interface DashboardShellProps {
  title: string;
  description?: string;
  navItems?: DashboardNavItem[];
  activeNavId?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  menuTitle?: string;
  menuDescription?: string;
}

const isPathActive = (itemPath: string, location: LocationLike) => {
  if (!itemPath) return false;
  if (itemPath.startsWith("#")) {
    return location.hash === itemPath;
  }

  const [rawPath, rawQuery] = itemPath.split("?");
  if (rawPath && rawPath !== location.pathname) return false;
  if (!rawQuery) return true;

  const targetParams = new URLSearchParams(rawQuery);
  const currentParams = new URLSearchParams(location.search);
  for (const [key, value] of targetParams.entries()) {
    if (currentParams.get(key) !== value) return false;
  }
  return true;
};

export function DashboardShell({
  title,
  description,
  navItems = [],
  activeNavId,
  actions,
  children,
  className,
  menuTitle = "Service Menu",
  menuDescription = "Use this menu to move between key sections in the dashboard.",
}: DashboardShellProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const hasNav = navItems.length > 0;
  const [activeHash, setActiveHash] = useState(location.hash);

  useEffect(() => {
    setActiveHash(location.hash);
  }, [location.hash]);

  const resolveActive = (item: DashboardNavItem) => {
    if (activeNavId) return item.id === activeNavId;
    if (item.path?.startsWith("#")) return activeHash === item.path;
    if (item.isActive) return item.isActive(location);
    if (item.path) return isPathActive(item.path, location);
    return false;
  };

  const handleHashNavigation = (
    event: MouseEvent<HTMLAnchorElement | HTMLButtonElement>,
    item: DashboardNavItem,
  ) => {
    if (!item.path?.startsWith("#")) return;
    event.preventDefault();
    const targetId = item.path.slice(1);
    const target = document.getElementById(targetId);
    setActiveHash(item.path);
    navigate(
      {
        pathname: location.pathname,
        search: location.search,
        hash: item.path,
      },
      { replace: false },
    );
    if (!target) return;

    window.requestAnimationFrame(() => {
      target.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  };

  const renderNavItem = (item: DashboardNavItem, variant: "rail" | "pill") => {
    const active = resolveActive(item);
    const Icon = item.icon;
    const baseClass =
      variant === "rail"
        ? `flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${
            active
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          }`
        : `inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition ${
            active
              ? "bg-primary text-primary-foreground shadow-sm"
              : "border border-border/70 bg-background/70 text-muted-foreground hover:bg-muted/40"
          }`;

    const content = (
      <>
        {Icon ? (
          <Icon className={variant === "rail" ? "size-4" : "size-3.5"} />
        ) : null}
        <span className="truncate">{item.label}</span>
      </>
    );

    if (item.path) {
      if (item.path.startsWith("#")) {
        return (
          <a
            key={item.id}
            href={item.path}
            onClick={(event) => {
              item.onSelect?.();
              handleHashNavigation(event, item);
            }}
            className={baseClass}
          >
            {content}
          </a>
        );
      }

      return (
        <Link
          key={item.id}
          to={item.path}
          onClick={item.onSelect}
          className={baseClass}
        >
          {content}
        </Link>
      );
    }

    return (
      <button
        key={item.id}
        type="button"
        onClick={item.onSelect}
        className={baseClass}
      >
        {content}
      </button>
    );
  };

  return (
    <section className={`dashboard-shell ${className || ""}`}>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Dashboard
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
              {title}
            </h1>
            {description ? (
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
          {actions ? (
            <div className="flex flex-wrap items-center gap-2">{actions}</div>
          ) : null}
        </div>

        {hasNav ? (
          <div className="lg:hidden">
            <div className="flex gap-2 overflow-x-auto whitespace-nowrap rounded-full border border-border/70 bg-background/60 p-1.5">
              {navItems.map((item) => renderNavItem(item, "pill"))}
            </div>
          </div>
        ) : null}

        <div
          className={`grid gap-6 ${
            hasNav ? "lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start" : ""
          }`}
        >
          {hasNav ? (
            <aside className="hidden lg:sticky lg:top-24 lg:block lg:h-[calc(100vh-7rem)] lg:self-start">
              <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-border/70 bg-card/80 p-3 shadow-sm">
                <div className="border-b border-border/60 px-2 pb-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    {menuTitle}
                  </p>
                  {menuDescription ? (
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {menuDescription}
                    </p>
                  ) : null}
                </div>
                <div className="mt-3 flex-1 space-y-1 overflow-y-auto pr-1">
                  {navItems.map((item) => renderNavItem(item, "rail"))}
                </div>
              </div>
            </aside>
          ) : null}
          <div className="min-w-0 space-y-6 dashboard-density">
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}

export default DashboardShell;
