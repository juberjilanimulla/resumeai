import { Router } from "express";
import multer from "multer";
import { google } from "googleapis";
import { fileURLToPath } from "url";
import { dirname } from "path";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import mammoth from "mammoth";
import OpenAI from "openai";
import {
  successResponse,
  errorResponse,
} from "../../helpers/serverResponse.js";
import resumeextractmodel from "../../models/resumeextractmodel.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Multer storage
const tempStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tempPath = path.join(__dirname, "../../temp");
    fs.mkdirSync(tempPath, { recursive: true });
    cb(null, tempPath);
  },
  filename: async (req, file, cb) => {
    try {
      const id = Math.floor(Math.random() * 900000) + 1000;
      const ext = path.extname(file.originalname);
      cb(null, `${id}_${ext}`);
    } catch (error) {
      cb(error);
    }
  },
});

function checkPdfFileType(file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExts = /\.(pdf|doc|docx)$/i;
  const allowedMimes = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];
  if (allowedExts.test(ext) && allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only PDF and Word documents (.doc, .docx) are allowed"));
  }
}

const upload = multer({
  storage: tempStorage,
  fileFilter: (req, file, cb) => checkPdfFileType(file, cb),
}).single("resume");

// Google Drive Auth
const credentials = JSON.parse(fs.readFileSync("credentials.json"));
const { client_secret, client_id, redirect_uris } = credentials.installed;

const oAuth2Client = new google.auth.OAuth2(
  client_id,
  client_secret,
  redirect_uris[0]
);
oAuth2Client.setCredentials(JSON.parse(fs.readFileSync("token.json")));
const drive = google.drive({ version: "v3", auth: oAuth2Client });

// OpenAI setup
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Extract text from PDF or DOCX
const extractText = async (filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".pdf") {
    const data = await pdfParse(fs.readFileSync(filePath));
    return data.text;
  } else if (ext === ".docx") {
    const { value } = await mammoth.extractRawText({ path: filePath });
    return value;
  } else {
    throw new Error("Unsupported file type for text extraction");
  }
};

const cvpdfRouter = Router();

