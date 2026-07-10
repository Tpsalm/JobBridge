import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import JobBridgeLogo from "../components/JobBridgeLogo";
import { CheckCircle, XCircle } from "lucide-react";

const MAX_WAIT_MS = 8000; // 8 seconds max before fallback to /login

export default function AuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"processing" | "success" | "error">(
    "processing",
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [progress, setProgress] = useState(0);
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const fallbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Animate the progress bar during processing
  useEffect(() => {
    if (status !== "processing") {
      if (progressTimer.current) clearInterval(progressTimer.current);
      return;
    }
    // Ease towards 85% while waiting (never reaches 100 until success)
    progressTimer.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 85) return prev;
        // Decelerate as we get closer to 85
        const step = Math.max(0.5, (85 - prev) / 15);
        return Math.min(85, prev + step);
      });
    }, 100);

    return () => {
      if (progressTimer.current) clearInterval(progressTimer.current);
    };
  }, [status]);

  useEffect(() => {
    let cancelled = false;

    const handleCallback = async () => {
      try {
        // Check for URL hash tokens (implicit grant flow)
        const hash = window.location.hash;
        const searchParams = new URLSearchParams(window.location.search);
        const code = searchParams.get("code");

        if (hash && hash.includes("access_token")) {
          // Implicit grant: Supabase client auto-detects this on init
          // via detectSessionInUrl — just wait briefly
          const hashParams = new URLSearchParams(hash.substring(1));
          const type = hashParams.get("type");
          if (type === "signup" || type === "recovery" || type === "invite") {
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        } else if (code) {
          // PKCE flow: exchange the code for a session
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        }

        // Check if we have a session now
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (cancelled) return;

        if (session) {
          if (progressTimer.current) clearInterval(progressTimer.current);
          setProgress(100);
          setStatus("success");

          setTimeout(() => {
            if (!cancelled) {
              window.dispatchEvent(
                new CustomEvent("jobbridge:toast", {
                  detail: {
                    message: "Email confirmed! You're now signed in.",
                    type: "success",
                  },
                }),
              );
              navigate("/profile", { replace: true });
            }
          }, 1500);
        } else {
          // No session yet — prompt user to sign in manually
          if (progressTimer.current) clearInterval(progressTimer.current);
          setStatus("error");
          setErrorMessage(
            "Your email has been confirmed, but we couldn't sign you in automatically. Please try signing in.",
          );
        }
      } catch (err: any) {
        if (cancelled) return;
        if (progressTimer.current) clearInterval(progressTimer.current);
        setStatus("error");
        setErrorMessage(
          err?.message ||
            "Something went wrong while confirming your email. Please try signing in.",
        );
      }
    };

    // Max-wait fallback: if callback takes too long, redirect to /login
    fallbackTimer.current = setTimeout(() => {
      if (!cancelled) {
        navigate("/login", { replace: true });
      }
    }, MAX_WAIT_MS);

    handleCallback().then(() => {
      if (fallbackTimer.current) clearTimeout(fallbackTimer.current);
    });

    return () => {
      cancelled = true;
      if (progressTimer.current) clearInterval(progressTimer.current);
      if (fallbackTimer.current) clearTimeout(fallbackTimer.current);
    };
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 flex items-center justify-center p-4 relative">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-20 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-20 w-72 h-72 bg-indigo-400/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-2xl p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white shadow-lg ring-4 ring-blue-50 mx-auto mb-4">
            <JobBridgeLogo variant="icon" iconSize={40} />
          </div>

          {status === "processing" && (
            <>
              <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Confirming your email...
              </h1>
              <p className="text-gray-500 mb-6">
                Please wait while we verify your email address.
              </p>

              {/* Animated progress bar */}
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-blue-600 h-full rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-2">This usually takes just a moment…</p>
            </>
          )}

          {status === "success" && (
            <>
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Email Confirmed!
              </h1>
              <p className="text-gray-500 mb-6">
                Your email has been verified. Redirecting you to your profile...
              </p>
              {/* Smooth fill-to-100 bar */}
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-green-500 h-full rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </>
          )}

          {status === "error" && (
            <>
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <XCircle className="w-8 h-8 text-red-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Confirmation Issue
              </h1>
              <p className="text-red-600 text-sm mb-6">{errorMessage}</p>
              <button
                onClick={() => navigate("/login", { replace: true })}
                className="w-full bg-blue-700 text-white py-3 rounded-xl font-semibold hover:bg-blue-800 active:scale-[0.98] transition-all mb-3"
              >
                Go to Sign In
              </button>
              <button
                onClick={() => navigate("/", { replace: true })}
                className="w-full text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                Return to Home
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
