import mongoose, { model, Schema } from "mongoose";

const resumeextractSchema = Schema(
  {
    name: String,
    email: String,
    education: [String],
    address: String,
    mobile: [String],
    skills: [String],
    experiencesummary: String,
    yearofexperience: String,
    originalFileName: String,
  },
  { timestamps: true, versionKey: false }
);

function currentLocalTimePlusOffset() {
  const now = new Date();
  const offset = 5.5 * 60 * 60 * 1000;
  return new Date(now.getTime() + offset);
}

resumeextractSchema.pre("save", function (next) {
  const currentTime = currentLocalTimePlusOffset();
  this.createdAt = currentTime;
  this.updatedAt = currentTime;
  next();
});

resumeextractSchema.pre("findOneAndUpdate", function (next) {
  const currentTime = currentLocalTimePlusOffset();
  this.set({ updatedAt: currentTime });
  next();
});

const resumeextractmodel = model("resume", resumeextractSchema);
export default resumeextractmodel;
