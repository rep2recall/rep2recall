/* eslint-disable prettier/prettier */
declare module "@fortawesome/react-fontawesome" {
    import {
        FaSymbol,
        FlipProp,
        IconProp,
        PullProp,
        RotateProp,
        SizeProp,
        Transform
    } from "@fortawesome/fontawesome-svg-core";
    import { JSX } from 'preact';

    export function FontAwesomeIcon(props: Props): JSX.Element;

    export interface Props {
        icon: IconProp;
        mask?: IconProp;
        className?: string;
        color?: string;
        spin?: boolean;
        pulse?: boolean;
        border?: boolean;
        fixedWidth?: boolean;
        inverse?: boolean;
        listItem?: boolean;
        flip?: FlipProp;
        size?: SizeProp;
        pull?: PullProp;
        rotation?: RotateProp;
        transform?: string | Transform;
        symbol?: FaSymbol;
        style?: {
            [key: string]: string;
        };
        tabIndex?: number;
        title?: string;
    }
}
