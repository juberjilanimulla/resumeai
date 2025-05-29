import { Router } from "express";
import adminjobpostingRouter from "./adminjobpostingRouter.js";
import adminjobapplicantsRouter from "./adminjobapplicantsRouter.js";
import adminuserRouter from "./adminuserRouter.js";
import adminresumeextractRouter from "./adminresumeextractRouter.js";
import admindashboardRouter from "./admindashboardRouter.js";

const adminRouter = Router();

export default adminRouter;

adminRouter.use("/jobapplicants", adminjobapplicantsRouter);
adminRouter.use("/jobposting", adminjobpostingRouter);
adminRouter.use("/users", adminuserRouter);
adminRouter.use("/resume", adminresumeextractRouter);
adminRouter.use("/dashboard", admindashboardRouter);
