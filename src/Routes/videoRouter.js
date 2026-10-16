const express=require('express');
const adminMiddleware=require("../middleware/adminMiddleware");
const videoRouter=express.Router();
const {generateUploadSignature,saveVideoMetadata,deleteVideo,getVideo}=require("../controllers/videoUploader.js");

console.log("adminMiddleware:", typeof adminMiddleware);
console.log("generateUploadSignature:", typeof generateUploadSignature);
console.log("getVideo:", typeof getVideo);
console.log("saveVideoMetadata:", typeof saveVideoMetadata);
console.log("deleteVideo:", typeof deleteVideo);

videoRouter.get("/create/:problemId",adminMiddleware,generateUploadSignature);
videoRouter.get("/getVideo/:problemId",adminMiddleware,getVideo)
videoRouter.post("/save",adminMiddleware,saveVideoMetadata);
videoRouter.get("/delete/:problemId",adminMiddleware,deleteVideo);

module.exports=videoRouter;