cvpdfRouter.post("/", (req, res) => {
  upload(req, res, async (err) => {
    if (err) return errorResponse(res, 400, err.message || "Upload error");

    if (!req.file) return errorResponse(res, 400, "No file was uploaded");

    const tempFilePath = req.file.path;
    const ext = path.extname(tempFilePath).toLowerCase();
    // try {
      // const folderName = "cadilaJobApplicantsResume";
      // const folderQuery = await drive.files.list({
      //   q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      //   fields: "files(id)",
      // });

      // let folderId = folderQuery.data.files[0]?.id;
      // if (!folderId) {
      //   const folder = await drive.files.create({
      //     resource: {
      //       name: folderName,
      //       mimeType: "application/vnd.google-apps.folder",
      //     },
      //     fields: "id",
      //   });
      //   folderId = folder.data.id;
      // }

      // const ext = path.extname(tempFilePath).toLowerCase();
      // const mimeTypeMap = {
      //   ".pdf": "application/pdf",
      //   ".doc": "application/msword",
      //   ".docx":
      //     "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      // };

      // const media = {
      //   mimeType: mimeTypeMap[ext] || "application/octet-stream",
      //   body: fs.createReadStream(tempFilePath),
      // };

      // const uploaded = await drive.files.create({
      //   resource: {
      //     name: req.file.filename,
      //     parents: [folderId],
      //   },
      //   media,
      //   fields: "id, webViewLink",
      // });

      // // Make public
      // try {
      //   await drive.permissions.create({
      //     fileId: uploaded.data.id,
      //     requestBody: {
      //       role: "reader",
      //       type: "anyone",
      //     },
      //   });
      // } catch (permErr) {}

      // Extract resume text
      try{
      const extractedText = await extractText(tempFilePath);

      const prompt = `
You are a resume parsing assistant. From the following extracted text from a document (it may be a resume in PDF or DOC format), extract only the following fields and return them as clean JSON:

Required Fields:
- name (Full name)
- email (Valid email addresses)
- mobile (All phone numbers found)
- address (Present or permanent address if found)
- skills (List of technical, design, and soft skills)
- education (List of degrees with institution and year range if mentioned)
- yearofexperience (Total professional experience in years, approximate if exact not stated)
- experiencesummary (Summarize all job roles and relevant experience in 2-3 lines)

Make sure:
- JSON keys are lowercase and exactly as listed.
- Return a well-formatted JSON object with only the above fields.
- If a field is missing in the text, return it as an empty string or empty array as appropriate.

Text:
"""${extractedText}"""
`;

      const response = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
      });

      let parsedData;
      try {
        parsedData = JSON.parse(response.choices[0].message.content);
      } catch (parseErr) {
        throw new Error("OpenAI response is not valid JSON");
      }
      if (Array.isArray(parsedData.education)) {
        parsedData.education = parsedData.education.map((edu) => {
          if (typeof edu === "object") {
            return `${edu.degree || ""}, ${edu.institution || ""}, ${
              edu.year || ""
            }`.trim();
          }
          return edu;
        });
      }
      if (
        parsedData.skills &&
        typeof parsedData.skills === "object" &&
        !Array.isArray(parsedData.skills)
      ) {
        const allSkills = [];
        Object.values(parsedData.skills).forEach((category) => {
          if (Array.isArray(category)) {
            allSkills.push(...category);
          }
        });
        parsedData.skills = allSkills;
      }
      // Save to MongoDB to get _id
      const resumeDoc = new resumeextractmodel(parsedData);
      await resumeDoc.save();

      // Rename local file with _id
      const renamedFileName = `${resumeDoc._id}${ext}`;
      const renamedFilePath = path.join(path.dirname(tempFilePath), renamedFileName);
      fs.renameSync(tempFilePath, renamedFilePath);

      // Ensure folder exists in Drive
      const folderName = "cadilaJobApplicantsResume";
      const folderQuery = await drive.files.list({
        q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: "files(id)",
      });

      let folderId = folderQuery.data.files[0]?.id;
      if (!folderId) {
        const folder = await drive.files.create({
          resource: {
            name: folderName,
            mimeType: "application/vnd.google-apps.folder",
          },
          fields: "id",
        });
        folderId = folder.data.id;
      }

      const mimeTypeMap = {
        ".pdf": "application/pdf",
        ".doc": "application/msword",
        ".docx":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      };

      const media = {
        mimeType: mimeTypeMap[ext] || "application/octet-stream",
        body: fs.createReadStream(renamedFilePath),
      };

      const uploaded = await drive.files.create({
        resource: {
          name: renamedFileName,
          parents: [folderId],
        },
        media,
        fields: "id, webViewLink",
      });

      await drive.permissions.create({
        fileId: uploaded.data.id,
        requestBody: {
          role: "reader",
          type: "anyone",
        },
      });

      resumeDoc.originalFileName = uploaded.data.webViewLink;
      await resumeDoc.save();

      fs.unlinkSync(renamedFilePath);
      successResponse(res, "Resume uploaded and parsed successfully", resumeDoc);
    } catch (error) {
      console.error("Resume processing error:", error.message);
      if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
      errorResponse(res, 500, "Error processing resume");
    }
  });
});

export default cvpdfRouter;

// import { Router } from "express";
// import multer from "multer";
// import path from "path";
// import fs from "fs";
// import pdfParse from "pdf-parse";
// import OpenAI from "openai";
// import { fileURLToPath } from "url";
// import { dirname } from "path";

// import resumeextractmodel from "../../models/resumeextractmodel.js";
// import jobapplicantsmodel from "../../models/jobapplicantsmodel.js";
// import {
//   successResponse,
//   errorResponse,
// } from "../../helpers/serverResponse.js";
// import getnumber from "../../helpers/helperFunction.js";

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = dirname(__filename);

// const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// // Prompt template
// const generatePrompt = (text) => `
// Extract these fields from this resume:

