import React, { useEffect, useRef, useState } from "react";
import {
  useLocation,
  useNavigate,
  useOutletContext,
  useParams,
} from "react-router";
import { generate3DView } from "../../lib/ai.action";
import { Box, Download, RefreshCcw, Share2, X } from "lucide-react";
import { Button } from "../../components/ui/Button";
import {
  createProject,
  getProjectById,
  setProjectVisibility,
} from "../../lib/puter.actions";
import { ShareModal } from "../../components/ShareModal";
import { fetchBlobFromUrl, getImageExtension } from "../../lib/utils";
import {
  ReactCompareSlider,
  ReactCompareSliderImage,
} from "react-compare-slider";

export function meta() {
  return [
    { title: "Visualizer — Archify" },
    {
      name: "description",
      content: "View and share your 3D floor plan render.",
    },
  ];
}

const VisualizerId = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { userId } = useOutletContext<AuthContext>();

  const hasInitialGenerated = useRef(false);

  const [project, setProject] = useState<DesignItem | null>(null);
  const [isProjectLoading, setIsProjectLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState<ShareStatus>("idle");
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [view, setView] = useState<StageView>("render");

  const isPublic = !!project?.isPublic;
  const shareUrl =
    typeof window === "undefined"
      ? ""
      : `${window.location.origin}/visualizer/${id}`;
  const isOwner = !!project?.ownerId && project.ownerId === userId;

  const hasRender = !!currentImage;
  const hasPlan = !!project?.sourceImage;
  const canCompare = hasRender && hasPlan;
  const shown = view === "plan" ? project?.sourceImage : currentImage;

  const handleBack = () => navigate("/");

  const handleRetryRender = () => {
    if (!project || isProcessing) return;
    hasInitialGenerated.current = true;
    void runGeneration(project);
  };

  const handleExport = async () => {
    if (!currentImage) return;

    // currentImage is either a data: URL from a fresh render or a cross-origin
    // .puter.site URL, where the anchor download attribute is ignored.
    const resolved = await fetchBlobFromUrl(currentImage);
    if (!resolved) {
      console.error("Failed to download the render.");
      return;
    }

    const ext = getImageExtension(resolved.contentType, currentImage);
    const base = (project?.name || `residence-${id}`)
      .trim()
      .replace(/[^\w.-]+/g, "-");
    const href = URL.createObjectURL(resolved.blob);

    const link = document.createElement("a");
    link.href = href;
    link.download = `${base}.${ext}`;
    link.click();

    setTimeout(() => URL.revokeObjectURL(href), 0);
  };

  const handleConfirmShare = async () => {
    if (!id || !project || shareStatus === "saving") return;
    setShareStatus("saving");
    setShareError(null);
    const updated = await setProjectVisibility({
      id,
      visibility: isPublic ? "private" : "public",
    });
    if (!updated) {
      setShareStatus("idle");
      setShareError("Could not update sharing. Please try again.");
      return;
    }
    setProject(updated);
    setShareStatus("done");
  };

  const handleCloseShare = () => {
    if (shareStatus === "saving") return;
    setIsShareOpen(false);
    setShareStatus("idle");
    setShareError(null);
  };

  const runGeneration = async (item: DesignItem) => {
    if (!id || !item.sourceImage) return;
    try {
      setIsProcessing(true);
      setRenderError(null);
      const result = await generate3DView({ sourceImage: item.sourceImage });
      if (result.renderedImage) {
        const updatedItem = {
          ...item,
          renderedImage: result.renderedImage,
          renderedPath: result.renderedPath,
          timestamp: Date.now(),
          ownerId: item.ownerId ?? userId ?? null,
          isPublic: item.isPublic ?? false,
        };
        const saved = await createProject({ item: updatedItem });
        if (saved?.renderedImage) {
          setProject(saved);
          setCurrentImage(saved.renderedImage);
        } else {
          console.error("Render was generated but could not be saved.");
          setRenderError("The render could not be saved. Please try again.");
        }
      } else {
        setRenderError("No render came back. Please try again.");
      }
    } catch (error) {
      console.error("Generation failed", error);
      setRenderError(
        error instanceof Error
          ? error.message
          : "Something went wrong while rendering.",
      );
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const loadProject = async () => {
      if (!id) {
        setIsProjectLoading(false);
        return;
      }

      setIsProjectLoading(true);

      const fetchedProject = await getProjectById({ id });

      if (!isMounted) return;

      setProject(fetchedProject);
      setCurrentImage(fetchedProject?.renderedImage || null);
      setIsProjectLoading(false);
      hasInitialGenerated.current = false;
    };

    loadProject();

    return () => {
      isMounted = false;
    };
  }, [id]);

  useEffect(() => {
    if (
      isProjectLoading ||
      hasInitialGenerated.current ||
      !project?.sourceImage
    )
      return;

    if (project.renderedImage) {
      setCurrentImage(project.renderedImage);
      hasInitialGenerated.current = true;
      return;
    }

    hasInitialGenerated.current = true;
    void runGeneration(project);
  }, [project, isProjectLoading]);

  return (
    <div className="visualizer">
      <nav className="topbar">
        <div className="brand">
          <Box className={"logo"} />
          <span className={"name"}>Archify</span>
        </div>
        <Button variant="ghost" size="sm" onClick={handleBack} className="exit">
          <X className="icon" /> Exit Editor
        </Button>
      </nav>
      <section className="content">
        <div className="workspace">
          <div className={`stage ${isProcessing ? "is-processing" : ""}`}>
            {isProjectLoading ? (
              <div className="stage-note">
                <RefreshCcw className="spinner" />
                <p>Loading project</p>
              </div>
            ) : !project ? (
              <div className="stage-note">
                <p>This project doesn&apos;t exist, or it isn&apos;t shared with you.</p>
                <Button size="sm" className="mt-5" onClick={handleBack}>
                  Back to projects
                </Button>
              </div>
            ) : view === "compare" && canCompare ? (
              <ReactCompareSlider
                defaultValue={50}
                style={{ width: "100%", height: "100%" }}
                itemOne={
                  <div className="compare-side">
                    <ReactCompareSliderImage
                      src={project.sourceImage}
                      alt="Original 2D floor plan"
                      className="stage-img"
                    />
                    <span className="tag tag-before">Your plan</span>
                  </div>
                }
                itemTwo={
                  <div className="compare-side">
                    <ReactCompareSliderImage
                      src={currentImage as string}
                      alt="Generated 3D render"
                      className="stage-img"
                    />
                    <span className="tag tag-after">Render</span>
                  </div>
                }
              />
            ) : shown ? (
              <img
                key={view}
                src={shown}
                alt={
                  view === "plan"
                    ? `Original floor plan for ${project.name || "this project"}`
                    : `3D render of ${project.name || "your floor plan"}`
                }
                className="stage-img"
              />
            ) : (
              <div className="stage-note">
                <p>No render yet.</p>
              </div>
            )}

            {project && isProcessing && (
              <div className="stage-veil">
                <RefreshCcw className="spinner" />
                <p>Rendering your visualization</p>
              </div>
            )}

            {project && !isProcessing && renderError && (
              <div className="stage-veil">
                <p className="loud">{renderError}</p>
                <Button size="sm" className="mt-4" onClick={handleRetryRender}>
                  <RefreshCcw className="w-4 h-4 mr-2" /> Try again
                </Button>
              </div>
            )}
          </div>

          {project && (
            <aside className="rail">
              <div className="rail-head">
                <h2>{project.name || `Residence ${id}`}</h2>
                <p>
                  {isOwner
                    ? isPublic
                      ? "Shared publicly by you"
                      : "Private to you"
                    : `Shared by ${project.sharedBy || "another user"}`}
                </p>
              </div>

              <div className="rail-actions">
                <Button
                  size="sm"
                  fullWidth
                  className="export"
                  disabled={!currentImage}
                  onClick={handleExport}
                >
                  <Download className="w-4 h-4 mr-2" /> Export
                </Button>
                <Button
                  size="sm"
                  fullWidth
                  className="share"
                  disabled={!currentImage || !isOwner}
                  onClick={() => setIsShareOpen(true)}
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  {isPublic ? "Shared" : "Share"}
                </Button>
              </div>

              <div className="rail-views" role="tablist" aria-label="View">
                <button
                  type="button"
                  role="tab"
                  aria-selected={view === "plan"}
                  disabled={!hasPlan}
                  onClick={() => setView("plan")}
                >
                  <span className="thumb">
                    {hasPlan && <img src={project.sourceImage} alt="" />}
                  </span>
                  Plan
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={view === "compare"}
                  disabled={!canCompare}
                  onClick={() => setView("compare")}
                >
                  <span className="thumb thumb-split">
                    {hasPlan && <img src={project.sourceImage} alt="" />}
                    {hasRender && <img className="over" src={currentImage as string} alt="" />}
                  </span>
                  Compare
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={view === "render"}
                  disabled={!hasRender}
                  onClick={() => setView("render")}
                >
                  <span className="thumb">
                    {hasRender && <img src={currentImage as string} alt="" />}
                  </span>
                  Render
                </button>
              </div>
            </aside>
          )}
        </div>
      </section>


      <ShareModal
        isOpen={isShareOpen}
        isPublic={isPublic}
        status={shareStatus}
        shareUrl={shareUrl}
        error={shareError}
        onConfirm={handleConfirmShare}
        onClose={handleCloseShare}
      />
    </div>
  );
};

export default VisualizerId;
