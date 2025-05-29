import { Router } from "express";
import {
  errorResponse,
  successResponse,
} from "../../helpers/serverResponse.js";
import usermodel from "../../models/usermodel.js";

const adminuserRouter = Router();

adminuserRouter.get("/", getusersHandler);

export default adminuserRouter;

async function getusersHandler(req, res) {
  try {
    const users = await usermodel.find({ role: "user" });
    successResponse(res, "success", users);
  } catch (error) {
    console.log("error", error);
    errorResponse(res, 500, "internal server error");
  }
}
