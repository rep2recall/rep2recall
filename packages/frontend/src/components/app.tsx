import { faGithub } from "@fortawesome/free-brands-svg-icons";
import { faComments, faTrashAlt } from "@fortawesome/free-regular-svg-icons";
import { faCog, faPlus, faTasks } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { MDCList } from "@material/list";
import { MDCRipple } from "@material/ripple";
import { Ulid } from "id128";
import { createRef, FunctionalComponent, h } from "preact";
import { Route, route, Router, RouterOnChangeArgs } from "preact-router";
import { Link } from "preact-router/match";
import { useEffect, useState } from "preact/hooks";
import { Provider } from "react-redux";
import NotFoundPage from "../routes/notfound";
import Quiz from "../routes/quiz";
import Settings from "../routes/settings";
import { store } from "../store/layout";
import Header from "./header";
import * as style from "./style.css";

// eslint-disable-next-line
if ((module as any).hot) {
    // tslint:disable-next-line:no-var-requires
    require("preact/debug");
}

const Redirect = ({ to }: { path: string; to: string }) => {
    useEffect(() => {
        route(to);
    }, [to]);

    return null;
};

const DeleteButton = ({
    removePreset,
}: {
    id: string;
    removePreset: () => void;
}) => {
    const btnRef = createRef<HTMLButtonElement>();
    useEffect(() => {
        if (btnRef.current) {
            const iconButtonRipple = new MDCRipple(btnRef.current);
            iconButtonRipple.unbounded = true;
        }
    }, [btnRef.current]);

    return (
        <button
            ref={btnRef}
            class="mdc-icon-button hover:show"
            aria-label="search"
            onClick={() => removePreset()}
        >
            <FontAwesomeIcon
                className="mdc-icon-button__icon"
                size="sm"
                icon={faTrashAlt}
            />
        </button>
    );
};

const App: FunctionalComponent = () => {
    const list = createRef<HTMLElement>();

    useEffect(() => {
        const { current: ls } = list;
        if (ls) {
            const list = MDCList.attachTo(ls);
            list.wrapFocus = true;
        }
    }, [list.current]);

    const [isDrawer, setDrawer] = useState(
        matchMedia("(min-width: 801px)").matches,
    );

    const [currentUrl, setUrl] = useState(location.pathname || "/");
    const [presets, setPresets] = useState<
        {
            id: string;
            name: string;
        }[]
    >([]);

    return (
        <div class={[style.app, ...(isDrawer ? [style.active] : [])].join(" ")}>
            {isDrawer ? (
                <aside class="mdc-drawer">
                    <div class="mdc-drawer__content">
                        <nav ref={list} class="mdc-list">
                            <nav class="mdc-list">
                                <Link
                                    class="mdc-list-item"
                                    activeClassName="mdc-list-item--activated"
                                    href="/quiz"
                                >
                                    <span class="mdc-list-item__ripple"></span>
                                    <FontAwesomeIcon
                                        className="mdc-list-item__graphic"
                                        size="2x"
                                        icon={faComments}
                                    />
                                    <span class="mdc-list-item__text">
                                        Quiz
                                    </span>
                                </Link>

                                {presets.map((p) => (
                                    <div
                                        key={p.id}
                                        class={`mdc-list-item ${
                                            currentUrl === `/quiz/${p.id}`
                                                ? "mdc-list-item--activated"
                                                : ""
                                        }`}
                                    >
                                        <Link
                                            class={`mdc-list-item__text ${style["quiz-preset-link"]}`}
                                            href={`/quiz/${p.id}`}
                                        >
                                            <span class="mdc-list-item__ripple"></span>
                                            <div style={{ width: "3rem" }} />
                                            <span>{p.name}</span>
                                            <div class="flex-grow"></div>
                                        </Link>

                                        <DeleteButton
                                            id={p.id}
                                            removePreset={() => {
                                                setPresets(
                                                    presets.filter(
                                                        (p1) => p1.id !== p.id,
                                                    ),
                                                );
                                            }}
                                        />
                                    </div>
                                ))}

                                {"quiz" ===
                                currentUrl.split("/").filter((s) => s)[0] ? (
                                    <div
                                        class="mdc-list-item"
                                        role="button"
                                        tabIndex={-1}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setPresets([
                                                ...presets,
                                                {
                                                    id: Ulid.generate().toCanonical(),
                                                    name: "Test",
                                                },
                                            ]);
                                        }}
                                    >
                                        <span class="mdc-list-item__ripple"></span>
                                        <FontAwesomeIcon
                                            size="lg"
                                            icon={faPlus}
                                            style={{ width: "3rem" }}
                                        />
                                        <span class="mdc-list-item__text">
                                            Save preset
                                        </span>
                                    </div>
                                ) : null}
                            </nav>

                            <div
                                role="separator"
                                class="mdc-list-divider"
                            ></div>

                            <Link
                                class="mdc-list-item"
                                activeClassName="mdc-list-item--activated"
                                href="/browse"
                            >
                                <span class="mdc-list-item__ripple"></span>
                                <FontAwesomeIcon
                                    className="mdc-list-item__graphic"
                                    size="2x"
                                    icon={faTasks}
                                />
                                <span class="mdc-list-item__text">Browse</span>
                            </Link>
                            <Link
                                class="mdc-list-item"
                                activeClassName="mdc-list-item--activated"
                                href="/settings"
                            >
                                <span class="mdc-list-item__ripple"></span>
                                <FontAwesomeIcon
                                    className="mdc-list-item__graphic"
                                    size="2x"
                                    icon={faCog}
                                />
                                <span class="mdc-list-item__text">
                                    Settings
                                </span>
                            </Link>
                            <a
                                class="mdc-list-item"
                                href="https://github.com/patarapolw/rep2recall"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <span class="mdc-list-item__ripple"></span>
                                <FontAwesomeIcon
                                    className="mdc-list-item__graphic"
                                    size="2x"
                                    icon={faGithub}
                                />
                                <span class="mdc-list-item__text">About</span>
                            </a>
                        </nav>
                    </div>
                </aside>
            ) : null}
            <section class={style.main}>
                <Header {...{ isDrawer, setDrawer }} />
                <article>
                    <Router
                        onChange={(e: RouterOnChangeArgs) => {
                            setUrl(e.url);
                        }}
                    >
                        <Route path="/quiz" component={Quiz} />
                        <Route path="/quiz/:id" component={Quiz} />
                        <Route path="/browse" component={Settings} />
                        <Route path="/settings" component={Settings} />
                        <Redirect path="/" to="/quiz" />
                        <NotFoundPage default />
                    </Router>
                </article>
            </section>
        </div>
    );
};

export default (
    <Provider store={store}>
        <App />
    </Provider>
);
