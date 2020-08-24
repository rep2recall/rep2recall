import { faCaretDown, faCaretRight } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { MDCRipple } from "@material/ripple";
import { createContext, createRef, FunctionalComponent, h } from "preact";
import { useContext, useEffect, useMemo, useState } from "preact/hooks";

interface ITreeviewState {
    isOpen: boolean;
}

const TreeviewContext = createContext<{
    treeview: {
        [id: string]: ITreeviewState;
    };
    toggleOpenTreeview: (id: string) => void;
}>({
    treeview: {},
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    toggleOpenTreeview: () => {},
});

interface ITreeviewItem {
    id: string;
    name: string;
    content?: ITreeviewItem[];
    isOpen?: boolean;
    toggleOpenTreeview?: (id: string) => void;
}

const TreeviewItem: FunctionalComponent<ITreeviewItem> = ({
    id,
    name,
    content,
    toggleOpenTreeview,
}: ITreeviewItem) => {
    const quiz = useContext(TreeviewContext);
    const isOpen = quiz.treeview[id]?.isOpen || false;

    const btnRef = createRef<HTMLButtonElement>();
    useEffect(() => {
        if (btnRef.current) {
            const iconButtonRipple = new MDCRipple(btnRef.current);
            iconButtonRipple.unbounded = true;
        }
    }, [btnRef.current]);

    return (
        <li>
            <div class="treeview-row">
                <div class="caret">
                    {content ? (
                        <button
                            ref={btnRef}
                            class="mdc-icon-button"
                            aria-label="caret"
                            onClick={() =>
                                toggleOpenTreeview
                                    ? toggleOpenTreeview(id)
                                    : null
                            }
                        >
                            <FontAwesomeIcon
                                className="mdc-icon-button__icon"
                                size="xs"
                                icon={isOpen ? faCaretDown : faCaretRight}
                            />
                        </button>
                    ) : null}
                </div>
                <div class="treeview-text">{name}</div>
            </div>
            {isOpen && content ? (
                <ul>
                    {content.map((node) => (
                        <TreeviewItem
                            key={node.id}
                            {...{ ...node, toggleOpenTreeview }}
                        />
                    ))}
                </ul>
            ) : null}
        </li>
    );
};

interface ITreeview {
    content: ITreeviewItem[];
}

const Treeview: FunctionalComponent<ITreeview> = ({ content }: ITreeview) => {
    const toggleOpenTreeview = (id: string) => {
        const { isOpen } = treeview[id] || {};

        setTreeview({
            ...treeview,
            [id]: {
                isOpen: !isOpen,
            },
        });
    };

    let initialTreeview = {} as Record<
        string,
        {
            isOpen: boolean;
        }
    >;

    const setOpen = (id: string, isOpen: boolean) => {
        initialTreeview = {
            ...initialTreeview,
            [id]: {
                isOpen,
            },
        };
    };

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    initialTreeview = useMemo(() => {
        recursePreferOpen(content, {
            maxDepth: 2,
            setOpen,
        });

        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return JSON.parse(JSON.stringify(initialTreeview));
    }, []);

    const [treeview, setTreeview] = useState<{
        [id: string]: ITreeviewState;
    }>(initialTreeview);

    return (
        <TreeviewContext.Provider
            value={{
                treeview,
                toggleOpenTreeview,
            }}
        >
            <ul class="treeview">
                {content.map((node) => (
                    <TreeviewItem
                        key={node.id}
                        {...{ ...node, toggleOpenTreeview }}
                    />
                ))}
            </ul>
        </TreeviewContext.Provider>
    );
};

export default Treeview;

function recursePreferOpen(
    cs: ITreeviewItem[],
    opts: {
        maxDepth: number;
        setOpen: (id: string, state: boolean) => void;
    },
    _depth = 1,
) {
    if (_depth < opts.maxDepth) {
        for (const d of cs) {
            opts.setOpen(
                d.id,
                typeof d.isOpen === "undefined" ? true : d.isOpen,
            );

            if (d.content) {
                recursePreferOpen(d.content, opts, _depth + 1);
            }
        }
    }
}
