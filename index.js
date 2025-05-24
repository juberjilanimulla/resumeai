import express from "express";
import config from "./config.js";
import dbConnect from "./db.js";
import morgan from "morgan";
import cors from "cors";
import userRoutes from "./routes/userRoutes.js";
import bodyParser from "body-parser";

const app = express();
const port = config.PORT;

//middleware
app.use(express.json());
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.json({ limit: "10mb" }));
app.use(
  morgan(
    ":remote-addr :method :url :status :res[content-length] - :response-time ms"
  )
);

//routes endpoint
app.use("/api/user", userRoutes);

//server connection
dbConnect()
  .then(() => {
    app.listen(port, () => {
      console.log(`server is listening at ${port} `);
    });
  })
  .catch((error) => {
    console.log("unable connect server", error);
  });
