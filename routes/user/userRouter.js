import { Router } from "express";
import userjobapplicantsRouter from "./userjobapplicantsRouter.js";

const userRouter = Router();

export default userRouter;

userRouter.use("/jobapplicants", userjobapplicantsRouter);
