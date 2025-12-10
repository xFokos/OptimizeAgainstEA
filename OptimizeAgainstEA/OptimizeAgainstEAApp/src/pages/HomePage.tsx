import NavigatePageButton from "../components/NavigatePageButton";
import "../Styles/HomePage.css";

export default function HomePage() {
    return (
        <div className="homepage-container">
            <div className="homepage-content">
                <h1>Optimize Against Evolutionary Algorithms</h1>
                <p className="subtext">
                    Do you have what it takes to outsmart evolutionary algorithms? Test your optimization strategies against some of the most popular EA methods, including Genetic Algorithms, Particle Swarm Optimization, and Differential Evolution.
                </p>

                <NavigatePageButton
                    to="/Settings"
                    text="⇒ Configure Game"
                    width="220px"
                    height="50px"
                />
            </div>
        </div>
    );
}
