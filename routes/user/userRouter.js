import { Router } from "express";
import userjobapplicantsRouter from "./userjobapplicantsRouter.js";
import userjobRouter from "./usersjobRouter.js";

const userRouter = Router();

export default userRouter;

userRouter.use("/jobapplicants", userjobapplicantsRouter);
userRouter.use("/jobs", userjobRouter);
