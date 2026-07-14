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

                {/* Zwei Wege hinein: direkt spielen, oder erst verstehen,
                    wogegen man spielt. */}
                {/* Gleichwertige Einstiege — erst verstehen oder direkt spielen. */}
                <div className="homepage-actions">
                    <NavigatePageButton
                        to="/dashboard?tab=ea"
                        text="What's an EA?"
                        width="220px"
                        height="50px"
                    />
                    <NavigatePageButton
                        to="/dashboard"
                        text="⇒ Configure Game"
                        width="220px"
                        height="50px"
                    />
                </div>
            </div>
        </div>
    );
}