// - Full name
// - Qualification
// - Address
// - Mobile number
// - Skills (as list)
// - Work experience

// Return in JSON like:
// {
//   "name": "",
//   "qualification": "",
//   "address": "",
//   "mobile": "",
//   "skills": [],
//   "experience": ""
// }

// Resume:
// """
// ${text}
// """`;

// // Multer setup
// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     const folder = path.join(__dirname, "../../pdfs");
//     fs.mkdirSync(folder, { recursive: true });
//     cb(null, folder);
//   },
//   filename: async (req, file, cb) => {
//     const id = await getnumber(req.params.id);
//     const rand = Math.floor(100000 + Math.random() * 900000);
//     const filename = `${id}__${rand}${path.extname(file.originalname)}`;
//     cb(null, filename);
//   },
// });

// const upload = multer({
//   storage,
//   fileFilter: (req, file, cb) => {
//     const ext = path.extname(file.originalname).toLowerCase();
//     if (ext !== ".pdf") {
//       return cb(new Error("Only PDF files allowed"));
//     }
//     cb(null, true);
//   },
// }).single("resume");

// const cvpdfRouter = Router();

// cvpdfRouter.post("/:id", (req, res) => {
//   upload(req, res, async (err) => {
//     if (err) return errorResponse(res, 400, err.message || "Upload failed");
//     if (!req.file) return errorResponse(res, 400, "No resume file uploaded");

//     const filePath = path.join(__dirname, "../../pdfs", req.file.filename);
//     if (!fs.existsSync(filePath)) {
//       return errorResponse(res, 404, "Uploaded PDF not found");
//     }

//     try {
//       const buffer = fs.readFileSync(filePath);
//       const { text } = await pdfParse(buffer);

//       if (!text || text.length < 50) {
//         return errorResponse(res, 400, "Could not extract text from resume");
//       }

//       const prompt = generatePrompt(text);

//       const response = await openai.chat.completions.create({
//         model: "gpt-4",
//         messages: [{ role: "user", content: prompt }],
//       });

//       const extracted = JSON.parse(response.choices[0].message.content);

//       const saved = new resumeextractmodel({
//         name: extracted.name || "",
//         qualification: extracted.qualification || "",
//         address: extracted.address || "",
//         mobile: extracted.mobile || "",
//         skills: extracted.skills || [],
//         experience: extracted.experience || "",
//         resumeFileName: req.file.filename,
//         applicantId: req.params.id,
//       });

//       await saved.save();

//       await jobapplicantsmodel.findByIdAndUpdate(
//         req.params.id,
//         { resume: req.file.filename },
//         { new: true }
//       );

//       successResponse(res, "Resume uploaded & extracted", saved);
//     } catch (error) {
//       console.error("Resume Extraction Error:", error.message);
//       return errorResponse(res, 500, "Resume processing failed");
//     }
//   });
// });

// export default cvpdfRouter;import { Router } from "express";

//////////////////////////////////////////////

