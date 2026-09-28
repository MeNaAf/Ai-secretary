import { withLambda } from "@netlify/aws-lambda-compat";
import serverless from "serverless-http";
import { server } from "../../dist/index.js";

export default withLambda(serverless(server));
