import { Router } from "express";
import {
  errorResponse,
  successResponse,
} from "../../helpers/serverResponse.js";
import jobpostingmodel from "../../models/jobpostingmodel.js";

const userjobRouter = Router();

userjobRouter.get("/", getuserjobsHandler);

export default userjobRouter;

async function getuserjobsHandler(req, res) {
  try {
    const jobs = await jobpostingmodel
      .find({ approved: true })
      .sort("-createdAt");
    if (!jobs) {
      return errorResponse(res, 404, "jobs not found");
    }
    successResponse(res, "success", jobs);
  } catch (error) {
    console.log("error", error);
    errorResponse(res, 500, "internal server error");
  }
}
