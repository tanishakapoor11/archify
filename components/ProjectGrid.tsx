import { Link } from "react-router";
import { ArrowUpRight, Clock, Layers } from "lucide-react";
import { Button } from "./ui/Button";

export function ProjectGrid({
  projects,
  isLoading,
  userId,
  isSignedIn,
  onSignIn,
  limit,
}: ProjectGridProps) {
  const visible = typeof limit === "number" ? projects.slice(0, limit) : projects;

  return (
    <div className="projects-grid">
      {isLoading &&
        [0, 1, 2].map((i) => (
          <div key={i} className="project-skeleton">
            <div className="preview" />
            <div className="lines">
              <span />
              <span />
            </div>
          </div>
        ))}

      {!isLoading && projects.length === 0 && (
        <div className="projects-empty">
          <Layers className="mark" />
          <h3>{isSignedIn ? "No projects yet" : "Sign in to see projects"}</h3>
          <p>
            {isSignedIn
              ? "Upload a floor plan and your renders will show up here, alongside anything the community has shared."
              : "Sign in with Puter to upload a floor plan and browse what the community has shared."}
          </p>
          {!isSignedIn && (
            <Button size="sm" className="mt-5" onClick={onSignIn}>
              Sign in with Puter
            </Button>
          )}
        </div>
      )}

      {visible.map(
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
                  loading="lazy"
                  decoding="async"
                />
                {(!isMine || isPublic) && (
                  <div className="badge">
                    <span>{isMine ? "Public" : "Community"}</span>
                  </div>
                )}
              </div>
              <div className="card-body">
                <div className="card-text">
                  <h3>{name}</h3>
                  <div className="meta">
                    <Clock size="12" />
                    <span>{new Date(timestamp).toLocaleDateString()}</span>
                    <span>By {isMine ? "you" : sharedBy || "another user"}</span>
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
  );
}
