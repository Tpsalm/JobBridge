import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import {
  DEFAULT_OG_IMAGE,
  SITE_NAME,
  SITE_URL,
  canonicalUrl,
  noindexPaths,
  normalizePath,
  routeForPath,
} from "../lib/seo";

function upsertMeta(selector: string, create: () => HTMLMetaElement, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = create();
    document.head.appendChild(element);
  }
  element.setAttribute("content", content);
}

function upsertLink(rel: string, href: string) {
  let element = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!element) {
    element = document.createElement("link");
    element.rel = rel;
    document.head.appendChild(element);
  }
  element.href = href;
}

function setJsonLd(id: string, data: unknown) {
  let element = document.getElementById(id) as HTMLScriptElement | null;
  if (!element) {
    element = document.createElement("script");
    element.id = id;
    element.type = "application/ld+json";
    document.head.appendChild(element);
  }
  element.text = JSON.stringify(data);
}

export default function SEO() {
  const location = useLocation();

  useEffect(() => {
    const normalizedPath = normalizePath(location.pathname);
    const route = routeForPath(normalizedPath);
    const canonical = canonicalUrl(normalizedPath);
    const shouldNoindex = route.noindex || noindexPaths.has(normalizedPath);
    const title = route.title;
    const description = route.description;

    document.title = title;
    document.documentElement.lang = "en";

    upsertMeta("meta[name='description']", () => {
      const el = document.createElement("meta");
      el.name = "description";
      return el;
    }, description);
    upsertMeta("meta[name='robots']", () => {
      const el = document.createElement("meta");
      el.name = "robots";
      return el;
    }, shouldNoindex ? "noindex, nofollow" : "index, follow, max-image-preview:large");
    upsertMeta("meta[property='og:site_name']", () => {
      const el = document.createElement("meta");
      el.setAttribute("property", "og:site_name");
      return el;
    }, SITE_NAME);
    upsertMeta("meta[property='og:title']", () => {
      const el = document.createElement("meta");
      el.setAttribute("property", "og:title");
      return el;
    }, title);
    upsertMeta("meta[property='og:description']", () => {
      const el = document.createElement("meta");
      el.setAttribute("property", "og:description");
      return el;
    }, description);
    upsertMeta("meta[property='og:type']", () => {
      const el = document.createElement("meta");
      el.setAttribute("property", "og:type");
      return el;
    }, normalizedPath.startsWith("/blog/") ? "article" : "website");
    upsertMeta("meta[property='og:url']", () => {
      const el = document.createElement("meta");
      el.setAttribute("property", "og:url");
      return el;
    }, canonical);
    upsertMeta("meta[property='og:image']", () => {
      const el = document.createElement("meta");
      el.setAttribute("property", "og:image");
      return el;
    }, DEFAULT_OG_IMAGE);
    upsertMeta("meta[property='og:image:alt']", () => {
      const el = document.createElement("meta");
      el.setAttribute("property", "og:image:alt");
      return el;
    }, "JobBridge career marketplace preview");
    upsertMeta("meta[name='twitter:card']", () => {
      const el = document.createElement("meta");
      el.name = "twitter:card";
      return el;
    }, "summary_large_image");
    upsertMeta("meta[name='twitter:title']", () => {
      const el = document.createElement("meta");
      el.name = "twitter:title";
      return el;
    }, title);
    upsertMeta("meta[name='twitter:description']", () => {
      const el = document.createElement("meta");
      el.name = "twitter:description";
      return el;
    }, description);
    upsertMeta("meta[name='twitter:image']", () => {
      const el = document.createElement("meta");
      el.name = "twitter:image";
      return el;
    }, DEFAULT_OG_IMAGE);

    const verification = import.meta.env.VITE_GOOGLE_SITE_VERIFICATION;
    if (verification) {
      upsertMeta("meta[name='google-site-verification']", () => {
        const el = document.createElement("meta");
        el.name = "google-site-verification";
        return el;
      }, verification);
    }

    upsertLink("canonical", canonical);

    setJsonLd("jobbridge-org-schema", {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
      logo: `${SITE_URL}/images/jobbridge-logo.jpeg`,
      sameAs: [
        "https://www.instagram.com/jobbridge__",
        "https://www.facebook.com/share/1DhVVgkF6P/",
        "https://x.com/jobbridge_com",
      ],
      contactPoint: {
        "@type": "ContactPoint",
        email: "jobbridgesupport@gmail.com",
        contactType: "customer support",
        areaServed: "NG",
      },
    });

    setJsonLd("jobbridge-page-schema", {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: title,
      description,
      url: canonical,
      isPartOf: {
        "@type": "WebSite",
        name: SITE_NAME,
        url: SITE_URL,
        potentialAction: {
          "@type": "SearchAction",
          target: `${SITE_URL}/jobs?q={search_term_string}`,
          "query-input": "required name=search_term_string",
        },
      },
    });
  }, [location.pathname]);

  return null;
}
