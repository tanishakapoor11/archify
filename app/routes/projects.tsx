import { useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router";
import { ArrowLeft } from "lucide-react";
import Navbar from "../../components/Navbar";
import { ProjectGrid } from "../../components/ProjectGrid";
import { getProjects } from "../../lib/puter.actions";

export function meta() {
  return [
    { title: "Projects — Archify" },
    {
      name: "description",
      content: "Every floor plan you have rendered, plus community projects.",
    },
  ];
}

export default function Projects() {
  const { userId, isSignedIn, signIn } = useOutletContext<AuthContext>();
  const [projects, setProjects] = useState<DesignItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchProjects = async () => {
      setIsLoading(true);
      const items = await getProjects();
      if (!isMounted) return;
      setProjects(items);
      setIsLoading(false);
    };

    fetchProjects();

    return () => {
      isMounted = false;
    };
  }, [isSignedIn]);

  return (
    <div className="home">
      <Navbar />
      <section className="projects projects-page">
        <div className="section-inner">
          <div className="section-head">
            <div className="copy">
              <Link to="/" className="back" viewTransition>
                <ArrowLeft size="14" /> Back home
              </Link>
              <h2>Projects</h2>
              <p>
                {isLoading
                  ? "Loading your projects..."
                  : `${projects.length} project${projects.length === 1 ? "" : "s"}, including anything the community has shared.`}
              </p>
            </div>
          </div>
          <ProjectGrid
            projects={projects}
            isLoading={isLoading}
            userId={userId}
            isSignedIn={isSignedIn}
            onSignIn={() => signIn()}
          />
        </div>
      </section>
    </div>
  );
}
