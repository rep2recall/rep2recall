/* eslint-disable @typescript-eslint/no-unsafe-call */
import { getFiles, setupPrecaching, setupRouting } from "preact-cli/sw/";

setupRouting();
setupPrecaching(getFiles());
