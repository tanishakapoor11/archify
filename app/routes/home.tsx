import type { Route } from "./+types/home";
import Navbar from "../../components/Navbar";
import { ArrowRight, Layers, Play } from "lucide-react";
import { Button } from "../../components/ui/Button";
import Upload from "../../components/Upload";
import { ProjectGrid } from "../../components/ProjectGrid";
import { Modal } from "../../components/ui/Modal";
import { Link, useNavigate, useOutletContext } from "react-router";
import {
  ReactCompareSlider,
  ReactCompareSliderImage,
} from "react-compare-slider";
import { useEffect, useRef, useState } from "react";
import { createProject, getProjects } from "../../lib/puter.actions";
import { projectNameFromFile } from "../../lib/utils";
import {
  ACCEPTED_IMAGE_LABEL,
  HOME_PROJECT_LIMIT,
  MAX_FILE_SIZE_MB,
} from "../../lib/constants";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Archify — AI floor plan to 3D render" },
    {
      name: "description",
      content:
        "Upload a 2D floor plan and get a photorealistic top-down 3D render.",
    },
  ];
}

export default function Home() {
  const navigate = useNavigate();
  const { userId, isSignedIn, signIn } = useOutletContext<AuthContext>();
  const [projects, setProjects] = useState<DesignItem[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [isDemoOpen, setIsDemoOpen] = useState(false);
  // Safety net: if the demo assets ever go missing, drop the CTA rather than
  // opening a dialog onto broken images.
  const [hasDemoAssets, setHasDemoAssets] = useState(true);
  const isCreatingProjectRef = useRef(false);

  const handleUploadComplete = async (base64Image: string, fileName?: string) => {
    if (isCreatingProjectRef.current) return false;
    isCreatingProjectRef.current = true;
    try {
      const newId = crypto.randomUUID();

      const name =
        projectNameFromFile(fileName) || `Residence ${newId.slice(0, 8)}`;

      const newItem = {
        id: newId,
        name,
        sourceImage: base64Image,
        renderedImage: undefined,
        timestamp: Date.now(),
      };

      const saved = await createProject({ item: newItem });
      if (!saved) {
        console.error("Failed to create project.");
        return false;
      }
      setProjects((prev) => [saved, ...prev]);
      navigate(`/visualizer/${newId}`, {
        state: {
          initialImage: saved.sourceImage,
          initialRender: saved.renderedImage || null,
          name,
        },
      });
      return true;
    } finally {
      isCreatingProjectRef.current = false;
    }
  };

  useEffect(() => {
    let isMounted = true;

    const fetchProjects = async () => {
      setIsLoadingProjects(true);
      const items = await getProjects();
      if (!isMounted) return;
      setProjects(items);
      setIsLoadingProjects(false);
    };

    fetchProjects();

    return () => {
      isMounted = false;
    };
  }, [isSignedIn]);

  return (
    <div className={"home"}>
      <Navbar />
      <section className="hero">
        <div className="announce">
          <div className="dot">
            <div className="pulse" />
          </div>
          <p>Introducing Archify 2.0</p>
        </div>
        <h1>Build beautiful spaces at the speed of thought with Archify</h1>
        <p className="subtitle">
          Archify is an AI-first design environment that helps you visualize,
          render, and ship your architectural projects faster than ever.
        </p>

        <div className="actions">
          <a href="#upload" className="cta">
            {" "}
            Start Building <ArrowRight className="icon" />{" "}
          </a>
          {hasDemoAssets && (
            <Button
              variant="outline"
              size="lg"
              className="demo"
              onClick={() => setIsDemoOpen(true)}
            >
              <Play className="w-4 h-4 mr-2" /> Watch Demo
            </Button>
          )}
        </div>
        <div id="upload" className="upload-shell">
          <div className="grid-overlay" />
          <div className="upload-card">
            <div className="upload-head">
              <div className="upload-icon">
                <Layers className="icon" />
              </div>
              <h3>Upload your floor plan</h3>
              <p>
                Supports {ACCEPTED_IMAGE_LABEL} formats up to {MAX_FILE_SIZE_MB}
                MB
              </p>
            </div>
            <Upload onComplete={handleUploadComplete} />
          </div>
        </div>
      </section>

      <Modal
        isOpen={isDemoOpen}
        onClose={() => setIsDemoOpen(false)}
        labelledBy="demo-modal-title"
        size="wide"
        showClose
      >
        <h3 id="demo-modal-title">See it work</h3>
        <p>
          The same apartment, before and after. Drag the handle to compare the
          plan you upload with the render you get back.
        </p>
        <div className="demo-stage">
          <ReactCompareSlider
            defaultValue={50}
            style={{ width: "100%", height: "100%" }}
            itemOne={
              <div className="demo-side">
                <ReactCompareSliderImage
                  src="/demo/before.webp"
                  alt="Original 2D floor plan"
                  onError={() => setHasDemoAssets(false)}
                />
                <span className="tag tag-before">2D plan</span>
              </div>
            }
            itemTwo={
              <div className="demo-side">
                <ReactCompareSliderImage
                  src="/demo/after.webp"
                  alt="Photorealistic 3D render of the same floor plan"
                  onError={() => setHasDemoAssets(false)}
                />
                <span className="tag tag-after">3D render</span>
              </div>
            }
          />
        </div>
      </Modal>

      <section id="projects" className="projects">
        <div className="section-inner">
          <div className="section-head">
            <div className="copy">
              <h2>Projects</h2>
              <p>
                Your latest work and shared community projects, all in one
                place.
              </p>
            </div>
            {projects.length > HOME_PROJECT_LIMIT && (
              <Link to="/projects" className="see-all" viewTransition>
                See all
                <ArrowRight className="w-4 h-4" />
              </Link>
            )}
          </div>
          <ProjectGrid
            projects={projects}
            isLoading={isLoadingProjects}
            userId={userId}
            isSignedIn={isSignedIn}
            onSignIn={() => signIn()}
            limit={HOME_PROJECT_LIMIT}
          />

        </div>
      </section>
    </div>
  );
}
