import type { Route } from "./+types/home";
import Navbar from "../../components/Navbar";
import {
  ArrowRight,
  ArrowUpRight,
  Clock,
  Layers,
  UploadIcon,
} from "lucide-react";
import { Button } from "../../components/ui/Button";
import Upload from "../../components/Upload";
import { Link, useNavigate, useOutletContext } from "react-router";
import { useEffect, useRef, useState } from "react";
import { createProject, getProjects } from "../../lib/puter.actions";
import { ACCEPTED_IMAGE_LABEL, MAX_FILE_SIZE_MB } from "../../lib/constants";

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
  const isCreatingProjectRef = useRef(false);

  const handleUploadComplete = async (base64Image: string) => {
    if (isCreatingProjectRef.current) return false;
    isCreatingProjectRef.current = true;
    try {
      const newId = crypto.randomUUID();

      const name = `Residence ${newId}`;

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
          <Button variant="outline" size="lg" className="demo">
            Watch Demo
          </Button>
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
          </div>
          <div className="projects-grid">
            {isLoadingProjects &&
              [0, 1, 2].map((i) => (
                <div key={i} className="project-skeleton">
                  <div className="preview" />
                  <div className="lines">
                    <span />
                    <span />
                  </div>
                </div>
              ))}

            {!isLoadingProjects && projects.length === 0 && (
              <div className="projects-empty">
                <Layers className="mark" />
                <h3>
                  {isSignedIn ? "No projects yet" : "Sign in to see projects"}
                </h3>
                <p>
                  {isSignedIn
                    ? "Upload a floor plan above and your renders will show up here, alongside anything the community has shared."
                    : "Sign in with Puter to upload a floor plan and browse what the community has shared."}
                </p>
                {!isSignedIn && (
                  <Button size="sm" className="mt-5" onClick={() => signIn()}>
                    Sign in with Puter
                  </Button>
                )}
              </div>
            )}

            {projects.map(
              ({
                id,
                name,
                renderedImage,
                sourceImage,
                timestamp,
                ownerId,
                isPublic,
                sharedBy,
              }) => {
                const isMine = !ownerId || ownerId === userId;
                return (
                  <Link
                    key={id}
                    to={`/visualizer/${id}`}
                    className="project-card group"
                    viewTransition
                  >
                    <div className="preview">
                      <img
                        src={renderedImage || sourceImage}
                        alt={`${name || "Untitled project"} floor plan render`}
                      />
                      {(!isMine || isPublic) && (
                        <div className="badge">
                          <span>{isMine ? "Public" : "Community"}</span>
                        </div>
                      )}
                    </div>
                    <div className="card-body">
                      <div>
                        <h3>{name}</h3>
                        <div className="meta">
                          <Clock size="12" />
                          <span>
                            {new Date(timestamp).toLocaleDateString()}
                          </span>
                          <span>
                            By {isMine ? "you" : sharedBy || "another user"}
                          </span>
                        </div>
                      </div>
                      <div className="arrow">
                        <ArrowUpRight size="18" />
                      </div>
                    </div>
                  </Link>
                );
              },
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
