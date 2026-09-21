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

  const isPublic = !!project?.isPublic;
  const shareUrl =
    typeof window === "undefined"
      ? ""
      : `${window.location.origin}/visualizer/${id}`;
  const isOwner = !!project?.ownerId && project.ownerId === userId;

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
        <div className="panel">
          {isProjectLoading ? (
            <div className="render-area">
              <div className="render-overlay">
                <div className="rendering-card">
                  <RefreshCcw className="spinner" />
                  <span className="title">Loading project...</span>
                </div>
              </div>
            </div>
          ) : !project ? (
            <div className="render-area">
              <div className="render-overlay">
                <div className="rendering-card">
                  <span className="title">Project not found</span>
                  <span className="subtitle">
                    This project doesn't exist or could not be loaded.
                  </span>
                  <Button size="sm" className="mt-4" onClick={handleBack}>
                    Back to projects
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="panel-header">
                <div className="panel-meta">
                  <p>Project</p>
                  <h2>{project?.name || `Residence ${id}`}</h2>
                  <p className="note">
                    {isOwner
                      ? isPublic
                        ? "Shared publicly by you"
                        : "Created by You"
                      : `Shared by ${project?.sharedBy || "another user"}`}
                  </p>
                </div>
                <div className="panel-actions">
                  <Button
                    size="sm"
                    className="export"
                    disabled={!currentImage}
                    onClick={handleExport}
                  >
                    <Download className="w-4 h-4 mr-2" /> Export
                  </Button>
                  <Button
                    size="sm"
                    className="share"
                    disabled={!currentImage || !isOwner}
                    onClick={() => setIsShareOpen(true)}
                  >
                    <Share2 className="w-4 h-4 mr-2" />
                    {isPublic ? "Shared" : "Share"}
                  </Button>
                </div>
              </div>
              <div
                className={`render-area ${isProcessing ? "is-processing" : ""}`}
              >
                {currentImage ? (
                  <img
                    src={currentImage}
                    alt={`3D render of ${project?.name || "your floor plan"}`}
                    className="render-img"
                  />
                ) : (
                  <div className="render-placeholder">
                    {project?.sourceImage && (
                      <img
                        src={project?.sourceImage}
                        alt={`Original floor plan for ${project?.name || "this project"}`}
                        className="render-fallback"
                      />
                    )}
                  </div>
                )}

                {!isProcessing && renderError && (
                  <div className="render-overlay">
                    <div className="rendering-card">
                      <span className="title">Render failed</span>
                      <span className="subtitle">{renderError}</span>
                      <Button
                        size="sm"
                        className="mt-4"
                        onClick={handleRetryRender}
                      >
                        <RefreshCcw className="w-4 h-4 mr-2" /> Try again
                      </Button>
                    </div>
                  </div>
                )}

                {isProcessing && (
                  <div className="render-overlay">
                    <div className="rendering-card">
                      <RefreshCcw className="spinner" />
                      <span className="title">Rendering...</span>
                      <span className="subtitle">
                        Generating your 3D visualization
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
          <div className="panel compare">
            <div className="panel-header">
              <div className="panel-meta">
                <p>Comparison</p>
                <h3>Before & After</h3>
              </div>
              <div className="hint">Drag to compare</div>
            </div>
            <div className="compare-stage">
              {project?.sourceImage && currentImage ? (
                <ReactCompareSlider
                  defaultValue={50}
                  style={{ width: "100%", height: "auto" }}
                  itemOne={
                    <ReactCompareSliderImage
                      src={project?.sourceImage}
                      alt="Original 2D floor plan"
                      className="compare-img"
                    />
                  }
                  itemTwo={
                    <ReactCompareSliderImage
                      src={currentImage}
                      alt="Generated 3D render"
                      className="compare-img"
                    />
                  }
                />
              ) : (
                <div className="compare-fallback">
                  {project?.sourceImage && (
                    <img
                      src={project.sourceImage}
                      alt="Original 2D floor plan"
                      className="compare-img"
                    />
                  )}
                </div>
              )}
            </div>
          </div>
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
