/* eslint-disable @typescript-eslint/no-empty-interface */
declare module "@fortawesome/react-fontawesome" {
    import {
        FaSymbol,
        FlipProp,
        IconProp,
        PullProp,
        RotateProp,
        SizeProp,
        // eslint-disable-next-line prettier/prettier
        Transform
    } from "@fortawesome/fontawesome-svg-core";
    import { JSX } from "preact";

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

declare module "id128" {
    interface IdFactory<T> {
        name: string;

        construct(bytes: Uint8Array): T;
        MIN(options?: unknown): T;
        MAX(options?: unknown): T;

        fromCanonical(canonical: string): T;
        fromCanonicalTrusted(canonical: string): T;
        fromRaw(raw: string): T;
        fromRawTrusted(raw: string): T;

        toCanonical(id: T): string;
        toRaw(id: T): string;

        compare(lhs: Id, rhs: Id): number;
        equal(lhs: Id, rhs: Id): boolean;

        isCanonical(canonical: string): boolean;
        isRaw(raw: string): boolean;
    }

    interface VersionedIdFactory<T> extends IdFactory<T> {
        versioned_ids: Array<IdFactory<T>>;

        MIN(options: VersionOption): T;
        MAX(options: VersionOption): T;
    }

    interface NodeOption {
        node?: Uint8Array | null;
    }

    interface TimeOption {
        time?: Date | number | null;
    }

    interface VersionOption {
        version: 0 | 1 | 4 | 6;
    }

    interface UlidFactory extends IdFactory<Ulid> {
        generate(options?: TimeOption): Ulid;
    }

    interface UlidMonotonicFactory extends IdFactory<UlidMonotonic> {
        generate(options?: TimeOption): UlidMonotonic;
    }

    interface UuidFactory extends VersionedIdFactory<Uuid> {
        generate(options: NodeOption & TimeOption & VersionOption): Uuid;
    }

    interface Uuid1Factory extends IdFactory<Uuid1> {
        generate(options?: NodeOption & TimeOption): Uuid1;
    }

    interface Uuid4Factory extends IdFactory<Uuid4> {
        generate(options?: unknown): Uuid4;
    }

    interface Uuid6Factory extends IdFactory<Uuid6> {
        generate(options?: NodeOption & TimeOption): Uuid6;
    }

    interface UuidNilFactory extends IdFactory<UuidNil> {
        generate(options?: unknown): UuidNil;
    }

    interface Id {
        bytes: Uint8Array;
        [Symbol.toStringTag]: string;

        clone(): this;

        toCanonical(): string;
        toRaw(): string;

        compare(rhs: Id): number;
        equal(rhs: Id): boolean;
    }

    interface Uuid extends Id {
        variant: number;
        version: number;
    }

    interface Ulid extends Id {
        time: Date;
    }

    interface UlidMonotonic extends Id {
        time: Date;
    }

    interface Uuid1 extends Uuid {
        clock_sequence: number;
        hires_time: number;
        node: Uint8Array;
        time: Date;
    }

    interface Uuid4 extends Uuid {}

    interface Uuid6 extends Uuid {
        clock_sequence: number;
        hires_time: number;
        node: Uint8Array;
        time: Date;
    }

    interface UuidNil extends Uuid {}

    interface Id128Error extends Error {}
    interface ClockSequenceOverflow extends Id128Error {}
    interface InvalidBytes extends Id128Error {}
    interface InvalidEncoding extends Id128Error {}
    interface InvalidEpoch extends Id128Error {}
    interface UnsupportedVersion extends Id128Error {}

    export const Ulid: UlidFactory;
    export const UlidMonotonic: UlidMonotonicFactory;
    export const Uuid: UuidFactory;
    export const Uuid1: Uuid1Factory;
    export const Uuid4: Uuid4Factory;
    export const Uuid6: Uuid6Factory;
    export const UuidNil: UuidNilFactory;

    export namespace Exception {
        const Id128Error: Id128Error;
        const ClockSequenceOverflow: ClockSequenceOverflow;
        const InvalidBytes: InvalidBytes;
        const InvalidEncoding: InvalidEncoding;
        const InvalidEpoch: InvalidEpoch;
        const UnsupportedVersion: UnsupportedVersion;
    }
}
