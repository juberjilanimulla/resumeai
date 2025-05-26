import { Router } from "express";
import {
  errorResponse,
  successResponse,
} from "../../helpers/serverResponse.js";
import cvpdfRouter from "./uploadcvRouter.js";
import jobapplicantsmodel from "../../models/jobapplicantsmodel.js";
import jobpostingmodel from "../../models/jobpostingmodel.js";

const userjobapplicantsRouter = Router();

userjobapplicantsRouter.post("/create", createjobapplicantHandler);
userjobapplicantsRouter.use("/upload", cvpdfRouter);

export default userjobapplicantsRouter;

async function createjobapplicantHandler(req, res) {
  try {
    const userid = res.locals.id;
    const { jobid, name, email, mobile, yearofexperience, termsaccepted } =
      req.body;

    if (!jobid || !name || !email || !mobile || !yearofexperience) {
      return errorResponse(res, 400, "Missing required fields");
    }

    const jobpost = await jobpostingmodel.findById(jobid);
    if (!jobpost) {
      return errorResponse(res, 404, "Job post not found");
    }

    const application = await jobapplicantsmodel.create({
      jobid,
      recruiterid: jobpost.postedBy, // Store the recruiter's ID
      applicantid: userid,
      name,
      email,
      mobile,
      yearofexperience,
      termsaccepted,
    });

    successResponse(res, "Application submitted successfully", application);
  } catch (error) {
    console.log("error", error);
    errorResponse(res, 500, "internal server error");
  }
}
