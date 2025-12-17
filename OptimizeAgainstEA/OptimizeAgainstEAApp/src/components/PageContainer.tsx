// PageContainer.tsx
import React, {type ReactNode } from "react";
import "../styles/Generic.css";

type PageContainerProps = {
    children: ReactNode;
    backgroundImage?: string; // URL or imported image
};

export default function PageContainer({ children, backgroundImage }: PageContainerProps) {
    const containerStyle: React.CSSProperties = {
        backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
    };

    return (
        <div className="page-container" style={containerStyle}>
            {children}
        </div>
    );
}
