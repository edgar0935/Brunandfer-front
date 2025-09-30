import React from "react";
import "@/styles/loading.css";

const LoadingScreen: React.FC = () => {
  return (
    <div className="splash">
      <div className="splash-backdrop" />

      <div className="logo-wrapper">
        <div className="logo-box">
          <div className="letters">B&amp;F</div>
        </div>
        <div className="subtext">BRUN &amp; FER</div>
      </div>
    </div>
  );
};

export default LoadingScreen;
