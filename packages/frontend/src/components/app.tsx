import { faGithub } from "@fortawesome/free-brands-svg-icons";
import { faComments } from "@fortawesome/free-regular-svg-icons";
import { faCog, faPlus, faTasks } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { MDCList } from "@material/list";
import { createRef, FunctionalComponent, h } from "preact";
import { Route, Router, RouterOnChangeArgs } from "preact-router";
import { Link } from "preact-router/match";
import { useEffect, useState } from "preact/hooks";
import Home from "../routes/home";
import NotFoundPage from "../routes/notfound";
import Profile from "../routes/profile";
import Header from "./header";
import * as style from "./style.css";

// eslint-disable-next-line
if ((module as any).hot) {
    // tslint:disable-next-line:no-var-requires
    require("preact/debug");
}

const App: FunctionalComponent = () => {
    const list = createRef<HTMLElement>();

    useEffect(() => {
        const { current: ls } = list;
        if (ls) {
            const list = MDCList.attachTo(ls);
            list.wrapFocus = true;
        }
    }, [list]);

    const [isDrawer, setDrawer] = useState(
        matchMedia("(min-width: 801px)").matches
    );

    const [currentUrl, setUrl] = useState(location.pathname);
    console.log(currentUrl);

    return (
        <div class={[style.app, ...(isDrawer ? [style.active] : [])].join(" ")}>
            {isDrawer ? (
                <aside class="mdc-drawer" style={{ display: "inline-block" }}>
                    <div class="mdc-drawer__content">
                        <nav ref={list} class="mdc-list">
                            <nav class="mdc-list">
                                <Link
                                    class="mdc-list-item"
                                    activeClassName="mdc-list-item--activated"
                                    href="/"
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
                                {["/", "/quiz"].includes(currentUrl) ? (
                                    <div class="mdc-list-item" role="button">
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
                        <Route path="/" component={Home} />
                        <Route path="/profile/" component={Profile} user="me" />
                        <Route path="/profile/:user" component={Profile} />
                        <NotFoundPage default />
                    </Router>
                </article>
            </section>
        </div>
    );
};

export default App;
