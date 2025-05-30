import { Router } from "express";
import {
  errorResponse,
  successResponse,
} from "../../helpers/serverResponse.js";
import resumeextractmodel from "../../models/resumeextractmodel.js";
import cvpdfRouter from "./uploadcvRouter.js";

const adminresumeextractRouter = Router();

export default adminresumeextractRouter;
adminresumeextractRouter.post("/", getallresumeextractHandler);
adminresumeextractRouter.use("/upload", cvpdfRouter);


async function getallresumeextractHandler(req, res) {
  try {
    const { pageno = 0, filterBy = {}, sortby = {}, search = "" } = req.body;

    const limit = 10; // Number of items per page
    const skip = pageno * limit;

    // Base query for jobs
    let query = {};

    // Apply filters
    if (filterBy) {
      Object.keys(filterBy).forEach((key) => {
        if (filterBy[key] !== undefined) {
          query[key] = filterBy[key];
        }
      });
    }

    // Apply search
    if (search.trim()) {
      const searchRegex = new RegExp(search.trim(), "i");
      const searchFields = ["name", "mobile", "email", "skills", "address"]; // Adjust based on job schema fields
      const searchConditions = searchFields.map((field) => ({
        [field]: { $regex: searchRegex },
      }));

      query = {
        $and: [{ $or: searchConditions }],
      };
    }

    // Apply sorting
    const sortBy =
      Object.keys(sortby).length !== 0
        ? Object.keys(sortby).reduce((acc, key) => {
            acc[key] = sortby[key] === "asc" ? 1 : -1;
            return acc;
          }, {})
        : { createdAt: -1 }; // Default sorting by most recent jobs

    // Fetch total count for pagination
    const totalCount = await resumeextractmodel.countDocuments(query);
    const totalPages = Math.ceil(totalCount / limit);

    // Fetch paginated jobs
    const resumedata = await resumeextractmodel
      .find(query)
      .sort(sortBy)
      .skip(skip)
      .limit(limit);

    successResponse(res, "Success", { resumedata, totalPages });
  } catch (error) {
    console.log("error", error);
    errorResponse(res, 500, "internal server error");
  }
}
