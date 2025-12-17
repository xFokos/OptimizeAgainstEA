import TravelingSalesman from "../components/TravelingSalesman";
import PageContainer from "../components/PageContainer.tsx";
import ("../styles/Generic.css")
import BackgroundImage from "../assets/HomePageBG.jpg";

export default function TravellingSalesmanPage() {


    return (
        <PageContainer backgroundImage={BackgroundImage}>
            <div
                style={{
                    display: "flex",
                    width: "100vw",
                    height: "100vh",
                }}
            >
                {/* LEFT + CENTER: TravelingSalesman */}
                <div
                    style={{
                        flex: "0 0 70%", // ~70% width
                        display: "flex",
                        flexDirection: "column",
                        backgroundColor: "rgba(0, 0, 0, 0.8)",
                        borderRight: "2px dashed rgba(0, 0, 0, 1)"
                    }}
                >
                    <TravelingSalesman />
                </div>

                {/* RIGHT: Placeholder / Extra Content */}
                <div
                    style={{
                        flex: "0 0 30%", // ~30% width
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        padding: 20,
                        boxSizing: "border-box",
                    }}
                >
                    <p>Extra content goes here</p>
                </div>
            </div>
        </PageContainer>
    );
}