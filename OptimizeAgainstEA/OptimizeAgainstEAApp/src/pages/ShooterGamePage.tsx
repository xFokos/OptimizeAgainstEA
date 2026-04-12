import { ShooterCanvas } from '../modules/shooterGame/components/ShooterCanvas.tsx';
import PageContainer from "../components/layout/PageContainer.tsx";


export default function ShooterGamePage(){
    return(
        <PageContainer>
            <div>
                    <ShooterCanvas />
            </div>
        </PageContainer>
    );
}