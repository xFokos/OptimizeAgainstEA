import BG2 from "../assets/TestBG2.jpg";
import SidePanelWrapper from "../components/SidePanelWrapper.tsx";
import ("../styles/Generic.css");

export default function SettingsPage() {


    return (
        <div style={{
            backgroundImage: `url(${BG2})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            width: "100vw",
            height: "100vh"
        }}>
            <SidePanelWrapper ></SidePanelWrapper>
        </div>
    );
}