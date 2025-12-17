
import SidePanelWrapper from "../components/SidePanelWrapper.tsx";
import PageContainer from "../components/PageContainer.tsx";
import ("../styles/Generic.css");
import BG2 from "../assets/TestBG2.jpg";

export default function SettingsPage() {


    return (
        <PageContainer backgroundImage={BG2}>
            <SidePanelWrapper />
        </PageContainer>
    );
}