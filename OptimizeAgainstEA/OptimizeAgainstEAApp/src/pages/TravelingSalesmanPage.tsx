import TravelingSalesman from "../components/TravelingSalesman";
import PageContainer from "../components/PageContainer.tsx";
import ("../styles/Generic.css")
import BackgroundImage from "../assets/HomePageBG.jpg";
import EAGif from "../assets/TSMEA.gif";

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
                    <img
                        src={EAGif}
                        alt="Animated GIF"
                        style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "contain", // or "cover" if you want it to fill
                        }}
                    />
                </div>
            </div>
        </PageContainer>
    );
}