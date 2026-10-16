
const cloudinary = require("cloudinary").v2;
const Problem = require("../Models/problem");
const SolutionVideo = require("../Models/video");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Generate Cloudinary upload signature
const generateUploadSignature = async (req, res) => {
  try {
    const { problemId } = req.params;

    const problem = await Problem.findById(problemId);

    if (!problem) {
      return res.status(404).json({
        message: "Problem not found",
      });
    }

    const timestamp = Math.round(Date.now() / 1000);
    const publicId = `leetcode-solutions/${problemId}_${timestamp}`;

    const signature = cloudinary.utils.api_sign_request(
      {
        timestamp,
        public_id: publicId,
      },
      process.env.CLOUDINARY_API_SECRET
    );

    return res.json({
      signature,
      timestamp,
      public_id: publicId,
      api_key: process.env.CLOUDINARY_API_KEY,
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      upload_url: `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/video/upload`,
    });
  } catch (err) {
    console.error("Signature error:", err);
    return res.status(500).json({
      message: "Failed to generate upload signature",
    });
  }
};

// Save uploaded video metadata
const saveVideoMetadata = async (req, res) => {
  try {
    const {
      problemId,
      cloudinaryPublicId,
      secureUrl,
      duration,
    } = req.body;

    if (!problemId || !cloudinaryPublicId || !secureUrl) {
      return res.status(400).json({
        message: "problemId, cloudinaryPublicId and secureUrl are required",
      });
    }

    const problem = await Problem.findById(problemId);

    if (!problem) {
      return res.status(404).json({
        message: "Problem not found",
      });
    }

    const resource = await cloudinary.api.resource(
      cloudinaryPublicId,
      { resource_type: "video" }
    );

    const video = await SolutionVideo.create({
      problemId,
      userId: req.user._id,
      cloudinaryPublicId,
      secureUrl: resource.secure_url || secureUrl,
      duration: resource.duration || duration || 0,
      thumbnailUrl: cloudinary.url(cloudinaryPublicId, {
        resource_type: "video",
        format: "jpg",
      }),
    });

    return res.status(201).json({
      message: "Video solution saved successfully",
      videoSolution: video,
    });
  } catch (err) {
    console.error("Save video error:", err);
    return res.status(500).json({
      message: "Failed to save video metadata",
    });
  }
};

// Get video for a problem
const getVideo = async (req, res) => {
  try {
    const { problemId } = req.params;

    const video = await SolutionVideo.findOne({ problemId })
      .select("secureUrl thumbnailUrl duration");

    if (!video) {
      return res.status(404).json({
        message: "No video found for this problem",
      });
    }

    return res.status(200).json(video);
  } catch (err) {
    console.error("Get video error:", err);
    return res.status(500).json({
      message: "Failed to fetch video",
    });
  }
};

// Delete video
const deleteVideo = async (req, res) => {
  try {
    const { problemId } = req.params;

    const video = await SolutionVideo.findOneAndDelete({ problemId });

    if (!video) {
      return res.status(404).json({
        message: "Video not found",
      });
    }

    await cloudinary.uploader.destroy(video.cloudinaryPublicId, {
      resource_type: "video",
      invalidate: true,
    });

    return res.json({
      message: "Video deleted successfully",
    });
  } catch (err) {
    console.error("Delete video error:", err);
    return res.status(500).json({
      message: "Failed to delete video",
    });
  }
};

module.exports = {
  generateUploadSignature,
  saveVideoMetadata,
  deleteVideo,
  getVideo,
};
