import { FunctionalComponent, h } from "preact";
import { Link } from "preact-router/match";
import * as style from "./style.css";

interface IProps {
    isDrawer: boolean;
    setDrawer: (d: boolean) => void;
}

const Header: FunctionalComponent<IProps> = ({
    isDrawer,
    setDrawer,
}: IProps) => {
    return (
        <header class={style.header}>
            <button
                class={`hamburger hamburger--arrowturn ${
                    isDrawer ? "is-active" : ""
                }`}
                type="button"
                style={{ transform: "scale(0.6)" }}
                onClick={() => setDrawer(!isDrawer)}
                onKeyPress={() => setDrawer(!isDrawer)}
            >
                <span class="hamburger-box">
                    <span class="hamburger-inner"></span>
                </span>
            </button>
            <h1>Preact App</h1>
            <div class="flex-grow"></div>
            <nav>
                <Link activeClassName={style.active} href="/">
                    Home
                </Link>
                <Link activeClassName={style.active} href="/profile">
                    Me
                </Link>
                <Link activeClassName={style.active} href="/profile/john">
                    John
                </Link>
            </nav>
        </header>
    );
};

export default Header;
