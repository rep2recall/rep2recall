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
    let currentUrl: string;
    const handleRoute = (e: RouterOnChangeArgs) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        currentUrl = e.url;
    };

    const drawer = createRef<HTMLElement>();

    useEffect(() => {
        const { current } = drawer;
        if (current) {
            const list = MDCList.attachTo(current);
            list.wrapFocus = true;
        }
    }, [drawer]);

    const [isDrawer, setDrawer] = useState(
        matchMedia("(min-width: 801px)").matches
    );

    return (
        <div class={[style.app, ...(isDrawer ? [style.active] : [])].join(" ")}>
            {isDrawer ? (
                <aside
                    ref={drawer}
                    class="mdc-drawer"
                    style={{ display: "inline-block" }}
                >
                    <div class="mdc-drawer__content">
                        <nav class="mdc-list">
                            <Link
                                class="mdc-list-item"
                                activeClassName="mdc-list-item--activated"
                                href="/"
                            >
                                <span class="mdc-list-item__ripple"></span>
                                <i
                                    class="material-icons mdc-list-item__graphic"
                                    aria-hidden="true"
                                >
                                    question_answer
                                </i>
                                <span class="mdc-list-item__text">Quiz</span>
                            </Link>
                            <Link
                                class="mdc-list-item"
                                activeClassName="mdc-list-item--activated"
                                href="/browse"
                            >
                                <span class="mdc-list-item__ripple"></span>
                                <i
                                    class="material-icons mdc-list-item__graphic"
                                    aria-hidden="true"
                                >
                                    view_list
                                </i>
                                <span class="mdc-list-item__text">Browse</span>
                            </Link>
                            <Link
                                class="mdc-list-item"
                                activeClassName="mdc-list-item--activated"
                                href="/settings"
                            >
                                <span class="mdc-list-item__ripple"></span>
                                <i
                                    class="material-icons mdc-list-item__graphic"
                                    aria-hidden="true"
                                >
                                    settings
                                </i>
                                <span class="mdc-list-item__text">
                                    Settings
                                </span>
                            </Link>
                        </nav>
                    </div>
                </aside>
            ) : null}
            <section class={style.main}>
                <Header {...{ isDrawer, setDrawer }} />
                <article>
                    <Router onChange={handleRoute}>
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
