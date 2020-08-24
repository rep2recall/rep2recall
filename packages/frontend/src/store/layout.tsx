import { createStore } from "redux";

interface IQuizPreset {
    id: string;
    name: string;
}

export interface IStore {
    presets: IQuizPreset[];
}

export interface IActionMap {
    LOAD_PRESETS: IQuizPreset[];
    ADD_PRESET: IQuizPreset;
    REMOVE_PRESET: {
        id: string;
    };
}

export interface IAction<K extends keyof IActionMap> {
    type: K;
    payload: IActionMap[K];
}

const initialState: IStore = {
    presets: [],
};

export const store = createStore<
    IStore,
    IAction<keyof IActionMap>,
    unknown,
    unknown
>((state = initialState, action) => {
    const handler: {
        [type in keyof IActionMap]: (p: IActionMap[type]) => IStore;
    } = {
        LOAD_PRESETS: (p) => {
            return {
                presets: p,
            };
        },
        ADD_PRESET: (p) => {
            return {
                presets: [...state.presets, p],
            };
        },
        REMOVE_PRESET: (p) => {
            return {
                presets: state.presets.filter(({ id }) => id !== p.id),
            };
        },
    };

    const fn = handler[action.type];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return fn ? fn(action.payload as any) : state;
});
