import SidePanelWrapper from "../components/SidePanelWrapper.tsx";
import PageContainer from "../components/PageContainer.tsx";
import "../styles/SettingsPage.css";

export default function SettingsPage() {
    return (
        <PageContainer>
            <div className={"settings-page-container"}>
                <SidePanelWrapper />                
            </div>
        </PageContainer>
    );
}
