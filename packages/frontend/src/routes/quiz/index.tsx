import { faSave, faSearch } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { MDCRipple } from "@material/ripple";
import { createRef, FunctionalComponent, h } from "preact";
import { useEffect, useState } from "preact/hooks";
import Treeview from "../../components/treeview";
import * as style from "./style.css";

interface Props {
    id?: string;
}

const Profile: FunctionalComponent<Props> = ({ id }: Props) => {
    const [q, setQ] = useState(id || "");

    useEffect(() => {
        const q0 = new URL(location.href).searchParams.get("q");
        if (q0) {
            setQ(q0);
        }
    }, []);

    const formRef = createRef<HTMLFormElement>();
    useEffect(() => {
        const { current } = formRef;

        if (current) {
            const rs = Array.from(current.querySelectorAll("button")).map(
                (btn) => {
                    const ripple = new MDCRipple(btn);
                    ripple.unbounded = true;

                    return ripple;
                },
            );

            return () => {
                rs.map((ripple) => ripple.destroy());
            };
        }
    }, [formRef.current]);

    return (
        <div class={style.profile}>
            <form ref={formRef} onSubmit={(e) => e.preventDefault()}>
                <input
                    class="flex-grow"
                    value={q}
                    placeholder="Add filter criteria..."
                    onInput={(e) => setQ((e.target as HTMLInputElement).value)}
                />
                <button
                    class="mdc-icon-button"
                    aria-label="save"
                    type="button"
                    disabled={!id}
                >
                    <FontAwesomeIcon
                        className="mdc-icon-button__icon"
                        size="sm"
                        icon={faSave}
                    />
                </button>
                <button
                    class="mdc-icon-button"
                    aria-label="search"
                    type="submit"
                >
                    <FontAwesomeIcon
                        className="mdc-icon-button__icon"
                        size="sm"
                        icon={faSearch}
                    />
                </button>
            </form>

            <Treeview
                content={[
                    {
                        id: "1",
                        name: "Water",
                    },
                    { id: "2", name: "Coffee" },
                    {
                        id: "3",
                        name: "Tea",
                        content: [
                            {
                                id: "31",
                                name: "Black tea",
                            },
                            {
                                id: "32",
                                name: "White tea",
                            },
                            {
                                id: "33",
                                name: "Green tea",
                                content: [
                                    {
                                        id: "331",
                                        name: "Sencha",
                                    },
                                    {
                                        id: "332",
                                        name: "Matcha",
                                    },
                                ],
                            },
                        ],
                    },
                ]}
            />
        </div>
    );
};

export default Profile;
