
import PageContainer from "../components/layout/PageContainer.tsx";
import BattleShipsGame from "../modules/BattleShips/BattleShipsGame.tsx";
import ("../styles/general/Generic.css")


export default function BattleShipsPage() {


    return (
        <PageContainer>
            <BattleShipsGame></BattleShipsGame>
        </PageContainer>
    );
}
