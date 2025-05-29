import { Router } from "express";
import {
  errorResponse,
  successResponse,
} from "../../helpers/serverResponse.js";
import jobpostingmodel from "../../models/jobpostingmodel.js";
import jobapplicantsmodel from "../../models/jobapplicantsmodel.js";
import resumeextractmodel from "../../models/resumeextractmodel.js";

const admindashboardRouter = Router();

admindashboardRouter.get("/", getdashboardHandler);
export default admindashboardRouter;

async function getdashboardHandler(req, res) {
  try {
    const jobposting = await jobpostingmodel.countDocuments();
    const jobapplicants = await jobapplicantsmodel.countDocuments();
    const resumeextract = await resumeextractmodel.countDocumen({
      approved: true,
    });
    successResponse(res, "success", {
      jobposting,
      jobapplicants,
      resumeextract,
      s,
    });
  } catch (error) {
    console.log("error", error);
    errorResponse(res, 500, "internal server error");
  }
}
