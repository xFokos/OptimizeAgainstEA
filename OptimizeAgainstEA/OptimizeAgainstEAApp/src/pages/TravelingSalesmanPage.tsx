import TravelingSalesman from "../modules/tspGame/game/TravelingSalesman.tsx";
import PageContainer from "../components/layout/PageContainer.tsx";
import ("../styles/general/Generic.css")


export default function TravellingSalesmanPage() {


    return (
        <PageContainer>
            <TravelingSalesman />
        </PageContainer>
    );
}