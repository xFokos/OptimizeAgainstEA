import { ShooterCanvas } from '../modules/shooterGame/components/ShooterCanvas.tsx';
import PageContainer from "../components/layout/PageContainer.tsx";
import { DNADisplay } from '../modules/shooterGame/components/dnaDisplay.tsx';


export default function ShooterGamePage(){
    return(
        <PageContainer>
            <div style={{display: "flex", height: "90vh" }}>
                    <ShooterCanvas />
                    <DNADisplay/>
            </div>
        </PageContainer>
    );
}