/*
import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { dirname } from "path";
import OpenAI from "openai";
import PDFParser from "pdf2json";
import { convert } from "pdf-poppler";
import Tesseract from "tesseract.js";

import getnumber from "../../helpers/helperFunction.js";
import {
  successResponse,
  errorResponse,
} from "../../helpers/serverResponse.js";
import jobapplicantsmodel from "../../models/jobapplicantsmodel.js";
import resumeextractmodel from "../../models/resumeextractmodel.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const generatePrompt = (text) => `
You are a resume parsing assistant. From the following extracted text from a document (it may be a resume in PDF or DOC format), extract only the following fields and return them as clean JSON:

Required Fields:
- name (Full name)
- email (Valid email addresses)
- mobile (All phone numbers found)
- address (Present or permanent address if found)
- skills (List of technical, design, and soft skills)
- education (List of degrees with institution and year range if mentioned)
- yearofexperience (Total professional experience in years, approximate if exact not stated)
- experiencesummary (Summarize all job roles and relevant experience in 2-3 lines)

Make sure:
- JSON keys are lowercase and exactly as listed.
- Return a well-formatted JSON object with only the above fields.
- If a field is missing in the text, return it as an empty string or empty array as appropriate.

Extracted Text:
"""
${text}
"""
`;

function extractEmailDirectlyFromFile(filePath) {
  try {
    const buffer = fs.readFileSync(filePath);
    const text = buffer.toString("utf8");
    const matches = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,7}/g);
    if (matches?.length > 0) {
      console.log("📧 Direct file scan email:", matches[0]);
      return [...new Set(matches.map((e) => e.trim()))];
    }
  } catch (err) {
    console.error("Direct file email extraction failed:", err);
  }
  return [];
}

function extractEmailsFromText(text) {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,7}/g;
  const matches = text.match(emailRegex) || [];
  return [...new Set(matches.map((e) => e.trim()))];
}

function extractPhoneNumbersFromText(text) {
  const normalized = text
    .replace(/[\u202f\u00a0]/g, " ")
    .replace(/491(?=\d{5})/g, "+91")
    .replace(/(\+91[\s\-]?\d{5})[\s\-]?(\d{5})/g, "$1$2")
    .replace(/(\d{5})[\s\-]?(\d{5})/g, "$1$2");

  const matches = normalized.match(/(\+91\d{10}|\b\d{10}\b)/g) || [];

  return [...new Set(matches.map((num) => {
    const digits = num.replace(/[^\d]/g, "");
    if (digits.length === 10) return "+91" + digits;
    if (digits.startsWith("91") && digits.length === 12) return "+" + digits;
    return null;
  }).filter(Boolean))];
}

function extractTextFromPDF(filePath) {
  return new Promise((resolve, reject) => {
    const parser = new PDFParser();
    parser.on("pdfParser_dataError", (err) => reject(err.parserError));
    parser.on("pdfParser_dataReady", (pdfData) => {
      let visibleText = "";
      const pages = pdfData?.formImage?.Pages || [];
      for (const page of pages) {
        for (const textItem of page.Texts) {
          const content = decodeURIComponent(
            textItem.R.map((r) => r.T).join("")
          );
          visibleText += content + " ";
        }
      }

      const fullRaw = JSON.stringify(pdfData);
      const mailtoMatches = fullRaw.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/g);
      if (mailtoMatches?.length > 0) {
        console.log("📩 Email found in PDF metadata:", mailtoMatches[0]);
        visibleText += " " + mailtoMatches[0];
      }

      resolve(visibleText);
    });

    parser.loadPDF(filePath);
  });
}

async function extractTextUsingOCR(filePath) {
  try {
    const outputDir = path.join(__dirname, "../../tempocr");
    fs.mkdirSync(outputDir, { recursive: true });

    const options = {
      format: "jpeg",
      out_dir: outputDir,
      out_prefix: path.basename(filePath, path.extname(filePath)),
      page: null,
    };

    await convert(filePath, options);

    const imagePath = path.join(
      outputDir,
      `${path.basename(filePath, path.extname(filePath))}-1.jpg`
    );

    const { data } = await Tesseract.recognize(imagePath, "eng");
    const ocrText = data.text || "";
    fs.writeFileSync("ocr-output.txt", ocrText);
    return ocrText;
  } catch (err) {
    console.error("OCR failed:", err);
    return "";
  }
}

const pdfStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, "../../pdfs");
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: async (req, file, cb) => {
    const pid = req.params.id;
    const pdfnumber = await getnumber(pid);
    const id = Math.floor(Math.random() * 900000) + 1000;
    const ext = path.extname(file.originalname);
    const filename = `${pdfnumber}__${id}${ext}`;
    cb(null, filename);
  },
});

const upload = multer({
  storage: pdfStorage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const mime = file.mimetype;
    if (ext === ".pdf" && mime === "application/pdf") return cb(null, true);
    cb(new Error("Only PDF files allowed"));
  },
}).single("resume");

const cvpdfRouter = Router();

cvpdfRouter.post("/:id", (req, res) => {
  upload(req, res, async (err) => {
    if (err) return errorResponse(res, 400, err.message);
    if (!req.file) return errorResponse(res, 400, "No file uploaded");

    const filePath = path.join(__dirname, "../../pdfs", req.file.filename);
    const jobid = req.params.id;

    try {
      const pdfText = await extractTextFromPDF(filePath);
      let ocrText = "";

      if (!pdfText || pdfText.trim().length < 30) {
        console.warn("PDF parsing failed. Trying OCR...");
        ocrText = await extractTextUsingOCR(filePath);
      }

      const combinedText = `${pdfText}\n${ocrText}`;
      const fallbackPhones = extractPhoneNumbersFromText(combinedText);
      let fallbackEmails = extractEmailsFromText(combinedText);

      if (fallbackEmails.length === 0) {
        fallbackEmails = extractEmailDirectlyFromFile(filePath);
      }

      if (fallbackEmails.length === 0) {
        const fileBase = path.basename(req.file.originalname, path.extname(req.file.originalname));
        const nameParts = fileBase.split(/[_\s\-]/).filter(Boolean);
        if (nameParts.length >= 2) {
          const guessedEmail = `${nameParts[0].toLowerCase()}${nameParts[1].toLowerCase()}@gmail.com`;
          console.warn("Email not found. Guessing:", guessedEmail);
          fallbackEmails.push(guessedEmail);
        }
      }

      const prompt = generatePrompt(combinedText);
      const response = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
      });

      const raw = response.choices[0].message.content;
      const jsonMatch = raw.match(/\{[\s\S]*?\}/);
      if (!jsonMatch)
        return errorResponse(res, 500, "OpenAI did not return valid JSON");

      let extracted;
      try {
        extracted = JSON.parse(jsonMatch[0]);
      } catch (err) {
        console.error("JSON parse error:", err);
        return errorResponse(res, 500, "Could not parse OpenAI response");
      }

      // ✅ Always override mobile and email with reliable fallback
      if (fallbackPhones.length > 0) {
        console.warn("✅ Forcing fallback mobile override:", fallbackPhones);
        extracted.mobile = fallbackPhones;
      }

      if (fallbackEmails.length > 0) {
        console.warn("✅ Forcing fallback email override:", fallbackEmails[0]);
        extracted.email = fallbackEmails[0];
      }

      // ✅ Fallback for name if OpenAI got it wrong
      if (!extracted.name || extracted.name.length < 3 || extracted.name.toLowerCase().includes("editor")) {
        const fileBase = path.basename(req.file.originalname, path.extname(req.file.originalname));
        const cleanedName = fileBase.replace(/[\-_]/g, " ").replace(/\d+/g, "").trim();
        console.warn("✅ Forcing fallback name from filename:", cleanedName);
        extracted.name = cleanedName;
      }

      const resumeData = new resumeextractmodel({
        name: extracted.name,
        email: extracted.email,
        mobile: extracted.mobile,
        education: extracted.education,
        address: extracted.address,
        skills: extracted.skills,
        experiencesummary: extracted.experiencesummary,
        yearofexperience: extracted.yearofexperience,
        originalFileName: req.file.filename,
      });

      console.log("Final Extracted Email:", extracted.email);
      console.log("Final Extracted Mobile:", extracted.mobile);
      console.log("Final Extracted Name:", extracted.name);

      await resumeData.save();

      await jobapplicantsmodel.findByIdAndUpdate(
        jobid,
        { resume: req.file.filename },
        { new: true }
      );

      successResponse(res, "Resume uploaded and extracted", resumeData);
    } catch (error) {
      console.error("Resume processing failed:", error);
      errorResponse(res, 500, "Resume processing failed");
    }
  });
});

export default cvpdfRouter;

*/

