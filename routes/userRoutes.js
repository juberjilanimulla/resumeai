import { Router } from "express";
import { errorResponse, successResponse } from "../helpers/serverResponse.js";
import usermodel from "../models/usermodel.js";

const userRoutes = Router();

userRoutes.get("/getall", getallusersHandler);
userRoutes.post("/create", createuserHandler);

export default userRoutes;

async function getallusersHandler(req, res) {
  try {
    const users = await usermodel.find();
    successResponse(res, "success", users);
  } catch (error) {
    console.log("error", error);
    errorResponse(res, 500, "internal server error");
  }
}

async function createuserHandler(req, res) {
  try {
    const { firstname, lastname, email, mobile, password } = req.body;
    if (!firstname || !lastname || !email || !mobile || !password) {
      return errorResponse(res, 400, "some params are missing");
    }
    const params = { firstname, lastname, email, mobile, password };
    const users = await usermodel.create(params);
    successResponse(res, "success", users);
  } catch (error) {
    console.log("error", error);
    errorResponse(res, 500, "internal server error");
  }
}
