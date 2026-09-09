import { useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, Square } from "lucide-react";
export default function QRScanner({
  onScan,
}: {
  onScan: (value: string) => void;
}) {
  const video = useRef<HTMLVideoElement>(null),
    stream = useRef<MediaStream | null>(null),
    running = useRef(false),
    callback = useRef(onScan);
  const [active, setActive] = useState(false),
    [error, setError] = useState(""),
    [raw, setRaw] = useState(""),
    [starting, setStarting] = useState(false);
  callback.current = onScan;
  const stop = () => {
    running.current = false;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    setActive(false);
  };
  useEffect(
    () => () => {
      running.current = false;
      stream.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );
  const start = async () => {
    setError("");
    setStarting(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw Error(
          "Camera scanning requires HTTPS. You can upload a QR image or paste the pass instead.",
        );
      const media = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      stream.current = media;
      if (!video.current) {
        media.getTracks().forEach((t) => t.stop());
        return;
      }
      video.current.srcObject = media;
      await video.current.play();
      running.current = true;
      setActive(true);
      const { default: decode } = await import("jsqr");
      const canvas = document.createElement("canvas"),
        ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      const tick = () => {
        if (!running.current) return;
        const v = video.current;
        if (v && v.readyState >= 2 && v.videoWidth) {
          canvas.width = Math.min(640, v.videoWidth);
          canvas.height = Math.round(
            (v.videoHeight * canvas.width) / v.videoWidth,
          );
          ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
          const img = ctx.getImageData(0, 0, canvas.width, canvas.height),
            code = decode(img.data, img.width, img.height);
          if (code) {
            stop();
            callback.current(code.data);
            return;
          }
        }
        setTimeout(tick, 250);
      };
      tick();
    } catch (e: any) {
      stop();
      setError(
        e.name === "NotAllowedError"
          ? "Camera access was denied. Allow it in your browser settings, upload a QR image, or paste a pass."
          : e.message || "Could not open the camera.",
      );
    } finally {
      setStarting(false);
    }
  };
  const upload = async (file?: File) => {
    if (!file) return;
    setError("");
    try {
      const image = await createImageBitmap(file);
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(image, 0, 0);
      image.close();
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const { default: decode } = await import("jsqr");
      const code = decode(pixels.data, pixels.width, pixels.height);
      if (!code) throw Error("No QR code found in this image.");
      stop();
      callback.current(code.data);
    } catch (e: any) {
      setError(e.message);
    }
  };
  return (
    <div className="scanner">
      <div className={`scannerViewport ${active ? "active" : ""}`}>
        <video ref={video} muted playsInline />
        <div className="scannerGuide">
          <Camera size={32} />
          <span>
            {active
              ? "Position the booking QR inside the frame"
              : "Scan a customer’s booking pass"}
          </span>
        </div>
      </div>
      <div className="scannerActions">
        <button
          className="primary"
          disabled={starting}
          onClick={active ? stop : start}
        >
          {active ? <Square size={16} /> : <Camera size={16} />}{" "}
          {starting
            ? "Opening camera…"
            : active
              ? "Stop camera"
              : "Start camera"}
        </button>
        <label className="ghost">
          <ImagePlus size={16} /> Upload QR
          <input
            type="file"
            accept="image/*"
            onChange={(e) => upload(e.target.files?.[0])}
            hidden
          />
        </label>
      </div>
      <form
        className="manualPass"
        onSubmit={(e) => {
          e.preventDefault();
          stop();
          callback.current(raw);
        }}
      >
        <label>
          Or paste a Coworx pass code
          <input
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder="coworx:pass:v1:…"
          />
        </label>
        <button className="ghost" type="submit" disabled={!raw.trim()}>
          Find pass
        </button>
      </form>
      {error && (
        <p className="inlineError" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
