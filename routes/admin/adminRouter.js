import { Router } from "express";
import adminjobpostingRouter from "./adminjobpostingRouter";
import adminjobapplicantsRouter from "./adminjobapplicantsRouter.js";

const adminRouter = Router();

export default adminRouter;

adminRouter.use("/jobapplicants", adminjobapplicantsRouter);
adminRouter.use("/jobposting", adminjobpostingRouter);
