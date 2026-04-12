import SidePanelWrapper from "../modules/selectProblemPage/components/SidePanelWrapper.tsx";
import PageContainer from "../components/layout/PageContainer.tsx";
import "../styles/specific/SettingsPage.css";

export default function SettingsPage() {
    return (
        <PageContainer>
            <div className={"settings-page-container"}>
                <SidePanelWrapper />                
            </div>
        </PageContainer>
    );
}