// import Router from "express";
// import multer from "multer";
// import fs from "fs";
// import PDFParser from "pdf2json";
// import { OpenAI } from "openai";
// import resumeextractmodel from "../../models/resumeextractmodel.js";

// const openai = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY, // Set in .env
// });
// const cvpdfRouter = Router();
// const storage = multer.diskStorage({
//   destination: (req, file, cb) => cb(null, 'uploads/'),
//   filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname)
// });
// const upload = multer({ storage });

// cvpdfRouter.post("/:id", upload.single("resume"), async (req, res) => {
//   try {
//     const filePath = req.file.path;
//     const dataBuffer = fs.readFileSync(filePath);
//     const pdfText = (await PDFParser(dataBuffer)).text;

//     const prompt = `
// You are a resume parsing assistant. From the following extracted text, return only the following fields in clean JSON format:

// Fields: name, email, mobile, address, skills, education, yearofexperience, experiencesummary

// If any field is missing, return empty string or empty array.

// Text:
// """
// ${pdfText}
// """`;

//     const completion = await openai.chat.completions.create({
//       model: "gpt-4o",
//       messages: [{ role: "user", content: prompt }],
//       temperature: 0.2,
//     });

//     const extractedData = JSON.parse(
//       completion.choices[0].message.content.trim()
//     );

