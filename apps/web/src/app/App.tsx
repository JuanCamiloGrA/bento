import { t } from "../i18n/dictionary";

const navItems = [
  { href: "/photos", label: t("nav.photos") },
  { href: "/drive", label: t("nav.drive") },
  { href: "/documents", label: t("nav.documents") },
  { href: "/jobs", label: t("nav.jobs") },
  { href: "/settings", label: t("nav.settings") },
];

export function App() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <div className="grid min-h-screen grid-cols-1 md:grid-cols-[15rem_1fr]">
        <aside className="border-b border-slate-200 bg-white px-4 py-4 md:border-b-0 md:border-r">
          <a className="text-xl font-semibold focus-visible:outline focus-visible:outline-2" href="/">
            Bento
          </a>
          <nav aria-label={t("nav.label")} className="mt-6 flex gap-2 overflow-x-auto md:flex-col">
            {navItems.map((item) => (
              <a
                className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                href={item.href}
                key={item.href}
              >
                {item.label}
              </a>
            ))}
          </nav>
        </aside>
        <section className="flex min-w-0 flex-col">
          <header className="border-b border-slate-200 bg-white px-4 py-3">
            <label className="block max-w-3xl">
              <span className="sr-only">{t("search.label")}</span>
              <input
                aria-label={t("search.label")}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20"
                placeholder={t("search.placeholder")}
                type="search"
              />
            </label>
          </header>
          <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
            <section className="rounded-md border border-slate-200 bg-white p-4">
              <h1 className="text-lg font-semibold">{t("shell.title")}</h1>
              <p className="mt-2 text-sm text-slate-600">{t("shell.status")}</p>
            </section>
            <section className="rounded-md border border-slate-200 bg-white p-4">
              <h2 className="text-base font-semibold">{t("photos.placeholderTitle")}</h2>
              <p className="mt-2 text-sm text-slate-600">{t("photos.placeholderBody")}</p>
            </section>
            <section className="rounded-md border border-slate-200 bg-white p-4">
              <h2 className="text-base font-semibold">{t("drive.placeholderTitle")}</h2>
              <p className="mt-2 text-sm text-slate-600">{t("drive.placeholderBody")}</p>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}