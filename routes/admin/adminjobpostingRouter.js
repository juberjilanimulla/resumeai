import { Router } from "express";
import {
  errorResponse,
  successResponse,
} from "../../helpers/serverResponse.js";
import jobpostingmodel from "../../models/jobpostingmodel.js";

const adminjobpostingRouter = Router();

adminjobpostingRouter.post("/create", createjobpostHandler);
adminjobpostingRouter.post("/getall", getalljobpostHandler);
adminjobpostingRouter.post("/update", updatejobpostHandler);
adminjobpostingRouter.post("/delete", deletejobpostHandler);
adminjobpostingRouter.get("/single", getsinglejobpostHandler);
adminjobpostingRouter.post("/approved/:id", approvedjobpostingHandler);

export default adminjobpostingRouter;

async function createjobpostHandler(req, res) {
  try {
    const role = res.locals && res.locals.role;
    const adminid = res.locals.id;
    if (role !== "Admin") {
      return errorResponse(res, 403, "Unauthorized access - Admins only");
    }

    const { jobtitle, experience, location, jobdescription, salary } = req.body;
    if (!jobtitle || !experience || !location || !jobdescription) {
      return errorResponse(res, 400, "some params are missing");
    }
    const params = {
      jobtitle,
      experience,
      location,
      salary,
      jobdescription,
      approved: true,
      postedBy: adminid,
    };
    const jobposting = await jobpostingmodel.create(params);
    if (!jobposting) {
      return errorResponse(res, 404, "career job add not properly");
    }
    successResponse(res, "success", jobposting);
  } catch (error) {
    console.log("error", error);
    errorResponse(res, 500, "internal server error");
  }
}

async function getalljobpostHandler(req, res) {
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
      const searchFields = ["jobtitle", "jobdescription", "location", "salary"]; // Adjust based on job schema fields
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

    // Aggregation pipeline
    const pipeline = [
      { $match: query }, // Match the query conditions
      { $sort: sortBy }, // Apply sorting
      { $skip: skip }, // Skip for pagination
      { $limit: limit }, // Limit for pagination
      {
        $lookup: {
          from: "users", // Replace with your user collection name
          localField: "postedBy", // Field in jobpostingmodel
          foreignField: "_id", // Field in user model
          as: "userDetails", // Name for joined user details
        },
      },
      {
        $unwind: "$userDetails",
      },
      {
        $project: {
          _id: 1,
          jobtitle: 1,
          experience: 1,
          salary: 1,
          location: 1,
          jobdescription: 1,
          approved: 1,
          createdAt: 1,
          updatedAt: 1,
          email: "$userDetails.email", // Add email from user details
          role: "$userDetails.role", // Include the role of the user
        },
      },
    ];

    // Execute aggregation pipeline
    const jobs = await jobpostingmodel.aggregate(pipeline);

    // Fetch total count for pagination
    const totalCount = await jobpostingmodel.countDocuments(query);
    const totalPages = Math.ceil(totalCount / limit);

    successResponse(res, "Success", { jobs, totalPages });
  } catch (error) {
    console.log("error", error);
    errorResponse(res, 500, "Internal server error");
  }
}

async function updatejobpostHandler(req, res) {
  try {
    const { _id, ...updatedData } = req.body;
    const options = { new: true };
    if (
      !updatedData.jobtitle ||
      !updatedData.experience ||
      !updatedData.location ||
      !updatedData.jobdescription
    ) {
      errorResponse(res, 404, "Some params are missing");
      return;
    }
    const updated = await jobpostingmodel.findByIdAndUpdate(
      _id,
      updatedData,
      options
    );

    successResponse(res, "success Updated", updated);
  } catch (error) {
    console.log("error", error);
    errorResponse(res, 500, "internal server error");
  }
}

async function deletejobpostHandler(req, res) {
  try {
    const { _id } = req.body;
    if (!_id) {
      return errorResponse(res, 400, "some params are missing");
    }
    const jobposting = await jobpostingmodel.findByIdAndDelete({ _id: _id });
    if (!jobposting) {
      return errorResponse(res, 404, "jobposting id not found");
    }
    successResponse(res, "Success");
  } catch (error) {
    console.log("error", error);
    errorResponse(res, 500, "internal server error");
  }
}

async function getsinglejobpostHandler(req, res) {
  try {
    const { id } = req.query;
    if (!id) {
      return errorResponse(res, 404, "some params are missing");
    }
    const jobposting = await jobpostingmodel.findById(id).select(" -_id");
    if (!jobposting) {
      return errorResponse(res, 404, "id not found");
    }
    successResponse(res, "Success", jobposting);
  } catch (error) {
    console.log("error", error);
    errorResponse(res, 500, "internal server error");
  }
}

async function approvedjobpostingHandler(req, res) {
  try {
    const jobpostingid = req.params.id;
    const { approved } = req.body;

    if (typeof approved !== "boolean") {
      return errorResponse(res, 400, "Invalid approved status");
    }

    const updatedUser = await jobpostingmodel.findByIdAndUpdate(
      jobpostingid,
      { approved },
      { new: true }
    );

    if (!updatedUser) {
      return errorResponse(res, 404, "User not found");
    }

    successResponse(
      res,
      "job post  approval status updated successfully",
      updatedUser
    );
  } catch (error) {
    console.log("Error:", error.message);
    return errorResponse(res, 500, "Internal server error");
  }
}
