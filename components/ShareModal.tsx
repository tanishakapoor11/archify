import { useEffect, useState } from "react";
import { Check, Copy, Globe, Lock } from "lucide-react";
import { Button } from "./ui/Button";
import { Modal } from "./ui/Modal";
import { SHARE_STATUS_RESET_DELAY_MS } from "../lib/constants";

export function ShareModal({
  isOpen,
  isPublic,
  status,
  shareUrl,
  error,
  onConfirm,
  onClose,
}: ShareModalProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) setCopied(false);
  }, [isOpen, status]);

  // `isPublic` is the state after a completed change, and the one being
  // proposed before it, so "done" flips which copy applies.
  const isDone = status === "done";
  const goingPublic = isDone ? isPublic : !isPublic;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), SHARE_STATUS_RESET_DELAY_MS);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      labelledBy="share-modal-title"
      focusKey={status}
    >
      <div className="icon">
        {goingPublic ? <Globe className="mark" /> : <Lock className="mark" />}
      </div>

      {isDone ? (
        <>
          <h3 id="share-modal-title">
            {goingPublic ? "Project is public" : "Project is private"}
          </h3>
          <p>
            {goingPublic
              ? "Anyone signed in to Archify can now find this project in the community feed and open it."
              : "This project has been removed from the community feed. Only you can open it now."}
          </p>

          {goingPublic && (
            <div className="copy-row">
              <input readOnly value={shareUrl} aria-label="Shareable link" />
              <Button variant="secondary" size="sm" onClick={handleCopy}>
                {copied ? (
                  <>
                    <Check className="w-4 h-4 mr-1.5" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-1.5" /> Copy
                  </>
                )}
              </Button>
            </div>
          )}

          <div className="actions">
            <Button className="confirm" onClick={onClose}>
              Done
            </Button>
          </div>
        </>
      ) : (
        <>
          <h3 id="share-modal-title">
            {goingPublic ? "Make this project public?" : "Make this private?"}
          </h3>
          <p>
            {goingPublic
              ? "A copy will be published to the community feed, where anyone signed in to Archify can view it and your username will be shown as the author. You can make it private again at any time."
              : "This project will be removed from the community feed. Anyone who saved the link will no longer be able to open it."}
          </p>
          {error && <p className="error">{error}</p>}
          <div className="actions">
            <Button
              className="confirm"
              disabled={status === "saving"}
              onClick={onConfirm}
            >
              {status === "saving"
                ? "Saving..."
                : goingPublic
                  ? "Make public"
                  : "Make private"}
            </Button>
            <button
              type="button"
              className="cancel"
              disabled={status === "saving"}
              onClick={onClose}
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
