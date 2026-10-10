"use client";

import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";

const LANGUAGES = [
  { code: "fr", label: "🇫🇷" },
  { code: "en", label: "🇬🇧" },
  { code: "ar", label: "🇹🇳" },
];

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();

  function switchLanguage(newLocale: string) {
    // Sauvegarder la préférence dans un cookie
    document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000`;

    // Rafraîchir la page pour recharger avec la nouvelle locale
    router.refresh();
  }

  return (
    <div className="flex items-center gap-1">
      {LANGUAGES.map((lang) => (
        <button
          key={lang.code}
          onClick={() => switchLanguage(lang.code)}
          className={`text-lg px-2 py-1 rounded ${
            locale === lang.code
              ? "bg-blue-100"
              : "hover:bg-gray-100"
          }`}
          title={lang.code.toUpperCase()}
        >
          {lang.label}
        </button>
      ))}
    </div>
  );
}