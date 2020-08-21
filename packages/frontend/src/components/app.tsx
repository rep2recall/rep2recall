import { FunctionalComponent, h } from "preact";
import { Route, Router, RouterOnChangeArgs } from "preact-router";
import Home from "../routes/home";
import NotFoundPage from "../routes/notfound";
import Profile from "../routes/profile";
import Header from "./header";

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

    return (
        <div id="app">
            <Header />
            <Router onChange={handleRoute}>
                <Route path="/" component={Home} />
                <Route path="/profile/" component={Profile} user="me" />
                <Route path="/profile/:user" component={Profile} />
                <NotFoundPage default />
            </Router>
        </div>
    );
};

export default App;
