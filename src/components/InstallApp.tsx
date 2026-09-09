import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
export default function InstallApp() {
  const [prompt, setPrompt] = useState<any>(null),
    [ios, setIos] = useState(false),
    [dismissed, setDismissed] = useState(
      () =>
        Number(localStorage.getItem("coworx-install-after") || 0) > Date.now(),
    );
  const [instructions, setInstructions] = useState(false);
  useEffect(() => {
    const standalone =
      matchMedia("(display-mode: standalone)").matches ||
      (navigator as any).standalone;
    if (standalone) return;
    setIos(/iPad|iPhone|iPod/.test(navigator.userAgent));
    const handler = (e: any) => {
      e.preventDefault();
      setPrompt(e);
    };
    const installed = () => {
      setPrompt(null);
      setIos(false);
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", installed);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);
  const dismiss = () => {
    localStorage.setItem(
      "coworx-install-after",
      String(Date.now() + 7 * 86400000),
    );
    setDismissed(true);
  };
  if (dismissed || (!prompt && !ios)) return null;
  return (
    <aside className="installCard" aria-label="Install Coworx">
      <button
        className="iconButton"
        aria-label="Dismiss install suggestion"
        onClick={dismiss}
      >
        <X size={17} />
      </button>
      <span className="installSymbol">
        <Download size={23} />
      </span>
      <h3>Coworx, one tap away.</h3>
      <p>Book faster. Keep your bookings and digital pass close.</p>
      {instructions ? (
        <p>
          <Share size={15} /> In Safari, tap Share, then{" "}
          <b>Add to Home Screen</b>.
        </p>
      ) : (
        <button
          className="primary small"
          onClick={async () => {
            if (prompt) {
              await prompt.prompt();
              const choice = await prompt.userChoice;
              setPrompt(null);
              if (choice.outcome === "accepted") dismiss();
            } else setInstructions(true);
          }}
        >
          Install Coworx Central
        </button>
      )}
      <button className="textButton" onClick={dismiss}>
        Not now
      </button>
    </aside>
  );
}
