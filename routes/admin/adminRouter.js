import { Router } from "express";
import adminjobpostingRouter from "./adminjobpostingRouter.js";
import adminjobapplicantsRouter from "./adminjobapplicantsRouter.js";

const adminRouter = Router();

export default adminRouter;

adminRouter.use("/jobapplicants", adminjobapplicantsRouter);
adminRouter.use("/jobposting", adminjobpostingRouter);
