import serverless from "serverless-http";
import { server } from "../../dist/index.js";

export const handler = serverless(server);
