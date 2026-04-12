import NavigatePageButton from "../components/ui/NavigatePageButton.tsx";
import "../styles/specific/HomePage.css";

export default function HomePage() {
    return (
        <div className="homepage-container">
            <div className="homepage-content">
                <h1>Optimize Against Evolutionary Algorithms</h1>
                <p className="subtext">
                    Do you have what it takes to outsmart evolutionary algorithms?
                </p>

                <NavigatePageButton
                    to="/dashboard"
                    text="⇒ Configure Game"
                    width="220px"
                    height="50px"
                />
            </div>
        </div>
    );
}
