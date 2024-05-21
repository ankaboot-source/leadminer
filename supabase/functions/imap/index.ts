import express from "express";
import cors from "cors";

import { getIMAPConfigFromEmail } from "./controllers.ts";
import { authorizeUser } from "../_shared/middlewares.ts";

const app = express();

app.use(cors());
app.use(express.json());
app.use(authorizeUser);

app.get("/imap/config/:email", getIMAPConfigFromEmail);

app.listen(3000);
