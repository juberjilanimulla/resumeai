import { Router } from "express";
import {
  errorResponse,
  successResponse,
} from "../../helpers/serverResponse.js";
import jobapplicantsmodel from "../../models/jobapplicantsmodel.js";

const adminjobapplicantsRouter = Router();

adminjobapplicantsRouter.post("/getall", getalljobapplicantsHandler);
adminjobapplicantsRouter.post("/delete", deletejobapplicantsHandler);

export default adminjobapplicantsRouter;

async function getalljobapplicantsHandler(req, res) {
  try {
    const role = res.locals.role; // Ensure only admins can access

    if (role !== "Admin") {
      return errorResponse(res, 403, "Unauthorized access - Admins only");
    }

    // Extract pagination, filters, sorting, and search parameters
    const { pageno = 0, filterBy = {}, sortby = {}, search = "" } = req.body;

    const limit = 10; // Number of items per page
    const skip = pageno * limit;

    // Base query for job applicants
    let query = {
      $and: [],
    };

    // Apply filters
    if (filterBy) {
      Object.keys(filterBy).forEach((key) => {
        if (filterBy[key] !== undefined) {
          query.$and.push({ [key]: filterBy[key] });
        }
      });
    }

    // Apply search
    if (search.trim()) {
      // const searchRegex = new RegExp(search.trim(), "i");
      const searchRegex = new RegExp("\\b" + search.trim(), "i");
      const searchConditions = [
        { name: { $regex: searchRegex } },
        { email: { $regex: searchRegex } },
        { "jobs.jobtitle": { $regex: searchRegex } },
      ];
      query.$and.push({ $or: searchConditions });
    }

    // If no filters or search applied, use an empty object for the query
    if (query.$and.length === 0) {
      query = {};
    }

    // Apply sorting
    const sortBy =
      Object.keys(sortby).length !== 0
        ? Object.keys(sortby).reduce((acc, key) => {
            acc[key] = sortby[key] === "asc" ? 1 : -1;
            return acc;
          }, {})
        : { createdAt: -1 }; // Default sorting by most recent applications

    // Aggregation pipeline
    const applicants = await jobapplicantsmodel.aggregate([
      { $match: query },
      {
        $lookup: {
          from: "jobpostings",
          localField: "jobid",
          foreignField: "_id",
          as: "jobs",
        },
      },
      { $unwind: "$jobs" },
      {
        $lookup: {
          from: "users",
          localField: "recruiterid",
          foreignField: "_id",
          as: "applicant",
        },
      },
      { $unwind: "$applicant" },

      {
        $lookup: {
          from: "users",
          localField: "recruiterid",
          foreignField: "_id",
          as: "recruiter",
        },
      },
      {
        $unwind: "$recruiter",
      },

      {
        $project: {
          _id: 1,
          jobid: "$jobid",
          jobtitle: "$jobs.jobtitle",
          location: "$jobs.location",
          name: 1,
          email: 1,
          mobile: 1,
          yearofexperience: 1,
          resume: 1,
          postedBy: "$recruiter.email",
          role: "$recruiter.role",
          createdAt: 1,
          termsaccepted: 1,
        },
      },
      { $sort: sortBy },
      { $skip: skip },
      { $limit: limit },
    ]);

    // Fetch total count for pagination
    const totalCount = await jobapplicantsmodel.countDocuments(query);
    const totalPages = Math.ceil(totalCount / limit);

    // Respond with data
    successResponse(res, "Success", { applicants, totalPages });
  } catch (error) {
    console.error("Error fetching job applicants:", error);
    errorResponse(res, 500, "Internal server error");
  }
}

async function deletejobapplicantsHandler(req, res) {
  try {
    const { _id } = req.body;
    if (!_id) {
      return errorResponse(res, 400, "some params are missing");
    }
    const contactus = await jobapplicantsmodel.findByIdAndDelete({ _id: _id });
    if (!contactus) {
      return errorResponse(res, 404, "contactus id not found");
    }
    successResponse(res, "Success");
  } catch (error) {
    console.log("error", error);
    errorResponse(res, 500, "internal server error");
  }
}
