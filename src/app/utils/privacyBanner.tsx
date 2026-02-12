import React, { useEffect, useState } from "react";
import { Button } from "../components/ui/button";
import { X } from "lucide-react";
import { useNavigate } from "react-router-dom";
type ShowBannerProps = {
  onAccept?: () => void;
};

const ShowBanner: React.FC<ShowBannerProps> = ({ onAccept }) => {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const accepted = localStorage.getItem("privacyAccepted");
    if (!accepted) {
      setVisible(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem("privacyAccepted", "true");
    setVisible(false);
    if (onAccept) onAccept();
  };

  const handleClose = () => {
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 animate-slideUp">
      <div className="bg-gray-900 text-white px-6 py-4 shadow-lg">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">

          {/* Text */}
          <p className="text-sm md:text-base text-center md:text-left">
            We use cookies and data to improve your experience.
            Read our{" "}
            <span
              onClick={() => navigate("/privacy-policy")}
              className="underline cursor-pointer hover:text-purple-400"
            >
              Privacy Policy
            </span>.
          </p>

          {/* Buttons */}
          <div className="flex items-center gap-3">
            <Button size="sm" onClick={handleAccept}>
              Accept
            </Button>

            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Animation style */}
      <style>
        {`
          .animate-slideUp {
            animation: slideUp 0.4s ease-out;
          }

          @keyframes slideUp {
            from {
              transform: translateY(100%);
              opacity: 0;
            }
            to {
              transform: translateY(0);
              opacity: 1;
            }
          }
        `}
      </style>
    </div>
  );
};

export default ShowBanner;
