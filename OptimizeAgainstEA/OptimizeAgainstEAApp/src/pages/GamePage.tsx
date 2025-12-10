import "../styles/App2.css";
//import myGif from "../assets/animation.gif";

export default function GamePage(){
    return <div className="fullpage-container">
        <header className="header">
            Header oben
        </header>

        <main className="content">
            <h1>Foo Optimization </h1>
            <p>Seiteninhalt</p>
        </main>

        <footer className="footer">
            Balken unten
        </footer>
    </div>
}