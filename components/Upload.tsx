import { CheckCircle2, ImageIcon, UploadIcon } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { useOutletContext } from "react-router";
import {
  ACCEPTED_IMAGE_LABEL,
  ACCEPTED_IMAGE_TYPES,
  MAX_FILE_SIZE_BYTES,
  MAX_FILE_SIZE_MB,
  PROGRESS_INTERVAL_MS,
  PROGRESS_STEP,
  REDIRECT_DELAY_MS,
} from "../lib/constants";

const Upload = ({ onComplete }: UploadProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const { isSignedIn } = useOutletContext<AuthContext>();

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const handedOffRef = useRef(false);
  useEffect(
    () => () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    },
    [],
  );

  // The progress bar is cosmetic and finishes before the real work starts, so
  // the hand-off has to report its own failure or the user is stranded here.
  const handOff = async (base64: string, fileName: string) => {
    if (handedOffRef.current) return;
    handedOffRef.current = true;
    setIsSaving(true);
    try {
      const ok = await onComplete(base64, fileName);
      if (ok === false) throw new Error("save rejected");
    } catch (e) {
      console.error("Failed to create project: ", e);
      setError("Could not save that project. Please try again.");
      setFile(null);
      setProgress(0);
      handedOffRef.current = false;
    } finally {
      setIsSaving(false);
    }
  };

  const processFile = (selected: File) => {
    if (!isSignedIn) return;

    if (!ACCEPTED_IMAGE_TYPES.includes(selected.type)) {
      setError(`Only ${ACCEPTED_IMAGE_LABEL} files are supported.`);
      return;
    }

    if (selected.size > MAX_FILE_SIZE_BYTES) {
      setError(`That file is over ${MAX_FILE_SIZE_MB}MB. Try a smaller image.`);
      return;
    }

    setError(null);
    setFile(selected);
    setProgress(0);
    handedOffRef.current = false;

    const reader = new FileReader();
    reader.onerror = () => {
      console.error("Failed to read file: ", reader.error);
      setError("Could not read that file. Try again.");
      setFile(null);
    };
    reader.onload = () => {
      const base64 = reader.result as string;

      // React may process a state updater more than once, so completion is
      // tracked here rather than inside setProgress: a bunched-up tick would
      // otherwise fire the hand-off twice and the duplicate looks like an error.
      let pct = 0;
      intervalRef.current = setInterval(() => {
        pct = Math.min(100, pct + PROGRESS_STEP);
        setProgress(pct);
        if (pct < 100) return;

        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        setTimeout(() => void handOff(base64, selected.name), REDIRECT_DELAY_MS);
      }, PROGRESS_INTERVAL_MS);
    };
    reader.readAsDataURL(selected);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) processFile(selected);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (isSignedIn) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) processFile(dropped);
  };

  return (
    <div className="upload">
      {!file ? (
        <div
          className={`dropzone ${isDragging ? "is-dragging" : ""}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input
            type="file"
            className="drop-input"
            accept={ACCEPTED_IMAGE_TYPES.join(",")}
            disabled={!isSignedIn}
            onChange={handleChange}
          />
          <div className="drop-content">
            <div className="drop-icon">
              <UploadIcon size="20" />
            </div>
            <p>
              {isSignedIn
                ? "Click to upload or just drag and drop"
                : "Sign in or Sign up with puter to upload "}
            </p>
            <p className="help">Maximum file size {MAX_FILE_SIZE_MB}MB</p>
            {error && <p className="error">{error}</p>}
          </div>
        </div>
      ) : (
        <div className="upload-status">
          <div className="status-content">
            <div className="status-icon">
              {progress === 100 ? (
                <CheckCircle2 className="check" />
              ) : (
                <ImageIcon className="image" />
              )}
            </div>
            <h3>{file.name}</h3>
            <div className="progress">
              <div className="bar" style={{ width: `${progress}%` }} />
              <p className="status-text">
                {progress < 100
                  ? "Analyzing Floor Plan..."
                  : isSaving
                    ? "Saving your project..."
                    : "Redirecting..."}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Upload;
