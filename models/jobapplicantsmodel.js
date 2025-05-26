import mongoose, { Schema, model } from "mongoose";

const jobapplicantSchema = new Schema(
  {
    jobid: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "jobposting",
    },
    recruiterid: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
    },
    applicantid: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
    },
    name: { type: String },
    email: { type: String },
    mobile: { type: String },
    yearofexperience: { type: String },
    resume: { type: String, default: "" },
    status: {
      type: String,
      enum: ["pending", "reviewed", "accepted", "rejected"],
      default: "pending",
    },
    termsaccepted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true, versionKey: false }
);

function currentLocalTimePlusOffset() {
  const now = new Date();
  const offset = 5.5 * 60 * 60 * 1000;
  return new Date(now.getTime() + offset);
}

jobapplicantSchema.pre("save", function (next) {
  const currentTime = currentLocalTimePlusOffset();
  this.createdAt = currentTime;
  this.updatedAt = currentTime;
  next();
});

jobapplicantSchema.pre("findOneAndUpdate", function (next) {
  const currentTime = currentLocalTimePlusOffset();
  this.set({ updatedAt: currentTime });
  next();
});

const jobapplicantsmodel = model("jobapplicant", jobapplicantSchema);
export default jobapplicantsmodel;