//     const savedDoc = await resumeextractmodel.create({
//       ...extractedData,
//       originalFileName: req.file.originalname,
//     });

//     fs.unlinkSync(filePath); // clean up uploaded file
//     res
//       .status(200)
//       .json({ message: "Resume parsed and stored", data: savedDoc });
//   } catch (error) {
//     console.error("Error:", error);
//     res.status(500).json({ error: "Resume parsing failed" });
//   }
// });

// export default cvpdfRouter;

// import { Router } from "express";
// import multer from "multer";
// import path from "path";
// import { fileURLToPath } from "url";
// import { dirname } from "path";
// import {
//   successResponse,
//   errorResponse,
// } from "../../helpers/serverResponse.js";
// import getnumber from "../../helpers/helperFunction.js";
// import fs from "fs";
// import jobapplicantsmodel from "../../models/jobapplicantsmodel.js";

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = dirname(__filename);

// function checkPdfFileType(file, cb) {
//   const filetypes = /pdf/;
//   const extname = filetypes.test(
//     path.extname(file.originalname).toLocaleLowerCase()
//   );
//   const mimetype = filetypes.test(file.mimetype);

//   if (mimetype && extname) {
//     return cb(null, true);
//   } else {
//     cb(new Error("Error:PDFs only!"));
//   }
// }

// const pdfStorage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     const uploadPath = path.join(__dirname, "../../pdfs");
//     fs.mkdirSync(uploadPath, { recursive: true }); //ensure directory exists
//     cb(null, uploadPath);
//   },
//   filename: async (req, file, cb) => {
//     try {
//       const pid = req.params.id;
//       const pdfnumber = await getnumber(pid);
//       const id = Math.floor(Math.random() * 900000) + 1000;
//       const ext = path.extname(file.originalname);
//       const filename = `${pdfnumber}__${id}${ext}`;

//       cb(null, filename);
//     } catch (error) {
//       cb(error);
//     }
//   },
// });

// const pdfUpload = multer({
//   storage: pdfStorage,
//   fileFilter: (req, file, cb) => {
//     checkPdfFileType(file, cb);
//   },
// }).single("resume");

// const cvpdfRouter = Router();

// cvpdfRouter.post("/:id", (req, res) => {
//   pdfUpload(req, res, async (err) => {
//     if (err) {
//       return errorResponse(res, 400, err.message || "upload error");
//     }
//     if (!req.file) {
//       return errorResponse(res, 400, "No File was uploaded");
//     }

//     try {
//       const resume = req.file.filename;
//       const jobid = req.params.id;
//       const updatedContactcv = await jobapplicantsmodel.findByIdAndUpdate(
//         jobid,
//         { resume: resume },
//         { new: true }
//       );
//       if (!updatedContactcv) {
//         return errorResponse(res, 404, "contact cv not found");
//       }

//       successResponse(res, "PDF successfully uploaded cv", updatedContactcv);
//     } catch (error) {
//       console.log("error", error);
//       errorResponse(res, 500, "internal server error");
//     }
//   });
// });

// export default cvpdfRouter;
