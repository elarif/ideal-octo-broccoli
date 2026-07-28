import { serve } from "@hono/node-server";
import { Hono } from "hono";
import search from "./routes/search";
import views from "./routes/views";

const app = new Hono();

app.get("/health", (c) => c.json({ status: "ok" }));
app.route("/api/search", search);
app.route("/api/views", views);

serve({ fetch: app.fetch, port: Number(process.env.PORT || 3000) });
