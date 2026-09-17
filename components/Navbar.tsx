import React from "react";
import { Box } from "lucide-react";
import { Button } from "./ui/Button";
import { useOutletContext } from "react-router";

const Navbar = () => {
  const { isSignedIn, userName, signIn, signOut } =
    useOutletContext<AuthContext>();
  const handleAuthClick = async () => {
    try {
      await (isSignedIn ? signOut() : signIn());
    } catch (error) {
      console.error("Puter auth failed: ", error);
    }
  };
  return (
    <header className={"navbar"}>
      <nav className={"inner"}>
        <div className={"left"}>
          <div className={"brand"}>
            <Box className={"logo"} />
            <span className={"name"}>Archify</span>
          </div>
          <ul className={"links"}>
            <a href={"#"}>Product</a>
            <a href={"#"}>Pricing</a>
            <a href={"#"}>Community</a>
            <a href={"#"}>Enterprise</a>
          </ul>
        </div>
        <div className={"actions"}>
          {isSignedIn ? (
            <>
              <span className={"greeting"}>
                {userName ? `Hi, ${userName}` : "Signed In"}
              </span>
              <Button size="sm" onClick={handleAuthClick} className="btn">
                Log Out
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                variant="ghost"
                className={"login"}
                onClick={handleAuthClick}
              >
                Log In
              </Button>
              <a href={"#upload"} className={"cta"}>
                {" "}
                Get Started
              </a>
            </>
          )}
        </div>
      </nav>
    </header>
  );
};

export default Navbar;
