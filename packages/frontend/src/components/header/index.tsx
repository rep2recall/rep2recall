import { MDCRipple } from "@material/ripple";
import { createRef, FunctionalComponent, h } from "preact";
import { useEffect } from "preact/hooks";
import * as style from "./style.css";

interface IProps {
    isDrawer: boolean;
    setDrawer: (d: boolean) => void;
}

const Header: FunctionalComponent<IProps> = ({
    isDrawer,
    setDrawer,
}: IProps) => {
    const btnRef = createRef<HTMLButtonElement>();
    useEffect(() => {
        if (btnRef.current) {
            const iconButtonRipple = new MDCRipple(btnRef.current);
            iconButtonRipple.unbounded = true;
        }
    }, [btnRef]);

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
            <div class="flex-grow"></div>
            <form onSubmit={(e) => e.preventDefault()}>
                <input
                    type="search"
                    autoComplete="off"
                    placeholder="Search items"
                    name="q"
                />
                <button ref={btnRef} class="mdc-icon-button material-icons">
                    search
                </button>
            </form>
        </header>
    );
};

export default Header;
