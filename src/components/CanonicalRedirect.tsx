import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { normalizePath } from "../lib/seo";

export default function CanonicalRedirect() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const hostname = window.location.hostname;
    const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
    if (window.location.protocol === "http:" && !isLocalhost) {
      window.location.replace(`https://${window.location.host}${window.location.pathname}${window.location.search}${window.location.hash}`);
      return;
    }

    const normalizedPath = normalizePath(location.pathname);
    if (normalizedPath !== location.pathname) {
      navigate(`${normalizedPath}${location.search}${location.hash}`, { replace: true });
    }
  }, [location.hash, location.pathname, location.search, navigate]);

  return null;
}
