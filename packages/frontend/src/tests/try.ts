/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-ignore
import { Ulid } from "id128";

const id = Ulid.generate();
console.log(id.toCanonical());
console.log(id.toRaw());
console.log(id);
