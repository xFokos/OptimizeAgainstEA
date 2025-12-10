import NavigatePageButton from "../components/NavigatePageButton";
import "../Styles/Generic.css"


export default function HomePage() {
    return (
        <div >
            <h1 className="">Welcome to the Home Page</h1>

            <NavigatePageButton
                to="/Settings"
                text="Go to Settings"
                width="200px"
                height="50px"
            />
        </div>
    );
}