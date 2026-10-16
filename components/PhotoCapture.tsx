// Datei: components/PhotoCapture.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";

// ==========================================
// ANPASSBARE KONFIGURATIONS-VARIABLEN
// ==========================================
const IMAGE_SIZE = 600; // Breite und Höhe des fertigen Fotos in Pixeln
const JPEG_QUALITY = 0.7; // Bildqualität zwischen 0.1 und 1.0
const CAMERA_MODE: "environment" | "user" = "environment"; // "environment" = Rückkamera

interface PhotoCaptureProps {
  onSubmitPhoto: (base64DataUrl: string) => void;
  isSubmitting?: boolean;
}

export default function PhotoCapture({
  onSubmitPhoto,
  isSubmitting = false,
}: PhotoCaptureProps) {
  // Referenzen auf das HTML-Video-Element (Live-Sucher) und den Canvas (Bildverarbeitung)
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // State-Variablen für das aufgenommene Bild und eventuelle Kamera-Fehlermeldungen
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCameraReady, setIsCameraReady] = useState<boolean>(false);

  // Schritt 1: Kamera-Stream starten, sobald die Komponente auf dem Bildschirm erscheint
  useEffect(() => {
    let mediaStream: MediaStream | null = null;

    async function initRearCamera() {
      setCameraError(null);
      setIsCameraReady(false);

      try {
        // Fragt den Browser nach Zugriff auf die Rückkamera (ohne Ton)
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: CAMERA_MODE },
            width: { ideal: 1080 },
            height: { ideal: 1080 },
          },
          audio: false,
        });

        // Verbindet den Live-Stream mit dem <video>-Element
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          setIsCameraReady(true);
        }
      } catch (err) {
        console.error("Fehler beim Kamera-Zugriff:", err);
        setCameraError(
          "Kamera konnte nicht gestartet werden. Bitte erlaube den Kamera-Zugriff im Browser."
        );
      }
    }

    // Kamera nur einschalten, wenn noch kein Foto geschossen wurde
    if (!capturedImage) {
      initRearCamera();
    }

    // Aufräum-Funktion (Cleanup): Schaltet die Kamera aus, sobald das Foto fertig ist oder der Screen wechselt
    return () => {
      if (mediaStream) {
        mediaStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [capturedImage]);

  // Schritt 2: Das aktuelle Live-Bild einfrieren, quadratisch zuschneiden und komprimieren
  const handleCaptureClick = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    // Setzt die Zielgröße des Canvas auf unsere Variable IMAGE_SIZE (600x600)
    canvas.width = IMAGE_SIZE;
    canvas.height = IMAGE_SIZE;

    const context = canvas.getContext("2d");
    if (!context) return;

    // Berechnet den quadratischen Ausschnitt genau aus der Mitte des Kamerabildes
    const shortestSide = Math.min(video.videoWidth, video.videoHeight);
    const cropStartX = (video.videoWidth - shortestSide) / 2;
    const cropStartY = (video.videoHeight - shortestSide) / 2;

    // Zeichnet das Videobild auf den Canvas
    context.drawImage(
      video,
      cropStartX,
      cropStartY,
      shortestSide,
      shortestSide,
      0,
      0,
      IMAGE_SIZE,
      IMAGE_SIZE
    );

    // Wandelt das Canvas-Bild in einen Text-String (Base64 Data-URL) um
    const compressedDataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
    setCapturedImage(compressedDataUrl);
  };

  return (
    <div className="flex flex-col items-center w-full max-w-sm mx-auto gap-5">
      {/* Unsichtbarer Canvas für den quadratischen 600x600 Zuschnitt */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Sucher- oder Vorschau-Rahmen */}
      <div
        className="relative w-full aspect-square rounded-2xl overflow-hidden flex items-center justify-center"
        style={{
          background: "#09090c",
          border: "1px solid rgba(212, 163, 89, 0.35)",
          boxShadow: "0 16px 36px -12px rgba(0, 0, 0, 0.75)",
        }}
      >
        {cameraError ? (
          <div className="p-6 text-center space-y-3">
            <span className="text-3xl block">📷</span>
            <p className="text-xs leading-relaxed" style={{ color: "#e05a47" }}>
              {cameraError}
            </p>
          </div>
        ) : capturedImage ? (
          <img
            src={capturedImage}
            alt="Aufgenommenes Foto"
            className="w-full h-full object-cover"
          />
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              onLoadedMetadata={() => setIsCameraReady(true)}
              className="w-full h-full object-cover"
            />
            {!isCameraReady && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#09090c]">
                <div
                  className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
                  style={{ borderColor: "#d4a359", borderTopColor: "transparent" }}
                />
                <span
                  className="text-[11px] uppercase tracking-[0.2em]"
                  style={{ color: "#7c766e" }}
                >
                  Kamera startet...
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Steuerungs-Buttons */}
      {!capturedImage ? (
        <button
          type="button"
          onClick={handleCaptureClick}
          disabled={!isCameraReady || !!cameraError}
          className="w-16 h-16 rounded-full flex items-center justify-center transition-transform active:scale-90 cursor-pointer disabled:opacity-30"
          style={{
            border: "3px solid #d4a359",
            background: "rgba(212, 163, 89, 0.15)",
            boxShadow: "0 0 24px rgba(212, 163, 89, 0.3)",
          }}
          title="Foto auslösen"
        >
          <span
            className="w-11 h-11 rounded-full block"
            style={{ background: "#d4a359" }}
          />
        </button>
      ) : (
        <div className="flex w-full gap-3">
          <button
            type="button"
            onClick={() => setCapturedImage(null)}
            disabled={isSubmitting}
            className="flex-1 py-3.5 rounded-2xl text-xs uppercase tracking-[0.18em] font-medium transition-all cursor-pointer disabled:opacity-40"
            style={{
              background: "rgba(255, 255, 255, 0.06)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              color: "#d8d3cb",
            }}
          >
            Neu versuchen
          </button>

          <button
            type="button"
            onClick={() => onSubmitPhoto(capturedImage)}
            disabled={isSubmitting}
            className="flex-1 py-3.5 rounded-2xl text-xs uppercase tracking-[0.18em] font-semibold transition-all cursor-pointer disabled:opacity-40"
            style={{
              background: "#d4a359",
              color: "#070709",
              boxShadow: "0 10px 30px -8px rgba(212, 163, 89, 0.5)",
            }}
          >
            {isSubmitting ? "Wird versiegelt..." : "Versiegeln ✨"}
          </button>
        </div>
      )}
    </div>
  );
}
