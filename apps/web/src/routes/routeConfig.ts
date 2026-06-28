import { t } from "../i18n/dictionary";
import type { MessageKey } from "../i18n/dictionary";
import type { SidebarItem } from "../components/Sidebar";

export type RouteDefinition = {
  bodyKey: MessageKey;
  pattern: RegExp;
  titleKey: MessageKey;
};

export const navItems: SidebarItem[] = [
  { href: "/photos", label: t("nav.photos") },
  { href: "/albums", label: t("nav.albums") },
  { href: "/favorites", label: t("nav.favorites") },
  { href: "/drive", label: t("nav.drive") },
  { href: "/documents", label: t("nav.documents") },
  { href: "/jobs", label: t("nav.jobs") },
  { href: "/settings", label: t("nav.settings") },
];

export const routeDefinitions: RouteDefinition[] = [
  { bodyKey: "route.search.body", pattern: /^\/search\/?$/, titleKey: "route.search.title" },
  { bodyKey: "route.photos.body", pattern: /^\/photos\/?$/, titleKey: "route.photos.title" },
  { bodyKey: "route.photoDetail.body", pattern: /^\/photos\/[^/]+\/?$/, titleKey: "route.photoDetail.title" },
  { bodyKey: "route.albums.body", pattern: /^\/albums\/?$/, titleKey: "route.albums.title" },
  { bodyKey: "route.albumDetail.body", pattern: /^\/albums\/[^/]+\/?$/, titleKey: "route.albumDetail.title" },
  { bodyKey: "route.favorites.body", pattern: /^\/favorites\/?$/, titleKey: "route.favorites.title" },
  { bodyKey: "route.drive.body", pattern: /^\/drive\/?$/, titleKey: "route.drive.title" },
  {
    bodyKey: "route.driveFolder.body",
    pattern: /^\/drive\/folders\/[^/]+\/?$/,
    titleKey: "route.driveFolder.title",
  },
  { bodyKey: "route.documents.body", pattern: /^\/documents\/?$/, titleKey: "route.documents.title" },
  { bodyKey: "route.jobs.body", pattern: /^\/jobs\/?$/, titleKey: "route.jobs.title" },
  { bodyKey: "route.settings.body", pattern: /^\/settings\/?$/, titleKey: "route.settings.title" },
];

export function resolveRoute(pathname: string): RouteDefinition {
  return (
    routeDefinitions.find((route) => route.pattern.test(pathname)) ?? {
      bodyKey: "route.notFound.body",
      pattern: /.*/,
      titleKey: "route.notFound.title",
    }
  );
}
