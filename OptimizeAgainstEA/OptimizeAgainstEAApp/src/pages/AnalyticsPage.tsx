import "../styles/AnalyticsPage.css";
import NavigatePageButton from "../components/NavigatePageButton.tsx";


    const AnalyticsPage: React.FC = () => {
        return (
            <div className="layout">
                {/* Left Sidebar */}
                <aside className="sidebar">
                    <h2 className="logo">Analytics</h2>



                    {/* Bottom centered button */}
                    <div className="sidebar-bottom">
                        <NavigatePageButton
                            to={"/"}
                            text={"Home Page"}
                        />
                    </div>
                </aside>

                {/* Main Window Area */}
                <div className="main-window">
                    <header className="top-bar">
                        <h1>Dashboard</h1>
                    </header>

                    {/* Inner Grid */}
                    <div className="window-grid">
                        <section className="window">
                            <h3>Block A</h3>
                            <div className="content-placeholder"></div>
                        </section>

                        <section className="window">
                            <h3>Block B</h3>
                            <div className="content-placeholder"></div>
                        </section>

                        <section className="window wide">
                            <h3>Block C (Wide)</h3>
                            <div className="content-placeholder"></div>
                        </section>

                        <section className="window">
                            <h3>Block D</h3>
                            <div className="content-placeholder"></div>
                        </section>

                        <section className="window">
                            <h3>Block E</h3>
                            <div className="content-placeholder"></div>
                        </section>
                    </div>
                </div>
            </div>
        );
    };

    export default AnalyticsPage;