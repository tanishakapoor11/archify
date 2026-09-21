import React, { useState } from "react";
import { Box, LogOut } from "lucide-react";
import { Button } from "./ui/Button";
import { Modal } from "./ui/Modal";
import { useOutletContext } from "react-router";

const Navbar = () => {
  const { isSignedIn, userName, signIn, signOut } =
    useOutletContext<AuthContext>();
  const [isLogoutOpen, setIsLogoutOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleAuthClick = async () => {
    if (isSignedIn) return setIsLogoutOpen(true);
    try {
      await signIn();
    } catch (error) {
      console.error("Puter auth failed: ", error);
    }
  };

  const handleConfirmLogout = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
      setIsLogoutOpen(false);
    } catch (error) {
      console.error("Puter auth failed: ", error);
    } finally {
      setIsSigningOut(false);
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
            <li>
              <a href={"#upload"}>Upload</a>
            </li>
            <li>
              <a href={"#projects"}>Projects</a>
            </li>
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

      <Modal
        isOpen={isLogoutOpen}
        onClose={() => !isSigningOut && setIsLogoutOpen(false)}
        labelledBy="logout-modal-title"
      >
        <div className="icon">
          <LogOut className="mark" />
        </div>
        <h3 id="logout-modal-title">Log out of Archify?</h3>
        <p>
          {userName ? `You are signed in as ${userName}. ` : ""}
          Your projects stay saved in your Puter account, and you can sign back
          in at any time.
        </p>
        <div className="actions">
          <Button
            className="confirm"
            disabled={isSigningOut}
            onClick={handleConfirmLogout}
          >
            {isSigningOut ? "Logging out..." : "Log out"}
          </Button>
          <button
            type="button"
            className="cancel"
            disabled={isSigningOut}
            onClick={() => setIsLogoutOpen(false)}
          >
            Cancel
          </button>
        </div>
      </Modal>
    </header>
  );
};

export default Navbar;
