import TravelingSalesman from "../components/TravelingSalesman";
import PageContainer from "../components/PageContainer.tsx";
import ("../styles/Generic.css")


export default function TravellingSalesmanPage() {


    return (
        <PageContainer>
            <div className={"settings-page-container"}>
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
                            flex: "0 0 100%", // ~70% width
                            display: "flex",
                            flexDirection: "column",
                            backgroundColor: "rgba(0, 0, 0, 0.2)",
                            borderRight: "2px dashed rgba(0, 0, 0, 1)"
                        }}
                    >
                        <TravelingSalesman />
                    </div>
                </div>
            </div>
        </PageContainer>
    );
}